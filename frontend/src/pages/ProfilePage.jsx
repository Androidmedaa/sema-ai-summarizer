import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Lock, ArrowLeft, CheckCircle2, X } from 'lucide-react'
import { updateUserEmail, updateUserPassword, getCurrentUser } from '../firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import './ProfilePage.css'

function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [activeTab, setActiveTab] = useState('email') // 'email' veya 'password'
  
  // Email güncelleme formu
  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    password: ''
  })
  
  // Şifre güncelleme formu
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  
  const [updating, setUpdating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    loadUserData()
  }, [])

  const loadUserData = async () => {
    try {
      const currentUser = getCurrentUser()
      if (!currentUser) {
        navigate('/auth?mode=login')
        return
      }

      // Firestore'dan kullanıcı bilgilerini al
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
      const userData = userDoc.data()

      setUser({
        uid: currentUser.uid,
        email: currentUser.email,
        name: userData?.name || currentUser.displayName || ''
      })
      setEmailForm(prev => ({ ...prev, newEmail: currentUser.email || '' }))
    } catch (error) {
      console.error('Error loading user data:', error)
      setError('Kullanıcı bilgileri yüklenemedi')
    } finally {
      setLoading(false)
    }
  }

  const handleEmailUpdate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUpdating(true)

    try {
      if (!emailForm.newEmail || !emailForm.password) {
        setError('Lütfen tüm alanları doldurun')
        setUpdating(false)
        return
      }

      if (emailForm.newEmail === user.email) {
        setError('Yeni e-posta adresi mevcut e-posta ile aynı olamaz')
        setUpdating(false)
        return
      }

      await updateUserEmail(emailForm.newEmail, emailForm.password)
      setSuccess('E-posta adresi başarıyla güncellendi')
      setEmailForm(prev => ({ ...prev, password: '' }))
      await loadUserData() // Kullanıcı bilgilerini yeniden yükle
    } catch (err) {
      setError(err.message || 'E-posta güncellenirken hata oluştu')
    } finally {
      setUpdating(false)
    }
  }

  const handlePasswordUpdate = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setUpdating(true)

    try {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        setError('Lütfen tüm alanları doldurun')
        setUpdating(false)
        return
      }

      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        setError('Yeni şifreler eşleşmiyor')
        setUpdating(false)
        return
      }

      if (passwordForm.newPassword.length < 6) {
        setError('Şifre en az 6 karakter olmalıdır')
        setUpdating(false)
        return
      }

      await updateUserPassword(passwordForm.currentPassword, passwordForm.newPassword)
      setSuccess('Şifre başarıyla güncellendi')
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
    } catch (err) {
      setError(err.message || 'Şifre güncellenirken hata oluştu')
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading">Yükleniyor...</div>
      </div>
    )
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <button onClick={() => navigate('/')} className="back-btn">
            <ArrowLeft />
            Geri Dön
          </button>
          <h1>Profil Ayarları</h1>
        </div>

        <div className="profile-content">
          {/* Kullanıcı Bilgileri */}
          <div className="profile-info-card">
            <div className="profile-avatar">
              <User className="avatar-icon" />
            </div>
            <div className="profile-details">
              <h2>{user?.name || 'Kullanıcı'}</h2>
              <p className="profile-email">{user?.email}</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="profile-tabs">
            <button
              className={`tab-btn ${activeTab === 'email' ? 'active' : ''}`}
              onClick={() => setActiveTab('email')}
            >
              <Mail />
              E-posta Güncelle
            </button>
            <button
              className={`tab-btn ${activeTab === 'password' ? 'active' : ''}`}
              onClick={() => setActiveTab('password')}
            >
              <Lock />
              Şifre Güncelle
            </button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="message error-message">
              <X className="message-icon" />
              {error}
            </div>
          )}
          {success && (
            <div className="message success-message">
              <CheckCircle2 className="message-icon" />
              {success}
            </div>
          )}

          {/* Email Update Form */}
          {activeTab === 'email' && (
            <form className="profile-form" onSubmit={handleEmailUpdate}>
              <div className="form-group">
                <label>
                  <Mail className="input-icon" />
                  Yeni E-posta Adresi
                </label>
                <input
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, newEmail: e.target.value }))}
                  placeholder="ornek@email.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <Lock className="input-icon" />
                  Mevcut Şifre (Doğrulama için)
                </label>
                <input
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
              </div>
              <button type="submit" className="btn-submit" disabled={updating}>
                {updating ? 'Güncelleniyor...' : 'E-postayı Güncelle'}
              </button>
            </form>
          )}

          {/* Password Update Form */}
          {activeTab === 'password' && (
            <form className="profile-form" onSubmit={handlePasswordUpdate}>
              <div className="form-group">
                <label>
                  <Lock className="input-icon" />
                  Mevcut Şifre
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))}
                  placeholder="••••••••"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <Lock className="input-icon" />
                  Yeni Şifre
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="••••••••"
                  minLength="6"
                  required
                />
              </div>
              <div className="form-group">
                <label>
                  <Lock className="input-icon" />
                  Yeni Şifre (Tekrar)
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="••••••••"
                  minLength="6"
                  required
                />
              </div>
              <button type="submit" className="btn-submit" disabled={updating}>
                {updating ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProfilePage

