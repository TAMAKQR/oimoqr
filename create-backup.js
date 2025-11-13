import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Определяем корневую директорию проекта (на уровень выше папки scripts)
const projectRoot = __dirname; // Теперь скрипт находится в корне проекта, поэтому projectRoot - это текущая директория
const backupsDir = path.join(projectRoot, 'backups');

const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d}_${h}-${min}-${s}`;
};

const main = async () => {
  try {
    // 1. Создаем папку для бэкапов, если ее нет
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
      console.log(`✅ Создана директория для бэкапов: ${backupsDir}`);
    }

    // 2. Генерируем имя файла и путь
    const timestamp = formatDate(new Date());
    const backupFileName = `backup_${timestamp}.zip`;
    const backupFilePath = path.join(backupsDir, backupFileName);

    console.log(`🚀 Начинаем создание бэкапа: ${backupFileName}`);

    // 3. Создаем поток для записи в zip-архив
    const output = fs.createWriteStream(backupFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Максимальное сжатие
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Предупреждение:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);

    // 4. Добавляем папки и файлы в архив
    console.log('... Добавляем backend');
    archive.directory(path.join(projectRoot, 'backend/'), 'backend');

    console.log('... Добавляем frontend');
    archive.directory(path.join(projectRoot, 'frontend/'), 'frontend');
    
    console.log('... Добавляем корневые файлы');
    archive.file(path.join(projectRoot, 'package.json'), { name: 'package.json' });
    archive.file(path.join(projectRoot, 'package-lock.json'), { name: 'package-lock.json' });
    if (fs.existsSync(path.join(projectRoot, 'docker-compose.yml'))) {
      archive.file(path.join(projectRoot, 'docker-compose.yml'), { name: 'docker-compose.yml' });
    }
    if (fs.existsSync(path.join(projectRoot, 'vercel.json'))) {
      archive.file(path.join(projectRoot, 'vercel.json'), { name: 'vercel.json' });
    }

    // 5. Завершаем архивацию
    await archive.finalize();

    console.log(`✅ Бэкап успешно создан: ${backupFilePath}`);
    console.log(`🗜️  Размер архива: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);

  } catch (error) {
    console.error('❌ Ошибка при создании бэкапа:', error);
  }
};

main();