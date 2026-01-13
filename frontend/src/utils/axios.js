import axios from 'axios'

// Axios instance oluştur
const api = axios.create({
  baseURL: '/api', // Vite proxy kullanıyor
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor - token ekle (Firebase token)
api.interceptors.request.use(
  async (config) => {
    // Önce localStorage'dan token al
    let token = localStorage.getItem('token')
    
    // Eğer token yoksa Firebase'den al
    if (!token) {
      try {
        const { auth } = await import('../firebase/config')
        const currentUser = auth.currentUser
        if (currentUser) {
          token = await currentUser.getIdToken()
          localStorage.setItem('token', token)
        }
      } catch (error) {
        console.error('Token alınamadı:', error)
      }
    }
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    
    // FormData için Content-Type'ı otomatik ayarla (axios otomatik ayarlar, manuel ayarlamayalım)
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'] // Axios otomatik ayarlasın
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - hata yönetimi
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

export default api

