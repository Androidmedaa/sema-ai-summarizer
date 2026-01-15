import { useState, useEffect } from 'react'
import React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import api from '../utils/axios'
import { 
  Upload, Search, MessageSquare, FileText, LogOut, 
  X, Download, Sparkles, Loader, MoreVertical, 
  Trash2, Share2, Eye, Copy, File, FileSpreadsheet,
  FolderPlus, Folder, Grid3x3, List, ArrowLeft, SortAsc, Pencil, ChevronDown, Home,
  ChevronLeft, ChevronRight, Play, Pause, Volume2, ChevronUp, Sun, Moon, User,
  ClipboardList, Trash, ArrowUpDown, Move
} from 'lucide-react'
import './Dashboard.css'

function Dashboard({ setIsAuthenticated }) {
  // Markdown formatını HTML'e çevir (bold, italic, vb.)
  const parseMarkdown = (text) => {
    if (!text) return ''
    // Önce HTML karakterlerini escape et (XSS koruması)
    let escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    
    // Markdown formatlarını HTML'e çevir (sıra önemli!)
    let parsed = escaped
      // Bold: **text** veya __text__ (önce bold, sonra italic)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>') // **bold** -> <strong>bold</strong>
      .replace(/__([^_]+)__/g, '<strong>$1</strong>') // __bold__ -> <strong>bold</strong>
      // Italic: *text* veya _text_ (bold'dan sonra, tek * veya _)
      .replace(/\*([^*\s][^*]*[^*\s])\*/g, '<em>$1</em>') // *italic* -> <em>italic</em>
      .replace(/_([^_\s][^_]*[^_\s])_/g, '<em>$1</em>') // _italic_ -> <em>italic</em>
      // Code: `code`
      .replace(/`([^`]+)`/g, '<code>$1</code>') // `code` -> <code>code</code>
      // Strikethrough: ~~text~~
      .replace(/~~([^~]+)~~/g, '<del>$1</del>') // ~~strikethrough~~ -> <del>strikethrough</del>
      // Link: [text](url)
      .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // [link](url) -> <a>link</a>
      // Satır sonlarını <br> ile değiştir
      .replace(/\n/g, '<br>')
    
    return parsed
  }

  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState(null)
  const [summary, setSummary] = useState(null)
  const [generatingSummary, setGeneratingSummary] = useState(false)
  const [viewingDoc, setViewingDoc] = useState(null) // Açılan doküman
  const [docContent, setDocContent] = useState(null) // Doküman içeriği
  const [openMenuId, setOpenMenuId] = useState(null) // Açık menü ID'si
  const [menuPositions, setMenuPositions] = useState({}) // Her doküman için menü pozisyonu
  const [editingContent, setEditingContent] = useState(null) // Düzenlenen içerik
  const [currentPage, setCurrentPage] = useState('documents') // 'documents', 'trash', 'summarize'
  const [trashItems, setTrashItems] = useState([]) // Çöp kutusu öğeleri
  const [summaryText, setSummaryText] = useState('') // Özetlenecek metin
  const [summaryResult, setSummaryResult] = useState('') // Özetlenmiş metin
  const [summaryLength, setSummaryLength] = useState(50) // Özet uzunluğu (%)
  const [summaryLanguage, setSummaryLanguage] = useState('Turkish') // Özet dili
  const [isSummarizing, setIsSummarizing] = useState(false) // Özetleme durumu
  const [isEditing, setIsEditing] = useState(false) // Düzenleme modu
  const [folders, setFolders] = useState([]) // Klasörler
  const [currentFolderId, setCurrentFolderId] = useState(null) // Açık klasör ID'si
  const [viewMode, setViewMode] = useState('list') // 'grid' veya 'list' - varsayılan: list
  const [sortBy, setSortBy] = useState('uploadedAt') // 'uploadedAt', 'modifiedAt', 'name'
  const [filterByType, setFilterByType] = useState('all') // 'all', 'pdf', 'txt'
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [folderPath, setFolderPath] = useState([]) // Breadcrumb için klasör yolu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
  })
  const [documentContextMenu, setDocumentContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    docId: null,
  })
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameDocId, setRenameDocId] = useState(null)
  const [newDocumentName, setNewDocumentName] = useState('')
  const [showNewMenu, setShowNewMenu] = useState(false) // "Yeni" butonu dropdown menüsü
  const [showMoveModal, setShowMoveModal] = useState(false) // Yer değiştir modal
  const [moveDocId, setMoveDocId] = useState(null) // Yer değiştirilecek dosya ID
  const [moveTargetIndex, setMoveTargetIndex] = useState(null) // Hedef pozisyon
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    // Büyük ekranlarda varsayılan olarak açık, küçük ekranlarda kapalı
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024
    }
    return true
  }) // Sidebar açık/kapalı durumu
  const [isMobile, setIsMobile] = useState(() => {
    // Ekran boyutunu kontrol et
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024
    }
    return false
  })
  const [summaryFormat, setSummaryFormat] = useState('short') // 'short', 'detailed', 'podcast'
  const [docQuestion, setDocQuestion] = useState('') // Doküman bazlı soru
  const [docAnswer, setDocAnswer] = useState(null) // Doküman bazlı cevap
  const [askingDocQuestion, setAskingDocQuestion] = useState(false) // Soru soruluyor mu
  const [audioUrl, setAudioUrl] = useState(null) // Podcast ses dosyası URL'i
  const [isPlaying, setIsPlaying] = useState(false) // Ses çalınıyor mu
  const [audioElement, setAudioElement] = useState(null) // Audio element referansı
  const [folderSummary, setFolderSummary] = useState(null) // Klasör özeti
  const [loadingFolderSummary, setLoadingFolderSummary] = useState(false) // Klasör özeti yükleniyor mu
  const [showFolderSummary, setShowFolderSummary] = useState(true) // Klasör özeti göster/gizle
  const [theme, setTheme] = useState(() => {
    // localStorage'dan tema tercihini yükle, varsayılan: 'light' (Mavi tema)
    const savedTheme = localStorage.getItem('theme') || 'light'
    // Eğer hiç tema seçilmemişse varsayılan olarak mavi (light) tema kullan
    if (!localStorage.getItem('theme')) {
      localStorage.setItem('theme', 'light')
    }
    return savedTheme
  })
  const [customColor, setCustomColor] = useState(() => {
    // localStorage'dan özel renk tercihini yükle
    return localStorage.getItem('customThemeColor') || '#3b82f6'
  })
  const [showColorPicker, setShowColorPicker] = useState(false) // Renk seçici göster/gizle
  const [generatingCustomTheme, setGeneratingCustomTheme] = useState(false) // Özel tema oluşturuluyor mu
  const navigate = useNavigate()

  const user = JSON.parse(localStorage.getItem('user') || '{}')

  // Dosya boyutunu formatla
  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  // Get file type and icon based on document type (sadece PDF ve TXT destekleniyor)
  const getFileTypeInfo = (doc) => {
    const type = (doc.type || '').toLowerCase()
    const filename = (doc.filename || doc.name || '').toLowerCase()
    
    if (type === 'pdf' || filename.endsWith('.pdf')) {
      return { 
        type: 'pdf', 
        icon: FileText, 
        color: '#dc2626', // Kırmızı
        bgColor: 'rgba(220, 38, 38, 0.1)',
        borderColor: 'rgba(220, 38, 38, 0.3)'
      }
    } else if (type === 'txt' || filename.endsWith('.txt')) {
      return { 
        type: 'txt', 
        icon: File, 
        color: '#6b7280', // Gri
        bgColor: 'rgba(107, 114, 128, 0.1)',
        borderColor: 'rgba(107, 114, 128, 0.3)'
      }
    }
    
    // Default (eski Word/Excel dosyaları için varsayılan görünüm)
    return { 
      type: 'default', 
      icon: FileText, 
      color: '#3b82f6', 
      bgColor: 'rgba(59, 130, 246, 0.1)',
      borderColor: 'rgba(59, 130, 246, 0.3)'
    }
  }

  // Klasör özeti yükle
  const loadFolderSummary = async () => {
    // Eğer doküman yoksa özet yükleme
    if (documents.length === 0 && folders.length === 0) {
      setFolderSummary(null)
      return
    }
    
    setLoadingFolderSummary(true)
    
    try {
      const folderId = currentFolderId || 'root'
      
      // Mevcut klasördeki dokümanları filtrele - çöp kutusundaki dokümanları hariç tut
      const folderDocs = documents.filter(doc => {
        // Çöp kutusundaki dokümanları hariç tut
        if (doc.isDeleted === true) return false
        
        if (folderId === 'root' || !folderId) {
          return !doc.folderId || doc.folderId === null || doc.folderId === ''
        }
        return doc.folderId === folderId || doc.folderId === String(folderId) || String(doc.folderId) === String(folderId)
      })
      
      // Eğer klasörde doküman yoksa özet yükleme
      if (folderDocs.length === 0) {
        setFolderSummary(null)
        setLoadingFolderSummary(false)
        return
      }
      
      // Dokümanları backend'e gönder (Firebase'den gelen dokümanlar için)
      const documentsParam = encodeURIComponent(JSON.stringify(folderDocs))
      const response = await api.get(`/documents/folder/${folderId}/summary?documents=${documentsParam}`)
      setFolderSummary(response.data)
    } catch (err) {
      console.error('Klasör özeti yükleme hatası:', err)
      // Hata olsa bile devam et
      setFolderSummary(null)
    } finally {
      setLoadingFolderSummary(false)
    }
  }

  // Çöp kutusu öğelerini yükle
  const loadTrashItems = async () => {
    try {
      const { auth } = await import('../firebase/config')
      const { getTrashDocuments } = await import('../firebase/documents')
      const currentUser = auth.currentUser
      
      if (!currentUser) return
      
      // Firebase'den çöp kutusundaki dokümanları getir
      const trashDocs = await getTrashDocuments(currentUser.uid)
      
      // 3 günden eski öğeleri filtrele
      const now = new Date()
      const filteredItems = trashDocs.filter(doc => {
        const deletedDate = new Date(doc.deletedAt || doc.uploadedAt)
        const daysDiff = (now - deletedDate) / (1000 * 60 * 60 * 24)
        return daysDiff < 3
      })
      
      setTrashItems(filteredItems.map(doc => ({
        id: doc.id,
        backendId: doc.backendId || doc.id,
        type: 'document',
        data: doc,
        deletedAt: doc.deletedAt || new Date().toISOString()
      })))
    } catch (err) {
      console.error('Error loading trash items:', err)
    }
  }

  // Öğeyi geri al
  const handleRestoreItem = async (item) => {
    try {
      const { auth } = await import('../firebase/config')
      const { restoreDocumentFromTrash } = await import('../firebase/documents')
      const currentUser = auth.currentUser
      
      if (!currentUser) {
        alert('Oturum bulunamadı')
        return
      }
      
      // Firebase'de dokümanı geri al
      const firebaseDocId = item.data?.id || item.id
      if (firebaseDocId) {
        await restoreDocumentFromTrash(firebaseDocId)
      }
      
      // Çöp kutusu listesinden kaldır
      setTrashItems(trashItems.filter(i => i.id !== item.id))
      
      alert('Öğe başarıyla geri alındı')
      
      // Dokümanları yeniden yükle
      if (currentPage === 'documents') {
        loadDocuments()
      } else if (currentPage === 'trash') {
        loadTrashItems()
      }
    } catch (err) {
      console.error('Error restoring item:', err)
      alert('Öğe geri alınırken hata oluştu: ' + (err.message || 'Bilinmeyen hata'))
    }
  }

  // Kalıcı olarak sil
  const handlePermanentlyDeleteItem = async (item) => {
    if (!confirm('Bu öğeyi kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
      return
    }
    
    try {
      const { auth } = await import('../firebase/config')
      const { deleteDocument } = await import('../firebase/documents')
      const currentUser = auth.currentUser
      
      if (!currentUser) {
        alert('Oturum bulunamadı')
        return
      }
      
      // Firebase'den tamamen sil
      const firebaseDocId = item.data?.id || item.id
      if (firebaseDocId) {
        await deleteDocument(firebaseDocId, item.data?.filepath || '')
      }
      
      // Backend'den de sil
      const backendId = item.backendId || item.data?.backendId
      if (backendId) {
        try {
          await api.delete(`/documents/${backendId}`)
        } catch (err) {
          console.error('Backend delete error:', err)
        }
      }
      
      // Çöp kutusu listesinden kaldır
      setTrashItems(trashItems.filter(i => i.id !== item.id))
      
      alert('Öğe kalıcı olarak silindi')
    } catch (err) {
      console.error('Error permanently deleting item:', err)
      alert('Öğe silinirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'))
    }
  }

  // Tema değiştirme fonksiyonu
  const changeTheme = (newTheme) => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    const root = document.documentElement
    
    // HTML element'e data-theme attribute ekle
    if (newTheme === 'dark') {
      root.setAttribute('data-theme', 'dark')
      // Özel tema inline style'larını temizle
      root.style.removeProperty('--bg-primary')
      root.style.removeProperty('--bg-secondary')
      root.style.removeProperty('--bg-tertiary')
      root.style.removeProperty('--accent-blue')
      root.style.removeProperty('--accent-blue-light')
      root.style.removeProperty('--accent-blue-dark')
      root.style.removeProperty('--accent-purple')
      root.style.removeProperty('--text-primary')
      root.style.removeProperty('--text-secondary')
      root.style.removeProperty('--text-muted')
      root.style.removeProperty('--border-color')
    } else if (newTheme === 'light-green') {
      root.setAttribute('data-theme', 'light-green')
      // Özel tema inline style'larını temizle
      root.style.removeProperty('--bg-primary')
      root.style.removeProperty('--bg-secondary')
      root.style.removeProperty('--bg-tertiary')
      root.style.removeProperty('--accent-blue')
      root.style.removeProperty('--accent-blue-light')
      root.style.removeProperty('--accent-blue-dark')
      root.style.removeProperty('--accent-purple')
      root.style.removeProperty('--text-primary')
      root.style.removeProperty('--text-secondary')
      root.style.removeProperty('--text-muted')
      root.style.removeProperty('--border-color')
    } else if (newTheme === 'custom') {
      root.setAttribute('data-theme', 'custom')
      // Özel tema renklerini yükle
      const savedColors = localStorage.getItem('customThemeColors')
      if (savedColors) {
        try {
          const themeColors = JSON.parse(savedColors)
          root.style.setProperty('--bg-primary', themeColors.bgPrimary)
          root.style.setProperty('--bg-secondary', themeColors.bgSecondary)
          root.style.setProperty('--bg-tertiary', themeColors.bgTertiary)
          root.style.setProperty('--accent-blue', themeColors.accentBlue)
          root.style.setProperty('--accent-blue-light', themeColors.accentBlueLight)
          root.style.setProperty('--accent-blue-dark', themeColors.accentBlueDark)
          root.style.setProperty('--accent-purple', themeColors.accentPurple)
          root.style.setProperty('--text-primary', themeColors.textPrimary)
          root.style.setProperty('--text-secondary', themeColors.textSecondary)
          root.style.setProperty('--text-muted', themeColors.textMuted)
          root.style.setProperty('--border-color', themeColors.borderColor)
        } catch (e) {
          console.error('Özel tema renkleri yüklenemedi:', e)
        }
      }
    } else {
      root.removeAttribute('data-theme')
      // Özel tema inline style'larını temizle
      root.style.removeProperty('--bg-primary')
      root.style.removeProperty('--bg-secondary')
      root.style.removeProperty('--bg-tertiary')
      root.style.removeProperty('--accent-blue')
      root.style.removeProperty('--accent-blue-light')
      root.style.removeProperty('--accent-blue-dark')
      root.style.removeProperty('--accent-purple')
      root.style.removeProperty('--text-primary')
      root.style.removeProperty('--text-secondary')
      root.style.removeProperty('--text-muted')
      root.style.removeProperty('--border-color')
    }
  }

  // Özel renk ile tema oluştur (Gemini AI ile)
  const generateCustomTheme = async (selectedColor) => {
    setGeneratingCustomTheme(true)
    try {
      const response = await api.post('/documents/generate-theme', { color: selectedColor })
      
      if (response.data && response.data.theme) {
        // Gemini'den gelen tema renklerini uygula
        const themeColors = response.data.theme
        
        console.log('Tema renkleri:', themeColors) // Debug için
        
        // CSS değişkenlerini dinamik olarak güncelle
        const root = document.documentElement
        
        // Önce mevcut inline style'ları temizle (varsa)
        root.style.removeProperty('--bg-primary')
        root.style.removeProperty('--bg-secondary')
        root.style.removeProperty('--bg-tertiary')
        root.style.removeProperty('--accent-blue')
        root.style.removeProperty('--accent-blue-light')
        root.style.removeProperty('--accent-blue-dark')
        root.style.removeProperty('--accent-purple')
        root.style.removeProperty('--text-primary')
        root.style.removeProperty('--text-secondary')
        root.style.removeProperty('--text-muted')
        root.style.removeProperty('--border-color')
        
        // Yeni renkleri uygula
        root.style.setProperty('--bg-primary', themeColors.bgPrimary)
        root.style.setProperty('--bg-secondary', themeColors.bgSecondary)
        root.style.setProperty('--bg-tertiary', themeColors.bgTertiary)
        root.style.setProperty('--accent-blue', themeColors.accentBlue)
        root.style.setProperty('--accent-blue-light', themeColors.accentBlueLight)
        root.style.setProperty('--accent-blue-dark', themeColors.accentBlueDark)
        root.style.setProperty('--accent-purple', themeColors.accentPurple)
        root.style.setProperty('--text-primary', themeColors.textPrimary)
        root.style.setProperty('--text-secondary', themeColors.textSecondary)
        root.style.setProperty('--text-muted', themeColors.textMuted)
        root.style.setProperty('--border-color', themeColors.borderColor)
        
        // Tema tercihini kaydet
        setTheme('custom')
        localStorage.setItem('theme', 'custom')
        localStorage.setItem('customThemeColors', JSON.stringify(themeColors))
        localStorage.setItem('customThemeColor', selectedColor)
        document.documentElement.setAttribute('data-theme', 'custom')
        
        // Kısa bir gecikme ile sayfanın render edilmesini bekle
        setTimeout(() => {
          console.log('CSS değişkenleri uygulandı:', {
            bgPrimary: getComputedStyle(root).getPropertyValue('--bg-primary'),
            accentBlue: getComputedStyle(root).getPropertyValue('--accent-blue'),
            textPrimary: getComputedStyle(root).getPropertyValue('--text-primary')
          })
          
          // Body'nin arka plan rengini kontrol et
          const body = document.body
          const computedBg = window.getComputedStyle(body).backgroundColor
          console.log('Body arka plan rengi:', computedBg)
        }, 100)
        
        setShowColorPicker(false)
        
        // State güncellemesi için kısa bir gecikme
        setTimeout(() => {
          alert('Özel tema başarıyla oluşturuldu!')
        }, 200)
      }
    } catch (err) {
      console.error('Özel tema oluşturma hatası:', err)
      alert('Özel tema oluşturulurken hata oluştu: ' + (err.response?.data?.message || err.message))
    } finally {
      setGeneratingCustomTheme(false)
    }
  }

  // Sayfa yüklendiğinde tema tercihini uygula
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark')
    } else if (theme === 'light-green') {
      document.documentElement.setAttribute('data-theme', 'light-green')
    } else if (theme === 'custom') {
      document.documentElement.setAttribute('data-theme', 'custom')
      // Özel tema renklerini yükle
      const savedColors = localStorage.getItem('customThemeColors')
      if (savedColors) {
        try {
          const themeColors = JSON.parse(savedColors)
          const root = document.documentElement
          root.style.setProperty('--bg-primary', themeColors.bgPrimary)
          root.style.setProperty('--bg-secondary', themeColors.bgSecondary)
          root.style.setProperty('--bg-tertiary', themeColors.bgTertiary)
          root.style.setProperty('--accent-blue', themeColors.accentBlue)
          root.style.setProperty('--accent-blue-light', themeColors.accentBlueLight)
          root.style.setProperty('--accent-blue-dark', themeColors.accentBlueDark)
          root.style.setProperty('--accent-purple', themeColors.accentPurple)
          root.style.setProperty('--text-primary', themeColors.textPrimary)
          root.style.setProperty('--text-secondary', themeColors.textSecondary)
          root.style.setProperty('--text-muted', themeColors.textMuted)
          root.style.setProperty('--border-color', themeColors.borderColor)
        } catch (e) {
          console.error('Özel tema renkleri yüklenemedi:', e)
        }
      }
    } else {
      document.documentElement.removeAttribute('data-theme')
      // Özel tema renklerini temizle
      const root = document.documentElement
      root.style.removeProperty('--bg-primary')
      root.style.removeProperty('--bg-secondary')
      root.style.removeProperty('--bg-tertiary')
      root.style.removeProperty('--accent-blue')
      root.style.removeProperty('--accent-blue-light')
      root.style.removeProperty('--accent-blue-dark')
      root.style.removeProperty('--accent-purple')
      root.style.removeProperty('--text-primary')
      root.style.removeProperty('--text-secondary')
      root.style.removeProperty('--text-muted')
      root.style.removeProperty('--border-color')
    }
  }, [theme])

  // Ekran boyutuna göre sidebar'ı otomatik aç/kapat
  useEffect(() => {
    const handleResize = () => {
      const isLargeScreen = window.innerWidth >= 1024
      setIsMobile(!isLargeScreen)
      
      // Büyük ekranlarda (1024px+) otomatik açık, küçük ekranlarda kapalı
      if (isLargeScreen) {
        setIsSidebarOpen(true)
      } else {
        setIsSidebarOpen(false)
      }
    }

    // İlk yüklemede kontrol et
    handleResize()

    // Ekran boyutu değiştiğinde kontrol et
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    // Token varsa dokümanları ve klasörleri yükle
    const token = localStorage.getItem('token')
    if (token) {
      loadDocuments()
      loadFolders()
      loadFolderPath() // Breadcrumb yolu yükle
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentFolderId])


  // Dokümanlar yüklendikten sonra klasör özetini yükle
  useEffect(() => {
    if (documents.length > 0 || folders.length > 0) {
      const timer = setTimeout(() => {
        loadFolderSummary()
      }, 300) // Kısa bir gecikme ile çalıştır (dokümanlar yüklenene kadar bekle)
      
      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length, folders.length, currentFolderId])

  const loadFolders = async () => {
    try {
      const { auth } = await import('../firebase/config')
      const { getUserFolders } = await import('../firebase/documents')
      const currentUser = auth.currentUser

      if (!currentUser) return

      const userFolders = await getUserFolders(currentUser.uid, currentFolderId)
      setFolders(userFolders)
    } catch (err) {
      console.error('Error loading folders:', err)
    }
  }

  // Breadcrumb yolu yükle (klasör hiyerarşisi)
  const loadFolderPath = async () => {
    if (!currentFolderId) {
      setFolderPath([])
      return
    }

    try {
      const { auth } = await import('../firebase/config')
      const { getFolder } = await import('../firebase/documents')
      const currentUser = auth.currentUser

      if (!currentUser) return

      const path = []
      let folderId = currentFolderId

      // Klasör hiyerarşisini yukarı doğru takip et
      while (folderId) {
        const folder = await getFolder(folderId)
        if (folder) {
          path.unshift(folder) // Başa ekle
          folderId = folder.parentFolderId
        } else {
          break
        }
      }

      setFolderPath(path)
    } catch (err) {
      console.error('Error loading folder path:', err)
      setFolderPath([])
    }
  }

  const loadDocuments = async () => {
    setLoading(true)
    try {
      // Firebase token'ı al
      const { auth } = await import('../firebase/config')
      const { getUserDocuments } = await import('../firebase/documents')
      const currentUser = auth.currentUser
      
      if (!currentUser) {
        console.warn('Kullanıcı oturumu bulunamadı')
        setIsAuthenticated(false)
        navigate('/auth')
        return
      }
      
      // Token'ı al ve localStorage'a kaydet
      const token = await currentUser.getIdToken()
      localStorage.setItem('token', token)
      
      // Firebase'den dokümanları getir (currentFolderId'ye göre filtrele)
      console.log('📂 Dokümanlar yükleniyor, currentFolderId:', currentFolderId)
      const userDocuments = await getUserDocuments(currentUser.uid, currentFolderId)
      console.log('📄 Yüklenen dokümanlar:', {
        count: userDocuments.length,
        folderId: currentFolderId,
        documents: userDocuments.map(doc => ({
          filename: doc.filename,
          folderId: doc.folderId,
          id: doc.id
        }))
      })
      setDocuments(userDocuments)
    } catch (err) {
      console.error('Error loading documents:', err)
      if (err.response?.status === 401) {
        setIsAuthenticated(false)
        navigate('/auth')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Dosya boyutu kontrolü (10MB limit)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      alert('Dosya boyutu çok büyük! Maksimum 10MB yükleyebilirsiniz.')
      return
    }

    // Dosya formatı kontrolü (Sadece PDF ve TXT kabul ediliyor)
    const allowedTypes = ['.pdf', '.txt']
    const fileExt = '.' + file.name.split('.').pop().toLowerCase()
    if (!allowedTypes.includes(fileExt)) {
      alert('Desteklenmeyen dosya formatı! Sadece PDF ve TXT dosyaları yüklenebilir.')
      return
    }

    // Aynı isimde dosya kontrolü (aynı klasörde)
    const duplicateFile = documents.find(doc => {
      const docFilename = (doc.filename || doc.name || '').toLowerCase().trim()
      const uploadFilename = file.name.toLowerCase().trim()
      // Silinmemiş dosyaları kontrol et ve aynı klasörde olmalı
      const docFolderId = doc.folderId || doc.parentFolderId || null
      const currentFolderIdStr = currentFolderId ? String(currentFolderId) : null
      const docFolderIdStr = docFolderId ? String(docFolderId) : null
      return !doc.isDeleted && 
             docFilename === uploadFilename &&
             docFolderIdStr === currentFolderIdStr
    })
    
    if (duplicateFile) {
      const confirmReplace = confirm(`"${file.name}" isimli bir dosya zaten mevcut. Mevcut dosyayı silip yeni dosyayı yüklemek istiyor musunuz?`)
      if (!confirmReplace) {
        e.target.value = '' // Input'u temizle
        return
      }
      
      // Mevcut dosyayı sil (onay zaten alındı, doğrudan sil)
      try {
        const docToDelete = duplicateFile
        const docIdStr = String(docToDelete._id || docToDelete.id || docToDelete.backendId)
        
        // Backend ID'yi belirle
        const backendId = docToDelete.backendId || docToDelete.id || docToDelete._id
        const firebaseDocId = docToDelete.id || docToDelete._id

        // Firebase'de dokümanı çöp kutusuna taşı (isDeleted flag'i ekle)
        const { auth } = await import('../firebase/config')
        const { moveDocumentToTrash } = await import('../firebase/documents')
        const currentUser = auth.currentUser
        
        if (currentUser && firebaseDocId) {
          await moveDocumentToTrash(firebaseDocId)
        }

        // Backend'den sil
        if (backendId) {
          try {
            await api.delete(`/documents/${backendId}`)
          } catch (err) {
            console.error('Backend delete error:', err)
          }
        }

        // State'den kaldır
        setDocuments(prevDocs => prevDocs.filter(doc => {
          const docIdStr2 = String(doc._id || doc.id || doc.backendId)
          return docIdStr2 !== docIdStr
        }))
        
        // Doküman listesini yenile
        await loadDocuments()
      } catch (deleteError) {
        console.error('Mevcut dosya silinirken hata:', deleteError)
        alert('Mevcut dosya silinirken bir hata oluştu. Lütfen tekrar deneyin.')
        e.target.value = '' // Input'u temizle
        return
      }
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)
    // Eğer bir klasör içindeysek, folderId'yi ekle
    if (currentFolderId) {
      formData.append('folderId', currentFolderId)
    }

    try {
      // Backend bağlantısını kontrol et
      try {
        await api.get('/health')
      } catch (healthError) {
        console.warn('⚠️ Health check failed, but continuing with upload...')
      }

      console.log('📤 Dosya yükleme başlatılıyor:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        currentFolderId: currentFolderId || 'root'
      })
      
      // Backend'e yükle
      const response = await api.post('/documents/upload', formData, {
        timeout: 120000, // 120 saniye timeout (büyük dosyalar için)
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            console.log(`📤 Yükleme ilerlemesi: ${percentCompleted}%`)
          }
        }
      })
      
      console.log('✅ Backend yükleme başarılı:', response.data)
      
      // Backend'den gelen dosyayı folderId ile birleştir
      // Backend'den gelen folderId'yi kullan, yoksa currentFolderId'yi kullan
      const finalFolderId = response.data.folderId !== undefined ? response.data.folderId : (currentFolderId || null)
      
      const uploadedDocument = {
        ...response.data,
        folderId: finalFolderId, // Klasör ID'sini ekle
        fileSize: response.data.fileSize || file.size // Dosya boyutunu ekle
      }
      
      console.log('📝 Yüklenen dosya bilgileri:', {
        filename: uploadedDocument.filename,
        folderId: uploadedDocument.folderId,
        currentFolderId: currentFolderId,
        backendFolderId: response.data.folderId
      })
      
      // Hemen state'e ekle (kullanıcı görebilsin)
      setDocuments([...documents, uploadedDocument])
      
      alert('Doküman başarıyla yüklendi!')
      
      // Firebase'e kayıt işlemini yap ve sonra listeyi yenile
      try {
        const { auth } = await import('../firebase/config')
        const { saveDocumentToFirestore } = await import('../firebase/documents')
        const currentUser = auth.currentUser
        
        if (currentUser && uploadedDocument) {
          console.log('📤 Firebase Firestore\'a kayıt başlatılıyor...', {
            folderId: finalFolderId,
            currentFolderId: currentFolderId
          })
          // Sadece Firestore'a metadata kaydet (Storage olmadan, daha hızlı)
          // folderId'yi string'e çevir (Firestore'da string olarak saklanmalı)
          const folderIdForFirestore = finalFolderId ? String(finalFolderId) : null
          
          await saveDocumentToFirestore(
            currentUser.uid,
            {
              id: uploadedDocument.id || uploadedDocument._id,
              filename: file.name,
              type: uploadedDocument.type,
              text: uploadedDocument.text || '',
              summary: uploadedDocument.summary || '',
              keywords: uploadedDocument.keywords || [],
              folderId: folderIdForFirestore, // Klasör ID'sini ekle (string olarak)
              fileSize: uploadedDocument.fileSize || file.size // Dosya boyutunu ekle
            }
          )
          console.log('✅ Doküman Firebase Firestore\'a başarıyla kaydedildi, folderId:', finalFolderId)
        }
      } catch (firebaseError) {
        console.error('❌ Firebase\'e kayıt hatası:', firebaseError)
        // Firebase hatası olsa bile devam et, backend'de zaten kayıtlı
      }
      
      // Dosya yüklendikten sonra listeyi yenile (Firebase'den güncel verileri al)
      // Bu sayede hem backend hem Firebase'den gelen dosyalar senkronize olur
      console.log('🔄 Doküman listesi yenileniyor, currentFolderId:', currentFolderId)
      await loadDocuments()
      
    } catch (err) {
      console.error('❌ Yükleme hatası:', err)
      console.error('Hata detayları:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        statusText: err.response?.statusText,
        code: err.code,
        request: err.request
      })
      
      let errorMessage = 'Yükleme hatası oluştu'
      let errorDetails = ''
      
      if (err.response) {
        // Backend'den gelen hata mesajı
        const backendError = err.response.data?.message || err.response.data?.error || err.response.data
        errorMessage = typeof backendError === 'string' ? backendError : `Sunucu hatası: ${err.response.status}`
        
        // Backend'den gelen detaylı hata mesajını göster
        if (err.response.data?.error && typeof err.response.data.error === 'string') {
          errorDetails = err.response.data.error
        }
        
        if (err.response.status === 400) {
          errorDetails = errorDetails || 'Dosya formatı desteklenmiyor veya dosya boş olabilir.'
        } else if (err.response.status === 401) {
          errorMessage = 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.'
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          setIsAuthenticated(false)
          navigate('/auth')
          return
        } else if (err.response.status === 413) {
          errorMessage = 'Dosya boyutu çok büyük. Maksimum 10MB yükleyebilirsiniz.'
        } else if (err.response.status === 500) {
          const serverError = err.response.data?.message || err.response.data?.error || 'Bilinmeyen bir hata oluştu'
          errorMessage = 'Sunucu hatası: ' + serverError
          errorDetails = errorDetails || 'Lütfen daha sonra tekrar deneyin veya farklı bir dosya yüklemeyi deneyin.'
          
          // Console'a detaylı hata bilgisi yazdır
          console.error('Backend hata detayları:', {
            status: err.response.status,
            data: err.response.data,
            headers: err.response.headers
          })
        }
      } else if (err.request) {
        // İstek gönderildi ama yanıt alınamadı
        errorMessage = 'Backend sunucusuna bağlanılamıyor!'
        errorDetails = 'Lütfen backend sunucusunun çalıştığından emin olun:\n\n1. Yeni bir terminal açın\n2. `cd backend` komutunu çalıştırın\n3. `npm run dev` komutunu çalıştırın\n\nVeya proje kök dizininde `npm run dev` komutunu çalıştırarak hem frontend hem backend\'i birlikte başlatabilirsiniz.\n\nBackend\'in http://localhost:5000/api/health adresinde çalıştığını kontrol edin.'
        
        // Request detaylarını console'a yazdır
        console.error('Request hatası:', {
          message: err.message,
          code: err.code,
          request: err.request
        })
      } else if (err.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
        errorMessage = 'Backend sunucusu çalışmıyor!'
        errorDetails = 'Lütfen backend\'i başlatın:\n\n1. Yeni bir terminal açın\n2. `cd backend` komutunu çalıştırın\n3. `npm run dev` komutunu çalıştırın'
      } else if (err.message?.includes('timeout')) {
        errorMessage = 'Yükleme zaman aşımına uğradı!'
        errorDetails = 'Dosya çok büyük olabilir veya internet bağlantınız yavaş olabilir. Lütfen daha küçük bir dosya deneyin.'
      } else {
        // İstek hazırlanırken hata oluştu
        errorMessage = err.message || 'Bilinmeyen bir hata oluştu'
      }
      
      const fullErrorMessage = errorDetails ? `${errorMessage}\n\n${errorDetails}` : errorMessage
      
      // Daha detaylı hata mesajı göster
      console.error('❌ Tam hata bilgisi:', {
        error: err,
        message: err.message,
        response: err.response?.data,
        status: err.response?.status,
        config: {
          url: err.config?.url,
          method: err.config?.method,
          headers: err.config?.headers
        }
      })
      
      alert(fullErrorMessage)
    } finally {
      // Her durumda uploading state'ini kapat
      setUploading(false)
      if (e.target) {
        e.target.value = ''
      }
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return

    setLoading(true)
    try {
      const response = await api.post('/documents/search', { query: searchQuery })
      setDocuments(response.data)
    } catch (err) {
      alert('Arama hatası: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  const handleAskQuestion = async () => {
    if (!question.trim()) return

    setLoading(true)
    setAnswer(null)
    try {
      const response = await api.post('/documents/ask', { question })
      setAnswer(response.data)
    } catch (err) {
      alert('Soru cevaplama hatası: ' + (err.response?.data?.message || err.message))
    } finally {
      setLoading(false)
    }
  }

  // Doküman bazlı soru sor
  const handleAskDocumentQuestion = async () => {
    if (!docQuestion.trim() || !viewingDoc) return

    setAskingDocQuestion(true)
    setDocAnswer(null)
    try {
      // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
      const docId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
      if (!docId) {
        alert('Doküman ID bulunamadı')
        return
      }
      const response = await api.post(`/documents/${docId}/ask`, { question: docQuestion })
      setDocAnswer(response.data)
    } catch (err) {
      alert('Soru cevaplama hatası: ' + (err.response?.data?.message || err.message))
    } finally {
      setAskingDocQuestion(false)
    }
  }

  // Özet formatına göre özet oluştur
  const handleGenerateSummaryWithFormat = async () => {
    if (!viewingDoc) return

    setGeneratingSummary(true)
    setAudioUrl(null) // Önceki ses dosyasını temizle
    try {
      // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
      const docId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
      if (!docId) {
        alert('Doküman ID bulunamadı')
        return
      }
      const response = await api.post(`/documents/${docId}/summary`, { format: summaryFormat })
      setSummary(response.data)
    } catch (err) {
      alert('Özet oluşturma hatası: ' + (err.response?.data?.message || err.message))
    } finally {
      setGeneratingSummary(false)
    }
  }

  // Ses dosyasını oynat/durdur
  const handleToggleAudio = () => {
    if (!audioUrl) return

    if (!audioElement) {
      const audio = new Audio(audioUrl)
      audio.addEventListener('ended', () => setIsPlaying(false))
      setAudioElement(audio)
      audio.play()
      setIsPlaying(true)
    } else {
      if (isPlaying) {
        audioElement.pause()
        setIsPlaying(false)
      } else {
        audioElement.play()
        setIsPlaying(true)
      }
    }
  }

  // Ses dosyasını indir
  const handleDownloadAudio = async () => {
    if (!audioUrl || !viewingDoc) return

    try {
      // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
      const docId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
      if (!docId) {
        alert('Doküman ID bulunamadı')
        return
      }
      const filename = audioUrl.split('/').pop()
      const response = await api.get(`/documents/${docId}/audio/${filename}`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Ses dosyası indirme hatası: ' + (err.response?.data?.message || err.message))
    }
  }

  // Özet metnini indir
  const handleDownloadSummary = async () => {
    if (!viewingDoc || !summary) return

    try {
      // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
      const docId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
      if (!docId) {
        alert('Doküman ID bulunamadı')
        return
      }
      let textToDownload = ''
      let filename = ''

      if (summaryFormat === 'detailed') {
        textToDownload = summary.detailedSummary || summary.shortSummary || ''
        filename = `${viewingDoc.filename.replace(/\.[^/.]+$/, '')}_detayli_ozet.txt`
      } else {
        textToDownload = summary.shortSummary || viewingDoc.summary || ''
        filename = `${viewingDoc.filename.replace(/\.[^/.]+$/, '')}_kisa_ozet.txt`
      }

      if (!textToDownload) {
        alert('İndirilecek özet bulunamadı')
        return
      }

      const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      alert('Özet indirme hatası: ' + (err.response?.data?.message || err.message))
    }
  }


  // Klasör oluştur
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert('Klasör adı boş olamaz')
      return
    }

    // Maksimum 20 karakter kontrolü
    if (newFolderName.trim().length > 20) {
      alert('Klasör adı maksimum 20 karakter olabilir')
      return
    }

    // İsim validasyonu: uzantı içermemeli
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
    if (invalidChars.test(newFolderName)) {
      alert('Klasör adı geçersiz karakterler içeremez')
      return
    }

    // Uzantı kontrolü
    if (newFolderName.includes('.')) {
      const parts = newFolderName.split('.')
      const lastPart = parts[parts.length - 1]
      // Eğer son kısım 1-4 karakter uzunluğundaysa ve sadece harf/rakam içeriyorsa uzantı olabilir
      if (lastPart.length <= 4 && /^[a-zA-Z0-9]+$/.test(lastPart)) {
        alert('Klasör adı dosya uzantısı içeremez')
        return
      }
    }

    try {
      const { auth } = await import('../firebase/config')
      const { createFolder } = await import('../firebase/documents')
      const currentUser = auth.currentUser

      if (!currentUser) {
        alert('Oturum bulunamadı')
        return
      }

      // Aynı klasör içinde aynı isimde klasör kontrolü
      // Önce Firebase'den güncel klasörleri yükle (state güncel olmayabilir)
      const { getUserFolders } = await import('../firebase/documents')
      const currentFolders = await getUserFolders(currentUser.uid, currentFolderId)
      
      const finalFolderName = newFolderName.trim()
      
      // Mevcut klasörler içinde aynı parent klasörde klasörleri filtrele
      const existingFoldersInSameParent = currentFolders.filter(f => {
        const folderParentId = f.parentFolderId || f.parentId || null
        const currentParentId = currentFolderId || null
        return folderParentId === currentParentId
      })
      
      // Aynı isimde klasör var mı kontrol et (büyük/küçük harf duyarsız)
      const duplicateFolder = existingFoldersInSameParent.find(f => 
        f.name.toLowerCase().trim() === finalFolderName.toLowerCase().trim()
      )
      
      if (duplicateFolder) {
        alert('Bu isimde bir klasör zaten mevcut. Lütfen farklı bir isim seçin.')
        return
      }

      const folder = await createFolder(currentUser.uid, finalFolderName, currentFolderId)
      
      // State'i güncelle - yeni klasörü ekle
      setFolders(prevFolders => [...prevFolders, {
        ...folder,
        parentFolderId: currentFolderId || null
      }])
      
      setShowCreateFolderModal(false)
      setNewFolderName('')
      alert('Klasör başarıyla oluşturuldu!')
    } catch (err) {
      alert('Klasör oluşturulurken hata: ' + (err.message || err))
    }
  }

  // Klasör sil
  const handleDeleteFolder = async (folderId) => {
    if (!confirm('Bu klasörü silmek istediğinize emin misiniz?')) {
      return
    }

    setOpenMenuId(null)
    try {
      const { auth } = await import('../firebase/config')
      const { deleteFolder } = await import('../firebase/documents')
      const currentUser = auth.currentUser

      if (!currentUser) {
        alert('Oturum bulunamadı')
        return
      }

      await deleteFolder(folderId)
      setFolders(folders.filter(f => f.id !== folderId))
      alert('Klasör başarıyla silindi')
    } catch (err) {
      alert('Klasör silinirken hata: ' + (err.message || err))
    }
  }

  // Dokümanı klasöre taşı (drag and drop)
  // Breadcrumb'tan bir üst dizine geç
  const navigateToFolder = (folderId) => {
    console.log('📂 navigateToFolder çağrıldı:', { folderId, currentFolderId })
    if (folderId === null) {
      setCurrentFolderId(null)
      setFolderPath([])
    } else {
      setCurrentFolderId(folderId)
      // Klasör değiştiğinde dokümanları ve klasörleri yeniden yükle
      // useEffect zaten currentFolderId değiştiğinde çağrılacak, ama manuel olarak da çağıralım
    }
  }

  // Sıralama ve filtreleme
  const getSortedItems = () => {
    // Hem klasörleri hem dokümanları birleştir
    // Not: documents ve folders state'leri zaten currentFolderId'ye göre filtrelenmiş olmalı
    // Ancak güvenlik için tekrar kontrol ediyoruz
    let allItems = [...folders, ...documents]

    // Mevcut klasördeki öğeleri filtrele (ekstra güvenlik kontrolü)
    allItems = allItems.filter(item => {
      if (currentFolderId) {
        // Klasör içindeyse, bu klasöre ait olanları göster
        const normalizedCurrentFolderId = String(currentFolderId)
        if (item.type === 'FOLDER') {
          const itemParentId = item.parentFolderId || item.parentId
          return itemParentId === currentFolderId || String(itemParentId) === normalizedCurrentFolderId
        } else {
          // Doküman için folderId kontrolü
          const itemFolderId = item.folderId
          if (!itemFolderId || itemFolderId === null || itemFolderId === '') {
            return false // folderId yoksa ve bir klasör içindeysek, gösterme
          }
          return itemFolderId === currentFolderId || String(itemFolderId) === normalizedCurrentFolderId
        }
      } else {
        // Root seviyede, parentFolderId olmayanları göster
        if (item.type === 'FOLDER') {
          const hasParent = item.parentFolderId || item.parentId
          return !hasParent || hasParent === null || hasParent === ''
        } else {
          const hasFolderId = item.folderId
          return !hasFolderId || hasFolderId === null || hasFolderId === ''
        }
      }
    })

    // Dosya tipine göre filtrele (sadece PDF ve TXT)
    if (filterByType !== 'all') {
      allItems = allItems.filter(item => {
        if (item.type === 'FOLDER') return true // Klasörler her zaman gösterilir
        
        const fileInfo = getFileTypeInfo(item)
        if (filterByType === 'pdf') {
          return fileInfo.type === 'pdf'
        } else if (filterByType === 'txt') {
          return fileInfo.type === 'txt'
        }
        return true
      })
    }

    const sorted = [...allItems].sort((a, b) => {
      // Klasörler her zaman en üstte olsun
      if (a.type === 'FOLDER' && b.type !== 'FOLDER') return -1
      if (a.type !== 'FOLDER' && b.type === 'FOLDER') return 1

      switch (sortBy) {
        case 'name':
          return (a.name || a.filename || '').localeCompare(b.name || b.filename || '')
        case 'nameDesc':
          return (b.name || b.filename || '').localeCompare(a.name || a.filename || '')
        case 'modifiedAt':
          const aMod = a.modifiedAt || a.uploadedAt || a.createdAt
          const bMod = b.modifiedAt || b.uploadedAt || b.createdAt
          return new Date(bMod) - new Date(aMod)
        case 'uploadedAt':
        default:
          const aUp = a.uploadedAt || a.createdAt
          const bUp = b.uploadedAt || b.createdAt
          return new Date(bUp) - new Date(aUp)
      }
    })

    return sorted
  }

  const handleLogout = async () => {
    try {
      const { logoutUser } = await import('../firebase/auth')
      await logoutUser()
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Logout error:', error)
      // Hata olsa bile çıkış yap
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setIsAuthenticated(false)
      navigate('/', { replace: true })
    }
  }

  // Dokümanı aç
  const handleOpenDocument = async (doc) => {
    setViewingDoc(doc)
    setOpenMenuId(null)
    setIsEditing(false)
    setEditingContent(null)
    setSummaryFormat('short') // Varsayılan format
    setDocQuestion('') // Soru input'unu temizle
    setDocAnswer(null) // Cevabı temizle
    setAudioUrl(null) // Ses dosyasını temizle
    setIsPlaying(false) // Oynatma durumunu sıfırla
    if (audioElement) {
      audioElement.pause()
      setAudioElement(null)
    }
    
    // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
    const backendId = doc.backendId || doc.id || doc._id
    
    if (!backendId) {
      alert('Doküman ID bulunamadı')
      return
    }
    
    // Doküman içeriğini yükle
    try {
      const response = await api.get(`/documents/${backendId}`)
      setDocContent(response.data)
      
      // Özeti de yükle
      if (!doc.summary) {
        try {
          const summaryResponse = await api.get(`/documents/${backendId}/summary`)
          setSummary(summaryResponse.data)
        } catch (err) {
          console.warn('Özet yüklenemedi:', err)
        }
      } else {
        setSummary({
          shortSummary: doc.summary,
          detailedSummary: doc.summary
        })
      }
    } catch (err) {
      console.error('Doküman yüklenemedi:', err)
      console.error('Backend ID:', backendId)
      console.error('Doküman objesi:', doc)
      alert('Doküman içeriği yüklenemedi: ' + (err.response?.data?.message || err.message))
    }
  }

  // Doküman içeriğini kaydet
  const handleSaveDocument = async () => {
    if (!viewingDoc || !editingContent) return

    // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
    const backendId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
    
    if (!backendId) {
      alert('Doküman ID bulunamadı')
      return
    }

    try {
      await api.put(`/documents/${backendId}/content`, {
        content: editingContent
      })
      setIsEditing(false)
      alert('Doküman başarıyla kaydedildi!')
      // İçeriği güncelle
      setDocContent({ ...docContent, text: editingContent })
    } catch (err) {
      alert('Kayıt hatası: ' + (err.response?.data?.message || err.message))
    }
  }

  // Dokümanı sil
  const handleDeleteDocument = async (docId) => {
    if (!confirm('Bu dokümanı silmek istediğinize emin misiniz?')) {
      return
    }
    
    setOpenMenuId(null)
    try {
      // Dokümanı bul - hem _id hem id hem de backendId ile kontrol et
      const docToDelete = documents.find(doc => {
        const docIdStr = String(docId)
        return String(doc._id) === docIdStr || 
               String(doc.id) === docIdStr || 
               String(doc.backendId) === docIdStr
      })
      
      if (!docToDelete) {
        alert('Doküman bulunamadı')
        return
      }
      
      // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
      const backendId = docToDelete.backendId || docToDelete.id || docToDelete._id
      const firebaseDocId = docToDelete.id || docToDelete._id
      
      // Firebase'de dokümanı çöp kutusuna taşı (isDeleted flag'i ekle)
      try {
        const { auth } = await import('../firebase/config')
        const { moveDocumentToTrash } = await import('../firebase/documents')
        const currentUser = auth.currentUser
        if (currentUser && firebaseDocId) {
          console.log('🗑️ Firebase\'de çöp kutusuna taşınıyor:', firebaseDocId)
          await moveDocumentToTrash(firebaseDocId)
          console.log('✅ Firebase\'de çöp kutusuna taşındı')
        }
      } catch (firebaseError) {
        console.error('❌ Firebase çöp kutusuna taşıma hatası:', firebaseError)
        // Firebase hatası olsa bile devam et
      }
      
      // State'den kaldır (sayfa yenilendiğinde Firebase'den yüklenecek ve isDeleted=true olanlar filtrelenecek)
      setDocuments(documents.filter(doc => {
        const docIdStr = String(docId)
        return String(doc._id) !== docIdStr && 
               String(doc.id) !== docIdStr && 
               String(doc.backendId) !== docIdStr
      }))
      
      alert('Doküman çöp kutusuna taşındı')
      
      // Dokümanları yeniden yükle (Firebase'den güncel listeyi al)
      setTimeout(() => {
        loadDocuments()
      }, 500)
    } catch (err) {
      console.error('Delete document error:', err)
      alert('Doküman silinirken hata oluştu: ' + (err.response?.data?.message || err.message))
    }
  }

  // Dokümanı indir
  const handleDownloadDocument = async (doc) => {
    setOpenMenuId(null)
    try {
      const response = await api.get(`/documents/${doc._id || doc.id}/download`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc.filename || 'document')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      // Eğer download endpoint yoksa, text'i indir
      if (doc.text) {
        const blob = new Blob([doc.text], { type: 'text/plain' })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', doc.filename || 'document.txt')
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
      } else {
        alert('Doküman indirilemedi')
      }
    }
  }

  // Dokümanı paylaş (link kopyala)
  const handleShareDocument = async (doc) => {
    setOpenMenuId(null)
    try {
      const shareUrl = `${window.location.origin}/document/${doc._id || doc.id}`
      await navigator.clipboard.writeText(shareUrl)
      alert('Paylaşım linki kopyalandı!')
    } catch (err) {
      // Fallback: text olarak göster
      const shareUrl = `${window.location.origin}/document/${doc._id || doc.id}`
      prompt('Paylaşım linki (kopyalayın):', shareUrl)
    }
  }

  // Menü dışına tıklandığında kapat
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest('.doc-menu') && !e.target.closest('.context-menu') && !e.target.closest('.document-context-menu') && !e.target.closest('.new-menu') && !e.target.closest('.create-folder-btn')) {
        setOpenMenuId(null)
        setContextMenu(prev => ({ ...prev, visible: false }))
        setDocumentContextMenu(prev => ({ ...prev, visible: false }))
        setShowNewMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  // Küçük ekranlarda sidebar dışına tıklandığında kapat (overlay zaten bunu yapıyor, bu gerekli değil)

  // Sağ tık menüsü için (boş alan)
  const handleContextMenu = (e) => {
    e.preventDefault()
    
    // Eğer bir doküman veya klasör üzerinde değilse (boş alanda veya documents-section'da)
    if (!e.target.closest('.document-card') && !e.target.closest('.folder-card') && !e.target.closest('.section-header') && !e.target.closest('.breadcrumb-container')) {
      setContextMenu({
        visible: true,
        x: e.clientX,
        y: e.clientY,
      })
    }
  }

  // Doküman kartına sağ tık menüsü
  const handleDocumentContextMenu = (e, docId) => {
    e.preventDefault()
    e.stopPropagation()
    setDocumentContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      docId: docId,
    })
  }

  // Context menu seçenekleri (boş alan)
  const handleContextMenuAction = (action) => {
    setContextMenu(prev => ({ ...prev, visible: false }))
    if (action === 'create-folder') {
      setShowCreateFolderModal(true)
    } else if (action === 'upload-file') {
      document.getElementById('file-upload').click()
    }
  }

  // Doküman context menu seçenekleri
  const handleDocumentContextMenuAction = (action, docId) => {
    setDocumentContextMenu(prev => ({ ...prev, visible: false }))
    if (action === 'delete') {
      handleDeleteDocument(docId)
    } else if (action === 'rename') {
      const doc = documents.find(d => (d._id || d.id) === docId)
      setRenameDocId(docId)
      // Dosya adından uzantıyı çıkar (sadece ismi göster)
      const filename = doc?.filename || doc?.name || ''
      const lastDotIndex = filename.lastIndexOf('.')
      const nameWithoutExt = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
      setNewDocumentName(nameWithoutExt)
      setShowRenameModal(true)
    } else if (action === 'move') {
      setMoveDocId(docId)
      setShowMoveModal(true)
    }
  }

  // Dosya yerini değiştir
  const handleMoveDocument = async (targetIndex) => {
    if (!moveDocId || targetIndex === null) {
      setShowMoveModal(false)
      setMoveDocId(null)
      setMoveTargetIndex(null)
      return
    }

    try {
      const currentIndex = documents.findIndex(doc => (doc._id || doc.id) === moveDocId)
      if (currentIndex === -1) {
        alert('Dosya bulunamadı')
        return
      }

      if (currentIndex === targetIndex) {
        alert('Dosya zaten bu konumda')
        setShowMoveModal(false)
        setMoveDocId(null)
        setMoveTargetIndex(null)
        return
      }

      // Yeni sıralamayı oluştur
      const newDocuments = [...documents]
      const [movedDoc] = newDocuments.splice(currentIndex, 1)
      newDocuments.splice(targetIndex, 0, movedDoc)

      // State'i güncelle
      setDocuments(newDocuments)

      // Firebase'de sıralamayı güncelle (eğer order field varsa)
      // Şimdilik sadece local state'i güncelliyoruz
      
      alert('Dosya yeri başarıyla değiştirildi')
      setShowMoveModal(false)
      setMoveDocId(null)
      setMoveTargetIndex(null)
    } catch (err) {
      console.error('Error moving document:', err)
      alert('Dosya yeri değiştirilirken hata oluştu: ' + (err.message || 'Bilinmeyen hata'))
    }
  }

  // Dokümanı yeniden adlandır
  const handleRenameDocument = async () => {
    if (!renameDocId || !newDocumentName.trim()) {
      alert('Dosya adı boş olamaz')
      return
    }

    try {
      // Taşınan dokümanı bul
      const docToRename = documents.find(doc => (doc._id || doc.id || doc.backendId) === renameDocId)
      if (!docToRename) {
        console.error('❌ Frontend: Doküman bulunamadı:', { renameDocId, availableDocs: documents.map(d => ({ id: d.id, _id: d._id, backendId: d.backendId })) })
        alert('Doküman bulunamadı')
        return
      }

      // Orijinal dosya adından uzantıyı al
      const originalFilename = docToRename.filename || docToRename.name || ''
      const lastDotIndex = originalFilename.lastIndexOf('.')
      const extension = lastDotIndex > 0 ? originalFilename.substring(lastDotIndex) : ''
      
      // Yeni adı al ve uzantıyı koru
      let finalName = newDocumentName.trim()
      
      // Eğer kullanıcı uzantı eklememişse, orijinal uzantıyı ekle
      if (extension && !finalName.toLowerCase().endsWith(extension.toLowerCase())) {
        finalName = finalName + extension
      }
      
      // Uzantı hariç maksimum 20 karakter kontrolü
      const nameWithoutExt = extension ? finalName.slice(0, -extension.length) : finalName
      if (nameWithoutExt.length > 20) {
        alert('Dosya adı (uzantı hariç) maksimum 20 karakter olabilir')
        return
      }
      
      if (nameWithoutExt.length === 0) {
        alert('Dosya adı boş olamaz')
        return
      }

      // Backend ID'yi belirle (backendId varsa onu kullan, yoksa id/_id kullan)
      const backendDocId = docToRename.backendId || docToRename._id || docToRename.id
      console.log('📝 Doküman adı değiştiriliyor:', { 
        frontendId: renameDocId, 
        backendId: backendDocId,
        originalName: originalFilename,
        newName: finalName,
        extension: extension
      })

      // Backend'de güncelle
      try {
        await api.put(`/documents/${backendDocId}/rename`, {
          filename: finalName
        })
      } catch (apiError) {
        // Backend bağlantı hatası kontrolü
        if (apiError.code === 'ECONNREFUSED' || apiError.message?.includes('ECONNREFUSED')) {
          throw new Error('Backend sunucusuna bağlanılamıyor. Lütfen backend sunucusunun çalıştığından emin olun (port 5000).')
        }
        throw apiError
      }

      // Local state'i güncelle
      setDocuments(documents.map(doc => 
        (doc._id || doc.id || doc.backendId) === renameDocId 
          ? { ...doc, filename: finalName }
          : doc
      ))

      // Firebase'de güncelle
      try {
        const { auth } = await import('../firebase/config')
        const { updateDocumentFilename } = await import('../firebase/documents')
        const currentUser = auth.currentUser
        if (currentUser) {
          const { getUserDocuments } = await import('../firebase/documents')
          const firebaseDocs = await getUserDocuments(currentUser.uid)
          const firebaseDoc = firebaseDocs.find(d => d.backendId === backendDocId || d.id === backendDocId || (d._id || d.id) === renameDocId)
          if (firebaseDoc) {
            await updateDocumentFilename(firebaseDoc.id, finalName)
          }
        }
      } catch (firebaseError) {
        console.warn('Firebase güncelleme hatası:', firebaseError)
        // Firebase hatası kritik değil, devam et
      }

      // Dokümanları yeniden yükle (güncel durumu görmek için)
      await loadDocuments()

      setShowRenameModal(false)
      setRenameDocId(null)
      setNewDocumentName('')
      console.log('✅ Doküman adı başarıyla güncellendi')
    } catch (err) {
      console.error('Doküman adı değiştirme hatası:', err)
      const errorMessage = err.response?.data?.message || err.message || 'Bilinmeyen bir hata oluştu'
      alert(`Doküman adı güncellenirken hata: ${errorMessage}`)
    }
  }

  return (
    <div className="dashboard">
      <div className="dashboard-layout">
        {/* Left Sidebar - LandingPage Header */}
        
        {/* Sidebar Overlay - Küçük ekranlarda */}
        {isSidebarOpen && isMobile && (
          <div 
            className="sidebar-overlay"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        
        <aside className={`dashboard-left-sidebar ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          <nav className="navbar-left">
            <div className="nav-menu-left">
              {/* En Üstte: Anasayfa */}
              <a 
                href="/" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/')
                }}
              >
                <Home className="nav-link-icon-left" />
                Anasayfa
              </a>
              
              {/* Doküman İşlemleri */}
              <a 
                href="#" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage('documents')
                  loadDocuments()
                  loadFolders()
                }}
              >
                <FileText className="nav-link-icon-left" />
                Dokümanlarım
              </a>
              <a 
                href="#" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('file-upload')?.click()
                }}
              >
                <Upload className="nav-link-icon-left" />
                Doküman Yükle
              </a>
              <a 
                href="#" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage('documents')
                  // Arama kutusunu bul ve vurgula
                  setTimeout(() => {
                    const searchBox = document.querySelector('.nav-search .search-box')
                    const searchInput = document.querySelector('.nav-search .search-box input')
                    if (searchBox && searchInput) {
                      // Scroll yap
                      searchBox.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      // Border'ı vurgula
                      searchBox.classList.add('search-highlight')
                      // Input'a focus yap
                      searchInput.focus()
                      // 3 saniye sonra highlight'ı kaldır
                      setTimeout(() => {
                        searchBox.classList.remove('search-highlight')
                      }, 3000)
                    }
                  }, 100)
                }}
              >
                <Search className="nav-link-icon-left" />
                Arama Yap
              </a>
              <a 
                href="#" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage('summarize')
                }}
              >
                <ClipboardList className="nav-link-icon-left" />
                Metin Özetleme
              </a>
              <a 
                href="#" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  setCurrentPage('trash')
                  loadTrashItems()
                }}
              >
                <Trash className="nav-link-icon-left" />
                Çöp Kutusu
              </a>
              
              {/* Ana Sayfa Linkleri */}
              <a 
                href="/#features" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/')
                  setTimeout(() => {
                    const element = document.getElementById('features')
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' })
                    }
                  }, 100)
                }}
              >
                Özellikler
              </a>
              <a 
                href="/#how-it-works" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/')
                  setTimeout(() => {
                    const element = document.getElementById('how-it-works')
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' })
                    }
                  }, 100)
                }}
              >
                Nasıl Çalışır?
              </a>
              <a 
                href="/#about" 
                className="nav-link-left"
                onClick={(e) => {
                  e.preventDefault()
                  navigate('/')
                  setTimeout(() => {
                    const element = document.getElementById('about')
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' })
                    } else {
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }
                  }, 100)
                }}
              >
                Hakkımızda
              </a>
              <a 
                href="mailto:info@sema.com" 
                className="nav-link-left"
              >
                İletişim
              </a>
              
              {/* Tema ve Çıkış */}
              <div className="nav-user-section">
                <span className="user-name-left">{user.name || user.email}</span>
                <div className="nav-actions-left">
                  <div className="theme-selector">
                    <label className="theme-selector-label">Tema:</label>
                    <div className="theme-options">
                      <button 
                        onClick={() => changeTheme('light')} 
                        className={`theme-option ${theme === 'light' ? 'active' : ''}`}
                        title="Açık Tema (Mavi)"
                      >
                        <Sun size={16} />
                        <span>Mavi</span>
                      </button>
                      <button 
                        onClick={() => changeTheme('light-green')} 
                        className={`theme-option ${theme === 'light-green' ? 'active' : ''}`}
                        title="Açık Tema (Yeşil)"
                      >
                        <Sun size={16} />
                        <span>Yeşil</span>
                      </button>
                      <button 
                        onClick={() => changeTheme('dark')} 
                        className={`theme-option ${theme === 'dark' ? 'active' : ''}`}
                        title="Koyu Tema"
                      >
                        <Moon size={16} />
                        <span>Koyu</span>
                      </button>
                    </div>
                    
                    {/* Özel Renk Seçici */}
                    <div className="custom-color-selector">
                      <button
                        onClick={() => setShowColorPicker(!showColorPicker)}
                        className={`custom-color-btn ${theme === 'custom' ? 'active' : ''}`}
                        title="Kendi rengini seç"
                      >
                        <Sparkles size={16} />
                        <span>{theme === 'custom' ? 'Özel Tema' : 'Kendi Rengini Seç'}</span>
                      </button>
                      
                      {showColorPicker && (
                        <div className="color-picker-panel">
                          <label className="color-picker-label">Renk Seç:</label>
                          <div className="color-picker-wrapper">
                            <input
                              type="color"
                              value={customColor}
                              onChange={(e) => setCustomColor(e.target.value)}
                              className="color-picker-input"
                            />
                            <div className="color-preview" style={{ backgroundColor: customColor }}></div>
                            <span className="color-hex">{customColor}</span>
                          </div>
                          <button
                            onClick={() => generateCustomTheme(customColor)}
                            className="generate-theme-btn"
                            disabled={generatingCustomTheme}
                          >
                            {generatingCustomTheme ? (
                              <>
                                <Loader className="spinning" size={16} />
                                <span>Oluşturuluyor...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles size={16} />
                                <span>Gemini ile Tema Oluştur</span>
                              </>
                            )}
                          </button>
                          {theme === 'custom' && (
                            <button
                              onClick={() => {
                                changeTheme('light')
                                setShowColorPicker(false)
                              }}
                              className="reset-theme-btn"
                            >
                              Varsayılan Temaya Dön
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button onClick={handleLogout} className="logout-btn-left">
                    <LogOut />
                    Çıkış Yap
                  </button>
                </div>
              </div>
            </div>
          </nav>
        </aside>

        <div className={`dashboard-main-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
          {/* Sidebar Toggle Button - Sol üstte */}
          <button 
            className={`sidebar-toggle-btn ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            aria-label={isSidebarOpen ? 'Sidebar\'ı kapat' : 'Sidebar\'ı aç'}
          >
            {isSidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>
          <nav className="dashboard-nav">
            <div className={`nav-content ${isSidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
              {/* SEMA Logo - Sol Üstte */}
              <div className="nav-logo">
                <span>SEMA</span>
              </div>
              {currentPage !== 'summarize' && (
                <div className="nav-search">
                  <div className={`search-box ${searchQuery.trim() ? 'search-active' : ''}`}>
                    <Search className="search-icon" />
                    <input
                      type="text"
                      placeholder="arama yap"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                      onFocus={(e) => {
                        e.target.closest('.search-box')?.classList.add('search-active')
                      }}
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          e.target.closest('.search-box')?.classList.remove('search-active')
                        }
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="nav-right">
                <button 
                  className="profile-btn"
                  onClick={() => navigate('/profile')}
                  title="Profilim"
                >
                  <User className="profile-icon" />
                  <span>Profilim</span>
                </button>
              </div>
            </div>
          </nav>

          <div className="dashboard-content">
        <div className="dashboard-main">
          {/* Çöp Kutusu Sayfası */}
          {currentPage === 'trash' && (
            <section className="documents-section">
              <div className="section-header">
                <div className="section-title">
                  <h2 style={{ margin: 0, padding: 0 }}>Çöp Kutusu</h2>
                </div>
              </div>
              <div className="trash-info">
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                  Öğeler eklendikten sonra 3 gün içinde tamamen silinecektir.
                </p>
              </div>
              {trashItems.length === 0 ? (
                <div className="empty-state">
                  <Trash size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                  <p>Çöp kutusu boş</p>
                </div>
              ) : (
                <div className="documents-list">
                  {trashItems.map((item) => {
                    const deletedDate = new Date(item.deletedAt)
                    const now = new Date()
                    const daysDiff = Math.ceil((now - deletedDate) / (1000 * 60 * 60 * 24))
                    const remainingDays = 3 - daysDiff
                    
                    return (
                      <div key={item.id} className="document-card list-view trash-item">
                        <div className="doc-header-list">
                          <FileText className="doc-icon" />
                          <div className="doc-name-list">
                            <h3>{item.data?.filename || item.data?.name || 'Bilinmeyen'}</h3>
                            <span className="doc-type-list">{item.data?.type || 'Dosya'}</span>
                          </div>
                        </div>
                        <div className="doc-info-list">
                          <span className="doc-date-list">
                            Silindi: {deletedDate.toLocaleDateString('tr-TR')}
                          </span>
                          <span className="doc-size-list" style={{ color: remainingDays <= 1 ? 'var(--error)' : 'var(--text-secondary)' }}>
                            {remainingDays > 0 ? `${remainingDays} gün sonra silinecek` : 'Bugün silinecek'}
                          </span>
                        </div>
                        <div className="doc-actions-list">
                          <button
                            className="btn-restore"
                            onClick={() => handleRestoreItem(item)}
                            title="Geri Al"
                          >
                            <ArrowLeft size={18} />
                            Geri Al
                          </button>
                          <button
                            className="btn-delete-permanent"
                            onClick={() => handlePermanentlyDeleteItem(item)}
                            title="Kalıcı Olarak Sil"
                          >
                            <Trash2 size={18} />
                            Kalıcı Olarak Sil
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </section>
          )}

          {/* Metin Özetleme Sayfası */}
          {currentPage === 'summarize' && (
            <section className="documents-section summarize-section">
              <div className="section-header">
                <div className="section-title">
                  <h2 style={{ margin: 0, padding: 0 }}>Metin Özetleme</h2>
                </div>
              </div>
              <div className="summarize-container">
                <div className="summarize-content">
                  <div className="summarize-input-panel">
                    <h3>Metin Girişi</h3>
                    <textarea
                      className="summarize-input"
                      placeholder="Özetlemek istediğiniz metni buraya yazın veya yapıştırın..."
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      rows="15"
                    />
                    <div className="input-actions">
                      <button
                        className="btn-clear"
                        onClick={() => {
                          setSummaryText('')
                          setSummaryResult('')
                        }}
                        disabled={!summaryText && !summaryResult}
                      >
                        Temizle
                      </button>
                    </div>
                  </div>
                  <div className="summarize-output-panel">
                    <div className="output-title">
                      <h3>Özet Sonucu</h3>
                    </div>
                    <div className="summarize-output">
                      {summaryResult ? (
                        <div className="summary-result">
                          <p dangerouslySetInnerHTML={{ __html: parseMarkdown(summaryResult) }}></p>
                        </div>
                      ) : (
                        <div className="output-placeholder">
                          <p>Özet burada görünecek...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="summarize-actions">
                  <div className="summarize-length-control">
                    <label>Özet Uzunluğu: {summaryLength}%</label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={summaryLength}
                      onChange={(e) => setSummaryLength(Number(e.target.value))}
                      className="length-slider"
                    />
                  </div>
                  <div className="language-select-wrapper">
                    <label>Dil:</label>
                    <select
                      value={summaryLanguage}
                      onChange={(e) => setSummaryLanguage(e.target.value)}
                      className="language-select"
                    >
                      <option value="Turkish">Türkçe</option>
                      <option value="English">İngilizce</option>
                    </select>
                  </div>
                  <button
                    className="btn-summarize-now"
                    onClick={async () => {
                      if (!summaryText.trim()) {
                        alert('Lütfen özetlemek için metin girin')
                        return
                      }
                      setIsSummarizing(true)
                      setSummaryResult('')
                      try {
                        const response = await api.post('/documents/summarize-text', {
                          text: summaryText,
                          length: summaryLength,
                          language: summaryLanguage
                        })
                        setSummaryResult(response.data.summary || 'Özet oluşturulamadı')
                      } catch (err) {
                        console.error('Summarization error:', err)
                        alert('Özet oluşturulurken hata oluştu: ' + (err.response?.data?.message || err.message))
                      } finally {
                        setIsSummarizing(false)
                      }
                    }}
                    disabled={isSummarizing || !summaryText.trim()}
                  >
                    {isSummarizing ? (
                      <>
                        <Loader className="spinning" size={18} />
                        Özetleniyor...
                      </>
                    ) : (
                      <>
                        <ClipboardList size={18} />
                        Özetle
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Documents List - En üstte */}
          {currentPage === 'documents' && (
          <section 
            className="documents-section"
            onContextMenu={handleContextMenu}
          >
            {/* AI ile Soru Sor Section - Moved to top */}
            <div className="qa-section">
              <h2>AI ile Soru Sor</h2>
              <p className="section-description">
                Dokümanlarınıza dayalı doğal dil soruları sorun
              </p>
              <div className="qa-box">
                <MessageSquare className="qa-icon" />
                <div className="textarea-wrapper">
                  <textarea
                    placeholder="Örn: Bu dokümanlarda ne hakkında konuşuluyor?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    rows="3"
                  />
                  <button onClick={handleAskQuestion} className="ask-btn">
                    Sor
                  </button>
                </div>
              </div>
              {answer && (
                <div className="answer-box">
                  <h3>AI Cevabı:</h3>
                  <div className="answer-content" dangerouslySetInnerHTML={{ __html: parseMarkdown(answer.answer) }}>
                  </div>
                  {answer.sources && answer.sources.length > 0 && (
                    <div className="sources">
                      <strong>Kaynak Dokümanlar:</strong>
                      <ul>
                        {answer.sources.map((source, idx) => (
                          <li key={idx}>{source}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            
            {/* Section Header - Dokümanlarım Başlığı */}
            <div className="section-header">
              <div className="section-title">
                {currentFolderId && (
                  <button 
                    onClick={() => navigateToFolder(null)}
                    className="back-btn"
                  >
                    <ArrowLeft />
                  </button>
                )}
                <h2 style={{ margin: 0, padding: 0 }}>Dokümanlarım</h2>
                <div className="new-menu-container">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowNewMenu(!showNewMenu)
                    }}
                    className="create-folder-btn"
                    title="Yeni"
                  >
                    <FolderPlus />
                    Yeni
                    <ChevronDown className="chevron-icon" />
                  </button>
                  {showNewMenu && (
                    <div className="new-menu">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowNewMenu(false)
                          setShowCreateFolderModal(true)
                        }}
                        className="new-menu-item"
                      >
                        <FolderPlus />
                        <span>Klasör Oluştur</span>
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowNewMenu(false)
                          document.getElementById('file-upload')?.click()
                        }}
                        className="new-menu-item"
                      >
                        <Upload />
                        <span>Dosya Yükleme</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="view-controls">
                <select
                  value={filterByType}
                  onChange={(e) => setFilterByType(e.target.value)}
                  className="filter-select"
                  title="Dosya Türüne Göre Filtrele"
                >
                  <option value="all">Tüm Dosyalar</option>
                  <option value="pdf">PDF</option>
                  <option value="txt">TXT</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="sort-select"
                >
                  <option value="uploadedAt">En Son Yüklenen</option>
                  <option value="modifiedAt">En Son Değiştirilen</option>
                  <option value="name">İsme Göre (A-Z)</option>
                  <option value="nameDesc">İsme Göre (Z-A)</option>
                </select>
                <div className="view-toggle">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={viewMode === 'grid' ? 'active' : ''}
                    title="Grid Görünümü"
                  >
                    <Grid3x3 />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={viewMode === 'list' ? 'active' : ''}
                    title="Liste Görünümü"
                  >
                    <List />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Breadcrumb - Bulunan Dizin */}
            <div className="breadcrumb-container">
              {folderPath.length > 0 ? (
                <div className="breadcrumb">
                  <button 
                    onClick={() => navigateToFolder(null)}
                    className="breadcrumb-item breadcrumb-home"
                  >
                    <Folder />
                    Ana Sayfa
                  </button>
                  {folderPath.map((folder, index) => (
                    <React.Fragment key={folder.id}>
                      <div className="breadcrumb-separator">
                        <span>/</span>
                      </div>
                      <button
                        onClick={() => navigateToFolder(folder.id)}
                        className="breadcrumb-item"
                      >
                        {folder.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              ) : (
                <div className="breadcrumb">
                  <span className="breadcrumb-current">
                    <Folder />
                    Ana Sayfa
                  </span>
                </div>
              )}
            </div>
            
            {/* Gemini'dan Analizler Bölümü */}
            {(folderSummary || loadingFolderSummary) && (
              <div className="gemini-analysis-section">
                <div className="gemini-analysis-header">
                  <div className="gemini-analysis-title">
                    <ChevronDown 
                      size={20} 
                      onClick={() => setShowFolderSummary(!showFolderSummary)}
                      style={{ cursor: 'pointer', transform: showFolderSummary ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}
                    />
                    <span>Gemini'dan analizler</span>
                  </div>
                </div>
                {showFolderSummary && (
                  <div className="gemini-analysis-content">
                    {loadingFolderSummary ? (
                      <div className="loading-folder-summary">
                        <Loader className="spinning" size={20} />
                        <span>Klasör analiz ediliyor...</span>
                      </div>
                    ) : folderSummary ? (
                      <div className="folder-highlights-card">
                        <h4>Klasörde öne çıkanlar</h4>
                        <p
                          className="folder-summary-text"
                          dangerouslySetInnerHTML={{ __html: parseMarkdown(folderSummary.summary || '') }}
                        ></p>
                        {folderSummary.documentCount > 0 && (
                          <div className="folder-stats">
                            <span>{folderSummary.documentCount} doküman</span>
                            {folderSummary.documentTypes && folderSummary.documentTypes.length > 0 && (
                              <span>• {folderSummary.documentTypes.join(', ')}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
            
            {loading && documents.length === 0 && folders.length === 0 ? (
              <div className="loading" onContextMenu={handleContextMenu}>Yükleniyor...</div>
            ) : (documents.length === 0 && folders.length === 0) ? (
              <div className="empty-state" onContextMenu={handleContextMenu}>
                <FileText />
                <p>Henüz doküman yüklenmedi</p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Sağ tıklayarak klasör oluşturabilir veya dosya yükleyebilirsiniz
                </p>
                <button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="btn btn-primary"
                  style={{ marginTop: '1rem' }}
                >
                  <Upload style={{ width: '18px', height: '18px', marginRight: '0.5rem' }} />
                  Dosya Yükle
                </button>
              </div>
            ) : (
              <div 
                className={viewMode === 'grid' ? 'documents-grid' : 'documents-list'}
                onContextMenu={handleContextMenu}
              >
                {/* Klasörler ve Dokümanlar */}
                {getSortedItems().map((item) => {
                  // Klasör ise
                  if (item.type === 'FOLDER') {
                    return (
                      <div
                        key={item.id}
                        className={`folder-card ${viewMode === 'list' ? 'list-view' : ''}`}
                        onClick={() => navigateToFolder(item.id)}
                      >
                        <div className="folder-header">
                          <Folder className="folder-icon" />
                          <h3>{item.name}</h3>
                          <div className="doc-menu-container">
                            <button
                              className="doc-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(openMenuId === item.id ? null : item.id)
                              }}
                            >
                              <MoreVertical />
                            </button>
                            {openMenuId === item.id && (
                              <div className="doc-menu">
                                <button onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteFolder(item.id)
                                }}>
                                  <Trash2 />
                                  Sil
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="folder-info">
                          <span className="doc-date">
                            {new Date(item.createdAt).toLocaleDateString('tr-TR')}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  
                  // Doküman ise
                  const doc = item
                  const fileInfo = getFileTypeInfo(doc)
                  const IconComponent = fileInfo.icon
                  
                  return (
                  <div 
                    key={doc._id || doc.id} 
                    className={`document-card document-card-${fileInfo.type} ${viewMode === 'list' ? 'list-view' : ''}`}
                    style={viewMode === 'list' ? {
                      borderLeft: `4px solid ${fileInfo.color}`
                    } : {
                      borderLeft: `4px solid ${fileInfo.color}`,
                      backgroundColor: fileInfo.bgColor
                    }}
                    onContextMenu={(e) => handleDocumentContextMenu(e, doc._id || doc.id)}
                  >
                    {viewMode === 'list' ? (
                      // List görünümü - Yatay düzen
                      <>
                        <div className="doc-header-list">
                          <IconComponent 
                            className="doc-icon" 
                            style={{ color: fileInfo.color }}
                          />
                          <div className="doc-name-list">
                            <h3>{doc.filename || doc.name}</h3>
                            <span className="doc-type-list">{doc.type || 'Dosya'}</span>
                          </div>
                        </div>
                        <div className="doc-info-list">
                          <span className="doc-date-list">
                            {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </span>
                          {doc.fileSize && (
                            <span className="doc-size-list">
                              {formatFileSize(doc.fileSize)}
                            </span>
                          )}
                        </div>
                        <div className="doc-actions-list">
                          <button
                            onClick={() => handleOpenDocument(doc)}
                            className="btn-open-list"
                            title="Dokümanı Aç"
                          >
                            <Eye size={18} />
                          </button>
                          <button
                            className="doc-menu-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              const docId = doc._id || doc.id
                              const buttonRect = e.currentTarget.getBoundingClientRect()
                              const newPosition = {
                                top: buttonRect.bottom + 4,
                                right: window.innerWidth - buttonRect.right
                              }
                              setMenuPositions(prev => ({
                                ...prev,
                                [docId]: newPosition
                              }))
                              setOpenMenuId(openMenuId === docId ? null : docId)
                            }}
                            title="Daha fazla"
                          >
                            <MoreVertical size={18} />
                          </button>
                          {openMenuId === (doc._id || doc.id) && menuPositions[doc._id || doc.id] && createPortal(
                            <div 
                              className="doc-menu doc-menu"
                              style={{
                                position: 'fixed',
                                top: `${menuPositions[doc._id || doc.id].top}px`,
                                right: `${menuPositions[doc._id || doc.id].right}px`,
                                zIndex: 999999
                              }}
                            >
                              <button onClick={() => {
                                setOpenMenuId(null)
                                handleDocumentContextMenuAction('rename', doc._id || doc.id)
                              }}>
                                <Pencil />
                                Yeniden Adlandır
                              </button>
                              <button onClick={() => {
                                setOpenMenuId(null)
                                handleDocumentContextMenuAction('move', doc._id || doc.id)
                              }}>
                                <ArrowUpDown />
                                Yer Değiştir
                              </button>
                              <button onClick={() => handleDeleteDocument(doc._id || doc.id)}>
                                <Trash2 />
                                Sil
                              </button>
                            </div>,
                            document.body
                          )}
                        </div>
                      </>
                    ) : (
                      // Grid görünümü - Kutu düzen
                      <>
                        <div className="doc-header">
                          <IconComponent 
                            className="doc-icon" 
                            style={{ color: fileInfo.color }}
                          />
                          <h3>{doc.filename || doc.name}</h3>
                          <div className="doc-menu-container">
                            <button
                              className="doc-menu-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                const docId = doc._id || doc.id
                                const buttonRect = e.currentTarget.getBoundingClientRect()
                                const newPosition = {
                                  top: buttonRect.bottom + 4,
                                  right: window.innerWidth - buttonRect.right
                                }
                                setMenuPositions(prev => ({
                                  ...prev,
                                  [docId]: newPosition
                                }))
                                setOpenMenuId(openMenuId === docId ? null : docId)
                              }}
                            >
                              <MoreVertical />
                            </button>
                            {openMenuId === (doc._id || doc.id) && menuPositions[doc._id || doc.id] && createPortal(
                              <div 
                                className="doc-menu doc-menu"
                                style={{
                                  position: 'fixed',
                                  top: `${menuPositions[doc._id || doc.id].top}px`,
                                  right: `${menuPositions[doc._id || doc.id].right}px`,
                                  zIndex: 999999
                                }}
                              >
                                <button onClick={() => {
                                  setOpenMenuId(null)
                                  handleDocumentContextMenuAction('rename', doc._id || doc.id)
                                }}>
                                  <Pencil />
                                  Yeniden Adlandır
                                </button>
                                <button onClick={() => {
                                  setOpenMenuId(null)
                                  handleDocumentContextMenuAction('move', doc._id || doc.id)
                                }}>
                                  <ArrowUpDown />
                                  Yer Değiştir
                                </button>
                                <button onClick={() => handleDeleteDocument(doc._id || doc.id)}>
                                  <Trash2 />
                                  Sil
                                </button>
                              </div>,
                              document.body
                            )}
                          </div>
                        </div>
                        <div className="doc-info">
                          <span className="doc-type">{doc.type || 'Dosya'}</span>
                          <span className="doc-date">
                            {new Date(doc.uploadedAt || doc.createdAt).toLocaleDateString('tr-TR', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit'
                            })}
                          </span>
                          {doc.fileSize && (
                            <span className="doc-size">
                              {formatFileSize(doc.fileSize)}
                            </span>
                          )}
                        </div>
                        {doc.summary && (
                          <p className="doc-summary">{doc.summary}</p>
                        )}
                        <div className="doc-actions">
                          <button
                            onClick={() => handleOpenDocument(doc)}
                            className="btn-open"
                          >
                            <Eye />
                            Dokümanı Aç
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  )
                })}
              </div>
            )}
          </section>
          )}

          {/* Q&A Section - Documents section'dan sonra */}
        </div>

        {/* Summary Sidebar */}
        {summary && !viewingDoc && (
          <div className="summary-sidebar">
            <div className="sidebar-header">
              <h3>Doküman Özeti</h3>
              <button onClick={() => setSummary(null)} className="close-btn">
                <X />
              </button>
            </div>
            <div className="summary-content">
              <h4>Kısa Özet:</h4>
              <p>{summary.shortSummary}</p>
              {summary.detailedSummary && (
                <>
                  <h4>Detaylı Özet:</h4>
                  <p>{summary.detailedSummary}</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>

      {/* Document View Modal */}
      {viewingDoc && (() => {
        const fileInfo = getFileTypeInfo(viewingDoc)
        const fileType = fileInfo.type
        // Backend ID'yi belirle - önce backendId, sonra id, sonra _id
        const docId = viewingDoc.backendId || viewingDoc.id || viewingDoc._id
        const token = localStorage.getItem('token')
        // File URL - for iframe we need token in query param, for other requests axios adds it to header
        const fileUrl = token ? `/api/documents/${docId}/file?token=${encodeURIComponent(token)}` : `/api/documents/${docId}/file`

        return (
          <div className="document-view-modal">
            <div className="document-view-content">
              <div className="document-view-header">
                <h2>{viewingDoc.filename || viewingDoc.name}</h2>
                <div className="document-view-actions">
                  {fileType === 'txt' && (
                    <button
                      onClick={() => {
                        if (isEditing) {
                          handleSaveDocument()
                        } else {
                          setIsEditing(true)
                          setEditingContent(docContent?.text || '')
                        }
                      }}
                      className="edit-btn"
                    >
                      {isEditing ? 'Kaydet' : 'Düzenle'}
                    </button>
                  )}
                  <button onClick={() => {
                    setViewingDoc(null)
                    setDocContent(null)
                    setSummary(null)
                    setIsEditing(false)
                    setEditingContent(null)
                    setSummaryFormat('short')
                    setDocQuestion('')
                    setDocAnswer(null)
                  }} className="close-btn">
                    <X />
                  </button>
                </div>
              </div>
              <div className="document-view-body">
                <div className="document-view-left">
                  <div className="document-content">
                    {fileType === 'pdf' ? (
                      <div className="a4-container">
                        <iframe
                          src={fileUrl}
                          className="document-iframe"
                          title="PDF Viewer"
                        />
                      </div>
                    ) : fileType === 'txt' ? (
                      <div className="a4-container txt-container">
                        {isEditing ? (
                          <textarea
                            className="document-textarea"
                            value={editingContent || docContent?.text || ''}
                            onChange={(e) => setEditingContent(e.target.value)}
                            spellCheck={false}
                          />
                        ) : (
                          <pre className="document-text">{docContent?.text || 'İçerik yükleniyor...'}</pre>
                        )}
                      </div>
                    ) : (
                      <div className="a4-container">
                        <pre className="document-text">{docContent?.text || 'İçerik yükleniyor...'}</pre>
                      </div>
                    )}
                  </div>
                </div>
                <div className="document-view-right">
                  <h3>Özet ve Sorular</h3>
                  
                  {/* Özet Formatı Seçenekleri */}
                  <div className="summary-format-selector">
                    <label>Özet Formatı:</label>
                    <div className="format-buttons">
                      <button
                        className={summaryFormat === 'short' ? 'active' : ''}
                        onClick={() => setSummaryFormat('short')}
                      >
                        Kısa Özet
                      </button>
                      <button
                        className={summaryFormat === 'detailed' ? 'active' : ''}
                        onClick={() => setSummaryFormat('detailed')}
                      >
                        Uzun Özet
                      </button>
                    </div>
                    <button
                      onClick={handleGenerateSummaryWithFormat}
                      className="btn-generate-summary"
                      disabled={generatingSummary}
                    >
                      {generatingSummary ? 'Oluşturuluyor...' : 'Özet Oluştur'}
                    </button>
                  </div>

                  {/* Özet Gösterimi */}
                  <div className="document-summary">
                    {summary ? (
                      <>
                        {summaryFormat === 'short' && (
                          <div className="summary-section">
                            <div className="summary-header-with-actions">
                              <h4>Kısa Özet</h4>
                              <button
                                onClick={handleDownloadSummary}
                                className="btn-download-summary"
                                title="Özet Metnini İndir"
                              >
                                <Download size={18} />
                              </button>
                            </div>
                            <p>{summary.shortSummary || viewingDoc.summary || 'Özet yükleniyor...'}</p>
                          </div>
                        )}
                        {summaryFormat === 'detailed' && (
                          <div className="summary-section">
                            <div className="summary-header-with-actions">
                              <h4>Detaylı Özet</h4>
                              <button
                                onClick={handleDownloadSummary}
                                className="btn-download-summary"
                                title="Özet Metnini İndir"
                              >
                                <Download size={18} />
                              </button>
                            </div>
                            <p>{summary.detailedSummary || summary.shortSummary || 'Detaylı özet yükleniyor...'}</p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="loading">Özet oluşturmak için format seçin ve "Özet Oluştur" butonuna tıklayın</div>
                    )}
                  </div>

                  {/* Doküman Bazlı Soru Sorma */}
                  <div className="document-question-section">
                    <h4>Doküman Hakkında Soru Sor</h4>
                    <div className="question-input-group">
                      <input
                        type="text"
                        placeholder="Örn: Bu dokümanın konusu ne?"
                        value={docQuestion}
                        onChange={(e) => setDocQuestion(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAskDocumentQuestion()}
                        className="question-input"
                      />
                      <button
                        onClick={handleAskDocumentQuestion}
                        className="btn-ask-question"
                        disabled={askingDocQuestion || !docQuestion.trim()}
                      >
                        {askingDocQuestion ? <Loader className="spinner" /> : 'Sor'}
                      </button>
                    </div>
                    {docAnswer && (
                      <div className="document-answer">
                        <h5>Cevap:</h5>
                        <p dangerouslySetInnerHTML={{ __html: parseMarkdown(docAnswer.answer || docAnswer) }}></p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Context Menu (Sağ Tık Menüsü - Boş Alan) */}
      {contextMenu.visible && (
        <div 
          className="context-menu"
          style={{
            position: 'fixed',
            top: `${contextMenu.y}px`,
            left: `${contextMenu.x}px`,
            zIndex: 2000
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            className="context-menu-item"
            onClick={() => handleContextMenuAction('create-folder')}
          >
            <FolderPlus />
            <span>Yeni klasör</span>
            <span className="context-menu-shortcut">Alt+C, ardından F</span>
          </button>
          <button 
            className="context-menu-item"
            onClick={() => handleContextMenuAction('upload-file')}
          >
            <Upload />
            <span>Dosya yükleme</span>
            <span className="context-menu-shortcut">Alt+C, ardından U</span>
          </button>
          <div className="context-menu-divider"></div>
          <button 
            className="context-menu-item"
            onClick={() => {
              setContextMenu(prev => ({ ...prev, visible: false }))
              loadDocuments()
              loadFolders()
            }}
          >
            <FileText />
            <span>Yenile</span>
          </button>
        </div>
      )}

      {/* Document Context Menu (Dosya Üzerine Sağ Tık) */}
      {documentContextMenu.visible && documentContextMenu.docId && (
        <div 
          className="context-menu document-context-menu"
          style={{
            position: 'fixed',
            top: `${documentContextMenu.y}px`,
            left: `${documentContextMenu.x}px`,
            zIndex: 2000
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <button 
            className="context-menu-item"
            onClick={() => handleDocumentContextMenuAction('rename', documentContextMenu.docId)}
          >
            <Pencil />
            <span>Yeniden Adlandır</span>
          </button>
          <button 
            className="context-menu-item"
            onClick={() => handleDocumentContextMenuAction('move', documentContextMenu.docId)}
          >
            <ArrowUpDown />
            <span>Yer Değiştir</span>
          </button>
          <div className="context-menu-divider"></div>
          <button 
            className="context-menu-item"
            onClick={() => handleDocumentContextMenuAction('delete', documentContextMenu.docId)}
          >
            <Trash2 />
            <span>Sil</span>
          </button>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolderModal && (
        <div className="modal-overlay" onClick={() => setShowCreateFolderModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Yeni Klasör Oluştur</h3>
              <button onClick={() => setShowCreateFolderModal(false)} className="close-btn">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Klasör adı"
                value={newFolderName}
                onChange={(e) => {
                  // Maksimum 20 karakter sınırı
                  const value = e.target.value
                  if (value.length <= 20) {
                    setNewFolderName(value)
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
                className="folder-name-input"
                maxLength={20}
                autoFocus
              />
              <p className="folder-hint">Maksimum 20 karakter. Klasör adı dosya uzantısı içeremez (örn: .exe, .txt)</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowCreateFolderModal(false)} className="btn-cancel">
                İptal
              </button>
              <button onClick={handleCreateFolder} className="btn-create">
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Document Modal */}
      {showRenameModal && (
        <div className="modal-overlay" onClick={() => {
          setShowRenameModal(false)
          setRenameDocId(null)
          setNewDocumentName('')
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dokümanı Yeniden Adlandır</h3>
              <button onClick={() => {
                setShowRenameModal(false)
                setRenameDocId(null)
                setNewDocumentName('')
              }} className="close-btn">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Dosya adı (uzantı otomatik korunur)"
                value={newDocumentName}
                onChange={(e) => {
                  // Maksimum 20 karakter sınırı
                  const value = e.target.value
                  if (value.length <= 20) {
                    setNewDocumentName(value)
                  }
                }}
                onKeyPress={(e) => e.key === 'Enter' && handleRenameDocument()}
                className="folder-name-input"
                maxLength={20}
                autoFocus
              />
              <p className="folder-hint" style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Maksimum 20 karakter (uzantı hariç). Uzantı otomatik olarak korunur.
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => {
                setShowRenameModal(false)
                setRenameDocId(null)
                setNewDocumentName('')
              }} className="btn-cancel">
                İptal
              </button>
              <button onClick={handleRenameDocument} className="btn-create">
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move Document Modal */}
      {showMoveModal && moveDocId && (
        <div className="modal-overlay" onClick={() => {
          setShowMoveModal(false)
          setMoveDocId(null)
          setMoveTargetIndex(null)
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Dosya Yerini Değiştir</h3>
              <button onClick={() => {
                setShowMoveModal(false)
                setMoveDocId(null)
                setMoveTargetIndex(null)
              }} className="close-btn">
                <X />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Dosyayı taşımak istediğiniz pozisyonu seçin:
              </p>
              <div className="move-position-list">
                {documents
                  .filter(doc => !doc.isDeleted)
                  .map((doc, index) => {
                    const isCurrentDoc = (doc._id || doc.id) === moveDocId
                    return (
                      <button
                        key={doc._id || doc.id}
                        className={`move-position-item ${isCurrentDoc ? 'current' : ''} ${moveTargetIndex === index ? 'selected' : ''}`}
                        onClick={() => setMoveTargetIndex(index)}
                        disabled={isCurrentDoc}
                      >
                        <span className="move-position-number">{index + 1}</span>
                        <span className="move-position-name">{doc.filename || doc.name}</span>
                        {isCurrentDoc && <span className="move-position-label">(Mevcut)</span>}
                      </button>
                    )
                  })}
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => {
                setShowMoveModal(false)
                setMoveDocId(null)
                setMoveTargetIndex(null)
              }} className="btn-cancel">
                İptal
              </button>
              <button 
                onClick={() => handleMoveDocument(moveTargetIndex)} 
                className="btn-create"
                disabled={moveTargetIndex === null}
              >
                Taşı
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        id="file-upload"
        type="file"
        accept=".pdf,.txt"
        onChange={handleFileUpload}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default Dashboard

