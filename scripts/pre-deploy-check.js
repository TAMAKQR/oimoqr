#!/usr/bin/env node

/**
 * Pre-Deploy Check Script
 * Запускай ПЕРЕД пушем: node scripts/pre-deploy-check.js
 * 
 * Проверяет:
 * 1. Frontend билдится без ошибок
 * 2. Backend запускается
 * 3. Нет console.log в продакшен коде (предупреждение)
 * 4. Все зависимости установлены
 * 5. Prisma schema валидна
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';

const ROOT = process.cwd();
let errors = [];
let warnings = [];
let passed = [];

function run(cmd, cwd = ROOT) {
    try {
        execSync(cmd, { cwd, stdio: 'pipe', timeout: 120000 });
        return { success: true };
    } catch (err) {
        return { success: false, error: err.stderr?.toString() || err.stdout?.toString() || err.message };
    }
}

function log(icon, msg) {
    console.log(`  ${icon} ${msg}`);
}

function getAllFiles(dir, ext, files = []) {
    try {
        const items = readdirSync(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            if (item === 'node_modules' || item === 'dist' || item === '.git' || item === 'android' || item === 'ios') continue;
            try {
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    getAllFiles(fullPath, ext, files);
                } else if (fullPath.endsWith(ext)) {
                    files.push(fullPath);
                }
            } catch { }
        }
    } catch { }
    return files;
}

console.log('\n🔍 OimoQR Pre-Deploy Check\n');
console.log('═'.repeat(50));

// 1. Check dependencies
console.log('\n📦 1. Проверка зависимостей...');
if (existsSync(path.join(ROOT, 'frontend/node_modules'))) {
    passed.push('Frontend зависимости установлены');
    log('✅', 'Frontend node_modules OK');
} else {
    errors.push('Frontend node_modules не найден. Запусти: cd frontend && npm install');
    log('❌', 'Frontend node_modules не найден');
}

if (existsSync(path.join(ROOT, 'backend/node_modules'))) {
    passed.push('Backend зависимости установлены');
    log('✅', 'Backend node_modules OK');
} else {
    errors.push('Backend node_modules не найден. Запусти: cd backend && npm install');
    log('❌', 'Backend node_modules не найден');
}

// 2. Prisma validation
console.log('\n🗄️  2. Проверка Prisma Schema...');
const prismaResult = run('npx prisma validate', path.join(ROOT, 'backend'));
if (prismaResult.success) {
    passed.push('Prisma schema валидна');
    log('✅', 'Schema валидна');
} else {
    errors.push('Prisma schema невалидна: ' + prismaResult.error);
    log('❌', 'Schema невалидна!');
    log('  ', prismaResult.error?.substring(0, 200));
}

// 3. Frontend build
console.log('\n⚛️  3. Сборка Frontend...');
const buildStart = Date.now();
const buildResult = run('npx vite build', path.join(ROOT, 'frontend'));
const buildTime = ((Date.now() - buildStart) / 1000).toFixed(1);

if (buildResult.success) {
    passed.push(`Frontend собрался за ${buildTime}s`);
    log('✅', `Build OK (${buildTime}s)`);
} else {
    errors.push('Frontend build failed');
    log('❌', 'Build FAILED!');
    // Вывести последние строки ошибки
    const errLines = (buildResult.error || '').split('\n').slice(-15).join('\n');
    console.log('\n' + errLines);
}

// 4. Backend syntax check (import without running server)
console.log('\n🖥️  4. Проверка Backend синтаксиса...');
const backendCheck = run('node --check src/server.js', path.join(ROOT, 'backend'));
if (backendCheck.success) {
    passed.push('Backend синтаксис OK');
    log('✅', 'Синтаксис OK');
} else {
    errors.push('Backend syntax error: ' + backendCheck.error);
    log('❌', 'Синтаксическая ошибка!');
    log('  ', backendCheck.error?.substring(0, 300));
}

// 5. Check for console.log (warning only)
console.log('\n🔎 5. Поиск console.log в коде...');
let consoleCount = 0;
const frontendFiles = getAllFiles(path.join(ROOT, 'frontend/src'), '.jsx')
    .concat(getAllFiles(path.join(ROOT, 'frontend/src'), '.js'));
const backendFiles = getAllFiles(path.join(ROOT, 'backend/src'), '.js');

const allSourceFiles = [...frontendFiles, ...backendFiles];
const consoleLogs = [];

for (const file of allSourceFiles) {
    try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, i) => {
            if (line.includes('console.log(') && !line.trim().startsWith('//')) {
                consoleCount++;
                if (consoleLogs.length < 10) {
                    const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
                    consoleLogs.push(`${relPath}:${i + 1}`);
                }
            }
        });
    } catch { }
}

if (consoleCount === 0) {
    passed.push('Нет console.log в коде');
    log('✅', 'console.log не найдены');
} else {
    warnings.push(`${consoleCount} console.log в коде`);
    log('⚠️', `Найдено ${consoleCount} console.log (рекомендуется убрать)`);
    consoleLogs.forEach(loc => log('  ', `📄 ${loc}`));
    if (consoleCount > 10) log('  ', `... и ещё ${consoleCount - 10}`);
}

// 6. Check for TODO/FIXME/HACK
console.log('\n📝 6. Поиск TODO/FIXME в коде...');
let todoCount = 0;
for (const file of allSourceFiles) {
    try {
        const content = readFileSync(file, 'utf-8');
        const matches = content.match(/\/\/\s*(TODO|FIXME|HACK|XXX):/gi);
        if (matches) todoCount += matches.length;
    } catch { }
}
if (todoCount === 0) {
    log('✅', 'Нет TODO/FIXME');
} else {
    warnings.push(`${todoCount} TODO/FIXME в коде`);
    log('⚠️', `${todoCount} TODO/FIXME комментариев`);
}

// 7. Check .env exists
console.log('\n🔐 7. Проверка .env файлов...');
if (existsSync(path.join(ROOT, 'backend/.env'))) {
    log('✅', 'backend/.env существует');

    // Проверка ключей
    const envContent = readFileSync(path.join(ROOT, 'backend/.env'), 'utf-8');
    const requiredKeys = ['DATABASE_URL', 'JWT_SECRET', 'YANDEX_GEOCODER_KEY'];
    for (const key of requiredKeys) {
        if (envContent.includes(key + '=')) {
            log('✅', `${key} настроен`);
        } else {
            warnings.push(`${key} отсутствует в .env`);
            log('⚠️', `${key} не найден в .env`);
        }
    }
} else {
    warnings.push('backend/.env не найден');
    log('⚠️', 'backend/.env не найден (OK для CI)');
}

// 8. Check dist folder size
console.log('\n📊 8. Размер сборки...');
const distPath = path.join(ROOT, 'frontend/dist');
if (existsSync(distPath)) {
    let totalSize = 0;
    const distFiles = getAllFiles(distPath, '');
    // Count all files in dist
    const countFiles = (dir) => {
        try {
            const items = readdirSync(dir);
            for (const item of items) {
                const full = path.join(dir, item);
                try {
                    const st = statSync(full);
                    if (st.isDirectory()) countFiles(full);
                    else totalSize += st.size;
                } catch { }
            }
        } catch { }
    };
    countFiles(distPath);
    const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    if (totalSize > 10 * 1024 * 1024) {
        warnings.push(`Размер сборки ${sizeMB} MB — многовато`);
        log('⚠️', `Сборка: ${sizeMB} MB (рекомендуется < 10 MB)`);
    } else {
        passed.push(`Размер сборки: ${sizeMB} MB`);
        log('✅', `Сборка: ${sizeMB} MB`);
    }
}

// === RESULTS ===
console.log('\n' + '═'.repeat(50));
console.log('\n📋 РЕЗУЛЬТАТ:\n');

if (errors.length === 0) {
    console.log('  🟢 ВСЕ ПРОВЕРКИ ПРОЙДЕНЫ — можно пушить!\n');
} else {
    console.log('  🔴 ЕСТЬ ОШИБКИ — НЕ ПУШИ!\n');
    errors.forEach(e => console.log(`  ❌ ${e}`));
    console.log('');
}

if (warnings.length > 0) {
    console.log('  ⚠️  Предупреждения:');
    warnings.forEach(w => console.log(`     • ${w}`));
    console.log('');
}

console.log(`  ✅ Пройдено: ${passed.length}`);
console.log(`  ⚠️  Предупреждений: ${warnings.length}`);
console.log(`  ❌ Ошибок: ${errors.length}`);
console.log('');

process.exit(errors.length > 0 ? 1 : 0);
