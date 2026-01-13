import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Sparkles, Mail, Lock, User, CheckCircle2 } from 'lucide-react'
import { registerUser, loginUser } from '../firebase/auth'
import './AuthPage.css'

function AuthPage({ setIsAuthenticated }) {
  const [searchParams, setSearchParams] = useSearchParams()
  // URL parametresine göre başlangıç modunu belirle (default: login)
  const getInitialMode = () => {
    const urlMode = searchParams.get('mode')
    return urlMode !== 'register' // 'register' değilse login modu
  }
  const [isLogin, setIsLogin] = useState(getInitialMode)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  // URL parametresine göre modu güncelle
  useEffect(() => {
    const urlMode = searchParams.get('mode')
    if (urlMode === 'register') {
      setIsLogin(false)
    } else {
      // 'login' veya mode yoksa login modu
      setIsLogin(true)
    }
  }, [searchParams])

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      let result
      if (isLogin) {
        result = await loginUser(formData.email, formData.password)
      } else {
        if (!formData.name.trim()) {
          setError('Ad Soyad gereklidir')
          setLoading(false)
          return
        }
        result = await registerUser(formData.email, formData.password, formData.name)
      }
      
      if (result.requiresVerification) {
        setInfo(result.message || 'Doğrulama e-postası gönderildi. Lütfen e-postanızı doğrulayın.')
      } else if (result.token) {
        localStorage.setItem('token', result.token)
        localStorage.setItem('user', JSON.stringify(result.user))
        setIsAuthenticated(true)
        // Sayfayı yenile veya dashboard'a yönlendir
        window.location.href = '/dashboard'
      } else {
        setError('Giriş başarısız. Lütfen tekrar deneyin.')
      }
    } catch (err) {
      setError(err.message || 'Bir hata oluştu. Lütfen tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className={`auth-container ${isLogin ? 'login' : 'register'}`}>
        {/* Left Side - Image/Visual */}
        <div className="auth-visual">
          <div className="visual-content">
            <Sparkles className="visual-icon" />
            <h2>SEMA</h2>
            <p>Semantic Analysis</p>
            <div className="visual-features">
              <div className="visual-feature">
                <span>✓</span> Anlamsal Arama
              </div>
              <div className="visual-feature">
                <span>✓</span> AI Özetler
              </div>
              <div className="visual-feature">
                <span>✓</span> Soru-Cevap
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Form */}
        <div className="auth-form-container">
          <div className="auth-form-wrapper">
            <div className="auth-toggle">
              <button
                className={isLogin ? 'active' : ''}
                onClick={() => {
                  setSearchParams({ mode: 'login' })
                  setIsLogin(true)
                }}
              >
                Giriş Yap
              </button>
              <button
                className={!isLogin ? 'active' : ''}
                onClick={() => {
                  setSearchParams({ mode: 'register' })
                  setIsLogin(false)
                }}
              >
                Kayıt Ol
              </button>
            </div>

            <form className="auth-form" onSubmit={handleSubmit}>
              <h1>{isLogin ? 'Hoş Geldiniz' : 'Hesap Oluştur'}</h1>
              <p className="auth-subtitle">
                {isLogin 
                  ? 'Hesabınıza giriş yapın' 
                  : 'Yeni bir hesap oluşturun ve başlayın'}
              </p>

              {!isLogin && (
                <div className="form-group">
                  <label>
                    <User className="input-icon" />
                    Ad Soyad
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required={!isLogin}
                    placeholder="Adınız ve soyadınız"
                  />
                </div>
              )}

              <div className="form-group">
                <label>
                  <Mail className="input-icon" />
                  E-posta
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="ornek@email.com"
                />
              </div>

              <div className="form-group">
                <label>
                  <Lock className="input-icon" />
                  Şifre
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  minLength="6"
                />
              </div>

              {error && <div className="error-message">{error}</div>}
              {info && (
                <div className="info-message">
                  <CheckCircle2 className="info-icon" />
                  {info}
                </div>
              )}

              <button 
                type="submit" 
                className="btn-submit"
                disabled={loading}
              >
                {loading ? 'Yükleniyor...' : (isLogin ? 'Giriş Yap' : 'Kayıt Ol')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AuthPage

