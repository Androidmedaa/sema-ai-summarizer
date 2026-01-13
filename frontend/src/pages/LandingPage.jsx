import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Upload, Search, MessageSquare, FileText, Sparkles, ArrowRight, Home, Mail, Info, FileText as FileTextIcon, HelpCircle, Shield, BookOpen, LogOut, User, Menu, X, Zap } from 'lucide-react'
import { logoutUser, onAuthStateChange } from '../firebase/auth'
import './LandingPage.css'

function LandingPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [scrolled, setScrolled] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    // Tema tercihini uygula
    const savedTheme = localStorage.getItem('theme') || 'light'
    if (savedTheme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (savedTheme === 'light-green') {
      document.documentElement.setAttribute('data-theme', 'light-green')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }

    // Mouse hareket takibi (Arka plan glow efekti için)
    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    
    // Scroll takibi (Navbar için)
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)

    // localStorage'dan kullanıcı bilgisini kontrol et
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')
    if (token && userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setUser(parsedUser)
        setIsAuthenticated(true)
      } catch (e) {
        console.error('User data parse error:', e)
      }
    }

    // Firebase auth state değişikliğini dinle
    const unsubscribe = onAuthStateChange((user) => {
      if (user) {
        setIsAuthenticated(true)
        setUser(user)
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        setIsAuthenticated(false)
        setUser(null)
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
    })

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('scroll', handleScroll)
      unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUser()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      setUser(null)
      // Eğer zaten anasayfadaysa sadece state'i güncelle, yoksa yönlendir
      if (window.location.pathname === '/') {
        // Zaten anasayfadayız, sadece state güncellendi
      } else {
        navigate('/', { replace: true })
      }
    } catch (error) {
      console.error('Logout error:', error)
      // Hata olsa bile çıkış yap
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      setUser(null)
      if (window.location.pathname !== '/') {
        navigate('/', { replace: true })
      }
    }
  }

  return (
    <div className="landing-page">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="mobile-menu-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      {/* Dynamic Background Glow */}
      <div 
        className="dynamic-glow"
        style={{
          background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, rgba(59, 130, 246, 0.15) 0%, transparent 40%)`
        }}
      />

      {/* Navigation */}
      <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="nav-container">
          <Link to="/" className="logo" onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}>
            <Sparkles className="logo-icon" />
            <span>SEMA</span>
          </Link>
          <button 
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
          <div className={`mobile-menu-container ${isMobileMenuOpen ? 'mobile-menu-open' : ''}`}>
            <div className="nav-menu">
              <a 
                href="#features" 
                className="nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
                  setIsMobileMenuOpen(false);
                }}
              >
                Özellikler
              </a>
              <a 
                href="#how-it-works" 
                className="nav-link"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  setIsMobileMenuOpen(false);
                }}
              >
                Nasıl Çalışır?
              </a>
              <a 
                href="mailto:info@sema.com" 
                className="nav-link"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                İletişim
              </a>
            </div>
            <div className="nav-links">
              {isAuthenticated ? (
                <>
                  <Link to="/profile" className="user-info" onClick={() => setIsMobileMenuOpen(false)}>
                    <User className="user-icon" />
                    <span className="user-name">Profilim</span>
                  </Link>
                  <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="nav-link logout-btn">
                    <LogOut className="logout-icon" />
                    Çıkış Yap
                  </button>
                </>
              ) : (
                <>
                  <Link to="/auth?mode=login" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Giriş Yap</Link>
                  <Link to="/auth?mode=register" className="nav-link btn-primary" onClick={() => setIsMobileMenuOpen(false)}>Kayıt Ol</Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="hero">
        {/* Abstract Floating Shapes */}
        <div className="hero-shape hero-shape-left" />
        <div className="hero-shape hero-shape-right" />
        
        <div className="hero-content">
          <div className="hero-badge">
            <Zap className="hero-badge-icon" />
            <span>Akıllı Doküman Arama Sistemi</span>
          </div>
          
          <h1 className="hero-title">
            Verilerinizi <br />
            <span className="hero-title-gradient">Anlamlı Bilgiye</span> Dönüştürün
          </h1>
          
          <p className="hero-subtitle">
            Dokümanlarınızı yükleyin, anlamsal arama yapın, sorular sorun ve özetler alın.
          </p>
          <div className="hero-buttons">
            {isAuthenticated ? (
              <Link to="/dashboard" className="btn btn-primary btn-large">
                <span>Dashboard'a Git</span>
                <ArrowRight className="btn-icon" />
              </Link>
            ) : (
              <>
                <Link 
                  to={isAuthenticated ? "/dashboard" : "/auth?mode=register"} 
                  className="btn btn-primary btn-large"
                >
                  <span>{isAuthenticated ? "Dashboard'a Git" : "Başlayın"}</span>
                  <ArrowRight className="btn-icon" />
                </Link>
                <a 
                  href="#about" 
                  className="btn btn-secondary btn-large"
                  onClick={(e) => {
                    e.preventDefault()
                    const element = document.getElementById('about')
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                >
                  Daha Fazla Bilgi
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features">
        <div className="container">
          <h2 className="section-title">Özellikler</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Upload />
              </div>
              <h3>Kolay Yükleme</h3>
              <p>PDF, Word ve TXT formatındaki dokümanlarınızı kolayca yükleyin ve saklayın.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <Search />
              </div>
              <h3>Anlamsal Arama</h3>
              <p>Anahtar kelime veya doğal dil kullanarak dokümanlarınızda akıllı arama yapın.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <MessageSquare />
              </div>
              <h3>AI Soru-Cevap</h3>
              <p>Dokümanlarınıza dayalı doğal dil soruları sorun ve bağlama duyarlı cevaplar alın.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FileText />
              </div>
              <h3>Akıllı Özetler</h3>
              <p>Her doküman için otomatik kısa özetler ve isteğe bağlı detaylı özetler oluşturun.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <h2 className="section-title">Nasıl Çalışır?</h2>
          <div className="steps">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Doküman Yükle</h3>
              <p>PDF, Word veya TXT formatındaki dosyalarınızı sisteme yükleyin.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Ara veya Sor</h3>
              <p>Anahtar kelime ile arama yapın veya doğal dilde sorular sorun.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Özet Al</h3>
              <p>Dokümanlarınız için otomatik özetler oluşturun ve analiz edin.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about">
        <div className="container">
          <h2 className="section-title">Hakkımızda</h2>
          <div className="about-content">
            <p className="about-text">
              SEMA (Semantic Analysis), dokümanlarınızı yapay zeka destekli semantik analiz ile 
              anlamlı bilgilere dönüştüren modern bir doküman yönetim sistemidir.
            </p>
            <p className="about-text">
              Dokümanlarınızda akıllı arama yapabilir, sorular sorabilir ve otomatik özetler oluşturabilirsiniz.
            </p>
            <div className="about-features">
              <div className="about-feature">
                <h3>🎯 Misyonumuz</h3>
                <p>Kullanıcıların dokümanlarını daha verimli yönetmesini ve bilgiye daha hızlı erişmesini sağlamak.</p>
              </div>
              <div className="about-feature">
                <h3>💡 Teknoloji</h3>
                <p>En son yapay zeka teknolojileri ile güçlendirilmiş, kullanıcı dostu bir platform.</p>
              </div>
              <div className="about-feature">
                <h3>🔒 Güvenlik</h3>
                <p>Dokümanlarınız güvenli bir şekilde saklanır ve yalnızca size aittir.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta">
        <div className="container">
          <h2>Hemen Başlayın</h2>
          <p>Dokümanlarınızı yönetmek ve akıllı arama yapmak için hemen kayıt olun.</p>
          <Link 
            to={isAuthenticated ? "/dashboard" : "/auth?mode=register"} 
            className="btn btn-primary btn-large"
          >
            {isAuthenticated ? "Dashboard'a Git" : "Ücretsiz Başlayın"}
            <ArrowRight className="btn-icon" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            {/* Brand Section */}
            <div className="footer-section">
              <div className="footer-brand">
                <div className="logo">
                  <Sparkles className="logo-icon" />
                  <span>SEMA</span>
                </div>
                <p className="footer-description">
                  Semantic Analysis - Akıllı doküman arama ve yönetim sistemi. 
                  Anlamsal arama ile dokümanlarınızı kolayca yönetin.
                </p>
              </div>
            </div>

            {/* About Section */}
            <div className="footer-section">
              <h3 className="footer-title">Yardım & Destek</h3>
              <ul className="footer-links">
                <li>
                  <a href="#how-it-works" className="footer-link" onClick={(e) => {
                    e.preventDefault();
                    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                  }}>
                    <HelpCircle className="footer-link-icon" />
                    Sık Sorulan Sorular
                  </a>
                </li>
                <li>
                  <Link to="/auth?mode=login" className="footer-link">
                    <FileText className="footer-link-icon" />
                    Dokümantasyon
                  </Link>
                </li>
                <li>
                  <a href="mailto:destek@sema.com" className="footer-link">
                    <Mail className="footer-link-icon" />
                    Destek
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link" onClick={(e) => {
                    e.preventDefault();
                    alert('Yardım merkezi yakında eklenecektir.');
                  }}>
                    <HelpCircle className="footer-link-icon" />
                    Yardım Merkezi
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal & Contact */}
            <div className="footer-section">
              <h3 className="footer-title">Yasal & Güvenlik</h3>
              <ul className="footer-links">
                <li>
                  <a href="#" className="footer-link" onClick={(e) => {
                    e.preventDefault();
                    alert('Gizlilik Politikası sayfası yakında eklenecektir.');
                  }}>
                    <Shield className="footer-link-icon" />
                    Gizlilik Politikası
                  </a>
                </li>
                <li>
                  <a href="#" className="footer-link" onClick={(e) => {
                    e.preventDefault();
                    alert('Kullanım Şartları sayfası yakında eklenecektir.');
                  }}>
                    <Shield className="footer-link-icon" />
                    Kullanım Şartları
                  </a>
                </li>
                <li>
                  <Link to="/auth?mode=login" className="footer-link">
                    <Sparkles className="footer-link-icon" />
                    Giriş Yap / Kayıt Ol
                  </Link>
                </li>
                <li>
                  <a href="#" className="footer-link" onClick={(e) => {
                    e.preventDefault();
                    alert('Çerez Politikası sayfası yakında eklenecektir.');
                  }}>
                    <Shield className="footer-link-icon" />
                    Çerez Politikası
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="footer-bottom">
            <p>&copy; 2024 SEMA - Semantic Analysis. Tüm hakları saklıdır.</p>
            <div className="footer-social">
              <span>Bizi takip edin:</span>
              <a href="#" className="social-link" aria-label="Twitter">Twitter</a>
              <a href="#" className="social-link" aria-label="LinkedIn">LinkedIn</a>
              <a href="#" className="social-link" aria-label="GitHub">GitHub</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

