// Apply dish recommendations migration
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('🔄 Applying dish recommendations migration...');

        // Read and execute SQL migration
        const sqlPath = path.join(__dirname, 'migrations', 'add_dish_recommendations.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            await prisma.$executeRawUnsafe(statement);
            console.log('✅ Executed:', statement.substring(0, 50) + '...');
        }

        console.log('✅ Migration applied successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
