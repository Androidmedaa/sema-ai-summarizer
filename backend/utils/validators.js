/**
 * Input Validation Utilities
 * Email ve şifre format kontrolleri için yardımcı fonksiyonlar
 */

/**
 * Email formatını kontrol et
 * @param {string} email - Kontrol edilecek email adresi
 * @returns {object} - { valid: boolean, error: string }
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'E-posta adresi gereklidir' }
  }

  const trimmedEmail = email.trim().toLowerCase()

  // Boş kontrolü
  if (trimmedEmail.length === 0) {
    return { valid: false, error: 'E-posta adresi boş olamaz' }
  }

  // Uzunluk kontrolü (RFC 5321: 64 karakter local part + @ + 255 karakter domain = max 320 karakter)
  if (trimmedEmail.length > 320) {
    return { valid: false, error: 'E-posta adresi çok uzun (maksimum 320 karakter)' }
  }

  // Temel email format kontrolü (regex)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
  
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, error: 'Geçersiz e-posta formatı. Örnek: kullanici@example.com' }
  }

  // @ işareti kontrolü
  if (trimmedEmail.indexOf('@') === -1) {
    return { valid: false, error: 'E-posta adresi @ işareti içermelidir' }
  }

  // @ işaretinden önce ve sonra karakter kontrolü
  const parts = trimmedEmail.split('@')
  if (parts.length !== 2) {
    return { valid: false, error: 'Geçersiz e-posta formatı' }
  }

  const [localPart, domain] = parts

  // Local part kontrolü (örn: kullanici)
  if (localPart.length === 0) {
    return { valid: false, error: 'E-posta adresinin @ işaretinden önce kısmı boş olamaz' }
  }

  if (localPart.length > 64) {
    return { valid: false, error: 'E-posta adresinin @ işaretinden önce kısmı çok uzun (maksimum 64 karakter)' }
  }

  // Domain kontrolü
  if (domain.length === 0) {
    return { valid: false, error: 'E-posta adresinin @ işaretinden sonra kısmı (domain) boş olamaz' }
  }

  if (domain.length > 255) {
    return { valid: false, error: 'E-posta adresinin domain kısmı çok uzun (maksimum 255 karakter)' }
  }

  // Domain'de nokta kontrolü
  if (domain.indexOf('.') === -1) {
    return { valid: false, error: 'E-posta adresinin domain kısmı geçerli bir domain içermelidir (örn: .com, .org)' }
  }

  // Ardışık nokta kontrolü
  if (trimmedEmail.includes('..')) {
    return { valid: false, error: 'E-posta adresinde ardışık nokta (..) bulunamaz' }
  }

  // Başta/sonda nokta kontrolü
  if (localPart.startsWith('.') || localPart.endsWith('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return { valid: false, error: 'E-posta adresinde başta veya sonda nokta bulunamaz' }
  }

  return { valid: true, email: trimmedEmail }
}

/**
 * Şifre formatını kontrol et
 * @param {string} password - Kontrol edilecek şifre
 * @returns {object} - { valid: boolean, error: string }
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Şifre gereklidir' }
  }

  // Boş kontrolü
  if (password.length === 0) {
    return { valid: false, error: 'Şifre boş olamaz' }
  }

  // Minimum uzunluk kontrolü
  if (password.length < 6) {
    return { valid: false, error: 'Şifre en az 6 karakter olmalıdır' }
  }

  // Maksimum uzunluk kontrolü (güvenlik için)
  if (password.length > 128) {
    return { valid: false, error: 'Şifre çok uzun (maksimum 128 karakter)' }
  }

  // Boşluk kontrolü (şifrelerde boşluk olmamalı)
  if (password.includes(' ')) {
    return { valid: false, error: 'Şifre boşluk içeremez' }
  }

  // Null karakter kontrolü
  if (password.includes('\0')) {
    return { valid: false, error: 'Şifre geçersiz karakter içeriyor' }
  }

  return { valid: true }
}

/**
 * Login input'larını validate et
 * @param {string} email - Email adresi
 * @param {string} password - Şifre
 * @returns {object} - { valid: boolean, errors: object }
 */
export function validateLoginInput(email, password) {
  const emailValidation = validateEmail(email)
  const passwordValidation = validatePassword(password)

  const errors = {}
  if (!emailValidation.valid) {
    errors.email = emailValidation.error
  }
  if (!passwordValidation.valid) {
    errors.password = passwordValidation.error
  }

  return {
    valid: emailValidation.valid && passwordValidation.valid,
    errors,
    email: emailValidation.email || email
  }
}
