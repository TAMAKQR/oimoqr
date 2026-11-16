import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  override: true,
});

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl || !['localhost', '127.0.0.1', '::1'].includes(new URL(databaseUrl).hostname)) {
  throw new Error('Demo data can only be seeded into a local database.');
}

const prisma = new PrismaClient();
const ownerPassword = 'Demo2026!';
const customerPassword = 'Guest2026!';
const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const alwaysOpen = Object.fromEntries(
  days.map((day) => [day, { open: '00:00', close: '23:59', isOpen: true }])
);

const restaurantHours = Object.fromEntries(
  days.map((day) => [
    day,
    {
      open: day === 'sunday' ? '11:00' : '10:00',
      close: day === 'sunday' ? '21:00' : '22:00',
      isOpen: true,
    },
  ])
);

const demoBusinesses = [
  {
    email: 'hotel.demo@oimoqr.local',
    ownerName: 'Демо-владелец отеля',
    ownerPhone: '+996700000101',
    businessType: 'HOTEL',
    restaurant: {
      name: 'Демо-отель «Ала-Тоо»',
      subdomain: 'demo-hotel',
      description: 'Тестовый отель с меню для заказа еды прямо в номер.',
      phone: '+996700000111',
      address: 'ул. Киевская, 100',
      city: 'Бишкек',
      country: 'Кыргызстан',
      currency: 'KGS',
      defaultLanguage: 'ru',
      cardStyle: 'vertical',
      deliveryEnabled: false,
      workingHours: JSON.stringify(alwaysOpen),
    },
    socialLinks: { whatsapp: '996700000111', instagram: 'demo_alatoo_hotel' },
    customer: {
      phone: '+996700000921',
      name: 'Тестовый гость отеля',
      email: 'guest.hotel@oimoqr.local',
    },
    categories: [
      {
        name: 'Завтрак в номер',
        description: 'Завтраки, которые подадим в ваш номер.',
        dishes: [
          {
            name: 'Завтрак «Ала-Тоо»',
            description: 'Яйца, сосиски, свежие овощи, хлеб и чай.',
            price: 650,
            badge: 'Популярное',
            modifiers: [{
              name: 'Напиток к завтраку',
              type: 'single',
              isRequired: true,
              options: [{ name: 'Чёрный чай', price: 0 }, { name: 'Кофе американо', price: 40 }],
            }],
          },
          { name: 'Омлет с овощами', description: 'Омлет из трёх яиц с сезонными овощами.', price: 320 },
          { name: 'Сырники со сметаной', description: 'Домашние сырники с ягодным соусом.', price: 340 },
        ],
      },
      {
        name: 'Горячие блюда',
        description: 'Сытные блюда для обеда и ужина.',
        dishes: [
          { name: 'Куриное филе с картофелем', description: 'Филе на гриле, картофель и соус.', price: 620 },
          { name: 'Манты ручной лепки', description: 'Пять мантов с говядиной и сметаной.', price: 580 },
          { name: 'Паста с грибами', description: 'Паста в сливочном соусе с шампиньонами.', price: 540 },
        ],
      },
      {
        name: 'Напитки',
        description: 'Горячие и прохладительные напитки.',
        dishes: [
          {
            name: 'Капучино',
            description: 'Эспрессо с молочной пеной.',
            price: 220,
            modifiers: [{
              name: 'Объём',
              type: 'single',
              isRequired: true,
              options: [{ name: '250 мл', price: 0 }, { name: '350 мл', price: 50 }],
            }],
          },
          { name: 'Горный чай', description: 'Чёрный чай с мёдом и лимоном.', price: 150 },
          { name: 'Апельсиновый фреш', description: 'Свежевыжатый апельсиновый сок, 300 мл.', price: 260 },
        ],
      },
      {
        name: 'Десерты',
        dishes: [
          { name: 'Медовик', description: 'Медовый торт со сметанным кремом.', price: 280 },
          { name: 'Фруктовая тарелка', description: 'Сезонные свежие фрукты.', price: 420 },
        ],
      },
    ],
    orders: [
      {
        orderNumber: 'DEMO-HOTEL-001',
        status: 'new',
        deliveryType: 'dine_in',
        tableNumber: '204',
        items: [{ name: 'Завтрак «Ала-Тоо»', quantity: 1 }, { name: 'Капучино', quantity: 1 }],
      },
      {
        orderNumber: 'DEMO-HOTEL-002',
        status: 'completed',
        deliveryType: 'dine_in',
        tableNumber: '108',
        items: [{ name: 'Манты ручной лепки', quantity: 1 }, { name: 'Горный чай', quantity: 1 }],
      },
    ],
  },
  {
    email: 'restaurant.demo@oimoqr.local',
    ownerName: 'Демо-владелец ресторана',
    ownerPhone: '+996700000102',
    businessType: 'RESTAURANT',
    restaurant: {
      name: 'Демо-ресторан «Оймо»',
      subdomain: 'demo-restaurant',
      description: 'Тестовое меню кафе с доставкой, самовывозом и заказами в зале.',
      phone: '+996700000112',
      address: 'пр. Чуй, 150',
      city: 'Бишкек',
      country: 'Кыргызстан',
      currency: 'KGS',
      defaultLanguage: 'ru',
      cardStyle: 'grid',
      deliveryEnabled: true,
      deliveryFee: 150,
      minOrderAmount: 400,
      freeDeliveryThreshold: 2000,
      deliveryRadius: 10,
      workingHours: JSON.stringify(restaurantHours),
      deliveryHours: JSON.stringify(restaurantHours),
    },
    socialLinks: { whatsapp: '996700000112', instagram: 'demo_oimoqr_cafe' },
    customer: {
      phone: '+996700000922',
      name: 'Тестовый гость ресторана',
      email: 'guest.restaurant@oimoqr.local',
    },
    categories: [
      {
        name: 'Закуски',
        dishes: [
          { name: 'Брускетта с томатами', description: 'Поджаренный хлеб, томаты и базилик.', price: 320 },
          { name: 'Самса с говядиной', description: 'Слоёная самса с сочной говядиной.', price: 180 },
          { name: 'Сырная тарелка', description: 'Ассорти сыров, мёд и орехи.', price: 590 },
        ],
      },
      {
        name: 'Салаты',
        dishes: [
          { name: 'Цезарь с курицей', description: 'Курица, салат романо, гренки и соус цезарь.', price: 420 },
          { name: 'Греческий салат', description: 'Овощи, фета, маслины и оливковое масло.', price: 360 },
          { name: 'Салат из свежих овощей', description: 'Огурцы, томаты, зелень и сезонная заправка.', price: 280 },
        ],
      },
      {
        name: 'Горячее',
        dishes: [
          { name: 'Плов по-домашнему', description: 'Рис, говядина, морковь и специи.', price: 420, badge: 'Хит' },
          { name: 'Лагман', description: 'Домашняя лапша с говядиной и овощами.', price: 390 },
          { name: 'Стейк из говядины', description: 'Стейк с картофелем и перечным соусом.', price: 850 },
        ],
      },
      {
        name: 'Пицца',
        dishes: [
          { name: 'Маргарита', description: 'Томаты, моцарелла и базилик.', price: 590 },
          {
            name: 'Пепперони',
            description: 'Томатный соус, моцарелла и пепперони.',
            price: 690,
            modifiers: [{
              name: 'Размер пиццы',
              type: 'single',
              isRequired: true,
              options: [{ name: '30 см', price: 0 }, { name: '40 см', price: 250 }],
            }],
          },
        ],
      },
      {
        name: 'Напитки',
        dishes: [
          { name: 'Ягодный лимонад', description: 'Домашний лимонад с ягодами, 400 мл.', price: 190 },
          { name: 'Капучино', description: 'Эспрессо с молочной пеной.', price: 210 },
          { name: 'Чёрный чай', description: 'Листовой чайник чёрного чая.', price: 100 },
        ],
      },
      {
        name: 'Десерты',
        dishes: [
          { name: 'Медовик', description: 'Медовый торт со сметанным кремом.', price: 270 },
          { name: 'Чизкейк', description: 'Классический чизкейк с ягодным соусом.', price: 290 },
        ],
      },
    ],
    orders: [
      {
        orderNumber: 'DEMO-RESTAURANT-001',
        status: 'new',
        deliveryType: 'delivery',
        deliveryAddress: 'г. Бишкек, пр. Чуй, 120',
        items: [{ name: 'Плов по-домашнему', quantity: 2 }, { name: 'Ягодный лимонад', quantity: 2 }],
      },
      {
        orderNumber: 'DEMO-RESTAURANT-002',
        status: 'completed',
        deliveryType: 'dine_in',
        tableNumber: '5',
        items: [{ name: 'Цезарь с курицей', quantity: 1 }, { name: 'Медовик', quantity: 1 }],
      },
    ],
  },
];

async function upsertModifier(dishId, modifierData) {
  const existing = await prisma.modifier.findFirst({
    where: { dishId, name: modifierData.name },
  });
  const modifier = existing
    ? await prisma.modifier.update({
      where: { id: existing.id },
      data: { type: modifierData.type, isRequired: modifierData.isRequired },
    })
    : await prisma.modifier.create({
      data: {
        dishId,
        name: modifierData.name,
        type: modifierData.type,
        isRequired: modifierData.isRequired,
      },
    });

  for (const option of modifierData.options) {
    const existingOption = await prisma.modifierOption.findFirst({
      where: { modifierId: modifier.id, name: option.name },
    });
    const data = { price: option.price };
    if (existingOption) {
      await prisma.modifierOption.update({ where: { id: existingOption.id }, data });
    } else {
      await prisma.modifierOption.create({
        data: { modifierId: modifier.id, name: option.name, ...data },
      });
    }
  }
}

async function seedBusiness(business, ownerPasswordHash, customerPasswordHash) {
  const user = await prisma.user.upsert({
    where: { email: business.email },
    update: { name: business.ownerName, phone: business.ownerPhone, password: ownerPasswordHash, isAdmin: false },
    create: {
      email: business.email,
      name: business.ownerName,
      phone: business.ownerPhone,
      password: ownerPasswordHash,
    },
  });

  const existingRestaurant = await prisma.restaurant.findUnique({
    where: { subdomain: business.restaurant.subdomain },
  });
  if (existingRestaurant && existingRestaurant.ownerId !== user.id) {
    throw new Error(`Subdomain "${business.restaurant.subdomain}" is already owned by another user.`);
  }

  const restaurant = existingRestaurant
    ? await prisma.restaurant.update({
      where: { id: existingRestaurant.id },
      data: { ...business.restaurant, businessType: business.businessType },
    })
    : await prisma.restaurant.create({
      data: {
        ...business.restaurant,
        businessType: business.businessType,
        ownerId: user.id,
      },
    });

  await prisma.socialLink.upsert({
    where: { restaurantId: restaurant.id },
    update: business.socialLinks,
    create: { ...business.socialLinks, restaurantId: restaurant.id },
  });

  const dishesByName = new Map();
  for (const [categoryOrder, categoryData] of business.categories.entries()) {
    const existingCategory = await prisma.category.findFirst({
      where: { restaurantId: restaurant.id, name: categoryData.name },
    });
    const category = existingCategory
      ? await prisma.category.update({
        where: { id: existingCategory.id },
        data: { description: categoryData.description || null, order: categoryOrder },
      })
      : await prisma.category.create({
        data: {
          name: categoryData.name,
          description: categoryData.description || null,
          order: categoryOrder,
          restaurantId: restaurant.id,
        },
      });

    for (const [dishOrder, dishData] of categoryData.dishes.entries()) {
      const { modifiers = [], ...dishFields } = dishData;
      const existingDish = await prisma.dish.findFirst({
        where: { restaurantId: restaurant.id, categoryId: category.id, name: dishFields.name },
      });
      const dish = existingDish
        ? await prisma.dish.update({
          where: { id: existingDish.id },
          data: { ...dishFields, order: dishOrder, available: true },
        })
        : await prisma.dish.create({
          data: {
            ...dishFields,
            order: dishOrder,
            available: true,
            categoryId: category.id,
            restaurantId: restaurant.id,
          },
        });

      dishesByName.set(dish.name, dish);
      for (const modifier of modifiers) {
        await upsertModifier(dish.id, modifier);
      }
    }
  }

  const languages = ['ru'];
  for (const [order, languageCode] of languages.entries()) {
    await prisma.restaurantLanguage.upsert({
      where: { restaurantId_languageCode: { restaurantId: restaurant.id, languageCode } },
      update: { isEnabled: true, order },
      create: { restaurantId: restaurant.id, languageCode, isEnabled: true, order },
    });
  }

  const matchingTier = await prisma.pricingTier.findFirst({
    where: { businessType: business.businessType, isActive: true },
    orderBy: { order: 'asc' },
  }) || await prisma.pricingTier.findFirst({
    where: { businessType: 'ALL', isActive: true },
    orderBy: { order: 'asc' },
  });
  const startsAt = new Date();
  const endsAt = new Date(startsAt.getTime() + 365 * 24 * 60 * 60 * 1000);
  const subscriptionData = {
    plan: 'TRIAL',
    status: 'TRIAL',
    source: 'MANUAL',
    trialEndsAt: endsAt,
    currentPeriodStart: startsAt,
    currentPeriodEnd: endsAt,
    pricingTierId: matchingTier?.id || null,
  };
  await prisma.subscription.upsert({
    where: { userId_restaurantId: { userId: user.id, restaurantId: restaurant.id } },
    update: subscriptionData,
    create: { ...subscriptionData, userId: user.id, restaurantId: restaurant.id },
  });

  const existingCustomer = await prisma.customer.findUnique({
    where: { phone: business.customer.phone },
  });
  if (existingCustomer?.registeredRestaurantId
    && existingCustomer.registeredRestaurantId !== restaurant.id) {
    throw new Error(`Demo customer phone "${business.customer.phone}" is already used by another restaurant.`);
  }
  const customer = await prisma.customer.upsert({
    where: { phone: business.customer.phone },
    update: {
      name: business.customer.name,
      email: business.customer.email,
      password: customerPasswordHash,
      registeredRestaurantId: restaurant.id,
    },
    create: {
      ...business.customer,
      password: customerPasswordHash,
      registeredRestaurantId: restaurant.id,
    },
  });

  for (const [orderIndex, orderData] of business.orders.entries()) {
    const existingOrder = await prisma.order.findUnique({
      where: { orderNumber: orderData.orderNumber },
    });
    if (existingOrder) {
      if (existingOrder.restaurantId !== restaurant.id) {
        throw new Error(`Demo order "${orderData.orderNumber}" belongs to another restaurant.`);
      }
      continue;
    }

    const items = orderData.items.map((item) => {
      const dish = dishesByName.get(item.name);
      if (!dish) throw new Error(`Demo dish "${item.name}" was not found.`);
      return {
        dishId: dish.id,
        dishName: dish.name,
        quantity: item.quantity,
        price: dish.price,
      };
    });

    await prisma.order.create({
      data: {
        orderNumber: orderData.orderNumber,
        customerName: business.customer.name,
        customerPhone: business.customer.phone,
        customerEmail: business.customer.email,
        customerId: customer.id,
        restaurantId: restaurant.id,
        deliveryType: orderData.deliveryType,
        deliveryAddress: orderData.deliveryAddress,
        tableNumber: orderData.tableNumber,
        status: orderData.status,
        paymentMethod: 'cash',
        notes: `Демо-заказ ${orderIndex + 1} для проверки локального проекта.`,
        totalAmount: items.reduce((total, item) => total + item.price * item.quantity, 0),
        createdAt: new Date(Date.now() - orderIndex * 24 * 60 * 60 * 1000),
        items: { create: items },
      },
    });
  }

  return {
    email: business.email,
    restaurantName: restaurant.name,
    subdomain: restaurant.subdomain,
    businessType: business.businessType,
    categoryCount: business.categories.length,
    dishCount: business.categories.reduce((total, category) => total + category.dishes.length, 0),
  };
}

async function main() {
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 10);
  const customerPasswordHash = await bcrypt.hash(customerPassword, 10);
  const results = [];

  for (const business of demoBusinesses) {
    results.push(await seedBusiness(business, ownerPasswordHash, customerPasswordHash));
  }

  console.log('Demo hotel and restaurant are ready in the local database.');
  for (const result of results) {
    console.log(`\n${result.businessType}: ${result.restaurantName}`);
    console.log(`Owner: ${result.email} / ${ownerPassword}`);
    console.log(`Menu: http://localhost:5173/menu/${result.subdomain}`);
    console.log(`Menu data: ${result.categoryCount} categories, ${result.dishCount} dishes`);
  }
  console.log(`\nCustomer password: ${customerPassword}`);
  console.log('Hotel guest phone: +996700000921');
  console.log('Restaurant guest phone: +996700000922');
}

main()
  .catch((error) => {
    console.error('Failed to seed demo businesses:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
