# 🌐 Freedom Naija Radio — Hosting & Deployment Guide

This guide covers two main areas:
1. **VPS Hosting:** How to host your web player on a server (e.g., DigitalOcean, Linode, AWS).
2. **Mobile Deployment:** How to build and release the Android app.

---

## 🖥️ Part 1: VPS Hosting (Smooth & Hitless)

### 1.1 Server Requirements
- **OS:** Ubuntu 22.04 LTS (Recommended)
- **RAM:** 1GB minimum
- **Disk:** 10GB+
- **Network:** Shared or Dedicated IP

### 1.2 Initial Setup (SSH into your VPS)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (Version 18+)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx & Certbot (for SSL)
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 1.3 Application Deployment
1. **Transfer code:** You can use `git clone` or SFTP your project folders.
2. **Build locally/on server:**
   ```bash
   cd /var/www/freedom-naija-radio
   npm install
   npm run build
   ```
   *Note: Your static files will be in the `/dist` folder.*

### 1.4 Nginx Configuration (The "No Hitch" Setup)
Create a new config: `sudo nano /etc/nginx/sites-available/fnr`

```nginx
server {
    listen 80;
    server_name player.dreamcode.ng;

    root /var/www/freedom-naija-radio/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy to Node.js API Server
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # IMPORTANT: Proxy for Icecast Metadata (to avoid CORS/HTTPS issues)
    location /api/icecast/ {
        proxy_pass http://69.197.134.188:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```
Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/fnr /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 1.5 API Server Setup (PM2)
To keep the administrative features (News, Scroll Text) working:
```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the API server
cd /var/www/freedom-naija-radio
pm2 start api-server.js --name "fnr-api"

# Save PM2 list to restart on reboot
pm2 save
sudo pm2 startup
```

### 1.6 SSL (HTTPS)
Simply run:
```bash
sudo certbot --nginx -d player.dreamcode.ng
```

> [!CAUTION]
> **Mixed Content Warning:** If your site is HTTPS but your Icecast stream is HTTP, Chrome/Safari may block the audio.
> **Solution:** You MUST use an HTTPS proxy for the stream or get an SSL certificate for your Icecast server (Port 8000).

---

## 📱 Part 2: Android Play Store Pre-Flight

You already have the detailed `ANDROID_PLAYSTORE_GUIDE.md`. Here is the condensed "Last Mile" checklist for Android:

### 2.1 Final Code Check
Ensure these brand values are consistent:
- `appName` in `capacitor.config.ts`
- `applicationId` (com.freedomnaijaradio.app) in `android/app/build.gradle`
- `versionCode` (Must increase with every upload)

### 2.2 Asset Verification
- Run `npx cap sync android` after every build.
- Open Android Studio: `npx cap open android`.
- Check `res/drawable/splash.png` (Verify it's your new logo).
- Check `res/mipmap/` (Verify app icons are updated).

### 2.3 Store Listing Assets
Prepare these BEFORE you start the Play Console process:
- **App Icon:** 512x512 PNG.
- **Feature Graphic:** 1024x500 PNG.
- **Screenshots:** At least 2 phone screenshots (use the Android Studio emulator).
- **Privacy Policy URL:** Host a simple page at `yourdomain.com/privacy`.

### 2.4 One-Command Build (Custom Script)
Add this to your `package.json` to make building a breeze:
```json
"scripts": {
  "build:android": "npm run build && npx cap sync android && cd android && ./gradlew bundleRelease"
}
```

---

## 🚀 Recommended Deployment Workflow

1. **Commit changes** to GitHub/Git.
2. **Server:** `git pull` and `npm run build` on your VPS.
3. **Mobile:** Run `npm run build:android` locally.
4. **Sign:** Sign the generated `.aab` file in Android Studio.
5. **Upload:** Upload the `.aab` to Google Play Console.

> [!TIP]
> For the "smoothest" experience, always test the built `dist` folder locally with `npx serve dist` before pushing to the VPS.
