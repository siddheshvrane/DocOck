# DocOc Windows Start Script

Write-Host "--- DocOc Local AI Medical Assistant ---" -ForegroundColor Cyan

# 1. Check Ollama
Write-Host "[1/4] Checking Ollama..." -ForegroundColor Yellow
$ollama = Get-Command ollama -ErrorAction SilentlyContinue
if ($null -eq $ollama) {
    Write-Host "Warning: Ollama not found in PATH." -ForegroundColor Red
    Write-Host "Please install it from https://ollama.com and run 'ollama pull phi3'" -ForegroundColor Gray
} else {
    Write-Host "Ollama detected." -ForegroundColor Green
}

# 2. Start Backend
Write-Host "[2/4] Starting FastAPI Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; python -m uvicorn main:app --reload --port 8000"
Write-Host "Backend process initiated in separate window (Port 8000)." -ForegroundColor Gray

# 3. Install/Check Frontend Deps
Write-Host "[3/4] Ensuring Frontend Dependencies..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-Wait", "-Command", "cd frontend; npm install"

# 4. Start Frontend
Write-Host "[4/4] Starting Vite Frontend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev -- --port 5173"
Write-Host "Frontend process initiated in separate window (Port 5173)." -ForegroundColor Gray

Write-Host "`nReady! Access the dashboard at http://localhost:5173" -ForegroundColor Green
Write-Host "Backend API docs available at http://localhost:8000/docs" -ForegroundColor Gray
