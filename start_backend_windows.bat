@echo off
setlocal
cd /d "%~dp0backend"
if not exist ".env" copy ".env.example" ".env"
if not exist ".venv" python -m venv .venv
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
python app.py
pause
