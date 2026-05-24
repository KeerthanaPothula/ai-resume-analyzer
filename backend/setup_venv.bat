@echo off
REM Setup Windows virtual environment for AI Resume Platform backend
REM Run this once: setup_venv.bat

echo [1/4] Creating virtual environment...
python -m venv venv

echo [2/4] Activating venv...
call venv\Scripts\activate.bat

echo [3/4] Upgrading pip...
python -m pip install --upgrade pip

echo [4/4] Installing all requirements...
pip install -r requirements_local.txt

echo.
echo Done! Virtual environment is ready.
echo To start the backend: venv\Scripts\python.exe -m uvicorn app.main:app --reload
