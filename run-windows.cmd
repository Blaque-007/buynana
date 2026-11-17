@echo off
setlocal
echo Starting BuyNana backend and frontend in separate terminals...
start "BuyNana backend" /D "%~dp0backend" cmd /k npm.cmd run dev
start "BuyNana frontend" /D "%~dp0frontend" cmd /k npm.cmd run dev
echo Open http://127.0.0.1:5173 after both terminals report ready.
pause
