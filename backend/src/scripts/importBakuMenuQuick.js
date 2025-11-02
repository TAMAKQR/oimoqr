import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const prisma = new PrismaClient();

const imageMap = JSON.parse(
  fs.readFileSync(
    path.join(path.resolve(), 'src/scripts/cloudinaryImages.json'),
    'utf-8'
  )
);

const imageUrls = Object.values(imageMap);
let imageIndex = 0;

function getNextImage() {
  if (imageIndex < imageUrls.length) {
    return imageUrls[imageIndex++];
  }
  return null;
}

async function importBakuMenu() {
  try {
    console.log('🌱 Starting import...');

    console.log('👤 Creating owner...');
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
    console.log('✅ Owner ready');

    console.log('🏪 Creating restaurant...');
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
        userId: owner.id,
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
    console.log('✅ Restaurant ready');

    const categories = [
      {
        name: 'Холодные закуски',
        dishes: [
          'Домашнее соленье – 200 г',
          'Лимон',
          'Сельдь с картошкой – 200 г',
          'Сёмга слабосолёная – 100 г',
          'Сырная тарелка – 200 г',
          'Бакинский букет – 350 г',
          'Лобио по-азербайджански – 200 г'
        ]
      },
      {
        name: 'Горячие закуски',
        dishes: [
          'Кутабы по 1 шт',
          'Пирожки – 1 шт'
        ]
      },
      {
        name: 'Салаты',
        dishes: [
          'Цезарь с курицей – 250 г',
          'Цезарь с семгой – 250 г',
          'Салат с телячьим языком и рукколой – 250 г',
          'Салат из свеклы – 250 г',
          'Салат от Шефа – 250 г',
          'Салат Баку – 250 г',
          'Цезарь с креветками – 250 г',
          'Капрезе – 250 г',
          'Салат с морепродуктами – 250 г',
          'Греческий салат – 250 г',
          'Хрустящие баклажаны – 200 г',
          'Чобан-салат – 200 г'
        ]
      },
      {
        name: 'Первые блюда',
        dishes: [
          'Кюфта бозбаш – 400 г',
          'Пити – 350 г',
          'Суп с лапшой и курицей – 350 г',
          'Хашлама – 350 г',
          'Крем-суп грибной – 300 г',
          'Крем-суп тыквенный – 300 г',
          'Харчо – 300 г',
          'Довга – 300 г',
          'Дюшбара «Бакинская» – 350 г',
          'Соютма – 350 г',
          'Борщ – 300 г',
          'Окрошка – 300 г'
        ]
      },
      {
        name: 'Основные блюда',
        dishes: [
          'Шах-плов – 350 г',
          'Хинкали по-грузински – 1 шт',
          'Долма – 200 г',
          'Казан-кебаб – 300 г',
          'Сыр Дах (из рыбы) – 250 г',
          'Хинкали по-азербайджански',
          'Долма "Три сестры" – 300 г',
          'Плов с цыплёнком – 350 г',
          'Долма баклажановая с лявянги – 300 г',
          'Хачапури по-аджарски – 300 г',
          'Гуляш из говядины – 150 г',
          'Узбекский плов – 300 г',
          'Чигиртма из цыплёнка – 300 г',
          'Садж – 1 кг',
          'Хачапури по-мегрельски – 500 г'
        ]
      },
      {
        name: 'Гарниры',
        dishes: [
          'Картофель Фри – 100 г',
          'Рис отварной – 150 г',
          'Гречка – 150 г',
          'Спагетти – 150 г',
          'Картофельное пюре – 150 г',
          'Булгур – 150 г'
        ]
      },
      {
        name: 'Соусы',
        dishes: [
          'Мацони – 50 г',
          'Сметана – 50 г',
          'Тартар – 50 г',
          'Наршараб – 50 г',
          'Кетчуп – 50 г',
          'Аджика – 50 г',
          'Соевый соус – 50 г'
        ]
      },
      {
        name: 'Шашлыки',
        dishes: [
          'Шашлык из баранины (мякоть) – 200 г',
          'Люля-кебаб из баранины – 200 г',
          'Люля-кебаб из курицы – 200 г',
          'Шашлык из бараньих семечек – 180 г',
          'Телячья мякоть – 200 г',
          'Перепёлка на мангале – 1 шт',
          'Рыба дорада – 300 г',
          'Рыба сибас – 300 г',
          'Картофельная люля – 200 г',
          'Куриная грудка – 200 г',
          'Шампиньоны на мангале – 180 г',
          'Шашлык из баранины (корейка) – 200 г',
          'Бастурма из говядины – 200 г',
          'Говяжья печень с курдюком – 200 г',
          'Шашлык ассорти (барбекю-набор)',
          'Овощной шашлык – 300 г'
        ]
      }
    ];

    console.log(`📦 Creating ${categories.length} categories and ${categories.reduce((a, c) => a + c.dishes.length, 0)} dishes...`);

    for (let catIdx = 0; catIdx < categories.length; catIdx++) {
      const cat = categories[catIdx];
      console.log(`\n📂 ${catIdx + 1}/${categories.length}: ${cat.name}`);

      const category = await prisma.category.upsert({
        where: { id: `${restaurant.id}-${cat.name}` },
        update: {},
        create: {
          id: `${restaurant.id}-${cat.name}`,
          name: cat.name,
          restaurantId: restaurant.id,
          order: catIdx
        }
      });

      for (let dishIdx = 0; dishIdx < cat.dishes.length; dishIdx++) {
        const dishName = cat.dishes[dishIdx];
        const image = getNextImage();
        
        await prisma.dish.upsert({
          where: { id: `${category.id}-${dishName}` },
          update: { image },
          create: {
            id: `${category.id}-${dishName}`,
            name: dishName,
            price: 100,
            image,
            categoryId: category.id,
            order: dishIdx
          }
        });

        process.stdout.write('.');
      }

      console.log(` ✅ ${cat.dishes.length} dishes`);
    }

    console.log('\n\n✨ Import complete!');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

importBakuMenu();
