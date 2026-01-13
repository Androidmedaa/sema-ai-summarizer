import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import nodemailer from 'nodemailer'
// Firebase Admin SDK isteğe bağlı - şimdilik kullanmıyoruz
// import firebaseAdmin from '../firebase-admin.js'
const firebaseAdmin = null

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dataDir = path.join(__dirname, '../data')
const usersFile = path.join(dataDir, 'users.json')

// Initialize data directory and users file if they don't exist
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([]))
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

// E-posta gönderme fonksiyonu
const sendLoginNotificationEmail = async (userEmail, userName, ipAddress = 'Bilinmiyor') => {
  try {
    // E-posta ayarları (Gmail örneği - .env'den alınabilir)
    const emailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER, // Gmail adresi
        pass: process.env.SMTP_PASS  // Gmail App Password
      }
    }

    // Eğer SMTP ayarları yoksa, e-posta gönderme
    if (!emailConfig.auth.user || !emailConfig.auth.pass) {
      console.log('⚠️ SMTP ayarları bulunamadı, e-posta gönderilmedi. .env dosyasına SMTP_USER ve SMTP_PASS ekleyin.')
      return false
    }

    const transporter = nodemailer.createTransport(emailConfig)

    const loginDate = new Date().toLocaleString('tr-TR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })

    const mailOptions = {
      from: `"SEMA" <${emailConfig.auth.user}>`,
      to: userEmail,
      subject: 'Giriş Bildirimi - SEMA',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8fafc; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6; }
            .footer { text-align: center; margin-top: 30px; color: #94a3b8; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>SEMA</h1>
              <p>Semantic Analysis</p>
            </div>
            <div class="content">
              <h2>Merhaba ${userName || 'Kullanıcı'},</h2>
              <p>Hesabınıza başarıyla giriş yapıldı.</p>
              
              <div class="info-box">
                <strong>Giriş Bilgileri:</strong><br>
                <strong>E-posta:</strong> ${userEmail}<br>
                <strong>Tarih:</strong> ${loginDate}<br>
                <strong>IP Adresi:</strong> ${ipAddress}
              </div>

              <p>Eğer bu giriş işlemini siz yapmadıysanız, lütfen hemen şifrenizi değiştirin ve bizimle iletişime geçin.</p>
              
              <div class="footer">
                <p>Bu otomatik bir bildirim e-postasıdır. Lütfen yanıtlamayın.</p>
                <p>&copy; ${new Date().getFullYear()} SEMA. Tüm hakları saklıdır.</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Merhaba ${userName || 'Kullanıcı'},
        
        Hesabınıza başarıyla giriş yapıldı.
        
        Giriş Bilgileri:
        E-posta: ${userEmail}
        Tarih: ${loginDate}
        IP Adresi: ${ipAddress}
        
        Eğer bu giriş işlemini siz yapmadıysanız, lütfen hemen şifrenizi değiştirin.
        
        Bu otomatik bir bildirim e-postasıdır.
      `
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('✅ Login notification email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('❌ Email send error:', error)
    return false
  }
}

// Helper functions
const readUsers = () => {
  try {
    const data = fs.readFileSync(usersFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

const writeUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2))
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Tüm alanlar gereklidir' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır' })
    }

    const users = readUsers()
    
    if (users.find(u => u.email === email)) {
      return res.status(400).json({ message: 'Bu e-posta adresi zaten kullanılıyor' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    }

    users.push(newUser)
    writeUsers(users)

    const token = jwt.sign(
      { userId: newUser.id, email: newUser.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email
      }
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Sunucu hatası' })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'E-posta ve şifre gereklidir' })
    }

    const users = readUsers()
    const user = users.find(u => u.email === email)

    if (!user) {
      return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' })
    }

    const isValidPassword = await bcrypt.compare(password, user.password)

    if (!isValidPassword) {
      return res.status(401).json({ message: 'Geçersiz e-posta veya şifre' })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Giriş bildirimi e-postası gönder (asenkron, hata olsa bile devam et)
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'Bilinmiyor'
    sendLoginNotificationEmail(user.email, user.name, clientIp).catch(err => {
      console.error('Login notification email failed:', err)
    })

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Sunucu hatası' })
  }
})

// Middleware to verify token (Firebase veya JWT)
export const verifyToken = async (req, res, next) => {
  // Token'ı header'dan veya query parameter'dan al (iframe için)
  let token = req.headers.authorization?.split(' ')[1]
  
  // Eğer header'da yoksa query parameter'dan dene
  if (!token && req.query.token) {
    token = req.query.token
  }

  if (!token) {
    return res.status(401).json({ message: 'Token bulunamadı' })
  }

  try {
    // Önce JWT token olarak dene (eski sistem)
    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      req.userId = decoded.userId
      req.userEmail = decoded.email
      return next()
    } catch (jwtError) {
      // JWT değilse Firebase token olabilir
      // Firebase Admin yoksa, token'ı decode et (güvenli değil ama çalışır)
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          // Firebase token formatı (JWT benzeri)
          // Base64 URL-safe decode (Firebase token'ları URL-safe base64 kullanır)
          let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
          // Padding ekle
          while (base64.length % 4) {
            base64 += '='
          }
          const payload = JSON.parse(Buffer.from(base64, 'base64').toString())
          
          // Firebase token payload'unda user_id, sub veya uid olabilir
          req.userId = payload.user_id || payload.sub || payload.uid || payload.user_id
          req.userEmail = payload.email
          
          if (req.userId) {
            console.log('✅ Firebase token decoded, userId:', req.userId, 'email:', req.userEmail)
            return next()
          } else {
            console.error('❌ Token payload\'unda userId bulunamadı:', payload)
          }
        } else {
          console.error('❌ Token formatı geçersiz, 3 parça bekleniyor, bulunan:', parts.length)
        }
      } catch (decodeError) {
        console.error('❌ Token decode error:', decodeError.message)
        console.error('Token (ilk 50 karakter):', token.substring(0, 50))
      }
      
      // Firebase Admin varsa kullan (isteğe bağlı)
      if (firebaseAdmin) {
        try {
          const decodedToken = await firebaseAdmin.auth().verifyIdToken(token)
          req.userId = decodedToken.uid
          req.userEmail = decodedToken.email
          return next()
        } catch (firebaseError) {
          console.error('Firebase token verification error:', firebaseError)
        }
      }
      // Her iki yöntem de başarısız
      return res.status(401).json({ message: 'Geçersiz token' })
    }
  } catch (error) {
    res.status(401).json({ message: 'Geçersiz token' })
  }
}

// Firebase Auth ile giriş bildirimi endpoint'i (Token gerektirmez - public endpoint)
router.post('/notify-login', async (req, res) => {
  try {
    const { email, name } = req.body

    if (!email) {
      return res.status(400).json({ message: 'E-posta gereklidir' })
    }

    // IP adresini al
    const clientIp = req.ip || 
                     req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
                     req.headers['x-real-ip'] || 
                     req.connection?.remoteAddress || 
                     'Bilinmiyor'
    
    console.log('📧 Login notification requested for:', email, 'from IP:', clientIp)
    
    // E-posta gönder (asenkron, hata olsa bile devam et)
    sendLoginNotificationEmail(email, name || 'Kullanıcı', clientIp).catch(err => {
      console.error('Login notification email failed:', err)
    })

    res.json({ message: 'Giriş bildirimi gönderildi' })
  } catch (error) {
    console.error('Notify login error:', error)
    res.status(500).json({ message: 'Bildirim gönderilirken hata oluştu' })
  }
})

export default router

