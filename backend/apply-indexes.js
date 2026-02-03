import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function applyIndexes() {
    try {
        console.log('📊 Applying performance indexes...');

        const sqlFile = join(__dirname, 'prisma', 'migrations', 'add_performance_indexes.sql');
        const sql = readFileSync(sqlFile, 'utf-8');

        // Разделяем SQL по командам
        const commands = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0);

        for (const command of commands) {
            console.log(`Executing: ${command.substring(0, 50)}...`);
            await prisma.$executeRawUnsafe(command);
        }

        console.log('✅ Performance indexes applied successfully!');
    } catch (error) {
        console.error('❌ Error applying indexes:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

applyIndexes();
