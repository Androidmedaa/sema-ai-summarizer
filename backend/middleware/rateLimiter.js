import rateLimit from 'express-rate-limit'
import { autoBanOnLimitReached, banIP } from './ipBan.js'

// Genel API rate limiter (tüm endpoint'ler için)
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 100, // 15 dakikada en fazla 100 istek
  message: 'Çok fazla istek gönderildi. Lütfen birkaç dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Rate limit aşıldığında IP'yi otomatik banla
    autoBanOnLimitReached(req, res)
  }
})

// Gemini API rate limiter (AI işlemleri için daha sıkı)
export const geminiApiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 10, // 1 dakikada en fazla 10 Gemini API çağrısı
  message: 'Gemini API için çok fazla istek gönderildi. Lütfen bir dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Health check ve bazı GET endpoint'lerini atla
    return req.path === '/api/health' || req.method === 'GET'
  },
  handler: (req, res) => {
    // Gemini API rate limit aşıldığında IP'yi otomatik banla
    autoBanOnLimitReached(req, res)
  }
})

// Login rate limiter (brute force koruması)
// Kullanıcı maksimum 10 kere hatalı giriş yapabilir
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10, // 15 dakikada en fazla 10 login denemesi
  message: 'Çok fazla başarısız giriş denemesi. Lütfen 15 dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Login rate limit aşıldığında IP'yi otomatik banla (2 saat - daha uzun)
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.headers['x-real-ip'] || 
               req.connection?.remoteAddress || 
               'unknown'
    
    banIP(ip, 2 * 60 * 60 * 1000) // 2 saat ban
    
    res.status(429).json({
      error: 'Çok Fazla Giriş Denemesi',
      message: '15 dakika içinde 10 kereden fazla başarısız giriş denemesi yapıldı. IP adresiniz 2 saat boyunca engellenmiştir.',
      retryAfter: 7200 // 2 saat (saniye cinsinden)
    })
  }
})

// Upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20, // 15 dakikada en fazla 20 dosya yükleme
  message: 'Çok fazla dosya yükleme denemesi. Lütfen birkaç dakika sonra tekrar deneyin.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    // Upload rate limit aşıldığında IP'yi otomatik banla
    autoBanOnLimitReached(req, res)
  }
})
