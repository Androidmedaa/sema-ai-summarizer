# Firebase Kurulum Rehberi

## 1. Firebase Projesi Oluşturma

1. **Firebase Console'a gidin**: https://console.firebase.google.com/
2. **"Add project" (Proje Ekle) butonuna tıklayın**
3. Proje adını girin (örn: "sema-documind")
4. Google Analytics'i isteğe bağlı olarak etkinleştirin
5. Projeyi oluşturun

## 2. Web Uygulaması Ekleme

1. Firebase Console'da projenizi açın
2. Sol menüden **"Project Settings"** (Proje Ayarları) seçin
3. Aşağı kaydırın ve **"Your apps"** bölümünde **Web (</>)** ikonuna tıklayın
4. Uygulama adını girin (örn: "SEMA Web App")
5. **"Register app"** butonuna tıklayın
6. Firebase yapılandırma bilgilerini kopyalayın

## 3. Firebase Servislerini Etkinleştirme

### Authentication (Kimlik Doğrulama)
1. Sol menüden **"Authentication"** seçin
2. **"Get started"** butonuna tıklayın
3. **"Sign-in method"** sekmesine gidin
4. **Email/Password** metodunu etkinleştirin

### Firestore Database
1. Sol menüden **"Firestore Database"** seçin
2. **"Create database"** butonuna tıklayın
3. **"Start in test mode"** seçin (geliştirme için)
4. Lokasyon seçin (örn: "europe-west1")
5. **"Enable"** butonuna tıklayın

### Storage
1. Sol menüden **"Storage"** seçin
2. **"Get started"** butonuna tıklayın
3. Güvenlik kurallarını onaylayın
4. **"Done"** butonuna tıklayın

## 4. Frontend Yapılandırması

1. `frontend` klasöründe `.env` dosyası oluşturun:

```env
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

2. Firebase Console'dan aldığınız değerleri `.env` dosyasına ekleyin

3. Paketleri yükleyin:
```bash
cd frontend
npm install
```

## 5. Firestore Güvenlik Kuralları

Firebase Console > Firestore Database > Rules sekmesinde:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Kullanıcılar sadece kendi verilerini okuyabilir/yazabilir
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Dokümanlar sadece sahibi tarafından erişilebilir
    match /documents/{documentId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
  }
}
```

## 6. Storage Güvenlik Kuralları

Firebase Console > Storage > Rules sekmesinde:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 7. Kullanım

Firebase entegrasyonu hazır! Artık:
- ✅ Firebase Authentication kullanabilirsiniz
- ✅ Firestore'da veri saklayabilirsiniz
- ✅ Storage'da dosya yükleyebilirsiniz

## Notlar

- `.env` dosyasını `.gitignore`'a eklediğinizden emin olun
- Production ortamında güvenlik kurallarını sıkılaştırın
- Firebase Console'da kullanım limitlerini kontrol edin

