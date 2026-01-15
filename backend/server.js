import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import authRoutes from './routes/auth.js'
import documentRoutes from './routes/documents.js'
import { apiLimiter, loginLimiter } from './middleware/rateLimiter.js'
import { ipBanMiddleware } from './middleware/ipBan.js'

dotenv.config()

// Production kontrolleri
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction) {
  // JWT_SECRET zorunlu kontrolü
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your-secret-key-change-in-production') {
    console.error('❌ PRODUCTION HATASI: JWT_SECRET environment variable zorunludur ve default değer kullanılamaz!')
    process.exit(1)
  }
  
  // GEMINI_API_KEY kontrolü (opsiyonel ama önerilir)
  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️ UYARI: GEMINI_API_KEY tanımlı değil. AI özellikleri çalışmayacak.')
  }
}

// Debug: Check if environment variables are loaded
console.log('🔧 Environment check:')
console.log('  - NODE_ENV:', process.env.NODE_ENV || 'development')
console.log('  - PORT:', process.env.PORT || '5000 (default)')
console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? (isProduction ? '✅ Set (hidden)' : '✅ Set') : '❌ Missing')
console.log('  - GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✅ Set (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : '❌ Missing')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// CORS Configuration - Environment variable ile yönetim
const corsOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000', 
      'http://127.0.0.1:3000',
      'http://localhost:3001', 
      'http://127.0.0.1:3001'
    ]

// Middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))

// IP Ban Middleware - Banlı IP'lerden gelen istekleri engelle
app.use('/api', ipBanMiddleware)

// Rate limiting - Tüm API endpoint'leri için
app.use('/api', apiLimiter)

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Trust proxy for accurate IP addresses
app.set('trust proxy', true)

// Create necessary directories
const uploadsDir = path.join(__dirname, 'uploads')
const dataDir = path.join(__dirname, 'data')

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

// Routes
// Login endpoint'ine özel rate limiting
app.use('/api/auth/login', loginLimiter)
app.use('/api/auth', authRoutes)
app.use('/api/documents', documentRoutes)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'SEMA API is running' })
})

app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`)
  console.log(`📡 API endpoint: http://localhost:${PORT}/api`)
  console.log(`🔍 Health check: http://localhost:${PORT}/api/health`)
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`)
    console.error('Please stop the other application or change PORT in .env')
  } else {
    console.error('❌ Server error:', err)
  }
  process.exit(1)
})

