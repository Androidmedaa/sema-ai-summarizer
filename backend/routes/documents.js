import express from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import pdfParse from 'pdf-parse'
import mammoth from 'mammoth'
import { verifyToken } from './auth.js'
import { 
  processDocument, 
  searchDocuments, 
  askQuestion, 
  generateSummary,
  simpleSummary,
  simpleExtractKeywords
} from '../services/aiService.js'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { TextToSpeechClient } from '@google-cloud/text-to-speech'
import { geminiApiLimiter, uploadLimiter } from '../middleware/rateLimiter.js'
import { fullyCleanPdfText } from '../utils/pdfCleaner.js'

// Initialize Gemini AI for podcast scripts - Lazy initialization
let genAI = null

function getGenAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    console.log('🔑 Initializing Gemini AI in documents.js with API key:', process.env.GEMINI_API_KEY.substring(0, 10) + '...')
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return genAI
}

// Initialize TTS client - Lazy initialization
let ttsClient = null

function getTTSClient() {
  if (!ttsClient) {
    try {
      // Google Cloud credentials environment variable kontrolü
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        console.log('🔊 Initializing TTS client with GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS)
        ttsClient = new TextToSpeechClient()
        console.log('✅ Text-to-Speech client initialized successfully')
      } else if (process.env.GEMINI_API_KEY) {
        // GEMINI_API_KEY varsa da deneyebiliriz (bazı durumlarda çalışabilir)
        console.log('⚠️ GOOGLE_APPLICATION_CREDENTIALS not found, trying with GEMINI_API_KEY...')
        ttsClient = new TextToSpeechClient()
        console.log('✅ Text-to-Speech client initialized with GEMINI_API_KEY')
      } else {
        console.warn('⚠️ TTS client not initialized: GOOGLE_APPLICATION_CREDENTIALS or GEMINI_API_KEY not found')
        console.warn('💡 TTS için Google Cloud credentials gerekli. GOOGLE_APPLICATION_CREDENTIALS environment variable ayarlayın.')
      }
    } catch (error) {
      console.error('❌ TTS client initialization failed:', error.message)
      console.error('💡 TTS için Google Cloud credentials gerekli. GOOGLE_APPLICATION_CREDENTIALS environment variable ayarlayın.')
      console.error('   Hata detayları:', error)
    }
  }
  return ttsClient
}

// Generate audio from text using Gemini TTS
async function generateAudioFromText(text, outputPath) {
  const client = getTTSClient()
  if (!client) {
    const errorMsg = 'TTS client not available. Please configure GOOGLE_APPLICATION_CREDENTIALS environment variable.'
    console.error('❌', errorMsg)
    throw new Error(errorMsg)
  }

  try {
    // Senaryodaki [Sunucu] ve [Konuk] etiketlerini kaldır, sadece metni al
    const cleanText = text
      .replace(/\[Sunucu\]:/g, '')
      .replace(/\[Konuk\]:/g, '')
      .replace(/\[Konuk\/Sunucu\]:/g, '')
      .replace(/\n+/g, ' ') // Çoklu satır sonlarını tek boşluğa çevir
      .trim()

    if (!cleanText || cleanText.length === 0) {
      throw new Error('Temizlenmiş metin boş, ses dosyası oluşturulamıyor')
    }

    console.log('🔊 Preparing TTS request...')
    console.log('   Clean text length:', cleanText.length, 'characters')
    console.log('   Output path:', outputPath)

    const request = {
      input: { text: cleanText },
      voice: {
        languageCode: 'tr-TR',
        name: 'tr-TR-Wavenet-D',
        ssmlGender: 'NEUTRAL'
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: 1.0,
        pitch: 0.0
      },
      model: 'gemini-2.5-flash-preview-tts' // Gemini TTS modeli
    }

    console.log('🔊 Calling TTS API with model: gemini-2.5-flash-preview-tts')
    const [response] = await client.synthesizeSpeech(request)
    
    if (!response || !response.audioContent) {
      throw new Error('TTS API yanıt vermedi veya ses içeriği boş')
    }

    // Ses dosyasını kaydet
    fs.writeFileSync(outputPath, response.audioContent, 'binary')
    const fileSize = fs.statSync(outputPath).size
    console.log(`✅ Audio file generated successfully: ${outputPath} (${fileSize} bytes)`)
    
    return outputPath
  } catch (error) {
    console.error('❌ TTS generation error:', error.message)
    if (error.code) {
      console.error('   Error code:', error.code)
    }
    if (error.details) {
      console.error('   Error details:', error.details)
    }
    throw error
  }
}

const router = express.Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.join(__dirname, '../uploads')
const dataDir = path.join(__dirname, '../data')
const audioDir = path.join(__dirname, '../audio')

// Create audio directory if it doesn't exist
if (!fs.existsSync(audioDir)) {
  fs.mkdirSync(audioDir, { recursive: true })
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Uploads klasörünün var olduğundan emin ol
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true })
    }
    cb(null, uploadsDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    // userId varsa kullan, yoksa 'temp' kullan (verifyToken sonra ekleyecek)
    const userId = req.userId || 'temp'
    cb(null, `${userId}-${uniqueSuffix}-${file.originalname}`)
  }
})

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.pdf', '.txt'] // Sadece PDF ve TXT kabul ediliyor
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('Sadece PDF ve TXT dosyaları yüklenebilir'))
    }
  }
})

const documentsFile = path.join(dataDir, 'documents.json')

// Initialize documents file
if (!fs.existsSync(documentsFile)) {
  fs.writeFileSync(documentsFile, JSON.stringify([]))
}

// Helper functions
const readDocuments = () => {
  try {
    const data = fs.readFileSync(documentsFile, 'utf8')
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

const writeDocuments = (documents) => {
  fs.writeFileSync(documentsFile, JSON.stringify(documents, null, 2))
}

// Extract text from file
const extractText = async (filePath, fileType) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      throw new Error(`Dosya bulunamadı: ${filePath}`)
    }

    // Check file size
    const stats = fs.statSync(filePath)
    if (stats.size === 0) {
      console.error(`❌ File is empty: ${filePath}`)
      throw new Error('Dosya boş')
    }

    console.log(`📄 Extracting text from ${fileType} file: ${filePath} (${stats.size} bytes)`)

    if (fileType === 'pdf') {
      try {
        const dataBuffer = fs.readFileSync(filePath)
        const data = await pdfParse(dataBuffer)
        let extractedText = data.text || ''
        console.log(`✅ PDF text extracted: ${extractedText.length} characters`)
        
        // Eğer metin çıkarılamadıysa (sadece resim içeriyorsa), boş string döndür ama hata fırlatma
        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('⚠️ PDF\'den metin çıkarılamadı (muhtemelen sadece resim içeriyor), dosya yine de kaydedilecek')
          return 'Bu PDF dosyası sadece resim içeriyor. Metin çıkarımı yapılamadı ancak dosya sisteme kaydedildi.'
        }
        
        // PDF metnini temizle (header, footer, query string vb.)
        extractedText = fullyCleanPdfText(extractedText)
        console.log(`🧹 PDF text cleaned: ${extractedText.length} characters (after cleaning)`)
        
        return extractedText
      } catch (pdfError) {
        console.error('❌ PDF parsing error:', pdfError)
        // PDF parse hatası olsa bile dosyayı kaydet, sadece uyarı ver
        console.warn('⚠️ PDF parse hatası, dosya yine de kaydedilecek:', pdfError.message)
        return 'PDF dosyası okunurken bir sorun oluştu ancak dosya sisteme kaydedildi. Dosya içeriği analiz edilemeyebilir.'
      }
    } else if (fileType === 'docx' || fileType === 'doc') {
      try {
        const result = await mammoth.extractRawText({ path: filePath })
        const extractedText = result.value || ''
        console.log(`✅ Word text extracted: ${extractedText.length} characters`)
        if (result.messages && result.messages.length > 0) {
          console.warn('⚠️ Word extraction warnings:', result.messages)
        }
        return extractedText
      } catch (wordError) {
        console.error('❌ Word parsing error:', wordError)
        throw new Error(`Word dosyası okunamadı: ${wordError.message}`)
      }
    } else if (fileType === 'txt') {
      try {
        const text = fs.readFileSync(filePath, 'utf8')
        console.log(`✅ TXT text extracted: ${text.length} characters`)
        return text
      } catch (txtError) {
        console.error('❌ TXT reading error:', txtError)
        throw new Error(`TXT dosyası okunamadı: ${txtError.message}`)
      }
    } else if (fileType === 'xls' || fileType === 'xlsx') {
      // Excel dosyaları için şimdilik basit bir mesaj döndür
      // İleride Excel parsing kütüphanesi eklenebilir (örn: xlsx, exceljs)
      console.warn('⚠️ Excel dosyası tespit edildi, metin çıkarımı şu an desteklenmiyor')
      return `Excel dosyası: ${path.basename(filePath)}\n\nNot: Excel dosyalarından metin çıkarımı şu an desteklenmiyor. Dosya kaydedildi ancak içerik analizi yapılamayacak.`
    } else {
      console.error(`❌ Unsupported file type: ${fileType}`)
      throw new Error(`Desteklenmeyen dosya tipi: ${fileType}`)
    }
  } catch (error) {
    console.error('❌ Text extraction error:', {
      filePath,
      fileType,
      error: error.message,
      stack: error.stack
    })
    throw error // Re-throw to get detailed error message
  }
}

// Get all documents for user
router.get('/', verifyToken, (req, res) => {
  try {
    const documents = readDocuments()
    const userDocuments = documents.filter(doc => doc.userId === req.userId)
    res.json(userDocuments)
  } catch (error) {
    console.error('Get documents error:', error)
    res.status(500).json({ message: 'Dokümanlar yüklenirken hata oluştu' })
  }
})

// Upload document - verifyToken önce çalışmalı ki req.userId set edilsin
router.post('/upload', verifyToken, uploadLimiter, upload.single('file'), async (req, res) => {
  let uploadedFilePath = null
  
  try {
    console.log('📤 Upload request received:', {
      hasFile: !!req.file,
      userId: req.userId,
      filename: req.file?.originalname,
      fileSize: req.file?.size,
      fileMimetype: req.file?.mimetype,
      filePath: req.file?.path,
      folderId: req.body.folderId
    })
    
    if (!req.file) {
      console.error('❌ No file in request')
      return res.status(400).json({ message: 'Dosya yüklenmedi' })
    }

    uploadedFilePath = req.file.path
    let filePath = req.file.path
    const fileExt = path.extname(req.file.originalname).toLowerCase()
    let fileType = fileExt.substring(1) // Remove the dot
    
    // .doc dosyaları mammoth tarafından desteklenmiyor, .docx'e dönüştürülmesi gerekir
    // Ancak şimdilik .doc dosyalarını da .docx olarak işlemeye çalışalım
    if (fileType === 'doc') {
      console.warn('⚠️ .doc formatı tam desteklenmiyor, .docx formatı önerilir')
      // .doc dosyalarını da .docx gibi işlemeye çalış
      fileType = 'docx'
    }
    
    // Excel dosyaları için fileType'ı düzelt
    if (fileType === 'xls' || fileType === 'xlsx') {
      console.log(`📊 Excel dosyası tespit edildi: ${fileType}`)
    }

    console.log('📄 Extracting text from file...')
    // Extract text from document
    let text = ''
    try {
      text = await extractText(filePath, fileType)
    } catch (extractError) {
      console.error('❌ Text extraction failed:', extractError)
      // Metin çıkarımı başarısız olsa bile dosyayı kaydet
      console.warn('⚠️ Metin çıkarımı başarısız, dosya yine de kaydedilecek')
      text = `Dosya yüklendi ancak metin çıkarımı yapılamadı: ${extractError.message || 'Bilinmeyen hata'}`
    }

    // Metin boş olsa bile dosyayı kaydet (örneğin sadece resim içeren PDF'ler için)
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ Text extraction returned empty result, dosya yine de kaydedilecek')
      text = 'Bu dosya yüklendi ancak metin içeriği çıkarılamadı. Dosya sadece resim içeriyor olabilir.'
    }

    console.log(`✅ Text extracted: ${text.length} characters`)

    // Dosya adını userId ile güncelle (eğer temp ise)
    if (req.file.filename.startsWith('temp-')) {
      const newFilename = req.file.filename.replace('temp-', `${req.userId}-`)
      const newPath = path.join(uploadsDir, newFilename)
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, newPath)
        filePath = newPath
        uploadedFilePath = newPath
      }
    }

    console.log('🤖 Processing document with AI...')
    // Process document with AI - timeout ile
    let processed
    try {
      // Eğer metin çok kısa veya sadece uyarı mesajı ise, AI işleme yapma
      if (text.length < 50 || text.includes('metin çıkarımı yapılamadı') || text.includes('içerik analiz edilemeyebilir')) {
        console.warn('⚠️ Metin çok kısa veya çıkarılamadı, basit özet kullanılacak')
        processed = {
          summary: 'Bu dosya yüklendi ancak metin içeriği çıkarılamadı. Dosya sadece resim içeriyor olabilir.',
          keywords: []
        }
      } else {
        processed = await Promise.race([
          processDocument(text),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI işleme zaman aşımına uğradı (60 saniye)')), 60000)
          )
        ])
      }
    } catch (aiError) {
      console.error('⚠️ AI processing error, using fallback:', aiError.message)
      // AI hatası olsa bile devam et, basit özet ve anahtar kelimeler kullan
      processed = {
        summary: text.length > 0 ? simpleSummary(text, 200) : 'Dosya yüklendi ancak içerik analizi yapılamadı.',
        keywords: text.length > 0 ? simpleExtractKeywords(text) : []
      }
    }

    // Create document record
    const document = {
      id: Date.now().toString(),
      userId: req.userId,
      filename: req.file.originalname,
      filepath: filePath,
      type: fileType.toUpperCase(),
      text: text,
      summary: processed.summary,
      keywords: processed.keywords,
      folderId: req.body.folderId || null, // Klasör ID'sini ekle
      uploadedAt: new Date().toISOString()
    }

    const documents = readDocuments()
    documents.push(document)
    writeDocuments(documents)

    res.status(201).json({
      _id: document.id,
      id: document.id,
      filename: document.filename,
      type: document.type,
      summary: document.summary,
      keywords: document.keywords,
      text: document.text.substring(0, 1000), // İlk 1000 karakter (Firebase limit için)
      folderId: document.folderId || null,
      uploadedAt: document.uploadedAt,
      userId: document.userId,
      fileSize: req.file.size || null // Dosya boyutu
    })
  } catch (error) {
    console.error('❌ Upload error:', error)
    console.error('Error stack:', error.stack)
    
    // Upload edilen dosyayı temizle
    if (uploadedFilePath && fs.existsSync(uploadedFilePath)) {
      try {
        fs.unlinkSync(uploadedFilePath)
        console.log('🗑️ Uploaded file deleted due to error')
      } catch (unlinkError) {
        console.error('File deletion error:', unlinkError)
      }
    }
    
    // Hata yanıtı gönder
    if (!res.headersSent) {
      res.status(500).json({ 
        message: 'Dosya yüklenirken hata oluştu: ' + (error.message || 'Bilinmeyen hata'),
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  }
})

// Search documents
router.post('/search', verifyToken, async (req, res) => {
  try {
    const { query } = req.body

    if (!query || !query.trim()) {
      return res.status(400).json({ message: 'Arama sorgusu gereklidir' })
    }

    const documents = readDocuments()
    const userDocuments = documents.filter(doc => doc.userId === req.userId)

    // Perform semantic search
    const results = await searchDocuments(userDocuments, query)

    res.json(results)
  } catch (error) {
    console.error('Search error:', error)
    res.status(500).json({ message: 'Arama sırasında hata oluştu' })
  }
})

// Generate custom theme with Gemini AI
router.post('/generate-theme', verifyToken, async (req, res) => {
  try {
    const { color } = req.body

    if (!color) {
      return res.status(400).json({ message: 'Renk gereklidir' })
    }

    // Hex renk kodunu RGB'ye çevir
    const hexToRgb = (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null
    }

    const rgb = hexToRgb(color)
    if (!rgb) {
      return res.status(400).json({ message: 'Geçersiz renk formatı' })
    }

    // Gemini AI ile tema renkleri oluştur
    const genAIInstance = getGenAI()
    let themeColors = {}

    if (genAIInstance && process.env.GEMINI_API_KEY) {
      try {
        const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
        
        // Renk parlaklığını hesapla (0-255 arası, 0 = siyah, 255 = beyaz)
        const lightness = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114)
        const isDarkColor = lightness < 128 // Koyu renk mi?
        const maxComponent = Math.max(rgb.r, rgb.g, rgb.b)
        const isVibrantColor = maxComponent > 200 // Parlak renk (sarı, turuncu, pembe vb.)
        
        const themePrompt = `Sen bir UI/UX renk uzmanısın. Verilen ana renge (#${color.substring(1)}) dayalı olarak modern ve profesyonel bir web uygulaması için uyumlu bir renk paleti oluştur.

Ana Renk: RGB(${rgb.r}, ${rgb.g}, ${rgb.b}) - Hex: ${color}
Renk Parlaklığı: ${lightness.toFixed(0)}/255 ${isDarkColor ? '(Koyu Renk)' : '(Açık Renk)'}
${isVibrantColor ? '⚠️ PARLAK RENK TESPİT EDİLDİ (sarı, turuncu, pembe vb.) - DAHA CANLI VE BELİRGİN TEMA OLUŞTUR!' : ''}

Görevin:
${isDarkColor ? 
  '1. Ana renge uyumlu, KOYU TONLU bir tema oluştur (koyu arka planlar)' :
  isVibrantColor ?
  '1. Ana renge uyumlu, CANLI VE BELİRGİN bir açık tema oluştur. Arka planlar ana renge dayalı, daha belirgin tonlarda olmalı (soluk değil!).' :
  '1. Ana renge uyumlu, AÇIK TONLU bir tema oluştur (açık arka planlar)'}
2. Arka plan renkleri: ${isDarkColor ? 'Koyu ve derin tonlar (siyah/gri tonları)' : isVibrantColor ? 'Ana renge dayalı, belirgin ama okunabilir tonlar (soluk değil, daha canlı!)' : 'Açık ve yumuşak tonlar'}
3. Vurgu renkleri: Ana renge dayalı, ${isDarkColor ? 'parlak ve görünür' : 'canlı ve belirgin'} tonlar
4. Metin renkleri: Yüksek kontrast, ${isDarkColor ? 'açık renkler (beyaz/açık gri)' : 'koyu renkler'} - okunabilir
5. Kenarlık renkleri: ${isDarkColor ? 'Koyu ama görünür' : 'Ana renge dayalı, belirgin ama yumuşak'}

${isDarkColor ? 
  'ÖNEMLİ: Koyu renk seçildi, bu yüzden KOYU TEMA oluştur. Arka planlar koyu (siyah/gri), metinler açık olmalı.' :
  isVibrantColor ?
  'ÖNEMLİ: PARLAK RENK seçildi! Arka planlar ana renge dayalı, BELİRGİN ve CANLI olmalı (soluk değil!). bgPrimary ve bgTertiary ana renge daha yakın tonlarda olmalı. Vurgu renkleri parlak ve dikkat çekici olmalı.' :
  'ÖNEMLİ: Açık renk seçildi, bu yüzden AÇIK TEMA oluştur. Arka planlar açık, metinler koyu olmalı.'}

Renk paletini JSON formatında ver:
{
  "bgPrimary": "#hex",
  "bgSecondary": "#hex",
  "bgTertiary": "#hex",
  "accentBlue": "#hex",
  "accentBlueLight": "#hex",
  "accentBlueDark": "#hex",
  "accentPurple": "#hex",
  "textPrimary": "#hex",
  "textSecondary": "#hex",
  "textMuted": "#hex",
  "borderColor": "#hex"
}

Sadece JSON objesini döndür, başka açıklama yapma.`

        const result = await model.generateContent(themePrompt)
        const response = await result.response
        const responseText = response.text().trim()
        
        // JSON'u parse et
        try {
          // JSON bloğunu bul (```json ... ``` veya sadece { ... })
          const jsonMatch = responseText.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            themeColors = JSON.parse(jsonMatch[0])
          } else {
            throw new Error('JSON bulunamadı')
          }
        } catch (parseError) {
          console.error('JSON parse error:', parseError)
          // Fallback: Basit renk hesaplama
          themeColors = generateThemeFromColor(color, rgb)
        }
      } catch (aiError) {
        console.error('Gemini theme generation error:', aiError)
        // Fallback: Basit renk hesaplama
        themeColors = generateThemeFromColor(color, rgb)
      }
    } else {
      // Fallback: Basit renk hesaplama
      themeColors = generateThemeFromColor(color, rgb)
    }

    console.log('Generated theme colors:', themeColors) // Debug için
    res.json({ theme: themeColors })
  } catch (error) {
    console.error('Generate theme error:', error)
    res.status(500).json({ message: 'Tema oluşturulurken hata oluştu' })
  }
})

// RGB'yi Hex'e çevir
function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? "0" + hex : hex
  }).join("")
}

// Basit renk hesaplama fonksiyonu (fallback)
function generateThemeFromColor(color, rgb) {
  // Ana renge dayalı basit bir tema oluştur
  const lightness = (rgb.r * 0.299 + rgb.g * 0.587 + rgb.b * 0.114)
  const isDarkColor = lightness < 128 // Koyu renk mi?
  
  if (isDarkColor) {
    // KOYU TEMA (siyah, koyu renkler için)
    // Koyu arka planlar
    const bgPrimaryR = Math.max(0, Math.min(30, rgb.r + 10))
    const bgPrimaryG = Math.max(0, Math.min(30, rgb.g + 10))
    const bgPrimaryB = Math.max(0, Math.min(30, rgb.b + 10))
    const bgPrimary = rgbToHex(bgPrimaryR, bgPrimaryG, bgPrimaryB)
    
    const bgSecondaryR = Math.max(0, Math.min(40, rgb.r + 20))
    const bgSecondaryG = Math.max(0, Math.min(40, rgb.g + 20))
    const bgSecondaryB = Math.max(0, Math.min(40, rgb.b + 20))
    const bgSecondary = rgbToHex(bgSecondaryR, bgSecondaryG, bgSecondaryB)
    
    const bgTertiaryR = Math.max(0, Math.min(50, rgb.r + 30))
    const bgTertiaryG = Math.max(0, Math.min(50, rgb.g + 30))
    const bgTertiaryB = Math.max(0, Math.min(50, rgb.b + 30))
    const bgTertiary = rgbToHex(bgTertiaryR, bgTertiaryG, bgTertiaryB)
    
    // Vurgu renkleri - parlak ve görünür
    const accentBlue = color
    const accentBlueLight = rgbToHex(
      Math.min(255, Math.max(rgb.r, rgb.r + 60)),
      Math.min(255, Math.max(rgb.g, rgb.g + 60)),
      Math.min(255, Math.max(rgb.b, rgb.b + 60))
    )
    const accentBlueDark = color
    
    // Metin renkleri - açık (koyu arka plan için)
    const textPrimary = '#f1f5f9'
    const textSecondary = '#cbd5e1'
    const textMuted = '#94a3b8'
    
    // Kenarlık - koyu ama görünür
    const borderR = Math.max(0, Math.min(60, rgb.r + 40))
    const borderG = Math.max(0, Math.min(60, rgb.g + 40))
    const borderB = Math.max(0, Math.min(60, rgb.b + 40))
    const borderColor = rgbToHex(borderR, borderG, borderB)
    
    return {
      bgPrimary,
      bgSecondary,
      bgTertiary,
      accentBlue,
      accentBlueLight,
      accentBlueDark,
      accentPurple: accentBlue,
      textPrimary,
      textSecondary,
      textMuted,
      borderColor
    }
  } else {
    // AÇIK TEMA (açık renkler için) - DAHA CANLI
    // Renk doygunluğunu kontrol et (parlak renkler için daha belirgin arka planlar)
    const maxComponent = Math.max(rgb.r, rgb.g, rgb.b)
    const isVibrantColor = maxComponent > 200 // Parlak renk (sarı, turuncu, pembe vb.)
    
    if (isVibrantColor) {
      // PARLAK RENKLER İÇİN (sarı, turuncu, pembe vb.) - DAHA CANLI
      // Arka planlar: Ana renge dayalı, daha belirgin ama okunabilir
      const bgPrimaryR = Math.min(255, Math.round(rgb.r * 0.15 + 245))
      const bgPrimaryG = Math.min(255, Math.round(rgb.g * 0.15 + 247))
      const bgPrimaryB = Math.min(255, Math.round(rgb.b * 0.15 + 250))
      const bgPrimary = rgbToHex(bgPrimaryR, bgPrimaryG, bgPrimaryB)
      
      const bgSecondary = '#ffffff'
      
      // Tertiary: Ana renge daha yakın, belirgin
      const bgTertiaryR = Math.min(255, Math.round(rgb.r * 0.25 + 235))
      const bgTertiaryG = Math.min(255, Math.round(rgb.g * 0.25 + 240))
      const bgTertiaryB = Math.min(255, Math.round(rgb.b * 0.25 + 245))
      const bgTertiary = rgbToHex(bgTertiaryR, bgTertiaryG, bgTertiaryB)
      
      // Vurgu renkleri: Ana renk ve parlak tonları
      const accentBlue = color
      const accentBlueLight = rgbToHex(
        Math.min(255, rgb.r + 30),
        Math.min(255, rgb.g + 30),
        Math.min(255, rgb.b + 30)
      )
      const accentBlueDark = rgbToHex(
        Math.max(0, rgb.r - 50),
        Math.max(0, rgb.g - 50),
        Math.max(0, rgb.b - 50)
      )
      
      // Metin renkleri: Koyu ve okunabilir
      const textPrimary = '#1e293b'
      const textSecondary = '#475569'
      const textMuted = '#64748b'
      
      // Kenarlık: Ana renge dayalı, belirgin ama yumuşak
      const borderR = Math.min(255, Math.round(rgb.r * 0.3 + 220))
      const borderG = Math.min(255, Math.round(rgb.g * 0.3 + 225))
      const borderB = Math.min(255, Math.round(rgb.b * 0.3 + 230))
      const borderColor = rgbToHex(borderR, borderG, borderB)
      
      return {
        bgPrimary,
        bgSecondary,
        bgTertiary,
        accentBlue,
        accentBlueLight,
        accentBlueDark,
        accentPurple: accentBlue,
        textPrimary,
        textSecondary,
        textMuted,
        borderColor
      }
    } else {
      // NORMAL AÇIK RENKLER İÇİN
      // Açık arka plan renkleri
      const bgPrimaryR = Math.min(255, Math.round(rgb.r * 0.08 + 248))
      const bgPrimaryG = Math.min(255, Math.round(rgb.g * 0.08 + 250))
      const bgPrimaryB = Math.min(255, Math.round(rgb.b * 0.08 + 252))
      const bgPrimary = rgbToHex(bgPrimaryR, bgPrimaryG, bgPrimaryB)
      
      const bgSecondary = '#ffffff'
      
      const bgTertiaryR = Math.min(255, Math.round(rgb.r * 0.12 + 241))
      const bgTertiaryG = Math.min(255, Math.round(rgb.g * 0.12 + 245))
      const bgTertiaryB = Math.min(255, Math.round(rgb.b * 0.12 + 249))
      const bgTertiary = rgbToHex(bgTertiaryR, bgTertiaryG, bgTertiaryB)
      
      // Vurgu renkleri
      const accentBlue = color
      const accentBlueLight = rgbToHex(
        Math.min(255, rgb.r + 40),
        Math.min(255, rgb.g + 40),
        Math.min(255, rgb.b + 40)
      )
      const accentBlueDark = rgbToHex(
        Math.max(0, rgb.r - 40),
        Math.max(0, rgb.g - 40),
        Math.max(0, rgb.b - 40)
      )
      
      // Metin renkleri (açık tema için)
      const textPrimary = '#1e293b'
      const textSecondary = '#475569'
      const textMuted = '#94a3b8'
      
      // Kenarlık (ana renge dayalı açık ton)
      const borderR = Math.min(255, Math.round(rgb.r * 0.2 + 226))
      const borderG = Math.min(255, Math.round(rgb.g * 0.2 + 232))
      const borderB = Math.min(255, Math.round(rgb.b * 0.2 + 240))
      const borderColor = rgbToHex(borderR, borderG, borderB)
      
      return {
        bgPrimary,
        bgSecondary,
        bgTertiary,
        accentBlue,
        accentBlueLight,
        accentBlueDark,
        accentPurple: accentBlue,
        textPrimary,
        textSecondary,
        textMuted,
        borderColor
      }
    }
  }
}

// Get folder summary (klasör içeriği özeti)
router.get('/folder/:folderId/summary', verifyToken, geminiApiLimiter, async (req, res) => {
  try {
    const { folderId } = req.params
    const { documents: providedDocuments } = req.query // Frontend'den gönderilen dokümanlar (opsiyonel)
    
    let folderDocuments = []
    
    // Eğer frontend'den dokümanlar gönderilmişse onları kullan, yoksa backend'den oku
    if (providedDocuments) {
      try {
        folderDocuments = JSON.parse(decodeURIComponent(providedDocuments))
      } catch (parseError) {
        console.warn('Provided documents parse error, using backend documents')
        const documents = readDocuments()
        folderDocuments = documents.filter(doc => {
          // Çöp kutusundaki dokümanları hariç tut
          if (doc.isDeleted === true) return false
          
          if (folderId === 'root' || folderId === 'null' || !folderId) {
            return doc.userId === req.userId && (!doc.folderId || doc.folderId === null || doc.folderId === '')
          }
          return doc.userId === req.userId && (doc.folderId === folderId || doc.folderId === String(folderId) || String(doc.folderId) === String(folderId))
        })
      }
    } else {
      const documents = readDocuments()
      // Klasördeki dokümanları filtrele (folderId null ise root klasör) - çöp kutusundaki dokümanları hariç tut
      folderDocuments = documents.filter(doc => {
        // Çöp kutusundaki dokümanları hariç tut
        if (doc.isDeleted === true) return false
        
        if (folderId === 'root' || folderId === 'null' || !folderId) {
          return doc.userId === req.userId && (!doc.folderId || doc.folderId === null || doc.folderId === '')
        }
        // String ve number karşılaştırması için
        return doc.userId === req.userId && (doc.folderId === folderId || doc.folderId === String(folderId) || String(doc.folderId) === String(folderId))
      })
    }
    
    // Frontend'den gelen dokümanları da filtrele (folderId'ye göre ve çöp kutusundaki dokümanları hariç tut)
    if (providedDocuments) {
      folderDocuments = folderDocuments.filter(doc => {
        // Çöp kutusundaki dokümanları hariç tut
        if (doc.isDeleted === true) return false
        
        if (folderId === 'root' || folderId === 'null' || !folderId) {
          return !doc.folderId || doc.folderId === null || doc.folderId === ''
        }
        return doc.folderId === folderId || doc.folderId === String(folderId) || String(doc.folderId) === String(folderId)
      })
    }

    if (folderDocuments.length === 0) {
      return res.json({
        summary: 'Bu klasörde henüz doküman bulunmuyor.',
        documentCount: 0
      })
    }

    // Tüm doküman metinlerini birleştir
    const combinedText = folderDocuments
      .map((doc, index) => {
        const docText = doc.text || doc.summary || ''
        return `DOKÜMAN ${index + 1}: ${doc.filename || 'İsimsiz'}
${docText.substring(0, 2000)}`
      })
      .join('\n\n' + '='.repeat(50) + '\n\n')

    // Gemini AI ile kısa özet oluştur
    const genAIInstance = getGenAI()
    let folderSummary = ''

    if (genAIInstance && process.env.GEMINI_API_KEY) {
      try {
        const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
        
        const summaryPrompt = `Aşağıdaki klasörde bulunan ${folderDocuments.length} dokümanı analiz et ve KISA bir özet oluştur.

KURALLAR:
1. Özet maksimum 2-3 cümle olmalı
2. Klasördeki dokümanların genel içeriğini, konusunu ve öne çıkan noktaları belirt
3. Doküman sayısını ve türlerini (varsa) belirt
4. Önemli anahtar kelimeleri vurgula
5. Türkçe, akıcı ve anlaşılır bir dil kullan
6. Özeti doğrudan ver, başlık veya format etiketi kullanma

Klasör İçeriği:
${combinedText.substring(0, 8000)}

Kısa özet:`

        const result = await model.generateContent(summaryPrompt)
        const response = await result.response
        folderSummary = response.text().trim()
      } catch (aiError) {
        console.error('Folder summary AI error:', aiError)
        // Fallback: basit özet
        folderSummary = `Bu klasörde ${folderDocuments.length} doküman bulunmaktadır.`
      }
    } else {
      // Fallback: basit özet
      folderSummary = `Bu klasörde ${folderDocuments.length} doküman bulunmaktadır.`
    }

    res.json({
      summary: folderSummary,
      documentCount: folderDocuments.length,
      documentTypes: [...new Set(folderDocuments.map(doc => doc.type || 'Bilinmeyen'))]
    })
  } catch (error) {
    console.error('Folder summary error:', error)
    res.status(500).json({ message: 'Klasör özeti oluşturulurken hata oluştu' })
  }
})

// Ask question
router.post('/ask', verifyToken, geminiApiLimiter, async (req, res) => {
  try {
    const { question } = req.body

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Soru gereklidir' })
    }

    const documents = readDocuments()
    // Sadece aktif (silinmemiş) dokümanları kullan - çöp kutusundaki dokümanları hariç tut
    const userDocuments = documents.filter(doc => 
      doc.userId === req.userId && 
      (!doc.isDeleted || doc.isDeleted === false) // Çöp kutusundaki dokümanları hariç tut
    )

    if (userDocuments.length === 0) {
      return res.status(400).json({ message: 'Henüz doküman yüklenmedi' })
    }

    console.log('📚 AI soru-cevap için kullanılan dokümanlar:', {
      total: userDocuments.length,
      filenames: userDocuments.map(d => d.filename)
    })

    // Get answer using AI
    const answer = await askQuestion(userDocuments, question)

    res.json(answer)
  } catch (error) {
    console.error('Ask question error:', error)
    res.status(500).json({ message: 'Soru cevaplanırken hata oluştu' })
  }
})

// Ask question about specific document
router.post('/:id/ask', verifyToken, geminiApiLimiter, async (req, res) => {
  try {
    const { id } = req.params
    const { question } = req.body

    if (!question || !question.trim()) {
      return res.status(400).json({ message: 'Soru gereklidir' })
    }

    const documents = readDocuments()
    // Sadece aktif (silinmemiş) dokümanları kullan - çöp kutusundaki dokümanları hariç tut
    const document = documents.find(doc => 
      doc.id === id && 
      doc.userId === req.userId && 
      (!doc.isDeleted || doc.isDeleted === false) // Çöp kutusundaki dokümanları hariç tut
    )

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı veya çöp kutusunda' })
    }

    console.log('📋 Doküman soru sorma isteği:', {
      docId: id,
      filename: document.filename,
      hasText: !!document.text,
      textLength: document.text?.length || 0,
      question: question.substring(0, 50)
    })

    // Doküman metninin varlığını kontrol et
    if (!document.text || document.text.trim().length === 0) {
      console.error('❌ Doküman metni boş!')
      return res.status(400).json({ 
        message: 'Doküman metni bulunamadı. Lütfen dokümanın içeriğinin yüklendiğinden emin olun.',
        answer: 'Doküman metni bulunamadı. Lütfen dokümanın içeriğinin yüklendiğinden emin olun.',
        sources: [document.filename]
      })
    }

    // Get answer using AI for this specific document (tek doküman için özel prompt)
    const answer = await askQuestion([document], question, true)

    console.log('✅ Cevap hazır:', {
      answerLength: answer.answer?.length || 0,
      hasSources: answer.sources?.length > 0
    })

    res.json(answer)
  } catch (error) {
    console.error('❌ Ask document question error:', error)
    console.error('Error stack:', error.stack)
    res.status(500).json({ 
      message: 'Soru cevaplanırken hata oluştu',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Generate summary with specific format
router.post('/:id/summary', verifyToken, geminiApiLimiter, async (req, res) => {
  try {
    const { id } = req.params
    const { format = 'short' } = req.body // 'short', 'detailed', 'podcast'

    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    const text = document.text || ''
    let summaryData = {}

    if (format === 'short') {
      // Kısa özet için özel prompt
      const shortSummaryPrompt = `Sen profesyonel bir doküman özetleme asistanısın. Aşağıdaki dokümanı analiz et ve KISA bir özet oluştur.

KURALLAR:
1. Özet yaklaşık 150 kelime olmalı
2. Dokümanın ana fikrini ve en önemli noktalarını içermeli
3. Cümleler tamamlanmış ve anlamlı olmalı
4. Gereksiz detaylardan kaçın, sadece önemli bilgileri özetle
5. Özeti doğrudan ver, başlık veya format etiketi kullanma

Doküman:
${text.substring(0, 4000)}`

      try {
        const genAIInstance = getGenAI()
        if (genAIInstance && process.env.GEMINI_API_KEY) {
          const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const result = await model.generateContent(shortSummaryPrompt)
          const response = await result.response
          const shortSummary = response.text().trim()
          summaryData = {
            shortSummary: shortSummary || simpleSummary(text, 150),
            detailedSummary: simpleSummary(text, 500)
          }
        } else {
          summaryData = {
            shortSummary: simpleSummary(text, 150),
            detailedSummary: simpleSummary(text, 500)
          }
        }
      } catch (error) {
        console.error('Short summary generation error:', error)
        summaryData = {
          shortSummary: simpleSummary(text, 150),
          detailedSummary: simpleSummary(text, 500)
        }
      }
    } else if (format === 'detailed') {
      // Uzun özet için özel prompt
      const detailedSummaryPrompt = `Sen profesyonel bir doküman özetleme asistanısın. Aşağıdaki dokümanı analiz et ve DETAYLI bir özet oluştur.

KURALLAR:
1. Özet yaklaşık 500 kelime olmalı
2. Dokümanın tüm önemli noktalarını kapsamalı
3. Bağlamı koruyarak, dokümanın yapısını yansıtmalı
4. Ana başlıklar ve alt başlıkları dikkate al
5. Teknik terimleri açıkla ve önemli detayları dahil et
6. Cümleler tamamlanmış ve anlamlı olmalı
7. Özeti doğrudan ver, başlık veya format etiketi kullanma

Doküman:
${text.substring(0, 6000)}`

      try {
        const genAIInstance = getGenAI()
        if (genAIInstance && process.env.GEMINI_API_KEY) {
          const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const result = await model.generateContent(detailedSummaryPrompt)
          const response = await result.response
          const detailedSummary = response.text().trim()
          summaryData = {
            shortSummary: simpleSummary(text, 150),
            detailedSummary: detailedSummary || simpleSummary(text, 500)
          }
        } else {
          summaryData = {
            shortSummary: simpleSummary(text, 150),
            detailedSummary: simpleSummary(text, 500)
          }
        }
      } catch (error) {
        console.error('Detailed summary generation error:', error)
        summaryData = {
          shortSummary: simpleSummary(text, 150),
          detailedSummary: simpleSummary(text, 500)
        }
      }
    } else if (format === 'podcast') {
      // Podcast senaryosu için özel prompt
      const podcastPrompt = `Sen profesyonel bir podcast içerik yazarısın. Aşağıdaki dokümanı analiz et ve podcast senaryosu oluştur.

KURALLAR:
1. Senaryo 3-5 dakikalık bir podcast için olmalı
2. Senaryo diyalog formatında olmalı:
   - [Sunucu]: Giriş ve konu tanıtımı
   - [Konuk/Sunucu]: Ana konu tartışması ve açıklamalar
   - [Sunucu]: Sorular ve yorumlar
   - [Konuk/Sunucu]: Detaylı açıklamalar ve örnekler
   - [Sunucu]: Sonuç ve özet
3. Diyalog doğal, akıcı ve ilgi çekici olmalı
4. Teknik konuları anlaşılır şekilde açıkla
5. Senaryoyu doğrudan ver, başlık veya format etiketi kullanma

Doküman:
${text.substring(0, 6000)}`
      
      try {
        const genAIInstance = getGenAI()
        let podcastScript = ''
        
        if (genAIInstance && process.env.GEMINI_API_KEY) {
          const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const podcastResult = await model.generateContent(podcastPrompt)
          const podcastResponse = await podcastResult.response
          podcastScript = podcastResponse.text().trim()
        } else {
          podcastScript = `Podcast Senaryosu:\n\n[Sunucu]: Merhaba, bugün ${simpleSummary(text, 50)} konusunu ele alacağız.\n\n[Konuk]: ${simpleSummary(text, 100)}\n\n[Sunucu]: ${simpleSummary(text, 80)}\n\n[Konuk]: ${simpleSummary(text, 100)}\n\n[Sunucu]: ${simpleSummary(text, 50)}`
        }
        
        summaryData.podcastScript = podcastScript
        
        // TTS ile ses dosyası oluştur
        try {
          const audioFileName = `${req.userId}-${id}-${Date.now()}.mp3`
          const audioPath = path.join(audioDir, audioFileName)
          console.log('🔊 Attempting to generate audio file...')
          console.log('   Text length:', podcastScript.length, 'characters')
          await generateAudioFromText(podcastScript, audioPath)
          summaryData.audioUrl = `/api/documents/${id}/audio/${audioFileName}`
          summaryData.audioFileName = audioFileName
          console.log('✅ Podcast audio generated successfully:', audioFileName)
        } catch (ttsError) {
          console.error('❌ TTS generation failed:', ttsError.message)
          console.error('   Error details:', ttsError)
          console.warn('⚠️ Continuing without audio file. Podcast script will be available as text only.')
          // TTS hatası olsa bile devam et, sadece ses dosyası olmayacak
          summaryData.audioError = ttsError.message
        }
        
        // Kısa ve detaylı özeti de ekle
        const result = await generateSummary(text)
        summaryData.shortSummary = result.shortSummary || simpleSummary(text, 150)
        summaryData.detailedSummary = result.detailedSummary || simpleSummary(text, 500)
      } catch (error) {
        console.error('Podcast script generation error:', error)
        summaryData.podcastScript = `Podcast Senaryosu:\n\n[Sunucu]: Merhaba, bugün ${simpleSummary(text, 50)} konusunu ele alacağız.\n\n[Konuk]: ${simpleSummary(text, 100)}\n\n[Sunucu]: ${simpleSummary(text, 80)}\n\n[Konuk]: ${simpleSummary(text, 100)}\n\n[Sunucu]: ${simpleSummary(text, 50)}`
        summaryData.shortSummary = simpleSummary(text, 150)
        summaryData.detailedSummary = simpleSummary(text, 500)
      }
    }

    res.json(summaryData)
  } catch (error) {
    console.error('Generate summary error:', error)
    res.status(500).json({ message: 'Özet oluşturulurken hata oluştu' })
  }
})

// Get document by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    // For Word documents, convert to HTML for better viewing
    let content = document.text
    if ((document.type === 'DOC' || document.type === 'DOCX') && document.filepath && fs.existsSync(document.filepath)) {
      try {
        // Image converter: resimleri base64 olarak embed et
        const imageConverter = mammoth.images.imgElement((image) => {
          return image.read('base64').then((imageBuffer) => {
            return {
              src: `data:${image.contentType};base64,${imageBuffer}`
            }
          })
        })
        
        const result = await mammoth.convertToHtml(
          { path: document.filepath },
          { convertImage: imageConverter }
        )
        content = result.value
      } catch (err) {
        console.warn('Word to HTML conversion failed, using text:', err)
        // Hata durumunda basit HTML dönüşümü dene
        try {
          const simpleResult = await mammoth.convertToHtml({ path: document.filepath })
          content = simpleResult.value
        } catch (simpleErr) {
          console.warn('Simple HTML conversion also failed:', simpleErr)
        }
      }
    }

    res.json({
      id: document.id,
      filename: document.filename,
      type: document.type,
      text: content,
      summary: document.summary,
      keywords: document.keywords,
      uploadedAt: document.uploadedAt,
      filepath: document.filepath
    })
  } catch (error) {
    console.error('Get document error:', error)
    res.status(500).json({ message: 'Doküman yüklenirken hata oluştu' })
  }
})

// Serve original file
router.get('/:id/file', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    if (!document.filepath || !fs.existsSync(document.filepath)) {
      return res.status(404).json({ message: 'Dosya bulunamadı' })
    }

    // Set appropriate content type
    const ext = path.extname(document.filename).toLowerCase()
    const contentTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }

    res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
    res.setHeader('Content-Disposition', `inline; filename="${document.filename}"`)
    
    // Stream file
    const fileStream = fs.createReadStream(document.filepath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Serve file error:', error)
    res.status(500).json({ message: 'Dosya yüklenirken hata oluştu' })
  }
})

// Update document content (for editable formats)
router.put('/:id/content', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { content } = req.body
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    // Update text content
    document.text = content
    writeDocuments(documents)

    res.json({ message: 'Doküman güncellendi' })
  } catch (error) {
    console.error('Update content error:', error)
    res.status(500).json({ message: 'Doküman güncellenirken hata oluştu' })
  }
})

// Update document folder (move to folder)
router.put('/:id/folder', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { folderId } = req.body
    const documents = readDocuments()
    
    // Hem id hem de _id ile kontrol et (frontend'den farklı formatlar gelebilir)
    const document = documents.find(doc => 
      (doc.id === id || doc._id === id) && doc.userId === req.userId
    )

    if (!document) {
      console.error('❌ Doküman bulunamadı:', { 
        requestedId: id, 
        userId: req.userId,
        totalDocs: documents.length,
        userDocs: documents.filter(d => d.userId === req.userId).map(d => ({ 
          id: d.id, 
          _id: d._id, 
          userId: d.userId,
          filename: d.filename 
        }))
      })
      return res.status(404).json({ 
        message: 'Doküman bulunamadı',
        requestedId: id,
        userId: req.userId
      })
    }

    // Update folderId
    document.folderId = folderId || null
    writeDocuments(documents)

    console.log('✅ Doküman klasöre taşındı:', { 
      docId: document.id, 
      folderId: document.folderId,
      filename: document.filename 
    })
    res.json({ message: 'Doküman klasöre taşındı', folderId: document.folderId })
  } catch (error) {
    console.error('Update folder error:', error)
    res.status(500).json({ message: 'Doküman taşınırken hata oluştu' })
  }
})

// Delete document
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    // Dosyayı sil
    if (document.filepath && fs.existsSync(document.filepath)) {
      try {
        fs.unlinkSync(document.filepath)
      } catch (unlinkError) {
        console.error('File deletion error:', unlinkError)
      }
    }

    // Dokümanı listeden çıkar
    const updatedDocuments = documents.filter(doc => doc.id !== id)
    writeDocuments(updatedDocuments)

    res.json({ message: 'Doküman başarıyla silindi' })
  } catch (error) {
    console.error('Delete error:', error)
    res.status(500).json({ message: 'Doküman silinirken hata oluştu' })
  }
})

// Rename document
router.put('/:id/rename', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { filename } = req.body
    const documents = readDocuments()
    
    // Hem id hem de _id ile kontrol et (frontend'den farklı formatlar gelebilir)
    const document = documents.find(doc => 
      (doc.id === id || doc._id === id) && doc.userId === req.userId
    )

    if (!document) {
      console.error('❌ Doküman bulunamadı:', { 
        requestedId: id, 
        userId: req.userId,
        totalDocs: documents.length,
        userDocs: documents.filter(d => d.userId === req.userId).map(d => ({ 
          id: d.id, 
          _id: d._id, 
          userId: d.userId,
          filename: d.filename 
        }))
      })
      return res.status(404).json({ 
        message: 'Doküman bulunamadı',
        requestedId: id,
        userId: req.userId
      })
    }

    if (!filename || filename.trim().length === 0) {
      return res.status(400).json({ message: 'Dosya adı boş olamaz' })
    }

    // Orijinal dosya adından uzantıyı al
    const originalFilename = document.filename || ''
    const lastDotIndex = originalFilename.lastIndexOf('.')
    const extension = lastDotIndex > 0 ? originalFilename.substring(lastDotIndex) : ''
    
    // Yeni adı al ve uzantıyı koru
    let finalName = filename.trim()
    
    // Eğer kullanıcı uzantı eklememişse, orijinal uzantıyı ekle
    if (extension && !finalName.toLowerCase().endsWith(extension.toLowerCase())) {
      finalName = finalName + extension
    }
    
    // Uzantı hariç maksimum 20 karakter kontrolü
    const nameWithoutExt = extension ? finalName.slice(0, -extension.length) : finalName
    if (nameWithoutExt.length > 20) {
      return res.status(400).json({ message: 'Dosya adı (uzantı hariç) maksimum 20 karakter olabilir' })
    }
    
    if (nameWithoutExt.length === 0) {
      return res.status(400).json({ message: 'Dosya adı boş olamaz' })
    }

    // Update filename
    document.filename = finalName
    writeDocuments(documents)

    console.log('✅ Doküman adı güncellendi:', { 
      docId: document.id, 
      newFilename: document.filename 
    })
    res.json({ message: 'Doküman adı başarıyla güncellendi', document })
  } catch (error) {
    console.error('Rename error:', error)
    res.status(500).json({ message: 'Doküman adı güncellenirken hata oluştu' })
  }
})

// Get document summary
router.get('/:id/summary', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    // Generate detailed summary
    const summary = await generateSummary(document.text)

    res.json({
      shortSummary: document.summary || summary.shortSummary,
      detailedSummary: summary.detailedSummary
    })
  } catch (error) {
    console.error('Summary error:', error)
    res.status(500).json({ message: 'Özet oluşturulurken hata oluştu' })
  }
})

// Download audio file
router.get('/:id/audio/:filename', verifyToken, async (req, res) => {
  try {
    const { id, filename } = req.params
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    // Dosya adının güvenli olduğunu kontrol et
    if (!filename || !filename.endsWith('.mp3')) {
      return res.status(400).json({ message: 'Geçersiz dosya adı' })
    }

    // Dosya adının kullanıcıya ait olduğunu kontrol et
    if (!filename.startsWith(`${req.userId}-${id}-`)) {
      return res.status(403).json({ message: 'Bu dosyaya erişim yetkiniz yok' })
    }

    const audioPath = path.join(audioDir, filename)

    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ message: 'Ses dosyası bulunamadı' })
    }

    // Ses dosyasını gönder
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    
    const fileStream = fs.createReadStream(audioPath)
    fileStream.pipe(res)
  } catch (error) {
    console.error('Download audio error:', error)
    res.status(500).json({ message: 'Ses dosyası indirilirken hata oluştu' })
  }
})

// Download summary text
router.get('/:id/summary/download', verifyToken, async (req, res) => {
  try {
    const { id } = req.params
    const { format = 'podcast' } = req.query // 'short', 'detailed', 'podcast'
    
    const documents = readDocuments()
    const document = documents.find(doc => doc.id === id && doc.userId === req.userId)

    if (!document) {
      return res.status(404).json({ message: 'Doküman bulunamadı' })
    }

    let textToDownload = ''
    let filename = ''

    if (format === 'podcast') {
      // Podcast script'i oluştur
      try {
        const podcastPrompt = `Sen profesyonel bir podcast içerik yazarısın. Aşağıdaki dokümanı analiz et ve podcast senaryosu oluştur.

KURALLAR:
1. Senaryo 3-5 dakikalık bir podcast için olmalı
2. Senaryo diyalog formatında olmalı:
   - [Sunucu]: Giriş ve konu tanıtımı
   - [Konuk/Sunucu]: Ana konu tartışması ve açıklamalar
   - [Sunucu]: Sorular ve yorumlar
   - [Konuk/Sunucu]: Detaylı açıklamalar ve örnekler
   - [Sunucu]: Sonuç ve özet
3. Diyalog doğal, akıcı ve ilgi çekici olmalı
4. Teknik konuları anlaşılır şekilde açıkla
5. Senaryoyu doğrudan ver, başlık veya format etiketi kullanma

Doküman:
${document.text.substring(0, 6000)}`
        
        const genAIInstance = getGenAI()
        if (genAIInstance && process.env.GEMINI_API_KEY) {
          const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
          const podcastResult = await model.generateContent(podcastPrompt)
          const podcastResponse = await podcastResult.response
          textToDownload = podcastResponse.text().trim()
        } else {
          textToDownload = `Podcast Senaryosu:\n\n[Sunucu]: Merhaba, bugün ${simpleSummary(document.text, 50)} konusunu ele alacağız.\n\n[Konuk]: ${simpleSummary(document.text, 100)}\n\n[Sunucu]: ${simpleSummary(document.text, 80)}\n\n[Konuk]: ${simpleSummary(document.text, 100)}\n\n[Sunucu]: ${simpleSummary(document.text, 50)}`
        }
        filename = `${document.filename.replace(/\.[^/.]+$/, '')}_podcast.txt`
      } catch (err) {
        textToDownload = document.summary || 'Özet bulunamadı'
        filename = `${document.filename.replace(/\.[^/.]+$/, '')}_ozet.txt`
      }
    } else if (format === 'detailed') {
      const result = await generateSummary(document.text)
      textToDownload = result.detailedSummary || result.shortSummary || document.summary || ''
      filename = `${document.filename.replace(/\.[^/.]+$/, '')}_detayli_ozet.txt`
    } else {
      textToDownload = document.summary || ''
      filename = `${document.filename.replace(/\.[^/.]+$/, '')}_kisa_ozet.txt`
    }

    if (!textToDownload) {
      return res.status(404).json({ message: 'Özet bulunamadı' })
    }

    // Metin dosyasını gönder
    res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
    res.send(textToDownload)
  } catch (error) {
    console.error('Download summary error:', error)
    res.status(500).json({ message: 'Özet indirilirken hata oluştu' })
  }
})

// Summarize text endpoint
router.post('/summarize-text', verifyToken, geminiApiLimiter, async (req, res) => {
  try {
    const { text, length = 50, language = 'Turkish' } = req.body

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Metin gereklidir' })
    }

    const { generateSummary } = await import('../services/aiService.js')
    
    const textWordCount = text.split(/\s+/).length
    
    const summaryData = await generateSummary(text, language)
    
    let summary = summaryData.detailedSummary || summaryData.shortSummary || ''
    
    if (length < 50) {
      summary = summaryData.shortSummary || summary
    }
    
    // Özeti kesme - AI'ın ürettiği tam özeti döndür
    // Kullanıcı slider ile uzunluk kontrolü yapabilir, ancak özet tam olmalı
    
    res.json({
      summary: summary,
      originalLength: textWordCount,
      summaryLength: summary.split(/\s+/).length,
      compressionRatio: length
    })
  } catch (error) {
    console.error('Text summarization error:', error)
    res.status(500).json({ message: 'Metin özetlenirken hata oluştu: ' + error.message })
  }
})

export default router

