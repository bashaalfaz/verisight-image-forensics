@echo off
setlocal
cd /d "%~dp0"
start "DeepSight Backend" cmd /k "call start_backend_windows.bat"
timeout /t 3 /nobreak >nul
start "DeepSight Frontend" cmd /k "call start_frontend_windows.bat"
echo.
echo Backend:  http://127.0.0.1:5000
echo Frontend: http://127.0.0.1:5173
echo Ensure MongoDB is running and trained model files are in backend\models.
pause
