// Direct SQL migration using pg
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env
dotenv.config();

const { Client } = pg;

async function main() {
    console.log('📋 DATABASE_URL:', process.env.DATABASE_URL ? 'Found' : 'NOT FOUND');

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL not found in environment!');
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔌 Connecting to database...');
        await client.connect();
        console.log('✅ Connected!');

        console.log('🔄 Applying dish recommendations migration...');

        // Read SQL file
        const sqlPath = path.join(__dirname, 'backend', 'migrations', 'add_dish_recommendations.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Split by semicolons and execute each statement
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('COMMENT'));

        for (const statement of statements) {
            console.log(`📝 Executing: ${statement.substring(0, 60)}...`);
            await client.query(statement);
            console.log('✅ Success');
        }

        // Execute COMMENT separately if needed
        const commentStatements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.startsWith('COMMENT'));

        for (const statement of commentStatements) {
            try {
                await client.query(statement);
                console.log('✅ Comment added');
            } catch (err) {
                console.log('⚠️ Comment skipped (probably not supported by pooler)');
            }
        }

        console.log('\n✨ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
