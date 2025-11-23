-- Создать ModifierOption для каждого Modifier, который имеет price но не имеет options
INSERT INTO "ModifierOption" (id, "modifierId", name, price, "createdAt", "updatedAt")
SELECT 
  gen_random_uuid() as id,
  m.id as "modifierId",
  m.name as name,
  m.price as price,
  NOW() as "createdAt",
  NOW() as "updatedAt"
FROM "Modifier" m
LEFT JOIN "ModifierOption" mo ON mo."modifierId" = m.id
WHERE m.price IS NOT NULL 
  AND mo.id IS NULL  -- только для модификаторов без существующих options
GROUP BY m.id, m.name, m.price;

-- Проверка результата
SELECT 
  m.name as modifier_name,
  m.price as modifier_price,
  COUNT(mo.id) as options_count
FROM "Modifier" m
LEFT JOIN "ModifierOption" mo ON mo."modifierId" = m.id
GROUP BY m.id, m.name, m.price
ORDER BY m.name;
