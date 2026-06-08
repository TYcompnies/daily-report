@echo off
title 每日工作回報表 - 伺服器 + 外網 Tunnel
echo ================================================
echo   每日工作回報表 - 一鍵啟動
echo ================================================
echo.

REM 啟動 Node.js 伺服器（背景執行）
echo [1/2] 啟動本地伺服器 (port 3000)...
start /b node server.js

REM 等待伺服器啟動
timeout /t 3 /nobreak >nul

REM 啟動 Cloudflare Tunnel
echo [2/2] 啟動 Cloudflare Tunnel...
echo.
echo ================================================
echo   外網連線 URL 會在下方顯示
echo   請將該 URL 分享給團隊成員即可登入
echo ================================================
echo.
npx cloudflared tunnel --url http://localhost:3000

pause
