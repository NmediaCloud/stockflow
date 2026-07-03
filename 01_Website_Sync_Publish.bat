@echo off
title Stockflow.media - Website Sync + Publish
color 0A
cd /d "%~dp0"

echo.
echo ============================================
echo   STOCKFLOW.MEDIA - WEBSITE SYNC + PUBLISH
echo   (SEO pages + sitemaps + ALL site edits)
echo ============================================
echo.

echo [1/4] %TIME%  Rendering SEO pages + sitemaps from the Google Sheet...
python tools\build_gallery.py
if errorlevel 1 goto :fail
echo.

echo [2/4] %TIME%  Staging + committing ALL local changes (site + SEO pages)...
git add -A
git commit -m "Website sync: regenerate SEO pages from Sheet + publish site edits"
rem commit exits 1 when nothing changed -- that is fine, continue
echo.

echo [3/4] %TIME%  Pulling any remote changes (rebase on a clean tree)...
git pull --rebase origin main
if errorlevel 1 goto :fail
echo.

echo [4/4] %TIME%  Pushing to GitHub (Pages publishes automatically)...
git push origin main
if errorlevel 1 goto :fail

echo.
echo ============================================
echo   DONE!  Live in a few minutes at:
echo   https://stockflow.media  (+ /gallery/ SEO pages)
echo ============================================
echo.
pause
exit /b 0

:fail
echo.
echo ============================================
echo   *** FAILED at %TIME% - see error above ***
echo   Nothing published.
echo ============================================
echo.
pause
exit /b 1
