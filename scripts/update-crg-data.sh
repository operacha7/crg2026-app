#!/bin/bash

# Step 1: Go to crg-data repo
cd ~/Downloads/crg-data || { echo "❌ crg-data folder not found."; exit 1; }

echo "📥 Pulling latest crg-data from GitHub..."
git pull origin main

# Step 2: Copy JSONs into crg2026-app/public/data
echo "📂 Copying JSON files into crg2026-app/public/data..."
cp *.json ~/crg2026-app/public/data/

# Step 3: Move into crg2026-app folder
cd ~/crg2026-app || { echo "❌ crg2026-app folder not found."; exit 1; }

echo "✅ JSON files updated! You can now run 'npm run dev' to start the app."