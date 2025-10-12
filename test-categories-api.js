// Change this to test different environments
const API_URL = 'https://backend.oimoqr.com/api'; // Production
// const API_URL = 'http://localhost:5000/api'; // Local

async function testCategoriesAPI() {
  try {
    // 1. Login first
    console.log('🔐 Logging in...');
    const loginResponse = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'vladislavaonischuk@gmail.com',
        password: '123456'
      })
    });

    if (!loginResponse.ok) {
      console.error('❌ Login failed:', await loginResponse.text());
      return;
    }

    const { token, user } = await loginResponse.json();
    console.log('✅ Logged in as:', user.email);
    console.log('🏪 Restaurant ID:', user.restaurant?.id);

    if (!user.restaurant) {
      console.error('❌ User has no restaurant');
      return;
    }

    // 2. Get categories with dishes
    console.log('\n📋 Fetching categories...');
    const categoriesResponse = await fetch(
      `${API_URL}/restaurants/${user.restaurant.id}/categories`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!categoriesResponse.ok) {
      console.error('❌ Failed to fetch categories:', await categoriesResponse.text());
      return;
    }

    const categories = await categoriesResponse.json();
    console.log('✅ Categories fetched:', categories.length);

    // 3. Check dishes and their images
    console.log('\n🍽️  Checking dishes and images:');
    categories.forEach((category, catIndex) => {
      console.log(`\n📁 Category ${catIndex + 1}: ${category.name}`);
      console.log(`   Dishes count: ${category.dishes?.length || 0}`);
      
      if (category.dishes && category.dishes.length > 0) {
        category.dishes.forEach((dish, dishIndex) => {
          console.log(`\n   🍴 Dish ${dishIndex + 1}: ${dish.name}`);
          console.log(`      - image field: ${dish.image || 'NULL'}`);
          console.log(`      - imageUrl field: ${dish.imageUrl || 'NULL'}`);
          console.log(`      - Has image: ${dish.image ? '✅ YES' : '❌ NO'}`);
          console.log(`      - Has imageUrl: ${dish.imageUrl ? '✅ YES' : '❌ NO'}`);
        });
      }
    });

    // 4. Show summary
    console.log('\n📊 Summary:');
    const totalDishes = categories.reduce((sum, cat) => sum + (cat.dishes?.length || 0), 0);
    const dishesWithImage = categories.reduce((sum, cat) => 
      sum + (cat.dishes?.filter(d => d.image).length || 0), 0
    );
    const dishesWithImageUrl = categories.reduce((sum, cat) => 
      sum + (cat.dishes?.filter(d => d.imageUrl).length || 0), 0
    );

    console.log(`Total dishes: ${totalDishes}`);
    console.log(`Dishes with 'image': ${dishesWithImage}`);
    console.log(`Dishes with 'imageUrl': ${dishesWithImageUrl}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testCategoriesAPI();