# Run this script to start the Dup Photo Locator

Write-Host "Starting Dup Photo Locator Setup..." -ForegroundColor Cyan

# 1. Backend Setup
Write-Host "Setting up Backend..." -ForegroundColor Yellow
cd backend
python -m pip install -r requirements.txt
Start-Process python -ArgumentList "main.py" -NoNewWindow
cd ..

# 2. Frontend Setup
Write-Host "Setting up Frontend..." -ForegroundColor Yellow
cd frontend
npm install
npm run dev
