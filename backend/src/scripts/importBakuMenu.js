import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function importBakuMenu() {
  try {
    console.log('🌱 Importing Baku restaurant menu...');

    // Create restaurant owner
    const owner = await prisma.user.upsert({
      where: { email: 'baku@restaurant.com' },
      update: {},
      create: {
        email: 'baku@restaurant.com',
        password: await bcrypt.hash('baku123', 10),
        name: 'Baku Owner',
        phone: '+905545334946'
      }
    });
    console.log('✅ Owner created/updated');

    // Create restaurant
    const restaurant = await prisma.restaurant.upsert({
      where: { subdomain: 'baku' },
      update: {},
      create: {
        name: 'Baku',
        subdomain: 'baku',
        address: 'Barbaros Cd',
        phone: '+905545334946',
        whatsapp: '905545334946',
        currency: '₺',
        owner: {
          connect: { id: owner.id }
        },
        subscription: {
          create: {
            plan: 'PREMIUM',
            status: 'ACTIVE',
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
          }
        }
      }
    });
    console.log('✅ Restaurant created/updated');

    // Categories with dishes
    const categoriesData = [
      {
        name: 'Холодные закуски',
        description: 'Холодные закуски',
        dishes: [
          { name: 'Домашнее соленье – 200 г', price: 250 },
          { name: 'Лимон', price: 50 },
          { name: 'Сельдь с картошкой – 200 г', price: 350 },
          { name: 'Сёмга слабосолёная – 100 г', price: 370 },
          { name: 'Сырная тарелка – 200 г', price: 240 },
          { name: 'Бакинский букет – 350 г', description: 'Помидоры, огурцы, зелень, ассорти перца, редис', price: 280 },
          { name: 'Лобио по-азербайджански – 200 г', description: 'Красная фасоль, кинза, чеснок, грецкие орехи', price: 350 }
        ]
      },
      {
        name: 'Горячие закуски',
        description: 'Горячие закуски',
        dishes: [
          { name: 'Кутабы по 1 шт', description: 'Выберите начинку', price: 0 },
          { name: 'Пирожки – 1 шт', description: 'Выберите начинку', price: 0 }
        ]
      },
      {
        name: 'Салаты',
        description: 'Салаты',
        dishes: [
          { name: 'Цезарь с курицей – 250 г', price: 390 },
          { name: 'Цезарь с семгой – 250 г', price: 390 },
          { name: 'Салат с телячьим языком и рукколой – 250 г', description: 'Руккола, помидоры, орехи кешью, телячий язык, заправка', price: 370 },
          { name: 'Салат из свеклы – 250 г', description: 'Запечённая свекла, козий сыр, микс салата, орехи кешью, заправка', price: 390 },
          { name: 'Салат от Шефа – 250 г', description: 'Баранина, руккола, гранат, кинза, помидоры, огурцы, красный лук, гранатовый соус', price: 380 },
          { name: 'Салат Баку – 250 г', description: 'Семга, микс салата, сырные шарики с кедровыми орехами, медово-лимонный соус', price: 390 },
          { name: 'Цезарь с креветками – 250 г', price: 410 },
          { name: 'Капрезе – 250 г', description: 'Помидоры, моцарелла, песто', price: 270 },
          { name: 'Салат с морепродуктами – 250 г', description: 'Микс морепродуктов, микс салата, соевый соус', price: 440 },
          { name: 'Греческий салат – 250 г', description: 'Помидоры, огурцы, болгарский перец, красный лук, сыр Фета, оливки', price: 290 },
          { name: 'Хрустящие баклажаны – 200 г', description: 'Баклажаны, помидоры, кинза, кисло-сладкий соус', price: 320 },
          { name: 'Чобан-салат – 200 г', description: 'Помидоры, огурцы, красный лук, сыр, зелень', price: 280 }
        ]
      },
      {
        name: 'Первые блюда',
        description: 'Первые блюда',
        dishes: [
          { name: 'Кюфта бозбаш – 400 г', description: 'Бараний фарш, картофель, нут', price: 380 },
          { name: 'Пити – 350 г', description: 'Баранина, каштаны, мята, сумах', price: 390 },
          { name: 'Суп с лапшой и курицей – 350 г', price: 390 },
          { name: 'Хашлама – 350 г', description: 'Баранина, овощи, зелень, албухара', price: 350 },
          { name: 'Крем-суп грибной – 300 г', price: 280 },
          { name: 'Крем-суп тыквенный – 300 г', price: 280 },
          { name: 'Харчо – 300 г', description: 'Говядина, рис, специи, томат', price: 310 },
          { name: 'Довга – 300 г', description: 'Варёный мацони с зеленью', price: 210 },
          { name: 'Дюшбара «Бакинская» – 350 г', description: 'Мини-равиоли в бульоне', price: 330 },
          { name: 'Соютма – 350 г', description: 'Баранья маца в бульоне', price: 380 },
          { name: 'Борщ – 300 г', price: 310 },
          { name: 'Окрошка – 300 г', price: 250 }
        ]
      },
      {
        name: 'Основные блюда',
        description: 'Основные блюда',
        dishes: [
          { name: 'Шах-плов – 350 г', description: 'Рис, мясо, сухофрукты, шафран, лаваш', price: 390 },
          { name: 'Хинкали по-грузински – 1 шт', description: 'Говядина, баранина', price: 75 },
          { name: 'Долма – 200 г', description: 'Фарш, рис, зелень в виноградных листьях', price: 340 },
          { name: 'Казан-кебаб – 300 г', description: 'Баранина, картофель', price: 380 },
          { name: 'Сыр Дах (из рыбы) – 250 г', description: 'Рыба, лук, зелень, чеснок, помидоры', price: 420 },
          { name: 'Хинкали по-азербайджански', description: 'Тонкое тесто, бараний фарш, подаётся с мацони', price: 370 },
          { name: 'Долма "Три сестры" – 300 г', price: 390 },
          { name: 'Плов с цыплёнком – 350 г', description: 'Цыплёнок, орехи, лук, специи', price: 350 },
          { name: 'Долма баклажановая с лявянги – 300 г', price: 490 },
          { name: 'Хачапури по-аджарски – 300 г', price: 340 },
          { name: 'Гуляш из говядины – 150 г', description: 'Говядина, баранина (гарнир на выбор)', price: 420 },
          { name: 'Узбекский плов – 300 г', description: 'Мясо, рис, лук, зира, специи', price: 350 },
          { name: 'Чигиртма из цыплёнка – 300 г', description: 'Цыплёнок, лук, помидоры, яйцо, зелень', price: 320 },
          { name: 'Садж – 1 кг', description: 'Цыплёнок/баранина, баклажаны, грибы, картофель, лук, помидоры, острый перец', price: 0 },
          { name: 'Хачапури по-мегрельски – 500 г', price: 390 }
        ]
      },
      {
        name: 'Гарниры',
        description: 'Гарниры',
        dishes: [
          { name: 'Картофель Фри – 100 г', price: 150 },
          { name: 'Рис отварной – 150 г', price: 120 },
          { name: 'Гречка – 150 г', price: 130 },
          { name: 'Спагетти – 150 г', price: 150 },
          { name: 'Картофельное пюре – 150 г', price: 150 },
          { name: 'Булгур – 150 г', price: 150 }
        ]
      },
      {
        name: 'Соусы',
        description: 'Соусы',
        dishes: [
          { name: 'Мацони – 50 г', price: 80 },
          { name: 'Сметана – 50 г', price: 80 },
          { name: 'Тартар – 50 г', price: 100 },
          { name: 'Наршараб – 50 г', price: 110 },
          { name: 'Кетчуп – 50 г', price: 50 },
          { name: 'Аджика – 50 г', price: 90 },
          { name: 'Соевый соус – 50 г', price: 80 }
        ]
      },
      {
        name: 'Шашлыки',
        description: 'Шашлыки',
        dishes: [
          { name: 'Шашлык из баранины (мякоть) – 200 г', price: 380 },
          { name: 'Люля-кебаб из баранины – 200 г', price: 410 },
          { name: 'Люля-кебаб из курицы – 200 г', price: 390 },
          { name: 'Шашлык из бараньих семечек – 180 г', price: 350 },
          { name: 'Телячья мякоть – 200 г', price: 320 },
          { name: 'Перепёлка на мангале – 1 шт', price: 380 },
          { name: 'Рыба дорада – 300 г', price: 250 },
          { name: 'Рыба сибас – 300 г', price: 290 },
          { name: 'Картофельная люля – 200 г', price: 220 },
          { name: 'Куриная грудка – 200 г', price: 310 },
          { name: 'Шампиньоны на мангале – 180 г', price: 250 },
          { name: 'Шашлык из баранины (корейка) – 200 г', price: 410 },
          { name: 'Бастурма из говядины – 200 г', price: 320 },
          { name: 'Говяжья печень с курдюком – 200 г', price: 380 },
          { name: 'Шашлык ассорти (барбекю-набор)', description: 'Баранья корейка, баранья мякоть, баранья люля, телятина, курица, картофель, овощи', price: 3200 },
          { name: 'Овощной шашлык – 300 г', price: 0 }
        ]
      }
    ];

    // Create categories and dishes
    for (const categoryData of categoriesData) {
      const category = await prisma.category.upsert({
        where: {
          id: `${restaurant.id}-${categoryData.name}`
        },
        update: {},
        create: {
          id: `${restaurant.id}-${categoryData.name}`,
          name: categoryData.name,
          description: categoryData.description,
          restaurantId: restaurant.id,
          order: categoriesData.indexOf(categoryData)
        }
      });

      // Create dishes for this category
      for (const dishData of categoryData.dishes) {
        await prisma.dish.upsert({
          where: {
            id: `${category.id}-${dishData.name}`
          },
          update: {},
          create: {
            id: `${category.id}-${dishData.name}`,
            name: dishData.name,
            description: dishData.description || '',
            price: dishData.price,
            categoryId: category.id,
            isAvailable: true,
            order: categoryData.dishes.indexOf(dishData)
          }
        });
      }

      console.log(`✅ Category "${categoryData.name}" with ${categoryData.dishes.length} dishes created`);
    }

    console.log('\n🎉 Baku menu imported successfully!');
    console.log('\n📝 Test account:');
    console.log('Email: baku@restaurant.com');
    console.log('Password: baku123');
    console.log('\n🌐 Menu: http://localhost:5173/menu/baku');

  } catch (error) {
    console.error('❌ Error importing menu:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importBakuMenu();
