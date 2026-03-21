#!/bin/bash

# Deployment script for Freedom Naija Radio Player
# Deploys the app to player.dreamcode.ng via nginx

set -e  # Exit on any error

echo "🚀 Starting Freedom Naija Radio deployment..."

# Health Check: Disk Space
echo "💾 Checking disk space..."
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ "$DISK_USAGE" -gt 95 ]; then
    echo "❌ CRITICAL: Disk space is at ${DISK_USAGE}%. Cleaning up old logs..."
    sudo find /var/log -type f -name "*.gz" -delete
    sudo find /var/log -type f -name "*.1" -delete
    sudo rm -f /tmp/*.dump
fi

# Navigate to project directory
cd /myNewDock/fnr

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Build the application for production
echo "🔨 Building application..."
npm run build

# Restart API server via PM2
echo "🔄 Restarting API server..."
pm2 reload "fnr-api" || pm2 start api-server.js --name "fnr-api"

# Refresh Nginx
echo "🔄 Reloading Nginx..."
sudo nginx -t && sudo systemctl reload nginx

echo "✅ Deployment and system refresh completed successfully!"
echo "🌐 Your app is now available at: https://player.dreamcode.ng"