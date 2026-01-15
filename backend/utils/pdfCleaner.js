/**
 * PDF metninden header, footer, query string ve gereksiz kısımları temizler
 * @param {string} text - Ham PDF metni
 * @returns {string} - Temizlenmiş metin
 */
export function cleanPdfText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let cleaned = text

  // 1. Header/Footer pattern'lerini temizle (sayfa numaraları, tarihler, tekrarlayan başlıklar)
  // Örnek: "Sayfa 1 / 10", "1", "2", "3" gibi tek başına sayılar
  cleaned = cleaned.replace(/^Page\s+\d+\s+of\s+\d+$/gim, '')
  cleaned = cleaned.replace(/^Sayfa\s+\d+\s+\/\s+\d+$/gim, '')
  cleaned = cleaned.replace(/^\d{1,3}$/gm, '') // Tek başına 1-3 haneli sayılar (muhtemelen sayfa numarası)
  
  // 2. URL ve query string'leri temizle
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '')
  cleaned = cleaned.replace(/www\.[^\s]+/gi, '')
  cleaned = cleaned.replace(/\?[^\s]+/g, '') // Query string'ler
  
  // 3. Email adreslerini temizle (opsiyonel - eğer istersen kaldırabilirsin)
  // cleaned = cleaned.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '')
  
  // 4. Tekrarlayan boş satırları temizle (3'ten fazla boş satır → 2 boş satır)
  cleaned = cleaned.replace(/\n{4,}/g, '\n\n\n')
  
  // 5. Başlık/footer pattern'leri (genellikle her sayfanın başında/sonunda tekrar eden metinler)
  // Örnek: "Confidential", "Draft", "Page X of Y" gibi
  const commonHeadersFooters = [
    /^Confidential$/gim,
    /^Draft$/gim,
    /^Internal Use Only$/gim,
    /^Proprietary$/gim,
    /^Copyright\s+\d{4}/gim,
    /^©\s+\d{4}/gim,
    /^All rights reserved$/gim,
  ]
  
  commonHeadersFooters.forEach(pattern => {
    cleaned = cleaned.replace(pattern, '')
  })
  
  // 6. Çok kısa satırları temizle (muhtemelen header/footer parçaları)
  // 3 karakterden kısa ve sadece büyük harf içeren satırları temizle
  cleaned = cleaned.split('\n').filter(line => {
    const trimmed = line.trim()
    if (trimmed.length < 3 && trimmed === trimmed.toUpperCase() && /^[A-Z\s]+$/.test(trimmed)) {
      return false
    }
    return true
  }).join('\n')
  
  // 7. Fazla boşlukları temizle
  cleaned = cleaned.replace(/[ \t]+/g, ' ') // Birden fazla boşluk → tek boşluk
  cleaned = cleaned.replace(/\n\s+\n/g, '\n\n') // Satır arası boşlukları temizle
  
  // 8. Başta ve sonda boşlukları temizle
  cleaned = cleaned.trim()
  
  return cleaned
}

/**
 * PDF metninden özel karakterleri ve gereksiz formatlamaları temizler
 * @param {string} text - Ham PDF metni
 * @returns {string} - Temizlenmiş metin
 */
export function sanitizePdfText(text) {
  if (!text || typeof text !== 'string') {
    return ''
  }

  let sanitized = text

  // 1. PDF'den gelen özel karakterleri temizle
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Kontrol karakterleri
  
  // 2. Unicode boşluk karakterlerini normal boşluğa çevir
  sanitized = sanitized.replace(/[\u2000-\u200B\u2028\u2029]/g, ' ')
  
  // 3. Birden fazla boşluk karakterini tek boşluğa indir
  sanitized = sanitized.replace(/ +/g, ' ')
  
  // 4. Birden fazla yeni satırı normalize et
  sanitized = sanitized.replace(/\r\n/g, '\n') // Windows → Unix
  sanitized = sanitized.replace(/\r/g, '\n') // Mac → Unix
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n') // 3+ yeni satır → 2 yeni satır

  return sanitized.trim()
}

/**
 * PDF metnini tamamen temizler (header, footer, query string ve sanitize işlemleri)
 * @param {string} text - Ham PDF metni
 * @returns {string} - Tamamen temizlenmiş metin
 */
export function fullyCleanPdfText(text) {
  let cleaned = cleanPdfText(text)
  cleaned = sanitizePdfText(cleaned)
  return cleaned
}
