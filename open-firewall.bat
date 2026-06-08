@echo off
echo ================================================
echo   每日工作回報表 - 開放 Port 3000 防火牆規則
echo ================================================
echo.
echo 正在新增防火牆入站規則...

netsh advfirewall firewall add rule name="Daily Report App - Port 3000" dir=in action=allow protocol=TCP localport=3000

if %ERRORLEVEL% EQU 0 (
    echo.
    echo [成功] 防火牆規則已新增！
    echo 其他裝置現在可以透過區網 IP 連線。
) else (
    echo.
    echo [失敗] 請確認以系統管理員身份執行此批次檔。
)

echo.
echo 你的區網 IP:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do echo   http:%%a:3000
echo.
pause
