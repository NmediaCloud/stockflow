@echo off
title Stockflow.media - Gallery Sync + Publish
color 0A
cd /d "%~dp0"

echo.
echo ============================================
echo   STOCKFLOW.MEDIA - GALLERY SYNC + PUBLISH
echo ============================================
echo.

echo [1/3] %TIME%  Rebuilding /gallery/ + sitemaps from the Google Sheet...
python tools\build_gallery.py
if errorlevel 1 goto :fail
echo.

echo [2/3] %TIME%  Committing...
git pull --rebase origin main
if errorlevel 1 goto :fail
git add -A
git commit -m "Gallery sync: regenerate pages + sitemaps from Sheet"
rem commit exits 1 when nothing changed -- that is fine, push anyway
echo.

echo [3/3] %TIME%  Pushing to GitHub (Pages publishes automatically)...
git push origin main
if errorlevel 1 goto :fail

echo.
echo ============================================
echo   DONE!  Live in a few minutes at:
echo   https://stockflow.media/gallery/
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
