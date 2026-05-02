Write-Host "Initializing Git repository..." -ForegroundColor Green
Set-Location "c:\Windsurf Projects\my-app"

try {
    git init
    Write-Host "Git repository initialized!" -ForegroundColor Green
} catch {
    Write-Host "Git not found in PATH. Please install Git first." -ForegroundColor Red
    exit
}

Write-Host "`nAdding files to Git..." -ForegroundColor Yellow
git add .

Write-Host "`nCreating initial commit..." -ForegroundColor Yellow
git commit -m "Initial commit: React + TypeScript + Tailwind CSS project"

Write-Host "`nStarting development server..." -ForegroundColor Green
Write-Host "Server will start at: http://localhost:5173" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

npm run dev
