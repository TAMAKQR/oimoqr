-- Добавляем таблицу шаблонов модификаторов на уровне ресторана
CREATE TABLE "ModifierTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "restaurantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierTemplate_pkey" PRIMARY KEY ("id")
);

-- Добавляем таблицу опций шаблонов модификаторов
CREATE TABLE "ModifierTemplateOption" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "image" TEXT,
    "templateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModifierTemplateOption_pkey" PRIMARY KEY ("id")
);

-- Добавляем поле templateId к таблице Modifier (для связи с шаблоном)
ALTER TABLE "Modifier" ADD COLUMN "templateId" TEXT;

-- Создаем индексы
CREATE INDEX "ModifierTemplate_restaurantId_idx" ON "ModifierTemplate"("restaurantId");
CREATE INDEX "ModifierTemplateOption_templateId_idx" ON "ModifierTemplateOption"("templateId");
CREATE INDEX "Modifier_templateId_idx" ON "Modifier"("templateId");

-- Добавляем внешние ключи
ALTER TABLE "ModifierTemplate" ADD CONSTRAINT "ModifierTemplate_restaurantId_fkey" 
    FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ModifierTemplateOption" ADD CONSTRAINT "ModifierTemplateOption_templateId_fkey" 
    FOREIGN KEY ("templateId") REFERENCES "ModifierTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Modifier" ADD CONSTRAINT "Modifier_templateId_fkey" 
    FOREIGN KEY ("templateId") REFERENCES "ModifierTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
