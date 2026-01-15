# Vercel Deployment Rehberi

Bu rehber, SEMA projesini Vercel'e deploy etmek için adım adım talimatlar içerir.

## ⚠️ ÖNEMLİ: Domain ve CORS Açıklaması

**Vercel otomatik olarak domain verecek**, ancak:
- Backend ve Frontend'i **ayrı ayrı deploy** etmeniz gerekiyor (monorepo yapısı)
- Her birinin **kendi domain'i** olacak:
  - Backend: `https://sema-backend.vercel.app`
  - Frontend: `https://sema-frontend.vercel.app`
- Frontend, backend'e istek atarken **farklı domain'den** geldiği için **CORS hatası** alırsınız
- Bu yüzden backend'in `CORS_ORIGINS` ayarında frontend domain'inin olması gerekiyor

**Çözüm**: Deployment sonrası Vercel'in verdiği domain'leri birbirine bağlamanız gerekiyor.

## 📋 Ön Hazırlık

1. **GitHub Repository**: Kodunuzun GitHub'da olduğundan emin olun
2. **Vercel Hesabı**: [vercel.com](https://vercel.com) üzerinden hesap oluşturun
3. **Environment Variables**: Aşağıdaki değerleri hazırlayın:
   - JWT_SECRET (güçlü bir secret key)
   - GEMINI_API_KEY (Google Gemini API anahtarı)
   - Firebase credentials (eğer kullanıyorsanız)

## 🚀 Deployment Adımları

### 1. Backend Deployment

#### 1.1 Vercel'e Proje Ekleme
1. Vercel dashboard'a gidin
2. "Add New Project" butonuna tıklayın
3. GitHub repository'nizi seçin
4. **Root Directory** olarak `backend` klasörünü seçin

#### 1.2 Build Ayarları
- **Framework Preset**: Other
- **Build Command**: `npm install` (veya `npm ci`)
- **Output Directory**: `.` (backend root directory)
- **Install Command**: `npm install`

#### 1.3 Environment Variables (Backend)
Vercel dashboard'da **Settings > Environment Variables** bölümüne gidin ve şunları ekleyin:

```
NODE_ENV=production
PORT=5000
JWT_SECRET=your-super-secret-jwt-key-here
GEMINI_API_KEY=your-gemini-api-key-here
CORS_ORIGINS=http://localhost:3000
```

**⚠️ ÖNEMLİ**: `CORS_ORIGINS` değerini şimdilik localhost olarak bırakın. **Frontend deployment sonrası Vercel'in verdiği frontend domain'ini buraya ekleyeceğiz.**

#### 1.4 Backend Deploy
1. "Deploy" butonuna tıklayın
2. Deployment tamamlandıktan sonra, **Vercel otomatik olarak size bir URL verecek** (örn: `https://sema-backend-abc123.vercel.app`)
3. **Bu URL'yi not edin** - frontend deployment için gerekecek

#### 1.5 Backend CORS Güncelleme
**Frontend deployment sonrası**, backend'in **Settings > Environment Variables** bölümüne geri dönün ve `CORS_ORIGINS` değerini güncelleyin:

```
CORS_ORIGINS=https://your-frontend-app.vercel.app
```

**Örnek**: Eğer frontend URL'iniz `https://sema-frontend-xyz789.vercel.app` ise:
```
CORS_ORIGINS=https://sema-frontend-xyz789.vercel.app
```

**Not**: 
- Birden fazla domain için virgülle ayırın: `https://domain1.com,https://domain2.com`
- Development için localhost'u da ekleyebilirsiniz: `https://frontend.vercel.app,http://localhost:3000`
- Güncelleme sonrası backend'i **yeniden deploy** edin (Settings > Redeploy)

### 2. Frontend Deployment

#### 2.1 Vercel'e Proje Ekleme
1. Vercel dashboard'a gidin
2. "Add New Project" butonuna tıklayın
3. Aynı GitHub repository'nizi seçin
4. **Root Directory** olarak `frontend` klasörünü seçin

#### 2.2 Build Ayarları
- **Framework Preset**: Vite
- **Build Command**: `npm run build` (otomatik algılanır)
- **Output Directory**: `dist` (otomatik algılanır)
- **Install Command**: `npm install`

#### 2.3 Environment Variables (Frontend)
Vercel dashboard'da **Settings > Environment Variables** bölümüne gidin ve şunları ekleyin:

```
VITE_API_URL=https://your-backend-app.vercel.app/api
```

**⚠️ ÖNEMLİ**: `your-backend-app.vercel.app` kısmını backend deployment'ınızdan aldığınız gerçek URL ile değiştirin.

#### 2.4 Frontend Deploy
1. "Deploy" butonuna tıklayın
2. Deployment tamamlandıktan sonra, **Vercel otomatik olarak size bir URL verecek** (örn: `https://sema-frontend-xyz789.vercel.app`)
3. **Bu URL'yi not edin** - backend CORS ayarı için gerekecek

#### 2.5 Backend CORS'u Güncelleme (ÖNEMLİ!)
Frontend URL'inizi aldıktan sonra:

1. **Backend projenize** Vercel dashboard'dan gidin
2. **Settings > Environment Variables** bölümüne gidin
3. `CORS_ORIGINS` değerini bulun ve **Edit** butonuna tıklayın
4. Değeri şu şekilde güncelleyin (frontend URL'inizi kullanarak):
   ```
   https://sema-frontend-xyz789.vercel.app
   ```
   (Kendi frontend URL'inizi kullanın!)
5. **Save** butonuna tıklayın
6. **Deployments** sekmesine gidin ve **Redeploy** butonuna tıklayın

**Bu adım olmadan frontend backend'e bağlanamaz ve CORS hatası alırsınız!**

### 3. Custom Domain (Opsiyonel)

Eğer kendi domain'inizi kullanmak istiyorsanız:

1. Vercel dashboard'da projenize gidin
2. **Settings > Domains** bölümüne gidin
3. Domain'inizi ekleyin ve DNS ayarlarını yapın
4. Domain eklendikten sonra, backend'in `CORS_ORIGINS` değerine yeni domain'i ekleyin

## 🔧 Troubleshooting

### CORS Hatası Alıyorum
- Backend'in `CORS_ORIGINS` environment variable'ında frontend URL'inizin olduğundan emin olun
- URL'lerin `https://` ile başladığından emin olun
- Backend'i yeniden deploy edin

### API Bağlantı Hatası
- Frontend'in `VITE_API_URL` environment variable'ının doğru olduğundan emin olun
- Backend URL'inin `/api` ile bittiğinden emin olun (örn: `https://backend.vercel.app/api`)
- Browser console'da network hatalarını kontrol edin

### Environment Variables Güncellenmiyor
- Environment variable'ları güncelledikten sonra projeyi yeniden deploy edin
- Vercel'de environment variable'ların hangi environment için geçerli olduğunu kontrol edin (Production, Preview, Development)

## 📝 Özet Checklist

- [ ] Backend'i Vercel'e deploy ettim
- [ ] Backend URL'ini not ettim
- [ ] Frontend'i Vercel'e deploy ettim
- [ ] Frontend'in `VITE_API_URL` environment variable'ını backend URL ile güncelledim
- [ ] Backend'in `CORS_ORIGINS` environment variable'ını frontend URL ile güncelledim
- [ ] Her iki projeyi de yeniden deploy ettim
- [ ] Test ettim ve çalıştığını doğruladım

## 🎉 Tamamlandı!

Artık projeniz canlıda! Herhangi bir sorun yaşarsanız, Vercel'in log'larını kontrol edin veya yukarıdaki troubleshooting bölümüne bakın.
