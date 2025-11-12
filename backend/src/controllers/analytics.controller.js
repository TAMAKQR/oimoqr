import { prisma } from '../config/prisma.js';

// Получить статистику по ресторану
export const getRestaurantStats = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    // Получаем данные параллельно для скорости
    const [
      totalDishes,
      totalCategories,
      totalOrders,
      todayOrders,
      weekOrders,
      monthOrders,
      recentOrders,
      topDishes,
      revenue
    ] = await Promise.all([
      // Общее количество блюд
      prisma.dish.count({
        where: { restaurantId }
      }),

      // Общее количество категорий
      prisma.category.count({
        where: { restaurantId }
      }),

      // Все заказы
      prisma.order.count({
        where: { restaurantId }
      }),

      // Заказы за сегодня
      prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Заказы за текущую неделю (с понедельника)
      prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - (new Date().getDay() + 6) % 7))
          }
        }
      }),

      // Заказы за текущий месяц (с 1-го числа)
      prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
          }
        }
      }),

      // Последние 5 заказов
      prisma.order.findMany({
        where: { restaurantId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          items: {
            include: {
              dish: true
            }
          }
        }
      }),

      // Топ 5 популярных блюд
      prisma.orderItem.groupBy({
        by: ['dishId'],
        where: {
          order: { restaurantId }
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
          restaurantId,
          status: {
            not: 'cancelled'
          }
        },
        _sum: {
          totalAmount: true
        }
      })
    ]);

    // Получаем детали для топ блюд
    const topDishesDetails = await Promise.all(
      topDishes.map(async (item) => {
        const dish = await prisma.dish.findUnique({
          where: { id: item.dishId }
        });
        return {
          ...dish,
          orderCount: item._count.dishId,
          totalQuantity: item._sum.quantity
        };
      })
    );

    // Выручка за сегодня
    const todayRevenue = await prisma.order.aggregate({
      where: {
        restaurantId,
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
        restaurantId,
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
        restaurantId,
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

    // Статистика по дням (последние 7 дней)
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayOrders = await prisma.order.count({
        where: {
          restaurantId,
          createdAt: {
            gte: date,
            lt: nextDate
          }
        }
      });

      const dayRevenue = await prisma.order.aggregate({
        where: {
          restaurantId,
          status: {
            not: 'cancelled'
          },
          createdAt: {
            gte: date,
            lt: nextDate
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      last7Days.push({
        date: date.toISOString().split('T')[0],
        orders: dayOrders,
        revenue: dayRevenue._sum.totalAmount || 0
      });
    }

    res.json({
      overview: {
        totalDishes,
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
      topDishes: topDishesDetails,
      chartData: last7Days
    });
  } catch (error) {
    console.error('Error fetching restaurant stats:', error);
    next(error);
  }
};

// Получить статистику просмотров (заглушка, пока нет трекинга)
export const getRestaurantViews = async (req, res, next) => {
  try {
    const { restaurantId } = req.params;

    // Пока возвращаем mock данные
    // TODO: Реализовать трекинг просмотров в будущем
    res.json({
      today: Math.floor(Math.random() * 100) + 50,
      week: Math.floor(Math.random() * 500) + 300,
      month: Math.floor(Math.random() * 2000) + 1000,
      total: Math.floor(Math.random() * 10000) + 5000
    });
  } catch (error) {
    next(error);
  }
};