# API Documentation

Base URL: `http://localhost:5000/api`

## Authentication

All protected endpoints require JWT token in Authorization header:

```
Authorization: Bearer <token>
```

---

## Auth Endpoints

### Register Restaurant

```http
POST /auth/register
Content-Type: application/json

{
  "email": "owner@restaurant.com",
  "password": "password123",
  "name": "John Doe",
  "phone": "+7 (999) 123-45-67",
  "restaurantName": "My Restaurant",
  "subdomain": "myrestaurant"
}
```

**Response:**

```json
{
  "message": "Registration successful",
  "user": {
    "id": "uuid",
    "email": "owner@restaurant.com",
    "name": "John Doe",
    "isAdmin": false,
    "restaurant": {
      "id": "uuid",
      "name": "My Restaurant",
      "subdomain": "myrestaurant",
      "subscription": {
        "plan": "TRIAL",
        "status": "TRIAL",
        "trialEndsAt": "2024-01-15T00:00:00.000Z"
      }
    }
  },
  "token": "jwt-token"
}
```

### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "owner@restaurant.com",
  "password": "password123"
}
```

### Get Current User

```http
GET /auth/me
Authorization: Bearer <token>
```

---

## Restaurant Endpoints

### Get Restaurant by Subdomain (Public)

```http
GET /restaurants/:subdomain
```

**Response:**

```json
{
  "id": "uuid",
  "name": "My Restaurant",
  "subdomain": "myrestaurant",
  "address": "123 Main St",
  "phone": "+7 (999) 123-45-67",
  "description": "Best restaurant in town",
  "instagram": "myrestaurant",
  "facebook": "myrestaurant",
  "whatsapp": "79991234567",
  "deliveryEnabled": true,
  "deliveryFee": 200,
  "minOrderAmount": 500,
  "banners": ["/uploads/banner1.jpg"],
  "categories": [
    {
      "id": "uuid",
      "name": "Appetizers",
      "dishes": [
        {
          "id": "uuid",
          "name": "Bruschetta",
          "description": "Toasted bread with tomatoes",
          "price": 350,
          "image": "/uploads/dish1.jpg",
          "modifiers": [
            {
              "id": "uuid",
              "name": "Extra cheese",
              "price": 50
            }
          ]
        }
      ]
    }
  ]
}
```

### Update Restaurant

```http
PUT /restaurants/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Restaurant Name",
  "address": "New Address",
  "phone": "+7 (999) 999-99-99",
  "description": "Updated description",
  "instagram": "instagram_handle",
  "facebook": "facebook_page",
  "whatsapp": "79991234567",
  "deliveryEnabled": true,
  "deliveryFee": 250,
  "minOrderAmount": 600
}
```

### Upload Banner

```http
POST /restaurants/:id/upload-banner
Authorization: Bearer <token>
Content-Type: multipart/form-data

banner: <file>
```

### Delete Banner

```http
DELETE /restaurants/:id/delete-banner
Authorization: Bearer <token>
Content-Type: application/json

{
  "bannerUrl": "/uploads/banner1.jpg"
}
```

---

## Category Endpoints

### Get Categories

```http
GET /categories/restaurant/:restaurantId
```

### Create Category

```http
POST /categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Appetizers",
  "description": "Cold and hot appetizers",
  "restaurantId": "uuid",
  "order": 0
}
```

### Update Category

```http
PUT /categories/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "description": "Updated description",
  "order": 1,
  "isActive": true
}
```

### Delete Category

```http
DELETE /categories/:id
Authorization: Bearer <token>
```

---

## Dish Endpoints

### Get Dishes by Category

```http
GET /dishes/category/:categoryId
```

### Create Dish

```http
POST /dishes
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Bruschetta",
  "description": "Toasted bread with tomatoes",
  "price": 350,
  "categoryId": "uuid",
  "order": 0
}
```

### Update Dish

```http
PUT /dishes/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Dish Name",
  "description": "Updated description",
  "price": 400,
  "order": 1,
  "isActive": true
}
```

### Upload Dish Image

```http
POST /dishes/:id/upload-image
Authorization: Bearer <token>
Content-Type: multipart/form-data

image: <file>
```

### Delete Dish

```http
DELETE /dishes/:id
Authorization: Bearer <token>
```

---

## Modifier Endpoints

### Create Modifier

```http
POST /dishes/:dishId/modifiers
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Extra cheese",
  "price": 50,
  "isRequired": false,
  "order": 0
}
```

### Update Modifier

```http
PUT /dishes/modifiers/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated modifier",
  "price": 60,
  "isRequired": true,
  "order": 1
}
```

### Delete Modifier

```http
DELETE /dishes/modifiers/:id
Authorization: Bearer <token>
```

---

## Admin Endpoints

All admin endpoints require admin role.

### Get All Restaurants

```http
GET /admin/restaurants
Authorization: Bearer <admin-token>
```

### Get Restaurant by ID

```http
GET /admin/restaurants/:id
Authorization: Bearer <admin-token>
```

### Update Subscription

```http
PUT /admin/subscriptions/:id
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "plan": "MONTHLY",
  "status": "ACTIVE"
}
```

**Plans:** `TRIAL`, `MONTHLY`, `YEARLY`
**Statuses:** `TRIAL`, `ACTIVE`, `EXPIRED`, `CANCELLED`

### Extend Subscription

```http
POST /admin/subscriptions/:id/extend
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "months": 1
}
```

### Get Subscription Stats

```http
GET /admin/stats/subscriptions
Authorization: Bearer <admin-token>
```

**Response:**

```json
{
  "stats": [
    { "status": "TRIAL", "_count": 5 },
    { "status": "ACTIVE", "_count": 10 },
    { "status": "EXPIRED", "_count": 2 }
  ],
  "trialExpiringSoon": 2,
  "subscriptionExpiringSoon": 3
}
```

### Update User Credentials

```http
PUT /admin/users/:userId/credentials
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "email": "newemail@example.com",
  "password": "newpassword123"
}
```

**Parameters:**

- `userId` - ID пользователя (обязательно)
- `email` - Новый email (опционально)
- `password` - Новый пароль, минимум 6 символов (опционально)

**Примечания:**

- Можно изменить только email, только пароль, или оба параметра
- Нельзя изменять учетные данные других администраторов
- Email должен быть уникальным

**Response:**

```json
{
  "message": "User credentials updated successfully",
  "user": {
    "id": "uuid",
    "email": "newemail@example.com",
    "name": "User Name",
    "phone": "+7 (999) 123-45-67",
    "isAdmin": false,
    "restaurant": {
      "id": "uuid",
      "name": "Restaurant Name",
      "subdomain": "subdomain"
    }
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": { ... }
}
```

### 401 Unauthorized

```json
{
  "error": "No token provided"
}
```

### 403 Forbidden

```json
{
  "error": "Access denied"
}
```

### 404 Not Found

```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

- General API: 100 requests per 15 minutes per IP
- Auth endpoints: 5 requests per 15 minutes per IP

---

## File Upload

- Supported formats: JPEG, JPG, PNG, GIF, WEBP
- Max file size: 5MB
- Files are stored in `/uploads` directory
- Accessible via: `http://localhost:5000/uploads/filename.jpg`
