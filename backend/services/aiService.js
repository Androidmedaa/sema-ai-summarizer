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
      
      prompt = `Sen çok üst düzey bir doküman analiz asistanısın.

Yüklediğim dokümanı:
- Satır satır
- Bağlamı kaçırmadan
- Teknik terimleri doğru yorumlayarak
- Örtük (açıkça yazılmamış) anlamları da çıkararak
derinlemesine analiz et.

Aşağıdaki kurallara kesinlikle uy:

1) Dokümanı tam olarak okuduğunu varsayma, gerçekten analiz et.
2) Cevap verirken:
   - Dokümandaki ilgili bölümü zihinsel olarak referans al
   - Gerekirse bölüm / başlık / kavram ismi belirt
3) Eğer sorduğum soru dokümanda:
   - Açıkça varsa → net ve kısa cevap ver
   - Dolaylı varsa → mantık yürüterek açıkla
   - Hiç yoksa → "Dokümanda bu bilgi yer almıyor" de ve tahmin etme
4) Teknik, akademik veya resmi bir dil kullan ama:
   - Gereksiz uzunluk yapma
   - Ezbere tanım yazma
5) Çelişki, eksik bilgi veya belirsizlik varsa:
   - Bunları özellikle işaretle
   - Neden sorun olduğunu açıkla
6) Tablo, liste veya madde yapısı varsa:
   - Yapıyı koruyarak açıkla
   - Gerekirse sadeleştirerek yeniden yaz
7) Sorularıma cevap verirken:
   - Sadece genel bilgiye değil
   - Özellikle BU dokümana dayan
8) Cevabını TAM CÜMLELER halinde, akıcı ve anlaşılır bir şekilde yaz.
9) Sadece liste veya madde işareti değil, açıklayıcı paragraflar kullan.

Doküman Adı: ${doc.filename || 'Bilinmeyen'}

Doküman İçeriği:
${docText.substring(0, 8000)}

Kullanıcının Sorusu: "${question}"

Şimdi yukarıdaki kurallara göre soruyu TAM CÜMLELER halinde, detaylı ve anlaşılır bir şekilde cevapla.`

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

      prompt = `Sistemde yüklü olan TÜM dokümanları birlikte değerlendir.

Kullanıcının sorusu, tek bir dokümana değil,
dokümanlar ARASI karşılaştırma ve analiz gerektirebilir.

🎯 Görevin:
1. Kullanıcının sorusunu analiz et
2. Gerekli olan dokümanları belirle
3. Dokümanları içerik, yapı ve bağlam açısından karşılaştır
4. Gerekçeli ve açık bir cevap üret

📄 Değerlendirme Kriterleri (gerektiğinde kullan):
- Başlık ve alt başlıkların tutarlılığı
- Bölümlerin mantıksal sıralaması
- Paragraf bütünlüğü
- Tekrar eden veya kopuk içerik
- Genel okunabilirlik

🧠 CEVAP FORMATINI AŞAĞIDAKİ GİBİ VER:

Cevap:
<Net ve anlaşılır cevap>

Gerekçe:
- Doküman Adı 1:
  • Kısa açıklama
- Doküman Adı 2:
  • Kısa açıklama
(...)

Sonuç:
<Genel değerlendirme>

⚠️ Kurallar:
- Dokümanlarda olmayan bilgiye dayalı çıkarım yapma
- Belirsiz durumlarda bunu açıkça belirt
- Gerekirse "Bu değerlendirme öznel kriterlere dayanmaktadır" uyarısı ekle

Kullanıcının Sorusu: "${question}"

Dokümanlar:
${combinedText}

Şimdi yukarıdaki kurallara göre soruyu cevapla ve belirtilen formatta çıktı ver.`
    }

    console.log('🤖 Gemini API çağrısı yapılıyor...')
    const result = await model.generateContent(prompt)
    const response = await result.response
    const answer = response.text()
    
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
export async function generateSummary(text) {
  const genAIInstance = getGenAI()
  if (!genAIInstance || !process.env.GEMINI_API_KEY) {
    return {
      shortSummary: simpleSummary(text, 150),
      detailedSummary: simpleSummary(text, 500)
    }
  }

  try {
    const model = genAIInstance.getGenerativeModel({ model: 'gemini-2.5-flash' })
    
    const prompt = `Sen profesyonel bir doküman özetleme asistanısın. Aşağıdaki dokümanı analiz et ve belirtilen formatta özet oluştur.

KURALLAR:
1. Kısa özet yaklaşık 150 kelime olmalı, dokümanın ana fikrini içermeli
2. Detaylı özet yaklaşık 500 kelime olmalı, tüm önemli noktaları kapsamalı
3. Cümleler tamamlanmış ve anlamlı olmalı, yarım kalan cümleler kullanma
4. Çıktıyı TAM OLARAK aşağıdaki formatta ver:

KISA_OZET:
[150 kelime civarında kısa özet buraya]

DETAYLI_OZET:
[500 kelime civarında detaylı özet buraya]

Doküman:
${text.substring(0, 4000)}`

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
