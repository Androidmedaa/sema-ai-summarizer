# 🚀 SEMA Çalıştırma Rehberi

## Adım 1: Bağımlılıkları Yükleyin

Proje kök dizininde (sema klasöründe) terminal açın ve şu komutu çalıştırın:

```bash
npm run install:all
```

Bu komut:
- Root dizindeki bağımlılıkları yükler
- Frontend bağımlılıklarını yükler
- Backend bağımlılıklarını yükler

## Adım 2: Backend .env Dosyası Oluşturun

`backend` klasöründe `.env` dosyası oluşturun:

**Windows PowerShell:**
```powershell
cd backend
Copy-Item env.example .env
```

**Manuel olarak:**
1. `backend` klasörüne gidin
2. `env.example` dosyasını kopyalayın
3. Adını `.env` olarak değiştirin

`.env` dosyası şu içeriğe sahip olmalı:
```env
PORT=5000
JWT_SECRET=/NgeXuRGKHSSr0PQJV/bXafetg+ckd3n3X1mxNE0Sl8=
GEMINI_API_KEY=AIzaSyDdjlUG2uUm7vRflaBvHSDDliaj0SNK_Qc
```

## Adım 3: Uygulamayı Başlatın

### Yöntem 1: Her İkisini Birlikte (Önerilen)

Proje kök dizininde:
```bash
npm run dev
```

Bu komut hem frontend hem backend'i birlikte başlatır.

### Yöntem 2: Ayrı Ayrı Başlatma

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

## Adım 4: Tarayıcıda Açın

Uygulama başladıktan sonra tarayıcınızda şu adresi açın:

```
http://localhost:3000
```

Backend API şu adreste çalışır:
```
http://localhost:5000
```

## ✅ Kontrol Listesi

- [ ] `npm run install:all` komutu başarıyla çalıştı
- [ ] `backend/.env` dosyası oluşturuldu ve API anahtarları eklendi
- [ ] `npm run dev` komutu çalıştırıldı
- [ ] Backend port 5000'de çalışıyor
- [ ] Frontend port 3000'de çalışıyor
- [ ] Tarayıcıda http://localhost:3000 açıldı

## 🐛 Sorun Giderme

### "Port already in use" hatası
- Port 3000 veya 5000 kullanımda olabilir
- Çalışan uygulamaları kapatın veya portları değiştirin

### "Module not found" hatası
- `npm run install:all` komutunu tekrar çalıştırın

### Backend başlamıyor
- `backend/.env` dosyasının var olduğundan emin olun
- `backend` klasöründe `npm install` çalıştırın

### Frontend başlamıyor
- `frontend` klasöründe `npm install` çalıştırın

## 📝 İlk Kullanım

1. Tarayıcıda http://localhost:3000 açın
2. "Kayıt Ol" butonuna tıklayın
3. Ad, e-posta ve şifre girin
4. Giriş yaptıktan sonra doküman yükleyebilirsiniz

## 🎉 Hazırsınız!

Artık SEMA'yı kullanmaya başlayabilirsiniz!

