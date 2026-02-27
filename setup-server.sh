#!/bin/zsh

# MAAVIS TALENT HUB - One-Command Setup Script
echo "🚀 Starting MAAVIS TALENT HUB Setup..."

# 1. Check for Homebrew and install if missing
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew already installed"
fi

# 2. Install System Dependencies
echo "📦 Installing Node, Git, and Cloudflared..."
brew install node git cloudflared

# 3. Install Global NPM Packages
echo "🛠 Installing PM2 and TSX..."
npm install -g pm2 tsx

# 4. Create Directory Structure
echo "📂 Creating server directories..."
mkdir -p ~/server/data

# 5. Clone the Repository
echo "📥 Cloning MAAVIS TALENT HUB..."
cd ~/server
if [ -d "app" ]; then
    echo "⚠️ Folder 'app' already exists. Pulling latest changes..."
    cd app && git pull
else
    git clone https://github.com/maahirvirsingh123-ctrl/MPPLtesting.git app
    cd app
fi

# 6. Install App Dependencies
echo "⚙️ Installing app dependencies..."
npm install

# 7. Start the Services
echo "🚦 Starting MAAVIS TALENT HUB, Cloudflare Tunnel, and Auto-Updater..."
DATA_DIR=~/server/data pm2 start server.ts --name "maavis-hub" --interpreter tsx
pm2 start "cloudflared tunnel --url http://localhost:3000" --name "cf-tunnel"

# Setup Auto-Updater
chmod +x auto-update.sh
pm2 start ./auto-update.sh --name "maavis-updater"

# 8. Finalize
pm2 save
echo "✅ SETUP COMPLETE!"
echo "-------------------------------------------------------"
echo "Check your public URL with: pm2 logs cf-tunnel"
echo "Check your app status with: pm2 list"
echo "-------------------------------------------------------"
