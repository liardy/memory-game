@echo off
echo Initializing Git repository...
cd /d "c:\Windsurf Projects\my-app"
git init
echo.

echo Adding files to Git...
git add .
echo.

echo Creating initial commit...
git commit -m "Initial commit: React + TypeScript + Tailwind CSS project"
echo.

echo Starting development server...
echo Server will start at: http://localhost:5173
echo.
npm run dev
