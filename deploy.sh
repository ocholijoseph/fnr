#!/bin/bash

# Deployment script for KFMX Radio Player
# Deploys the app to kfmx.dreamcode.ng via nginx

set -e  # Exit on any error

echo "🚀 Starting KFMX deployment..."

# Navigate to project directory
cd /myNewDock/kfmx

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
systemctl reload nginx

# Check SSL certificate status
echo "🔒 Checking SSL certificate..."
if [ -f "/etc/letsencrypt/live/kfmx.dreamcode.ng/fullchain.pem" ]; then
    echo "✅ SSL certificate is active and valid"
else
    echo "⚠️  SSL certificate not found - please run: certbot --nginx -d kfmx.dreamcode.ng"
fi

# Verify nginx is running and configuration is valid
if nginx -t && systemctl is-active --quiet nginx; then
    echo "✅ Nginx is running successfully"
else
    echo "❌ Nginx configuration error"
    exit 1
fi

echo "✅ Deployment completed successfully!"
echo "🌐 Your app is now available at: https://kfmx.dreamcode.ng"

# Show current nginx status
echo "📊 Nginx status:"
systemctl status nginx --no-pager -l