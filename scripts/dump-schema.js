import pg from 'pg';

const { Client } = pg;

// Вставь сюда строку подключения Supabase Postgres
const connectionString = process.env.DATABASE_URL || 'postgres://USER:PASSWORD@HOST:5432/postgres';

const query = `
SELECT
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_schema, table_name, ordinal_position;
`;

(async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const res = await client.query(query);
    await client.end();

    // Группируем по таблицам для удобства
    const grouped = res.rows.reduce((acc, row) => {
        const key = `${row.table_schema}.${row.table_name}`;
        acc[key] = acc[key] || [];
        acc[key].push(row);
        return acc;
    }, {});

    console.log('=== Schema dump ===');
    Object.entries(grouped).forEach(([table, cols]) => {
        console.log(`\n${table}`);
        cols.forEach((c) => {
            console.log(
                `  ${c.column_name} ${c.data_type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}` +
                (c.column_default ? ` DEFAULT ${c.column_default}` : '')
            );
        });
    });
})();