@echo off
title Auto Setup - My App
color 0A

echo ========================================
echo    AUTO SETUP FOR MY APP
echo ========================================
echo.

echo Step 1: Initializing Git repository...
cd /d "c:\Windsurf Projects\my-app"
git init
echo.

echo Step 2: Adding files to Git...
git add .
echo.

echo Step 3: Creating initial commit...
git commit -m "Initial commit: React + TypeScript + Tailwind CSS project"
echo.

echo Step 4: Starting development server...
echo.
echo ========================================
echo    SERVER STARTING AT:
echo    http://localhost:5173
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

npm run dev
