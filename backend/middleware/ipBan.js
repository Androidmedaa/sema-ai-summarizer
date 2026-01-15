/**
 * IP Ban Middleware
 * Aynı IP'den çok fazla istek gelirse IP'yi belirli bir süre engeller
 */

// Banned IP'ler ve ban süreleri (memory'de tutuluyor)
const bannedIPs = new Map() // IP -> ban bitiş zamanı (timestamp)

// Ban süresi (milisaniye cinsinden)
const BAN_DURATION = 60 * 60 * 1000 // 1 saat

/**
 * IP'yi banla
 * @param {string} ip - Banlanacak IP adresi
 * @param {number} durationMs - Ban süresi (milisaniye), varsayılan 1 saat
 */
export function banIP(ip, durationMs = BAN_DURATION) {
  const banUntil = Date.now() + durationMs
  bannedIPs.set(ip, banUntil)
  console.log(`🚫 IP banned: ${ip} until ${new Date(banUntil).toISOString()}`)
}

/**
 * IP'nin banlı olup olmadığını kontrol et
 * @param {string} ip - Kontrol edilecek IP adresi
 * @returns {boolean} - Banlı ise true
 */
export function isIPBanned(ip) {
  const banUntil = bannedIPs.get(ip)
  if (!banUntil) {
    return false
  }
  
  // Ban süresi dolmuşsa temizle
  if (Date.now() > banUntil) {
    bannedIPs.delete(ip)
    console.log(`✅ IP ban expired: ${ip}`)
    return false
  }
  
  return true
}

/**
 * IP ban middleware'i
 * Banlı IP'lerden gelen istekleri reddeder
 */
export function ipBanMiddleware(req, res, next) {
  // IP adresini al
  const ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             'unknown'
  
  // IP banlı mı kontrol et
  if (isIPBanned(ip)) {
    const banUntil = bannedIPs.get(ip)
    const remainingMinutes = Math.ceil((banUntil - Date.now()) / (60 * 1000))
    
    console.log(`🚫 Blocked request from banned IP: ${ip} (${remainingMinutes} minutes remaining)`)
    
    return res.status(403).json({
      error: 'IP Engellendi',
      message: `Bu IP adresi ${remainingMinutes} dakika boyunca engellenmiştir. Çok fazla istek gönderildiği için geçici olarak erişim kısıtlandı.`,
      retryAfter: remainingMinutes * 60 // Saniye cinsinden
    })
  }
  
  next()
}

/**
 * Rate limit aşıldığında IP'yi otomatik banla
 * Bu fonksiyon rate limiter'ın onLimitReached callback'i olarak kullanılabilir
 */
export function autoBanOnLimitReached(req, res) {
  const ip = req.ip || 
             req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
             req.headers['x-real-ip'] || 
             req.connection?.remoteAddress || 
             'unknown'
  
  // IP'yi banla (1 saat)
  banIP(ip, BAN_DURATION)
  
  // Rate limit hatası döndür
  res.status(429).json({
    error: 'Çok Fazla İstek',
    message: 'Çok fazla istek gönderildi. IP adresiniz 1 saat boyunca engellenmiştir.',
    retryAfter: 3600 // 1 saat (saniye cinsinden)
  })
}

/**
 * Tüm banlı IP'leri temizle (opsiyonel - admin için)
 */
export function clearAllBans() {
  bannedIPs.clear()
  console.log('✅ All IP bans cleared')
}

/**
 * Belirli bir IP'nin banını kaldır (opsiyonel - admin için)
 */
export function unbanIP(ip) {
  bannedIPs.delete(ip)
  console.log(`✅ IP unbanned: ${ip}`)
}

/**
 * Banlı IP listesini al (opsiyonel - admin için)
 */
export function getBannedIPs() {
  const now = Date.now()
  const activeBans = []
  
  bannedIPs.forEach((banUntil, ip) => {
    if (banUntil > now) {
      activeBans.push({
        ip,
        bannedUntil: new Date(banUntil).toISOString(),
        remainingMinutes: Math.ceil((banUntil - now) / (60 * 1000))
      })
    }
  })
  
  return activeBans
}

// Eski banları temizlemek için periyodik temizlik (her 10 dakikada bir)
setInterval(() => {
  const now = Date.now()
  let cleaned = 0
  
  bannedIPs.forEach((banUntil, ip) => {
    if (banUntil <= now) {
      bannedIPs.delete(ip)
      cleaned++
    }
  })
  
  if (cleaned > 0) {
    console.log(`🧹 Cleaned ${cleaned} expired IP bans`)
  }
}, 10 * 60 * 1000) // 10 dakika
