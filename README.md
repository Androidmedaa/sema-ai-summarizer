# SEMA - Semantic Analysis

Modern, akademik web arayüzlü akıllı doküman arama ve yönetim sistemi.

## Özellikler

- 📄 **Doküman Yükleme**: PDF ve TXT formatlarında dosya yükleme
- 🔍 **Anlamsal Arama**: Anahtar kelime ve doğal dil ile akıllı arama
- 💬 **AI Soru-Cevap**: Dokümanlarınıza dayalı doğal dil soruları sorma
- 📝 **Akıllı Özetler**: Otomatik kısa ve detaylı özet oluşturma
- 🔐 **Kullanıcı Kimlik Doğrulama**: Güvenli giriş ve kayıt sistemi
- 🎨 **Modern UI**: Karanlık tema ve mavi vurgularla modern tasarım

## Teknolojiler

### Frontend
- React 18
- Vite
- React Router
- Axios
- Lucide React (Icons)

### Backend
- Node.js
- Express.js
- Multer (File upload)
- JWT (Authentication)
- PDF-Parse, Mammoth (Document parsing)
- Google Gemini API (AI features - optional)

## Kurulum

### 1. Tüm bağımlılıkları yükleyin

```bash
npm run install:all
```

### 2. Ortam değişkenlerini ayarlayın

#### Backend

`backend` klasöründe `.env.example` dosyasını kopyalayıp `.env` olarak kaydedin:

```bash
cd backend
cp .env.example .env
```

Sonra `.env` dosyasını düzenleyip değerleri doldurun:

```env
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
GEMINI_API_KEY=your-gemini-api-key-optional
```

**Notlar**: 
- **JWT_SECRET**: Kullanıcı kimlik doğrulama token'larını imzalamak için kullanılan gizli anahtar. Üretim ortamında mutlaka güçlü bir değer kullanın (örn: `openssl rand -base64 32` ile oluşturabilirsiniz).
- **GEMINI_API_KEY**: Google Gemini API anahtarı isteğe bağlıdır. Anahtar olmadan da temel özellikler çalışır, ancak AI özellikleri sınırlı olacaktır. Gemini API anahtarı almak için: https://makersuite.google.com/app/apikey

#### Frontend

`frontend` klasöründe `.env.example` dosyasını kopyalayıp `.env` olarak kaydedin:

```bash
cd frontend
cp .env.example .env
```

Sonra `.env` dosyasını düzenleyip Firebase yapılandırma bilgilerinizi ekleyin:

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
# ... diğer Firebase ayarları
```

Firebase yapılandırma bilgilerinizi Firebase Console'dan (https://console.firebase.google.com) alabilirsiniz.

### 3. Uygulamayı başlatın

Geliştirme modu (frontend + backend birlikte):
```bash
npm run dev
```

Veya ayrı ayrı:
```bash
# Frontend (port 3000)
npm run dev:frontend

# Backend (port 5000)
npm run dev:backend
```

## Kullanım

1. Tarayıcıda `http://localhost:3000` adresine gidin
2. Yeni bir hesap oluşturun veya giriş yapın
3. Dokümanlarınızı yükleyin (PDF, TXT)
4. Arama yapın, sorular sorun veya özetler oluşturun

## Proje Yapısı

```
docuMind/
├── frontend/          # React frontend uygulaması
│   ├── src/
│   │   ├── pages/     # Sayfa bileşenleri
│   │   ├── firebase/  # Firebase yapılandırması
│   │   ├── utils/     # Yardımcı fonksiyonlar
│   │   ├── App.jsx    # Ana uygulama
│   │   └── main.jsx   # Giriş noktası
│   ├── .env.example  # Örnek environment variables
│   └── package.json
├── backend/           # Express backend API
│   ├── routes/        # API route'ları
│   ├── services/      # AI servisleri
│   ├── data/          # Veri dosyaları (JSON) - gitignore'da
│   ├── uploads/       # Yüklenen dosyalar - gitignore'da
│   ├── audio/         # Podcast ses dosyaları - gitignore'da
│   ├── .env.example   # Örnek environment variables
│   └── server.js      # Ana sunucu
├── .gitignore         # Git ignore dosyası
└── package.json       # Root package.json
```

## Güvenlik Notları

⚠️ **ÖNEMLİ**: Bu projeyi GitHub'a yüklemeden önce:

1. ✅ `.env` dosyalarının `.gitignore`'da olduğundan emin olun
2. ✅ `.env.example` dosyalarını kontrol edin (gerçek değerler içermemeli)
3. ✅ Firebase credentials dosyalarının ignore edildiğinden emin olun
4. ✅ `package-lock.json` dosyalarının ignore edilip edilmeyeceğine karar verin (şu anda ignore ediliyor)
5. ✅ Yüklenen dosyalar (`backend/data/`, `backend/uploads/`) ignore ediliyor

## API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Kullanıcı girişi

### Documents
- `GET /api/documents` - Tüm dokümanları listele
- `POST /api/documents/upload` - Doküman yükle (PDF, TXT)
- `POST /api/documents/search` - Dokümanlarda ara
- `POST /api/documents/ask` - Soru sor
- `GET /api/documents/:id/summary` - Doküman özeti al
- `POST /api/documents/summarize-text` - Metin özetleme
- `PUT /api/documents/:id/rename` - Dokümanı yeniden adlandır
- `DELETE /api/documents/:id` - Dokümanı sil

## Lisans

MIT



# mesela kullanıcı isterse podcast isterse video formatında bir ozet secme seceneği olabilir o yuzden ona dikkat edelim ve bu secenegi de ekleyebilriz
