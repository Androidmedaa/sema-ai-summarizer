// Firebase Admin SDK - isteğe bağlı
// Şimdilik kullanmıyoruz, token decode ile çalışıyoruz
// firebase-admin paketi yüklü değilse bu dosya hata vermez
let firebaseAdmin = null

// Firebase Admin SDK kullanmak isterseniz:
// 1. npm install firebase-admin
// 2. Aşağıdaki kodu aktif edin
/*
try {
  import('firebase-admin').then(admin => {
    firebaseAdmin = admin.default.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || 'semadb-e2a17'
    })
  }).catch(() => {
    // Paket yüklü değil, sorun değil
  })
} catch (error) {
  // Admin SDK yoksa sorun değil, basit decode kullanacağız
}
*/

export default firebaseAdmin

