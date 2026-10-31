@echo off
chcp 65001 >nul
set REPO_URL=https://github.com/aymen1998-numb/ProcureFlow-DZD.git

echo --- Pushing to %REPO_URL% ---
echo.

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: git is not installed or not in PATH.
    pause
    exit /b 1
)

if not exist ".git" (
    git init -b main
) else (
    git branch -M main
)

git config user.name "Aymen Benouasser"
git config user.email "spaelfath16@gmail.com"

git add .
git commit -m "Update ProcureFlow-DZD" >nul 2>nul

git remote remove origin >nul 2>nul
git remote add origin %REPO_URL%

git push -u --force origin main

echo.
echo Done! Repository updated at https://github.com/aymen1998-numb/ProcureFlow-DZD
pause
