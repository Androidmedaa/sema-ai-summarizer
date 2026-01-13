# Prompt Loglama Scriptleri

Bu klasörde prompt loglama için kullanılan scriptler bulunmaktadır.

## Dosyalar

- `log-prompt.js` - Node.js scripti
- `log-prompt.ps1` - PowerShell scripti (Windows)

## Kullanım

### Node.js Scripti

```bash
node scripts/log-prompt.js [KATEGORI] "Prompt metni"
```

Örnek:
```bash
node scripts/log-prompt.js FEATURE "Yeni özellik ekle"
node scripts/log-prompt.js BUG_FIX "Hata düzelt"
```

### PowerShell Scripti (Windows)

```powershell
.\scripts\log-prompt.ps1 -Prompt "Prompt metni" -Category FEATURE
```

Örnek:
```powershell
.\scripts\log-prompt.ps1 -Prompt "Yeni özellik ekle" -Category FEATURE
.\scripts\log-prompt.ps1 -Prompt "Hata düzelt" -Category BUG_FIX
```

## Kategoriler

- **FEATURE**: Yeni özellik isteği
- **BUG_FIX**: Hata düzeltme
- **CONFIG**: Yapılandırma/Ayarlar
- **UI/UX**: Arayüz tasarımı
- **INTEGRATION**: Entegrasyon (Firebase, API, vb.)
- **DOCUMENTATION**: Dokümantasyon
- **REFACTOR**: Kod iyileştirme
- **QUESTION**: Soru/Bilgi

## Otomatik Loglama

Manuel kullanım için scriptler hazır. Otomatik loglama için:

1. Cursor extension geliştirme
2. Git hook kullanımı
3. API entegrasyonu

gibi yöntemler kullanılabilir.

