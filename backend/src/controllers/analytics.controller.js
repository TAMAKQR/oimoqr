import { prisma } from '../config/prisma.js';
import { ensureRestaurantOwnerAccess } from '../utils/restaurantAccess.js';

// Получить статистику по ресторану
export const getRestaurantStats = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        businessType: true,
        sharedMenuSourceRestaurantId: true
      }
    });

    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    const menuSourceRestaurantId = restaurant.sharedMenuSourceRestaurantId || restaurant.id;
    const isOnlineStore = restaurant.businessType === 'ONLINE_STORE';

    // Условие для фильтрации заказов:
    // Заказ принадлежит ресторану, если:
    // 1. assignedRestaurantId === restaurantId (приоритет - переназначенные заказы)
    // 2. assignedRestaurantId === null И restaurantId === restaurantId (непереназначенные заказы)
    const orderFilter = {
      OR: [
        { assignedRestaurantId: restaurantId },
        {
          assignedRestaurantId: null,
          restaurantId: restaurantId
        }
      ]
    };

    // Получаем данные параллельно для скорости
    const [
      totalItems,
      totalCategories,
      totalOrders,
      todayOrders,
      weekOrders,
      monthOrders,
      recentOrders,
      topItems,
      revenue
    ] = await Promise.all([
      isOnlineStore
        ? prisma.product.count({
          where: { restaurantId, available: true }
        })
        : prisma.dish.count({
          where: { restaurantId: menuSourceRestaurantId }
        }),

      isOnlineStore
        ? prisma.productCategory.count({
          where: { restaurantId, isActive: true }
        })
        : prisma.category.count({
          where: { restaurantId: menuSourceRestaurantId }
        }),

      // Все заказы (с учетом assignedRestaurantId)
      prisma.order.count({
        where: orderFilter
      }),

      // Заказы за сегодня
      prisma.order.count({
        where: {
          ...orderFilter,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Заказы за текущую неделю (с понедельника)
      prisma.order.count({
        where: {
          ...orderFilter,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - (new Date().getDay() + 6) % 7))
          }
        }
      }),

      // Заказы за текущий месяц (с 1-го числа)
      prisma.order.count({
        where: {
          ...orderFilter,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Последние 5 заказов
      prisma.order.findMany({
        where: orderFilter,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: {
            include: {
              dish: true,
              product: true
            }
          }
        }
      }),

      isOnlineStore
        ? prisma.orderItem.groupBy({
          by: ['productId'],
          where: {
            order: orderFilter,
            productId: { not: null }
          },
          _count: {
            productId: true
          },
          _sum: {
            quantity: true
          },
          orderBy: {
            _sum: {
              quantity: 'desc'
            }
          },
          take: 5
        })
        : prisma.orderItem.groupBy({
          by: ['dishId'],
          where: {
            order: orderFilter,
            dishId: { not: null } // Исключаем удаленные блюда
          },
          _count: {
            dishId: true
          },
          _sum: {
            quantity: true
          },
          orderBy: {
            _sum: {
              quantity: 'desc'
            }
          },
          take: 5
        }),

      // Выручка
      prisma.order.aggregate({
        where: {
          ...orderFilter,
          status: {
            not: 'cancelled'
          }
        },
        _sum: {
          totalAmount: true
        }
      })
    ]);

    // Получаем детали для популярных позиций
    const topItemsDetails = await Promise.all(
      topItems
        .filter(item => isOnlineStore ? item.productId !== null : item.dishId !== null)
        .map(async (item) => {
          const menuItem = isOnlineStore
            ? await prisma.product.findUnique({ where: { id: item.productId } })
            : await prisma.dish.findUnique({ where: { id: item.dishId } });
          if (!menuItem) return null;
          return {
            ...menuItem,
            orderCount: isOnlineStore ? item._count.productId : item._count.dishId,
            totalQuantity: item._sum.quantity
          };
        })
    ).then(results => results.filter(item => item !== null)); // Убираем null значения

    // Выручка за сегодня
    const todayRevenue = await prisma.order.aggregate({
      where: {
        ...orderFilter,
        status: {
          not: 'cancelled'
        },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    // Выручка за текущую неделю (с понедельника)
    const weekRevenue = await prisma.order.aggregate({
      where: {
        ...orderFilter,
        status: {
          not: 'cancelled'
        },
        createdAt: {
          gte: new Date(new Date().setDate(new Date().getDate() - (new Date().getDay() + 6) % 7))
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    // Выручка за текущий месяц (с 1-го числа)
    const monthRevenue = await prisma.order.aggregate({
      where: {
        ...orderFilter,
        status: {
          not: 'cancelled'
        },
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        }
      },
      _sum: {
        totalAmount: true
      }
    });

    // Статистика по дням (последние 30 дней) — одним эффективным SQL-запросом
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const dailyStats = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*)::int as orders,
        COALESCE(SUM(CASE WHEN "status" != 'cancelled' THEN "totalAmount" ELSE 0 END), 0) as revenue
      FROM "Order"
      WHERE ("assignedRestaurantId" = $1 OR ("assignedRestaurantId" IS NULL AND "restaurantId" = $1))
        AND "createdAt" >= $2
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `, restaurantId, thirtyDaysAgo);

    // Заполняем пропущенные дни нулями
    const chartData = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const found = dailyStats.find(s => {
        const sDate = s.date instanceof Date ? s.date.toISOString().split('T')[0] : String(s.date).split('T')[0];
        return sDate === dateStr;
      });
      chartData.push({
        date: dateStr,
        orders: found ? Number(found.orders) : 0,
        revenue: found ? Number(found.revenue) : 0
      });
    }

    res.json({
      overview: {
        totalDishes: totalItems,
        totalCategories,
        totalOrders,
        totalRevenue: revenue._sum.totalAmount || 0
      },
      period: {
        today: {
          orders: todayOrders,
          revenue: todayRevenue._sum.totalAmount || 0
        },
        week: {
          orders: weekOrders,
          revenue: weekRevenue._sum.totalAmount || 0
        },
        month: {
          orders: monthOrders,
          revenue: monthRevenue._sum.totalAmount || 0
        }
      },
      recentOrders: recentOrders.map(order => ({
        id: order.id,
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        totalAmount: order.totalAmount,
        status: order.status,
        itemsCount: order.items.length,
        createdAt: order.createdAt
      })),
      topDishes: topItemsDetails,
      chartData
    });
  } catch (error) {
    console.error('Error fetching restaurant stats:', error);
    next(error);
  }
};

// Получить статистику просмотров
export const getRestaurantViews = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    if (!ensureRestaurantOwnerAccess(req, res, restaurantId)) {
      return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    const [todayViews, weekViews, monthViews, totalViews] = await Promise.all([
      prisma.menuView.count({
        where: {
          restaurantId,
          createdAt: { gte: today }
        }
      }),
      prisma.menuView.count({
        where: {
          restaurantId,
          createdAt: { gte: weekAgo }
        }
      }),
      prisma.menuView.count({
        where: {
          restaurantId,
          createdAt: { gte: monthAgo }
        }
      }),
      prisma.menuView.count({
        where: { restaurantId }
      })
    ]);

    res.json({
      today: todayViews,
      week: weekViews,
      month: monthViews,
      total: totalViews
    });
  } catch (error) {
    next(error);
  }
};
