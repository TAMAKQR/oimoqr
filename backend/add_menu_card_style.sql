-- Добавление поля menuCardStyle в таблицу restaurants
ALTER TABLE "restaurants" 
ADD COLUMN IF NOT EXISTS "menuCardStyle" TEXT NOT NULL DEFAULT 'horizontal';

-- Проверка результата
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'restaurants' AND column_name = 'menuCardStyle';