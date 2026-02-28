#!/bin/zsh

# ================================================
# MAAVIS TALENT HUB - Smart Setup v2.3
# Ready for direct GitHub upload
# Last updated: Feb 28 2026
# ================================================

echo "🚀 Starting MAAVIS TALENT HUB Smart Setup v2.3..."

# 1. Homebrew
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew already installed"
fi

# 2. System dependencies
echo "Installing/updating Node, Git, Cloudflared..."
brew install node git cloudflared

# 3. Global tools
echo "Installing PM2 & TSX globally..."
npm install -g pm2 tsx

# 4. Create folders
echo "Creating data folder..."
mkdir -p ~/server/data

# 5. Clone or update repository
cd ~/server
if [ -d "app" ]; then
    echo "✅ Updating existing app from GitHub..."
    cd app && git pull origin main
else
    echo "Cloning fresh repository..."
    git clone https://github.com/maahirvirsingh123-ctrl/MPPLtesting.git app
    cd app
fi

# 6. Fix duplicate Vite issue (prevents true.js crash)
echo "Fixing Vite duplicate in package.json..."
sed -i '' '/"vite": "^6.2.0",/d' package.json

# 7. Install dependencies
echo "Installing project dependencies..."
npm install

# 8. .env setup (interactive + safe)
echo "=== Setting up .env file ==="
if [ ! -f ".env" ]; then
    cp .env.example .env
    echo "✅ Created .env from template"
fi

echo "Please enter your details (press Enter to skip/keep existing):"
echo -n "Gmail address (SMTP_USER): "
read smtp_user
echo -n "Gmail App Password (SMTP_PASS): "
read -s smtp_pass
echo ""
echo -n "Gemini API Key (optional, leave blank if not using AI): "
read gemini_key
echo ""

# Safe .env updates
if [ -n "$smtp_user" ]; then
    if grep -q "^SMTP_USER=" .env; then
        sed -i '' "s|^SMTP_USER=.*|SMTP_USER=$smtp_user|" .env
    else
        echo "SMTP_USER=$smtp_user" >> .env
    fi
fi

if [ -n "$smtp_pass" ]; then
    if grep -q "^SMTP_PASS=" .env; then
        sed -i '' "s|^SMTP_PASS=.*|SMTP_PASS=$smtp_pass|" .env
    else
        echo "SMTP_PASS=$smtp_pass" >> .env
    fi
fi

if [ -n "$gemini_key" ]; then
    if grep -q "^GEMINI_API_KEY=" .env; then
        sed -i '' "s|^GEMINI_API_KEY=.*|GEMINI_API_KEY=$gemini_key|" .env
    else
        echo "GEMINI_API_KEY=$gemini_key" >> .env
    fi
fi

echo "✅ .env configured successfully!"

# 9. Start services (exactly the working commands)
echo "Starting services..."
pm2 stop maavis-hub maavis-updater cf-tunnel 2>/dev/null || true

DATA_DIR=~/server/data pm2 start server.ts --name "maavis-hub" --interpreter tsx --cwd ~/server/app

pm2 start "cloudflared tunnel --url http://localhost:3000" --name "cf-tunnel"

chmod +x auto-update.sh
pm2 start ./auto-update.sh --name "maavis-updater" --cwd ~/server/app --interpreter zsh

pm2 save
pm2 list

echo ""
echo "🎉 SETUP COMPLETE!"
echo "✅ App is now running at: http://localhost:3000"
echo "✅ Public URL (Cloudflare tunnel): pm2 logs cf-tunnel"
echo ""
echo "Next time just run: cd ~/server/app && ./setup-server.sh"
echo "Or push any changes to GitHub — auto-updater will keep everything in sync."
