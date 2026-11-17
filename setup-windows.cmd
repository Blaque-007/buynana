@echo off
setlocal
cd /d "%~dp0backend"
echo Installing BuyNana backend dependencies...
call npm.cmd ci
if errorlevel 1 (
  echo Backend installation failed. Check Node.js and network access.
  exit /b 1
)
cd /d "%~dp0frontend"
echo Installing BuyNana frontend dependencies...
call npm.cmd ci
if errorlevel 1 (
  echo Frontend installation failed. Check Node.js and network access.
  exit /b 1
)
echo.
echo Setup complete. Double-click run-windows.cmd to start BuyNana.
pause
