// Простой тест API для проверки imageUrl
const testAPI = async () => {
  try {
    // Тест 1: Проверка health endpoint
    console.log('🔍 Тест 1: Health Check');
    const healthRes = await fetch('http://localhost:5000/health');
    const health = await healthRes.json();
    console.log('✅ Health:', health);
    console.log('');

    // Тест 2: Логин (нужен токен для доступа к категориям)
    console.log('🔍 Тест 2: Login');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@oimoqr.com',
        password: 'admin123'
      })
    });
    
    if (!loginRes.ok) {
      console.log('❌ Login failed:', await loginRes.text());
      console.log('ℹ️  Создайте админа: npm run create-admin admin@oimoqr.com admin123 "Admin"');
      return;
    }
    
    const loginData = await loginRes.json();
    console.log('✅ Login successful');
    console.log('User:', loginData.user.email);
    console.log('Restaurant:', loginData.user.restaurant?.name || 'No restaurant');
    console.log('');

    if (!loginData.user.restaurant) {
      console.log('ℹ️  Пользователь не имеет ресторана. Создайте ресторан через UI.');
      return;
    }

    // Тест 3: Получение категорий с блюдами
    console.log('🔍 Тест 3: Get Categories with Dishes');
    const categoriesRes = await fetch(
      `http://localhost:5000/api/restaurants/${loginData.user.restaurant.id}/categories`,
      {
        headers: {
          'Authorization': `Bearer ${loginData.token}`
        }
      }
    );

    if (!categoriesRes.ok) {
      console.log('❌ Categories fetch failed:', await categoriesRes.text());
      return;
    }

    const categories = await categoriesRes.json();
    console.log('✅ Categories fetched:', categories.length);
    
    if (categories.length === 0) {
      console.log('ℹ️  Нет категорий. Создайте категорию и блюдо через UI.');
      return;
    }

    // Проверяем первую категорию
    const firstCategory = categories[0];
    console.log('');
    console.log('📁 Категория:', firstCategory.name);
    console.log('   Блюд:', firstCategory.dishes?.length || 0);
    
    if (firstCategory.dishes && firstCategory.dishes.length > 0) {
      const firstDish = firstCategory.dishes[0];
      console.log('');
      console.log('🍽️  Первое блюдо:');
      console.log('   Название:', firstDish.name);
      console.log('   Цена:', firstDish.price);
      console.log('   image:', firstDish.image || 'null');
      console.log('   imageUrl:', firstDish.imageUrl || 'null');
      console.log('');
      
      if (firstDish.imageUrl) {
        console.log('✅ imageUrl присутствует!');
      } else if (firstDish.image) {
        console.log('⚠️  image есть, но imageUrl отсутствует!');
      } else {
        console.log('ℹ️  У блюда нет изображения');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

// Запуск теста
testAPI();