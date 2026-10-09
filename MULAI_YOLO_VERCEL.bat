@echo off
setlocal
title TimbangQR - YOLO Cloud Bridge ke Vercel
cd /d "%~dp0"

echo ====================================================
echo   TIMBANGQR - PENGHUBUNG YOLO OCR KE VERCEL
echo ====================================================
echo.

node scripts\start-yolo-vercel-bridge.mjs
pause
