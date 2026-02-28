#!/bin/zsh

# 🚀 MAAVIS TALENT HUB - Smart One-Command Setup v2.1 (with .env automation)
echo "🚀 Starting MAAVIS TALENT HUB Smart Setup..."

# 1. Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew already installed"
fi

# 2. System deps
echo "Installing Node, Git, Cloudflared..."
brew install node git cloudflared

# 3. Global tools
echo "Installing PM2 & TSX..."
npm install -g pm2 tsx

# 4. Folders
echo "Creating folders..."
mkdir -p ~/server/data

# 5. Clone / Update
cd ~/server
if [ -d "app" ]; then
    echo "Updating existing app..."
    cd app && git pull
else
    echo "Cloning fresh..."
    git clone https://github.com/maahirvirsingh123-ctrl/MPPLtesting.git app
    cd app
fi

# 6. Vite fix (removes duplicate forever)
echo "Fixing Vite duplicate issue..."
sed -i '' '/"vite": "^6.2.0",/d' package.json

# 7. Dependencies
echo "Installing app dependencies..."
npm install

# 8. .env automation (this is the new part you asked for)
echo "=== Setting up .env file ==="
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ .env created from template"
fi

echo "Please enter your details (press Enter to skip if you already did this):"
read -p "Gmail address (SMTP_USER): " smtp_user
read -s -p "Gmail App Password (SMTP_PASS): " smtp_pass
echo ""
read -p "Gemini API Key (optional - leave blank if none): " gemini_key

# Safe write
if [ -n "$smtp_user" ]; then
    sed -i '' "s|SMTP_USER=.*|SMTP_USER=$smtp_user|" .env
fi
if [ -n "$smtp_pass" ]; then
    sed -i '' "s|SMTP_PASS=.*|SMTP_PASS=$smtp_pass|" .env
fi
if [ -n "$gemini_key" ]; then
    echo "GEMINI_API_KEY=$gemini_key" >> .env
    echo "✅ GEMINI_API_KEY added"
fi
echo "✅ .env configured!"

# 9. Start services (clean & working)
echo "Starting services..."
DATA_DIR=~/server/data pm2 start server.ts --name "maavis-hub" --interpreter tsx --cwd ~/server/app
pm2 start "cloudflared tunnel --url http://localhost:3000" --name "cf-tunnel"
chmod +x auto-update.sh
pm2 start ./auto-update.sh --name "maavis-updater" --cwd ~/server/app --interpreter zsh

# 10. Finish
pm2 save
pm2 list

echo "🎉 SETUP COMPLETE!"
echo "App → http://localhost:3000"
echo "Public URL → pm2 logs cf-tunnel"
