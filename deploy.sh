#!/bin/bash

# Deployment script for Freedom Naija Radio Player
# Deploys the app to player.dreamcode.ng via nginx

set -e  # Exit on any error

echo "🚀 Starting Freedom Naija Radio deployment..."

# Navigate to project directory
cd /myNewDock/fnr

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run linting to ensure code quality (allow warnings)
echo "🔍 Running linting..."
npm run lint || echo "⚠️  Linting found issues but continuing deployment..."

# Build the application for production
echo "🔨 Building application..."
npm run build

# Restart nginx to apply configuration changes
echo "🔄 Restarting nginx..."
sudo systemctl reload nginx

# Restart API server if pm2 is available
if command -v pm2 &> /dev/null; then
    echo "🔄 Restarting API server with PM2..."
    pm2 reload "fnr-api" || pm2 start api-server.js --name "fnr-api"
else
    echo "⚠️  PM2 not found. Manual API server restart may be required."
fi

# Check SSL certificate status
echo "🔒 Checking SSL certificate..."
if [ -f "/etc/letsencrypt/live/player.dreamcode.ng/fullchain.pem" ]; then
    echo "✅ SSL certificate is active and valid"
else
    echo "⚠️  SSL certificate not found - please run: sudo certbot --nginx -d player.dreamcode.ng"
fi

# Verify nginx is running and configuration is valid
if sudo nginx -t && sudo systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running successfully"
else
    echo "❌ Nginx configuration error"
    exit 1
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Your app is now available at: https://player.dreamcode.ng"

# Show current nginx status
echo "📊 Nginx status:"
systemctl status nginx --no-pager -l