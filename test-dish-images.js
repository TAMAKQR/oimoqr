const API_URL = 'http://localhost:5000/api';

async function testDishImages() {
  try {
    // 1. Login
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'vladislavaonischuk@gmail.com',
        password: '123456'
      })
    });

    const { token, user } = await loginResponse.json();
    console.log('✅ Logged in\n');

    // 2. Get categories
    const categoriesResponse = await fetch(
      `${API_URL}/restaurants/${user.restaurant.id}/categories`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );

    const categories = await categoriesResponse.json();

    // 3. Find dishes with images
    console.log('🔍 Searching for dishes with images...\n');
    
    categories.forEach(category => {
      if (category.dishes) {
        category.dishes.forEach(dish => {
          if (dish.image || dish.imageUrl) {
            console.log('✅ FOUND DISH WITH IMAGE:');
            console.log('   Name:', dish.name);
            console.log('   Category:', category.name);
            console.log('   Full JSON:', JSON.stringify(dish, null, 2));
            console.log('\n' + '='.repeat(80) + '\n');
          }
        });
      }
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testDishImages();