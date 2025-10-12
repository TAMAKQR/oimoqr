# 📡 Примеры использования API

Практические примеры работы с API QR Menu SaaS на разных языках и платформах.

---

## 🔐 Аутентификация

### JavaScript (Fetch API)

```javascript
// Регистрация
const register = async () => {
  const response = await fetch("http://localhost:5000/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "restaurant@example.com",
      password: "SecurePass123",
      restaurantName: "My Restaurant",
      ownerName: "John Doe",
      phone: "+1234567890",
      subdomain: "myrestaurant",
    }),
  });

  const data = await response.json();
  console.log("Token:", data.token);
  localStorage.setItem("token", data.token);
};

// Вход
const login = async () => {
  const response = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: "restaurant@example.com",
      password: "SecurePass123",
    }),
  });

  const data = await response.json();
  localStorage.setItem("token", data.token);
};

// Получить текущего пользователя
const getMe = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch("http://localhost:5000/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const user = await response.json();
  console.log("User:", user);
};
```

### Python (requests)

```python
import requests

BASE_URL = 'http://localhost:5000/api'

# Регистрация
def register():
    response = requests.post(f'{BASE_URL}/auth/register', json={
        'email': 'restaurant@example.com',
        'password': 'SecurePass123',
        'restaurantName': 'My Restaurant',
        'ownerName': 'John Doe',
        'phone': '+1234567890',
        'subdomain': 'myrestaurant'
    })
    data = response.json()
    return data['token']

# Вход
def login():
    response = requests.post(f'{BASE_URL}/auth/login', json={
        'email': 'restaurant@example.com',
        'password': 'SecurePass123'
    })
    data = response.json()
    return data['token']

# Получить текущего пользователя
def get_me(token):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.get(f'{BASE_URL}/auth/me', headers=headers)
    return response.json()

# Использование
token = login()
user = get_me(token)
print(f"Logged in as: {user['email']}")
```

### cURL

```bash
# Регистрация
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@example.com",
    "password": "SecurePass123",
    "restaurantName": "My Restaurant",
    "ownerName": "John Doe",
    "phone": "+1234567890",
    "subdomain": "myrestaurant"
  }'

# Вход
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "restaurant@example.com",
    "password": "SecurePass123"
  }'

# Получить текущего пользователя
curl http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 🏪 Управление рестораном

### JavaScript

```javascript
// Получить ресторан по субдомену
const getRestaurant = async (subdomain) => {
  const response = await fetch(
    `http://localhost:5000/api/restaurants/${subdomain}`
  );
  return await response.json();
};

// Обновить информацию о ресторане
const updateRestaurant = async (restaurantId, data) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://localhost:5000/api/restaurants/${restaurantId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  return await response.json();
};

// Пример использования
const updateInfo = async () => {
  const updated = await updateRestaurant(1, {
    name: "Updated Restaurant Name",
    description: "New description",
    address: "123 Main St",
    phone: "+1234567890",
    whatsapp: "+1234567890",
    instagram: "@myrestaurant",
    facebook: "myrestaurant",
    deliveryEnabled: true,
    deliveryFee: 5.0,
    minOrderAmount: 20.0,
  });
  console.log("Updated:", updated);
};
```

### Python

```python
# Получить ресторан по субдомену
def get_restaurant(subdomain):
    response = requests.get(f'{BASE_URL}/restaurants/{subdomain}')
    return response.json()

# Обновить информацию о ресторане
def update_restaurant(restaurant_id, token, data):
    headers = {'Authorization': f'Bearer {token}'}
    response = requests.put(
        f'{BASE_URL}/restaurants/{restaurant_id}',
        headers=headers,
        json=data
    )
    return response.json()

# Пример использования
restaurant = get_restaurant('myrestaurant')
print(f"Restaurant: {restaurant['name']}")

updated = update_restaurant(1, token, {
    'name': 'Updated Restaurant Name',
    'description': 'New description',
    'deliveryEnabled': True,
    'deliveryFee': 5.00
})
```

---

## 📤 Загрузка изображений

### JavaScript (FormData)

```javascript
// Загрузить баннер
const uploadBanner = async (restaurantId, file) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("banner", file);

  const response = await fetch(
    `http://localhost:5000/api/restaurants/${restaurantId}/upload-banner`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  return await response.json();
};

// Использование с input file
document.getElementById("bannerInput").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (file) {
    const result = await uploadBanner(1, file);
    console.log("Banner uploaded:", result.bannerUrl);
  }
});

// Загрузить фото блюда
const uploadDishImage = async (dishId, file) => {
  const token = localStorage.getItem("token");
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(
    `http://localhost:5000/api/dishes/${dishId}/upload-image`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    }
  );

  return await response.json();
};
```

### Python

```python
# Загрузить баннер
def upload_banner(restaurant_id, token, file_path):
    headers = {'Authorization': f'Bearer {token}'}
    files = {'banner': open(file_path, 'rb')}
    response = requests.post(
        f'{BASE_URL}/restaurants/{restaurant_id}/upload-banner',
        headers=headers,
        files=files
    )
    return response.json()

# Загрузить фото блюда
def upload_dish_image(dish_id, token, file_path):
    headers = {'Authorization': f'Bearer {token}'}
    files = {'image': open(file_path, 'rb')}
    response = requests.post(
        f'{BASE_URL}/dishes/{dish_id}/upload-image',
        headers=headers,
        files=files
    )
    return response.json()

# Использование
result = upload_banner(1, token, 'banner.jpg')
print(f"Banner URL: {result['bannerUrl']}")
```

### cURL

```bash
# Загрузить баннер
curl -X POST http://localhost:5000/api/restaurants/1/upload-banner \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "banner=@/path/to/banner.jpg"

# Загрузить фото блюда
curl -X POST http://localhost:5000/api/dishes/1/upload-image \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "image=@/path/to/dish.jpg"
```

---

## 🍽️ Управление меню

### JavaScript

```javascript
// Получить все категории ресторана
const getCategories = async (restaurantId) => {
  const response = await fetch(
    `http://localhost:5000/api/restaurants/${restaurantId}/categories`
  );
  return await response.json();
};

// Создать категорию
const createCategory = async (data) => {
  const token = localStorage.getItem("token");
  const response = await fetch("http://localhost:5000/api/categories", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

// Обновить категорию
const updateCategory = async (categoryId, data) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://localhost:5000/api/categories/${categoryId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  return await response.json();
};

// Удалить категорию
const deleteCategory = async (categoryId) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://localhost:5000/api/categories/${categoryId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return await response.json();
};

// Получить блюда категории
const getDishes = async (categoryId) => {
  const response = await fetch(
    `http://localhost:5000/api/categories/${categoryId}/dishes`
  );
  return await response.json();
};

// Создать блюдо
const createDish = async (data) => {
  const token = localStorage.getItem("token");
  const response = await fetch("http://localhost:5000/api/dishes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

// Пример: создание полного меню
const createFullMenu = async (restaurantId) => {
  // Создать категорию
  const category = await createCategory({
    restaurantId: restaurantId,
    name: "Пицца",
    displayOrder: 1,
  });

  // Создать блюдо
  const dish = await createDish({
    categoryId: category.id,
    name: "Маргарита",
    description: "Классическая пицца с томатами и моцареллой",
    price: 12.99,
    displayOrder: 1,
  });

  // Создать модификаторы
  const modifier1 = await createModifier({
    dishId: dish.id,
    name: "Большая",
    priceModifier: 3.0,
  });

  const modifier2 = await createModifier({
    dishId: dish.id,
    name: "Экстра сыр",
    priceModifier: 2.0,
  });

  console.log("Menu created successfully!");
};
```

### Python

```python
# Полный пример создания меню
def create_full_menu(restaurant_id, token):
    headers = {'Authorization': f'Bearer {token}'}

    # Создать категорию
    category_response = requests.post(
        f'{BASE_URL}/categories',
        headers=headers,
        json={
            'restaurantId': restaurant_id,
            'name': 'Пицца',
            'displayOrder': 1
        }
    )
    category = category_response.json()

    # Создать блюдо
    dish_response = requests.post(
        f'{BASE_URL}/dishes',
        headers=headers,
        json={
            'categoryId': category['id'],
            'name': 'Маргарита',
            'description': 'Классическая пицца с томатами и моцареллой',
            'price': 12.99,
            'displayOrder': 1
        }
    )
    dish = dish_response.json()

    # Создать модификаторы
    modifiers = [
        {'name': 'Большая', 'priceModifier': 3.00},
        {'name': 'Экстра сыр', 'priceModifier': 2.00}
    ]

    for mod in modifiers:
        requests.post(
            f'{BASE_URL}/modifiers',
            headers=headers,
            json={
                'dishId': dish['id'],
                **mod
            }
        )

    print('Menu created successfully!')
    return category, dish

# Использование
category, dish = create_full_menu(1, token)
```

---

## 👨‍💼 Админ-панель

### JavaScript

```javascript
// Получить все рестораны (только для админа)
const getAllRestaurants = async () => {
  const token = localStorage.getItem("token");
  const response = await fetch("http://localhost:5000/api/admin/restaurants", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return await response.json();
};

// Обновить подписку
const updateSubscription = async (subscriptionId, data) => {
  const token = localStorage.getItem("token");
  const response = await fetch(
    `http://localhost:5000/api/admin/subscriptions/${subscriptionId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    }
  );
  return await response.json();
};

// Активировать подписку
const activateSubscription = async (subscriptionId) => {
  return await updateSubscription(subscriptionId, {
    status: "ACTIVE",
    plan: "MONTHLY",
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  });
};

// Продлить подписку на месяц
const extendSubscription = async (subscriptionId, currentEndDate) => {
  const newEndDate = new Date(currentEndDate);
  newEndDate.setMonth(newEndDate.getMonth() + 1);

  return await updateSubscription(subscriptionId, {
    endDate: newEndDate.toISOString(),
  });
};

// Отменить подписку
const cancelSubscription = async (subscriptionId) => {
  return await updateSubscription(subscriptionId, {
    status: "CANCELLED",
  });
};
```

---

## 🔄 Полный workflow примеры

### Регистрация и создание меню

```javascript
const completeSetup = async () => {
  try {
    // 1. Регистрация
    const registerResponse = await fetch(
      "http://localhost:5000/api/auth/register",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "newrestaurant@example.com",
          password: "SecurePass123",
          restaurantName: "Bella Italia",
          ownerName: "Mario Rossi",
          phone: "+1234567890",
          subdomain: "bellaitalia",
        }),
      }
    );
    const { token, user } = await registerResponse.json();
    localStorage.setItem("token", token);

    // 2. Обновить информацию о ресторане
    await fetch(`http://localhost:5000/api/restaurants/${user.restaurant.id}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        description: "Authentic Italian cuisine",
        address: "123 Main Street, New York",
        whatsapp: "+1234567890",
        instagram: "@bellaitalia",
        deliveryEnabled: true,
        deliveryFee: 5.0,
        minOrderAmount: 20.0,
      }),
    });

    // 3. Создать категории
    const categories = ["Appetizers", "Pizza", "Pasta", "Desserts"];
    const createdCategories = [];

    for (let i = 0; i < categories.length; i++) {
      const response = await fetch("http://localhost:5000/api/categories", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: user.restaurant.id,
          name: categories[i],
          displayOrder: i + 1,
        }),
      });
      createdCategories.push(await response.json());
    }

    // 4. Создать блюда
    const pizzaCategory = createdCategories.find((c) => c.name === "Pizza");

    const dishes = [
      {
        name: "Margherita",
        description: "Tomato sauce, mozzarella, basil",
        price: 12.99,
      },
      {
        name: "Pepperoni",
        description: "Tomato sauce, mozzarella, pepperoni",
        price: 14.99,
      },
    ];

    for (let i = 0; i < dishes.length; i++) {
      await fetch("http://localhost:5000/api/dishes", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          categoryId: pizzaCategory.id,
          ...dishes[i],
          displayOrder: i + 1,
        }),
      });
    }

    console.log(
      "Setup complete! Visit: http://localhost:5173/menu/bellaitalia"
    );
  } catch (error) {
    console.error("Setup failed:", error);
  }
};

// Запустить
completeSetup();
```

---

## 🧪 Тестирование API

### Postman Collection

Создайте коллекцию в Postman с переменными:

```json
{
  "baseUrl": "http://localhost:5000/api",
  "token": "",
  "restaurantId": "",
  "categoryId": "",
  "dishId": ""
}
```

### Jest тесты

```javascript
const axios = require("axios");

const API_URL = "http://localhost:5000/api";
let token;
let restaurantId;

describe("QR Menu API Tests", () => {
  test("Register new restaurant", async () => {
    const response = await axios.post(`${API_URL}/auth/register`, {
      email: `test${Date.now()}@example.com`,
      password: "Test123456",
      restaurantName: "Test Restaurant",
      ownerName: "Test Owner",
      phone: "+1234567890",
      subdomain: `test${Date.now()}`,
    });

    expect(response.status).toBe(201);
    expect(response.data).toHaveProperty("token");
    expect(response.data).toHaveProperty("user");

    token = response.data.token;
    restaurantId = response.data.user.restaurant.id;
  });

  test("Login", async () => {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: "test@restaurant.com",
      password: "test123",
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("token");
  });

  test("Get current user", async () => {
    const response = await axios.get(`${API_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("email");
  });

  test("Create category", async () => {
    const response = await axios.post(
      `${API_URL}/categories`,
      {
        restaurantId: restaurantId,
        name: "Test Category",
        displayOrder: 1,
      },
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    expect(response.status).toBe(201);
    expect(response.data.name).toBe("Test Category");
  });
});
```

---

## 📱 React Native пример

```javascript
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:5000/api";

// Создать axios instance с interceptors
const api = axios.create({
  baseURL: API_URL,
});

// Добавить токен к каждому запросу
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// API методы
export const authAPI = {
  register: (data) => api.post("/auth/register", data),
  login: (data) => api.post("/auth/login", data),
  getMe: () => api.get("/auth/me"),
};

export const restaurantAPI = {
  getBySubdomain: (subdomain) => api.get(`/restaurants/${subdomain}`),
  update: (id, data) => api.put(`/restaurants/${id}`, data),
  uploadBanner: (id, file) => {
    const formData = new FormData();
    formData.append("banner", {
      uri: file.uri,
      type: file.type,
      name: file.fileName,
    });
    return api.post(`/restaurants/${id}/upload-banner`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};

export const menuAPI = {
  getCategories: (restaurantId) =>
    api.get(`/restaurants/${restaurantId}/categories`),
  createCategory: (data) => api.post("/categories", data),
  getDishes: (categoryId) => api.get(`/categories/${categoryId}/dishes`),
  createDish: (data) => api.post("/dishes", data),
};
```

---

## 🎯 Полезные советы

### Обработка ошибок

```javascript
const apiCall = async (fn) => {
  try {
    const response = await fn();
    return { success: true, data: response.data };
  } catch (error) {
    if (error.response) {
      // Сервер ответил с ошибкой
      return {
        success: false,
        error: error.response.data.message || "Server error",
      };
    } else if (error.request) {
      // Запрос был отправлен, но ответа нет
      return {
        success: false,
        error: "No response from server",
      };
    } else {
      // Ошибка при настройке запроса
      return {
        success: false,
        error: error.message,
      };
    }
  }
};

// Использование
const result = await apiCall(() =>
  axios.post("http://localhost:5000/api/auth/login", credentials)
);

if (result.success) {
  console.log("Logged in:", result.data);
} else {
  console.error("Login failed:", result.error);
}
```

### Rate Limiting

API имеет ограничения:

- Auth endpoints: 5 запросов / 15 минут
- Остальные endpoints: 100 запросов / 15 минут

Обрабатывайте 429 ошибки:

```javascript
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      alert("Too many requests. Please try again later.");
    }
    return Promise.reject(error);
  }
);
```

---

**Готово! Используйте эти примеры для интеграции с API.** 🚀
