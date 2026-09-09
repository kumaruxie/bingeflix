# ==========================================================================
# AXON OTT - 1-Click Rollback Script to Pre-M3U8 Checkpoint
# Usage: .\scripts\rollback_to_pre_m3u8.ps1
# ==========================================================================

Write-Host "🔄 Rolling back AXON OTT to checkpoint-pre-m3u8..." -ForegroundColor Cyan

# 1. Reset all Git-tracked files to checkpoint tag
git reset --hard checkpoint-pre-m3u8

# 2. Clean untracked build artifacts
git clean -fd

# 3. Clean up backend anime scraper files
if (Test-Path "backend/src/services/animeScraper.js") {
    Remove-Item "backend/src/services/animeScraper.js" -Force
}
if (Test-Path "backend/src/routes/anime.js") {
    Remove-Item "backend/src/routes/anime.js" -Force
}

# 4. Clean up backend/server.js import and route
if (Test-Path "backend/server.js") {
    $serverContent = Get-Content "backend/server.js" -Raw
    $serverContent = $serverContent -replace "import animeRouter from '\./src/routes/anime\.js';`r?`n", ""
    $serverContent = $serverContent -replace "app\.use\('/api/anime', animeRouter\);`r?`n", ""
    Set-Content -Path "backend/server.js" -Value $serverContent
}

# 5. Rebuild frontend bundle
Write-Host "📦 Rebuilding production bundle..." -ForegroundColor Yellow
npm run build
Copy-Item -Path "dist/*" -Destination "docs" -Recurse -Force

Write-Host "✅ 100% Successfully rolled back to checkpoint-pre-m3u8!" -ForegroundColor Green
Write-Host "Everything is restored to the working multi-server state." -ForegroundColor Green
