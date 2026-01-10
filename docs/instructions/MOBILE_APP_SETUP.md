# 📱 Мобильное приложение OimoQR - Инструкция

## ✅ Что установлено

Проект **OimoQR** теперь поддерживает мобильные платформы через **Capacitor**!

### 📦 Установленные пакеты

```json
"@capacitor/core": "^8.0.0",
"@capacitor/cli": "^8.0.0",
"@capacitor/android": "^8.0.0",
"@capacitor/ios": "^8.0.0",
"@capacitor/camera": "^latest",
"@capacitor/geolocation": "^latest",
"@capacitor/push-notifications": "^latest",
"@capacitor/app": "^latest",
"@capacitor/splash-screen": "^latest",
"@capacitor/status-bar": "^latest"
```

### 📁 Структура проекта

```
frontend/
├── android/              ← Android проект (Android Studio)
├── ios/                  ← iOS проект (Xcode)
├── dist/                 ← Скомпилированный web код
├── capacitor.config.json ← Конфигурация Capacitor
└── package.json          ← Обновлённые скрипты
```

---

## 🚀 Быстрый старт

### 1️⃣ Сборка и синхронизация

```bash
cd frontend

# Полная сборка для мобильных платформ
npm run mobile:build
```

Этот скрипт:
- Собирает React приложение → `dist/`
- Синхронизирует код с Android и iOS

### 2️⃣ Запуск на Android

**Требования:**
- ✅ Android Studio установлен
- ✅ Android SDK настроен
- ✅ Эмулятор или физическое устройство

```bash
# Открыть проект в Android Studio
npm run cap:open:android

# Или запустить напрямую (если настроено)
npm run cap:run:android
```

### 3️⃣ Запуск на iOS

**Требования:**
- ✅ macOS
- ✅ Xcode установлен
- ✅ Симулятор или физическое устройство

```bash
# Открыть проект в Xcode
npm run cap:open:ios

# Или запустить напрямую
npm run cap:run:ios
```

---

## 📜 Доступные команды

| Команда | Описание |
|---------|----------|
| `npm run mobile:build` | Полная сборка + синхронизация |
| `npm run cap:sync` | Синхронизация обеих платформ |
| `npm run cap:sync:android` | Синхронизация только Android |
| `npm run cap:sync:ios` | Синхронизация только iOS |
| `npm run cap:open:android` | Открыть в Android Studio |
| `npm run cap:open:ios` | Открыть в Xcode |
| `npm run cap:run:android` | Запустить на Android |
| `npm run cap:run:ios` | Запустить на iOS |

---

## 🔌 Установленные плагины

### 📷 Camera
Доступ к камере для QR-сканирования и фото блюд.

```javascript
import { Camera, CameraResultType } from '@capacitor/camera';

const takePicture = async () => {
  const image = await Camera.getPhoto({
    quality: 90,
    allowEditing: false,
    resultType: CameraResultType.Uri
  });
  return image.webPath;
};
```

### 📍 Geolocation
Определение местоположения для доставки.

```javascript
import { Geolocation } from '@capacitor/geolocation';

const getCurrentPosition = async () => {
  const coordinates = await Geolocation.getCurrentPosition();
  return {
    lat: coordinates.coords.latitude,
    lng: coordinates.coords.longitude
  };
};
```

### 🔔 Push Notifications
Push-уведомления о заказах.

```javascript
import { PushNotifications } from '@capacitor/push-notifications';

await PushNotifications.requestPermissions();
await PushNotifications.register();
```

### 🎨 Splash Screen & Status Bar
Управление внешним видом приложения.

```javascript
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

// Скрыть splash screen после загрузки
await SplashScreen.hide();

// Настроить status bar
await StatusBar.setStyle({ style: Style.Light });
```

---

## ⚙️ Конфигурация

### capacitor.config.json

```json
{
  "appId": "com.oimoqr.app",
  "appName": "OimoQR",
  "webDir": "dist"
}
```

Можно настроить:
- `appId` - Bundle ID для iOS и Package для Android
- `appName` - Название приложения
- `server.url` - URL backend для режима разработки

---

## 🛠️ Разработка

### Live Reload (для разработки)

Чтобы видеть изменения в реальном времени на устройстве:

1. Найдите IP вашего компьютера в локальной сети
2. Запустите frontend: `npm run dev`
3. Обновите `capacitor.config.json`:

```json
{
  "appId": "com.oimoqr.app",
  "appName": "OimoQR",
  "webDir": "dist",
  "server": {
    "url": "http://192.168.1.XXX:5173",
    "cleartext": true
  }
}
```

4. Синхронизируйте: `npm run cap:sync`
5. Запустите на устройстве

⚠️ **Важно:** Удалите `server` из конфигурации перед финальной сборкой!

### Обновление после изменений

После любых изменений в коде:

```bash
npm run build
npm run cap:sync
```

Или используйте комбинированную команду:

```bash
npm run mobile:build
```

---

## 📱 Публикация

### Android (Google Play)

1. Обновите версию в `android/app/build.gradle`:
   ```gradle
   versionCode 1
   versionName "1.0.0"
   ```

2. Создайте подписанный APK в Android Studio:
   - Build → Generate Signed Bundle / APK
   - Следуйте инструкциям для создания keystore

3. Загрузите в Google Play Console

### iOS (App Store)

1. Обновите версию в Xcode:
   - General → Identity → Version / Build

2. Настройте код подписи:
   - Signing & Capabilities
   - Выберите вашу команду разработчика

3. Архивируйте и загрузите:
   - Product → Archive
   - Загрузите в App Store Connect

---

## 🔧 Решение проблем

### Android Studio не видит устройство

```bash
# Проверьте подключение
adb devices

# Перезапустите adb сервер
adb kill-server
adb start-server
```

### iOS Build Failed

- Проверьте версию Xcode (должна быть последняя)
- Очистите build: Product → Clean Build Folder
- Удалите DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`

### Capacitor не видит изменения

```bash
# Полная пересборка
npm run build
npx cap sync
npx cap copy
```

---

## 📚 Полезные ссылки

- 📖 [Capacitor Docs](https://capacitorjs.com/docs)
- 🔌 [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- 📱 [Android Development](https://developer.android.com/)
- 🍎 [iOS Development](https://developer.apple.com/)

---

## ✅ Следующие шаги

1. **Настроить иконки и splash screen**
   - Используйте `@capacitor/assets` для генерации
   
2. **Добавить deep linking**
   - Для открытия меню по QR-коду прямо в приложении

3. **Настроить push-уведомления**
   - Firebase Cloud Messaging для Android
   - Apple Push Notification Service для iOS

4. **Протестировать на реальных устройствах**

5. **Подготовить магазинные листинги**
   - Скриншоты, описания, иконки

---

**Готово к разработке мобильного приложения!** 🚀📱
