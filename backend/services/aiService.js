import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI - Lazy initialization to ensure env vars are loaded
let genAI = null

function getGenAI() {
  if (!genAI && process.env.GEMINI_API_KEY) {
    console.log('🔑 Initializing Gemini AI with API key:', process.env.GEMINI_API_KEY.substring(0, 10) + '...')
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  }
  return genAI
}

// Simple text-based AI functions (fallback if Gemini is not configured)
export const simpleExtractKeywords = (text) => {
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 4)
  
  const wordCount = {}
  words.forEach(word => {
    wordCount[word] = (wordCount[word] || 0) + 1
  })
  
  return Object.keys(wordCount)
    .sort((a, b) => wordCount[b] - wordCount[a])
    .slice(0, 10)
}

export const simpleSummary = (text, maxLength = 150) => {
  if (text.length <= maxLength) return text
  const sentences = text.split(/[.!?]+/)
  let summary = ''
  for (const sentence of sentences) {
    if (summary.length + sentence.length > maxLength) break
    summary += sentence.trim() + '. '
  }
  return summary.trim() || text.substring(0, maxLength) + '...'
}

// Parse AI response with strict format: KISA_OZET:, DETAYLI_OZET:, ANAHTAR_KELIMELER:
// Uses regex to reliably extract sections without cutting sentences
function parseAIResponse(responseText) {
  const result = {
    shortSummary: null,
    detailedSummary: null,
    keywords: []
  }

  // Extract KISA_OZET section - matches until next section or end
  const shortMatch = responseText.match(/KISA_OZET:\s*([\s\S]*?)(?=DETAYLI_OZET:|ANAHTAR_KELIMELER:|$)/i)
  if (shortMatch) {
    result.shortSummary = shortMatch[1].trim()
  }

  // Extract DETAYLI_OZET section - matches until next section or end
  const detailedMatch = responseText.match(/DETAYLI_OZET:\s*([\s\S]*?)(?=ANAHTAR_KELIMELER:|KISA_OZET:|$)/i)
  if (detailedMatch) {
    result.detailedSummary = detailedMatch[1].trim()
  }

  // Extract ANAHTAR_KELIMELER section - flexible parsing for various formats
  const keywordsMatch = responseText.match(/ANAHTAR_KELIMELER:\s*([\s\S]*?)(?=KISA_OZET:|DETAYLI_OZET:|$)/i)
  if (keywordsMatch) {
    // Parse keywords - supports comma-separated, line-separated, or bullet points
    const keywordsText = keywordsMatch[1].trim()
    result.keywords = keywordsText
      .split(/[,\n•\-\*]/)
      .map(k => k.trim())
      .filter(k => k.length > 0)
      .slice(0, 10) // Limit to 10 keywords
  }

  return result
}

// Process document with AI
export async function processDocument(text) {
  const genAIInstance = getGenAI()
  if (!genAIInstance || !process.env.GEMINI_API_KEY) {
    const fallbackSummary = simpleSummary(text)
    return {
      summary: fallbackSummary, // Backward compatibility
      shortSummary: fallbackSummary,
      detailedSummary: simpleSummary(text, 500),
      keywords: simpleExtractKeywords(text)
    }
  }

  try {
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Sen profesyonel bir doküman özetleme asistanısın. Aşağıdaki dokümanı analiz et ve belirtilen formatta özet oluştur.

KURALLAR:
1. Kısa özet yaklaşık 150 kelime olmalı, dokümanın ana fikrini içermeli
2. Detaylı özet yaklaşık 500 kelime olmalı, tüm önemli noktaları kapsamalı
3. Anahtar kelimeler dokümanın en önemli 5-10 kavramını içermeli
4. Cümleler tamamlanmış ve anlamlı olmalı, yarım kalan cümleler kullanma
5. Çıktıyı TAM OLARAK aşağıdaki formatta ver:

KISA_OZET:
[150 kelime civarında kısa özet buraya]

DETAYLI_OZET:
[500 kelime civarında detaylı özet buraya]

ANAHTAR_KELIMELER:
[anahtar, kelime, listesi, virgülle, ayrılmış]

Doküman:
${text.substring(0, 3000)}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const resultText = response.text()

    // Parse structured response using regex-based extraction
    const parsed = parseAIResponse(resultText)

    // Validate parsed results - use fallback only if parsing failed or content too short
    // No truncation applied to preserve sentence integrity
    const shortSummary = parsed.shortSummary && parsed.shortSummary.length > 20
      ? parsed.shortSummary
      : simpleSummary(text)
    
    const detailedSummary = parsed.detailedSummary && parsed.detailedSummary.length > 50
      ? parsed.detailedSummary
      : simpleSummary(text, 500)
    
    const keywords = parsed.keywords && parsed.keywords.length > 0
      ? parsed.keywords
      : simpleExtractKeywords(text)

    return {
      summary: shortSummary, // Backward compatibility
      shortSummary,
      detailedSummary,
      keywords
    }
  } catch (error) {
    console.error('AI processing error:', error)
    const fallbackSummary = simpleSummary(text)
    return {
      summary: fallbackSummary, // Backward compatibility
      shortSummary: fallbackSummary,
      detailedSummary: simpleSummary(text, 500),
      keywords: simpleExtractKeywords(text)
    }
  }
}

// Search documents semantically
export async function searchDocuments(documents, query) {
  const genAIInstance = getGenAI()
  if (!genAIInstance || !process.env.GEMINI_API_KEY) {
    // Simple keyword-based search
    const queryLower = query.toLowerCase()
    return documents.filter(doc => {
      const text = (doc.text || '').toLowerCase()
      const summary = (doc.summary || '').toLowerCase()
      return text.includes(queryLower) || summary.includes(queryLower)
    })
  }

  try {
    // For semantic search, use keyword matching with relevance scoring
    // Gemini can be used for more advanced semantic search if needed
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
    
    const scoredDocs = documents.map(doc => {
      const text = (doc.text || '').toLowerCase()
      const summary = (doc.summary || '').toLowerCase()
      let score = 0
      
      queryWords.forEach(word => {
        if (text.includes(word)) score += 2
        if (summary.includes(word)) score += 3
        if (doc.keywords && doc.keywords.some(k => k.toLowerCase().includes(word))) {
          score += 1
        }
      })
      
      return { ...doc, relevanceScore: score }
    })
    
    return scoredDocs
      .filter(doc => doc.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
  } catch (error) {
    console.error('Search error:', error)
    return documents.filter(doc => 
      (doc.text || '').toLowerCase().includes(query.toLowerCase()) ||
      (doc.summary || '').toLowerCase().includes(query.toLowerCase())
    )
  }
}

// Ask question about documents
export async function askQuestion(documents, question, isSingleDocument = false) {
  // API key kontrolü ve debug
  const genAIInstance = getGenAI()
  const hasApiKey = !!process.env.GEMINI_API_KEY
  const hasGenAI = !!genAIInstance
  
  console.log('🔍 Ask question debug:', {
    hasApiKey,
    hasGenAI,
    isSingleDocument,
    documentsCount: documents.length,
    question: question.substring(0, 50)
  })
  
  if (!genAIInstance || !process.env.GEMINI_API_KEY) {
    console.warn('⚠️ Gemini API key bulunamadı, fallback mekanizması kullanılıyor')
    // Simple keyword-based answer
    const questionLower = question.toLowerCase()
    const relevantDocs = documents.filter(doc => {
      const text = (doc.text || '').toLowerCase()
      return text.includes(questionLower.split(' ')[0])
    })
    
    if (relevantDocs.length === 0) {
      return {
        answer: 'Bu soru için dokümanlarınızda yeterli bilgi bulunamadı.',
        sources: []
      }
    }
    
    const answer = relevantDocs[0].summary || 'İlgili doküman bulundu ancak detaylı cevap için AI servisi yapılandırılmamış.'
    const sources = relevantDocs.map(doc => doc.filename)
    
    return { answer, sources }
  }

  try {
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    // Tek doküman için özel prompt, çoklu doküman için genel prompt
    let prompt
    
    if (isSingleDocument && documents.length === 1) {
      // Tek doküman için detaylı analiz prompt'u
      const doc = documents[0]
      const docText = doc.text || ''
      
      console.log('📄 Doküman bilgileri:', {
        filename: doc.filename,
        textLength: docText.length,
        textPreview: docText.substring(0, 100)
      })
      
      if (!docText || docText.trim().length === 0) {
        console.error('❌ Doküman metni boş!')
        return {
          answer: 'Doküman metni bulunamadı. Lütfen dokümanın içeriğinin yüklendiğinden emin olun.',
          sources: [doc.filename]
        }
      }
      
      prompt = `Kullanıcının sorusunu yanıtlamak için dokümanı analiz et.

ÖNEMLİ KURALLAR:
1. Soruya doğrudan ve net cevap ver - gereksiz detaylara girme
2. Cevabın maksimum 4 paragraf olmalı - aşırı uzun cevaplar verme
3. Sadece soruyla ilgili bilgileri kullan, dokümanın tamamından bahsetme
4. Markdown formatı kullanma (bold, italic vb.), sadece düz metin yaz
5. Kısa, öz ve anlaşılır cevaplar ver
6. Eğer soru dokümanda yoksa, "Dokümanda bu bilgi yer almıyor" de

Doküman Adı: ${doc.filename || 'Bilinmeyen'}

Doküman İçeriği:
${docText.substring(0, 8000)}

Kullanıcının Sorusu: "${question}"

Şimdi yukarıdaki kurallara göre soruya doğrudan, kısa ve öz bir cevap ver (maksimum 4 paragraf). Gereksiz uzunluk yapma ve sadece soruyla ilgili bilgileri kullan.`

      console.log('📤 Prompt gönderiliyor, uzunluk:', prompt.length)
    } else {
      // Çoklu doküman için karşılaştırmalı analiz prompt'u
      // Tüm dokümanları birleştir (daha fazla doküman için limit artırılabilir)
      const combinedText = documents
        .slice(0, 10) // Limit to 10 documents for comprehensive analysis
        .map((doc, index) => {
          const docText = doc.text || ''
          return `DOKÜMAN ${index + 1}: ${doc.filename || 'İsimsiz'}
${docText.substring(0, 4000)}`
        })
        .join('\n\n' + '='.repeat(80) + '\n\n')

      prompt = `Kullanıcının sorusunu yanıtlamak için dokümanları analiz et.

ÖNEMLİ KURALLAR:
1. Sadece soruya doğrudan ilgili dokümanları kullan, gereksiz dokümanlardan bahsetme
2. Cevabın maksimum 4 paragraf olmalı - aşırı uzun cevaplar verme
3. Soruya doğrudan ve net cevap ver, gereksiz detaylara girme
4. Tüm dokümanları listelemek zorunda değilsin - sadece soruyla ilgili olanları kullan
5. Markdown formatı kullanma (bold, italic vb.), sadece düz metin yaz
6. Kısa, öz ve anlaşılır cevaplar ver

Kullanıcının Sorusu: "${question}"

Dokümanlar:
${combinedText}

Şimdi yukarıdaki kurallara göre soruya doğrudan, kısa ve öz bir cevap ver (maksimum 4 paragraf). Gereksiz uzunluk yapma ve sadece soruyla ilgili bilgileri kullan.`
  • Detaylı açıklama ve spesifik bilgiler
- Doküman Adı 2:
  • Detaylı açıklama ve spesifik bilgiler
(...)

Sonuç:
<Genel değerlendirme ve özet>

⚠️ Kurallar:
- Dokümanlarda olmayan bilgiye dayalı çıkarım yapma
- Belirsiz durumlarda bunu açıkça belirt
- Gerekirse "Bu değerlendirme öznel kriterlere dayanmaktadır" uyarısı ekle
- ÖNEMLİ: **bold**, *italic*, __bold__, _italic_ gibi markdown formatları KULLANMA. Sadece düz metin yaz.
- Yüzeysel analiz yapma, detayları, örnekleri, spesifik bilgileri dikkate al ve cevabına dahil et.

Kullanıcının Sorusu: "${question}"

Dokümanlar:
${combinedText}

Şimdi yukarıdaki kurallara göre soruyu detaylı, kapsamlı ve anlaşılır bir şekilde cevapla. Markdown formatı kullanma, sadece düz metin yaz.`
    }

    console.log('🤖 Gemini API çağrısı yapılıyor...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    const answer = response.text()
    
    // Markdown formatları frontend'de HTML'e çevrilecek, burada temizleme yapmıyoruz
    
    console.log('✅ Cevap alındı, uzunluk:', answer.length)
    console.log('📝 Cevap önizleme:', answer.substring(0, 200))
    
    const sources = documents.slice(0, 3).map(doc => doc.filename)

    return {
      answer,
      sources
    }
  } catch (error) {
    console.error('❌ Ask question error:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      stack: error.stack
    })
    return {
      answer: 'Soru cevaplanırken bir hata oluştu: ' + (error.message || 'Bilinmeyen hata') + '. Lütfen tekrar deneyin.',
      sources: []
    }
  }
}

// Generate summary
export async function generateSummary(text, language = 'Turkish') {
  const genAIInstance = getGenAI()
  if (!genAIInstance || !process.env.GEMINI_API_KEY) {
    return {
      shortSummary: simpleSummary(text, 150),
      detailedSummary: simpleSummary(text, 500)
    }
  }

  try {
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const languageInstruction = language === 'English' 
      ? 'Özeti İngilizce olarak oluştur. Tüm çıktılar İngilizce olmalıdır.'
      : 'Özeti Türkçe olarak oluştur. Tüm çıktılar Türkçe olmalıdır.'
    
    const prompt = `Sen profesyonel bir doküman özetleme asistanısın. Aşağıdaki dokümanı analiz et ve belirtilen formatta özet oluştur.

KURALLAR:
1. Kısa özet yaklaşık 150 kelime olmalı, dokümanın ana fikrini içermeli
2. Detaylı özet yaklaşık 500 kelime olmalı, tüm önemli noktaları kapsamalı
3. Cümleler tamamlanmış ve anlamlı olmalı, yarım kalan cümleler kullanma
4. ${languageInstruction}
5. Çıktıyı TAM OLARAK aşağıdaki formatta ver (markdown formatı kullanma, sadece düz metin):
6. Önemli kelimeleri vurgulamak için **bold** veya *italic* gibi markdown formatları KULLANMA, sadece düz metin yaz

KISA_OZET:
[150 kelime civarında kısa özet buraya - sadece düz metin, markdown yok]

DETAYLI_OZET:
[500 kelime civarında detaylı özet buraya - sadece düz metin, markdown yok]

Doküman:
${text.substring(0, 30000)}`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const resultText = response.text()

    // Parse structured response using regex-based extraction
    const parsed = parseAIResponse(resultText)

    // Validate and use fallback if needed - no truncation to preserve sentence integrity
    const shortSummary = parsed.shortSummary && parsed.shortSummary.length > 20
      ? parsed.shortSummary
      : simpleSummary(text, 150)
    
    const detailedSummary = parsed.detailedSummary && parsed.detailedSummary.length > 50
      ? parsed.detailedSummary
      : simpleSummary(text, 500)

    return {
      shortSummary,
      detailedSummary
    }
  } catch (error) {
    console.error('Summary generation error:', error)
    return {
      shortSummary: simpleSummary(text, 150),
      detailedSummary: simpleSummary(text, 500)
    }
  }
}
