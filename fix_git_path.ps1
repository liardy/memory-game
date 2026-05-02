Write-Host "Fixing Git PATH..." -ForegroundColor Yellow

# Common Git installation paths
$gitPaths = @(
    "C:\Program Files\Git\cmd",
    "C:\Program Files (x86)\Git\cmd",
    "C:\Users\$env:USERNAME\AppData\Local\Programs\Git\cmd"
)

$foundGit = $false
foreach ($path in $gitPaths) {
    if (Test-Path "$path\git.exe") {
        Write-Host "Found Git at: $path" -ForegroundColor Green
        $env:PATH += ";$path"
        $foundGit = $true
        break
    }
}

if (-not $foundGit) {
    Write-Host "Git not found in common locations. Please check Git installation." -ForegroundColor Red
    Write-Host "Try running: winget install Git.Git" -ForegroundColor Yellow
    exit
}

Write-Host "Git added to PATH for this session." -ForegroundColor Green
Write-Host "Testing Git..." -ForegroundColor Yellow

git --version

if ($LASTEXITCODE -eq 0) {
    Write-Host "Git is working! Proceeding with setup..." -ForegroundColor Green
    
    Set-Location "c:\Windsurf Projects\my-app"
    
    Write-Host "`nInitializing Git repository..." -ForegroundColor Cyan
    git init
    
    Write-Host "`nAdding files..." -ForegroundColor Cyan
    git add .
    
    Write-Host "`nCreating initial commit..." -ForegroundColor Cyan
    git commit -m "Initial commit: React + TypeScript + Tailwind CSS project"
    
    Write-Host "`nStarting development server..." -ForegroundColor Green
    Write-Host "Server will start at: http://localhost:5173" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
    Write-Host ""
    
    npm run dev
} else {
    Write-Host "Git still not working. Please restart PowerShell or install Git." -ForegroundColor Red
}
