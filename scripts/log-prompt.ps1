# PowerShell Script - Otomatik Prompt Loglama
# Bu script Cursor'daki her prompt'u otomatik olarak PROMPT_LOG.txt dosyasına kaydeder.

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt,
    
    [Parameter(Mandatory=$false)]
    [ValidateSet('FEATURE', 'BUG_FIX', 'CONFIG', 'UI/UX', 'INTEGRATION', 'DOCUMENTATION', 'REFACTOR', 'QUESTION')]
    [string]$Category = 'QUESTION'
)

$logFile = Join-Path $PSScriptRoot "..\PROMPT_LOG.txt"
$mdLogFile = Join-Path $PSScriptRoot "..\PROMPT_LOG.md"

# Tarih ve saat
$dateStr = Get-Date -Format "yyyy-MM-dd"
$timeStr = Get-Date -Format "HH:mm:ss"
$timestamp = "$dateStr $timeStr"

# TXT dosyasına ekle
$logEntry = "[$timestamp] [$Category] $Prompt`n"
Add-Content -Path $logFile -Value $logEntry -Encoding UTF8

Write-Host "✅ Prompt log dosyasına eklendi: $Category" -ForegroundColor Green

# Markdown dosyası için prompt numarasını hesapla
$mdContent = Get-Content -Path $mdLogFile -Raw -Encoding UTF8
$promptMatches = [regex]::Matches($mdContent, "## Prompt \d+")
$nextPromptNumber = $promptMatches.Count + 1

# Markdown formatı
$mdEntry = @"

## Prompt $nextPromptNumber
**Tarih/Saat:** $timestamp  
**Kategori:** $Category  
**Prompt:**
$Prompt

---

"@

# İstatistikler bölümünden önce ekle
$statsIndex = $mdContent.IndexOf('## İstatistikler')
if ($statsIndex -ne -1) {
    $beforeStats = $mdContent.Substring(0, $statsIndex)
    $afterStats = $mdContent.Substring($statsIndex)
    $newContent = $beforeStats + $mdEntry + $afterStats
    Set-Content -Path $mdLogFile -Value $newContent -Encoding UTF8
} else {
    Add-Content -Path $mdLogFile -Value $mdEntry -Encoding UTF8
}

Write-Host "✅ Markdown log dosyası güncellendi" -ForegroundColor Green

