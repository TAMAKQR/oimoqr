import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const exportOrderToJson = async (orderNumber) => {
  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: {
        restaurant: true
      }
    });

    if (!order) {
      console.error(`Order ${orderNumber} not found`);
      process.exit(1);
    }

    const items = JSON.parse(order.items);
    
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        const dish = await prisma.dish.findUnique({
          where: { id: item.dishId },
          include: {
            category: true,
            modifiers: true
          }
        });

        return {
          ...item,
          dishDetails: dish
        };
      })
    );

    const orderData = {
      ...order,
      items: enrichedItems
    };

    const outputPath = path.join(__dirname, `../../exports/order_${orderNumber.replace('#', '')}.json`);
    
    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(orderData, null, 2));
    console.log(`✓ Order exported to: ${outputPath}`);
    
  } catch (error) {
    console.error('Export error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const orderNumber = process.argv[2];
if (!orderNumber) {
  console.error('Usage: node exportOrderToJson.js <orderNumber>');
  console.error('Example: node exportOrderToJson.js "#1234567890"');
  process.exit(1);
}

exportOrderToJson(orderNumber);
