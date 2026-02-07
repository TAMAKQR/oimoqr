/**
 * Проверка состояния бэкенда и CORS
 */

import https from 'https';

const BACKEND_URL = 'https://oimoqr.onrender.com';
const FRONTEND_ORIGIN = 'https://www.oimoqr.com';

console.log('🔍 Проверка бэкенда...\n');

// 1. Проверка health endpoint
console.log('1️⃣ Проверка /health endpoint...');
checkEndpoint('/health', (data) => {
    console.log('   ✅ Бэкенд работает:', data);
    console.log('');

    // 2. Проверка CORS
    console.log('2️⃣ Проверка CORS для', FRONTEND_ORIGIN);
    checkCORS('/api/pricing-tiers');
});

function checkEndpoint(path, callback) {
    const options = {
        hostname: 'oimoqr.onrender.com',
        path: path,
        method: 'GET',
    };

    const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            if (res.statusCode === 200) {
                try {
                    callback(JSON.parse(data));
                } catch (e) {
                    callback(data);
                }
            } else {
                console.log(`   ❌ Ошибка: HTTP ${res.statusCode}`);
            }
        });
    });

    req.on('error', (e) => {
        console.log(`   ❌ Ошибка подключения:`, e.message);
        console.log('\n⚠️ Бэкенд на Render может быть спящим. Попробуйте открыть:');
        console.log('   https://oimoqr.onrender.com/health');
        console.log('   и подождите 30-60 секунд.\n');
    });

    req.end();
}

function checkCORS(path) {
    const options = {
        hostname: 'oimoqr.onrender.com',
        path: path,
        method: 'OPTIONS', // Preflight request
        headers: {
            'Origin': FRONTEND_ORIGIN,
            'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'Content-Type,Authorization'
        }
    };

    const req = https.request(options, (res) => {
        const corsHeaders = {
            'Access-Control-Allow-Origin': res.headers['access-control-allow-origin'],
            'Access-Control-Allow-Methods': res.headers['access-control-allow-methods'],
            'Access-Control-Allow-Credentials': res.headers['access-control-allow-credentials'],
        };

        console.log('   Статус:', res.statusCode);
        console.log('   CORS заголовки:', corsHeaders);

        if (corsHeaders['Access-Control-Allow-Origin']) {
            console.log('   ✅ CORS настроен правильно');
        } else {
            console.log('   ❌ CORS заголовки отсутствуют!');
            console.log('\n🔧 Решение:');
            console.log('   1. Зайдите на Render Dashboard');
            console.log('   2. Перезапустите сервис (Manual Deploy > Clear build cache & deploy)');
            console.log('   3. Подождите 2-3 минуты');
        }
    });

    req.on('error', (e) => {
        console.log(`   ❌ Ошибка:`, e.message);
    });

    req.end();
}
