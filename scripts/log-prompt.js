/**
 * Otomatik Prompt Loglama Scripti
 * 
 * Bu script Cursor'daki her prompt'u otomatik olarak PROMPT_LOG.txt dosyasına kaydeder.
 * 
 * Kullanım:
 * 1. Bu script'i Cursor'da çalıştırın
 * 2. Her prompt için otomatik olarak log dosyasına eklenir
 * 
 * Not: Bu script manuel olarak çalıştırılmalıdır veya bir hook sistemi ile entegre edilmelidir.
 */

const fs = require('fs');
const path = require('path');

// Kategoriler
const CATEGORIES = {
  FEATURE: 'Yeni özellik isteği',
  BUG_FIX: 'Hata düzeltme',
  CONFIG: 'Yapılandırma/Ayarlar',
  'UI/UX': 'Arayüz tasarımı',
  INTEGRATION: 'Entegrasyon (Firebase, API, vb.)',
  DOCUMENTATION: 'Dokümantasyon',
  REFACTOR: 'Kod iyileştirme',
  QUESTION: 'Soru/Bilgi'
};

/**
 * Prompt'u log dosyasına ekle
 * @param {string} prompt - Prompt metni
 * @param {string} category - Prompt kategorisi
 */
function logPrompt(prompt, category = 'QUESTION') {
  const logFile = path.join(__dirname, '..', 'PROMPT_LOG.txt');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const timestamp = `${dateStr} ${timeStr}`;
  
  // Log formatı
  const logEntry = `[${timestamp}] [${category}] ${prompt}\n`;
  
  // Dosyaya ekle
  fs.appendFileSync(logFile, logEntry, 'utf8');
  
  console.log(`✅ Prompt log dosyasına eklendi: ${category}`);
}

/**
 * Markdown log dosyasına da ekle
 * @param {string} prompt - Prompt metni
 * @param {string} category - Prompt kategorisi
 * @param {number} promptNumber - Prompt numarası
 */
function logPromptMarkdown(prompt, category = 'QUESTION', promptNumber) {
  const logFile = path.join(__dirname, '..', 'PROMPT_LOG.md');
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0];
  const timestamp = `${dateStr} ${timeStr}`;
  
  // Markdown formatı
  const logEntry = `\n## Prompt ${promptNumber}\n**Tarih/Saat:** ${timestamp}  \n**Kategori:** ${category}  \n**Prompt:**\n${prompt}\n\n---\n`;
  
  // Dosyanın sonuna ekle (istatistiklerden önce)
  const content = fs.readFileSync(logFile, 'utf8');
  const statsIndex = content.indexOf('## İstatistikler');
  
  if (statsIndex !== -1) {
    const beforeStats = content.substring(0, statsIndex);
    const afterStats = content.substring(statsIndex);
    const newContent = beforeStats + logEntry + afterStats;
    fs.writeFileSync(logFile, newContent, 'utf8');
  } else {
    fs.appendFileSync(logFile, logEntry, 'utf8');
  }
  
  // İstatistikleri güncelle
  updateStatistics();
}

/**
 * İstatistikleri güncelle
 */
function updateStatistics() {
  const logFile = path.join(__dirname, '..', 'PROMPT_LOG.md');
  const content = fs.readFileSync(logFile, 'utf8');
  
  // Kategori sayılarını hesapla
  const categoryCounts = {};
  Object.keys(CATEGORIES).forEach(cat => {
    const regex = new RegExp(`\\*\\*Kategori:\\*\\* ${cat}`, 'g');
    const matches = content.match(regex);
    categoryCounts[cat] = matches ? matches.length : 0;
  });
  
  // Toplam prompt sayısını hesapla
  const promptMatches = content.match(/## Prompt \d+/g);
  const totalPrompts = promptMatches ? promptMatches.length : 0;
  
  // İstatistikleri güncelle
  const statsSection = `## İstatistikler\n\n**Toplam Prompt Sayısı:** ${totalPrompts}\n\n**Kategori Dağılımı:**\n${Object.entries(categoryCounts).map(([cat, count]) => `- **${cat}**: ${count} prompt`).join('\n')}\n`;
  
  // Eski istatistikleri bul ve değiştir
  const statsRegex = /## İstatistikler[\s\S]*?(?=\n---|\n## Notlar|$)/;
  const newContent = content.replace(statsRegex, statsSection);
  
  fs.writeFileSync(logFile, newContent, 'utf8');
}

// Örnek kullanım
if (require.main === module) {
  const args = process.argv.slice(2);
  const prompt = args.join(' ');
  const category = args[0]?.startsWith('[') ? args[0].replace(/[\[\]]/g, '') : 'QUESTION';
  
  if (prompt) {
    // Prompt numarasını hesapla
    const mdContent = fs.readFileSync(path.join(__dirname, '..', 'PROMPT_LOG.md'), 'utf8');
    const promptMatches = mdContent.match(/## Prompt \d+/g);
    const nextPromptNumber = promptMatches ? promptMatches.length + 1 : 1;
    
    logPrompt(prompt, category);
    logPromptMarkdown(prompt, category, nextPromptNumber);
  } else {
    console.log('Kullanım: node log-prompt.js [KATEGORI] "Prompt metni"');
    console.log('\nKategoriler:');
    Object.entries(CATEGORIES).forEach(([key, desc]) => {
      console.log(`  ${key}: ${desc}`);
    });
  }
}

module.exports = { logPrompt, logPromptMarkdown, CATEGORIES };

