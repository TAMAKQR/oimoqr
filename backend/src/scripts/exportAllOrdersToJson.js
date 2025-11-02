import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const exportAllOrders = async (restaurantId) => {
  try {
    const orders = await prisma.order.findMany({
      where: { restaurantId },
      include: {
        restaurant: true
      },
      orderBy: { createdAt: 'desc' }
    });

    if (orders.length === 0) {
      console.error(`No orders found for restaurant ${restaurantId}`);
      process.exit(1);
    }

    const enrichedOrders = await Promise.all(
      orders.map(async (order) => {
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

        return {
          ...order,
          items: enrichedItems
        };
      })
    );

    const exportsDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputPath = path.join(exportsDir, `orders_${restaurantId}_${timestamp}.json`);

    fs.writeFileSync(outputPath, JSON.stringify({
      totalOrders: enrichedOrders.length,
      restaurant: enrichedOrders[0].restaurant.name,
      exportDate: new Date().toISOString(),
      orders: enrichedOrders
    }, null, 2));

    console.log(`✓ ${enrichedOrders.length} orders exported to: ${outputPath}`);
    
  } catch (error) {
    console.error('Export error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
};

const restaurantId = process.argv[2];
if (!restaurantId) {
  console.error('Usage: node exportAllOrdersToJson.js <restaurantId>');
  process.exit(1);
}

exportAllOrders(restaurantId);
