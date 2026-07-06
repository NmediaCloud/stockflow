# ============================================================
#  Publish_Recover.ps1 — build + commit + push the Stockflow
#  website, recovering from stale git locks (Comodo leaves these
#  when git add on 18k files gets interrupted).
#
#  Run from PowerShell:   .\Publish_Recover.ps1
#  (Right-click > Run with PowerShell also works.)
# ============================================================
$ErrorActionPreference = 'Stop'
$repo = 'D:\Projects\2026\00_Stockflow.media_website'
Set-Location $repo

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  STOCKFLOW WEBSITE — PUBLISH / RECOVER" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# 1. Guard: never clobber an in-progress git operation.
$git = Get-Process git -ErrorAction SilentlyContinue
if ($git) {
    Write-Host "A git process is STILL running (PID $($git.Id -join ', '))." -ForegroundColor Yellow
    Write-Host "That is your previous sync still working (slow under Comodo)." -ForegroundColor Yellow
    Write-Host "Wait for it to finish, then re-run this script. Exiting to stay safe." -ForegroundColor Yellow
    exit 1
}

# 2. Clear a stale lock (safe now that no git process is running).
if (Test-Path .git\index.lock) {
    Remove-Item .git\index.lock -Force
    Write-Host "Removed stale .git\index.lock" -ForegroundColor Green
}

# 3. Rebuild the site (AI SEO metadata + enhanced merchant feed).
Write-Host "`n[1/5] Building gallery (SEO pages + feeds + sitemaps)..." -ForegroundColor Cyan
python tools\build_gallery.py

# 4. Stage everything (the slow step under Comodo — be patient).
Write-Host "`n[2/5] Staging changes (slow under Comodo AV)..." -ForegroundColor Cyan
git add -A

# 5. Commit (skip cleanly if nothing changed).
Write-Host "`n[3/5] Committing..." -ForegroundColor Cyan
git commit -m "Website sync: AI SEO metadata + enhanced marketplace feed"
if ($LASTEXITCODE -ne 0) { Write-Host "  (nothing new to commit — continuing)" -ForegroundColor DarkGray }

# 6. Pull rebase, then push.
Write-Host "`n[4/5] Pulling remote changes (rebase)..." -ForegroundColor Cyan
git pull --rebase origin main

Write-Host "`n[5/5] Pushing to GitHub (Pages auto-deploys)..." -ForegroundColor Cyan
git push origin main

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  DONE — live at https://stockflow.media in a few minutes." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
