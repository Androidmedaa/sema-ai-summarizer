import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect, useRef, useCallback } from 'react'
import LandingPage from './pages/LandingPage'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'
import ProfilePage from './pages/ProfilePage'
import { onAuthStateChange, logoutUser } from './firebase/auth'
import './App.css'

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const timeoutRef = useRef(null)
  const warningTimeoutRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  // Session timeout: 30 dakika (1800000 ms)
  const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 dakika
  const WARNING_TIME = 5 * 60 * 1000 // 5 dakika önce uyarı

  // Otomatik çıkış fonksiyonu
  const handleAutoLogout = useCallback(async () => {
    try {
      await logoutUser()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      alert('Güvenlik nedeniyle oturumunuz sonlandırıldı. Lütfen tekrar giriş yapın.')
      window.location.href = '/auth?mode=login'
    } catch (error) {
      console.error('Auto logout error:', error)
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      window.location.href = '/auth?mode=login'
    }
  }, [])

  // Kullanıcı aktivitesini takip et ve timeout'u sıfırla
  const resetTimeout = useCallback(() => {
    if (!isAuthenticated) return

    lastActivityRef.current = Date.now()

    // Önceki timeout'ları temizle
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current)
    }

    // Uyarı timeout'u (5 dakika önce)
    warningTimeoutRef.current = setTimeout(() => {
      const remainingTime = Math.ceil((SESSION_TIMEOUT - WARNING_TIME) / 1000 / 60)
      const shouldContinue = confirm(
        `Oturumunuz ${remainingTime} dakika sonra sona erecek. Devam etmek istiyor musunuz?`
      )
      if (shouldContinue) {
        resetTimeout() // Kullanıcı devam etmek isterse timeout'u sıfırla
      }
    }, SESSION_TIMEOUT - WARNING_TIME)

    // Otomatik çıkış timeout'u
    timeoutRef.current = setTimeout(() => {
      handleAutoLogout()
    }, SESSION_TIMEOUT)
  }, [isAuthenticated, handleAutoLogout])

  useEffect(() => {
    // Firebase auth state değişikliğini dinle
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        setIsAuthenticated(true)
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        setIsAuthenticated(false)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        // Timeout'ları temizle
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
        }
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current)
        }
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Kullanıcı giriş yaptığında timeout'u başlat
  useEffect(() => {
    if (isAuthenticated) {
      resetTimeout()
    } else {
      // Timeout'ları temizle
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current)
      }
    }
  }, [isAuthenticated, resetTimeout])

  // Kullanıcı aktivite event listener'ları
  useEffect(() => {
    if (!isAuthenticated) return

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    const handleActivity = () => {
      resetTimeout()
    }

    // Event listener'ları ekle
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Sayfa görünürlüğü değişikliğini takip et
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        // Sayfa tekrar görünür olduğunda, son aktiviteden bu yana geçen süreyi kontrol et
        const timeSinceLastActivity = Date.now() - lastActivityRef.current
        if (timeSinceLastActivity >= SESSION_TIMEOUT) {
          handleAutoLogout()
        } else {
          resetTimeout()
        }
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, resetTimeout, handleAutoLogout])

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route 
          path="/auth" 
          element={<AuthPage setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route 
          path="/dashboard" 
          element={
            isAuthenticated ? (
              <Dashboard setIsAuthenticated={setIsAuthenticated} />
            ) : (
              <Navigate to="/auth?mode=login" replace />
            )
          } 
        />
        <Route 
          path="/profile" 
          element={
            isAuthenticated ? (
              <ProfilePage />
            ) : (
              <Navigate to="/auth?mode=login" replace />
            )
          } 
        />
      </Routes>
    </Router>
  )
}

export default App

