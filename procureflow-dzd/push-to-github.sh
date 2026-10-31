#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/aymen1998-numb/ProcureFlow-DZD.git"

echo "--- Pushing to $REPO_URL ---"

if ! command -v git &> /dev/null; then
    echo "Error: git is not installed."
    exit 1
fi

if [ ! -d ".git" ]; then
    git init -b main
else
    git branch -M main
fi

git config user.name "Aymen Benouasser"
git config user.email "spaelfath16@gmail.com"

git add .
git commit -m "Update ProcureFlow-DZD" || true

if git remote | grep -q "^origin$"; then
    git remote set-url origin "$REPO_URL"
else
    git remote add origin "$REPO_URL"
fi

git push -u --force origin main

echo "Done! Repository updated at https://github.com/aymen1998-numb/ProcureFlow-DZD"
