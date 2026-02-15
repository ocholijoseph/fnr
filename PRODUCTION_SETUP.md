# Production API Setup Guide

To enable the Scroll Override feature in your production environment, you must run the API backend and configure Nginx to proxy requests to it.

## 1. Start the API Server
The API server needs to run in the background on your VPS.

```bash
# Install dependencies (if you haven't)
npm install

# Start the API server
npm run start-api
```

### Recommended: Use PM2
To ensure the API server stays running even after a reboot or crash, use `pm2`:

```bash
# Install PM2 globally
sudo npm install -g pm2

# Start the API server with PM2
pm2 start api-server.js --name "kfmx-api"

# Save the PM2 list
pm2 save
```

## 2. Update Nginx Configuration
Edit your Nginx configuration file for `kfmx.dreamcode.ng` and add the following block inside the `server` section:

```nginx
location /api/ {
    proxy_pass http://localhost:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Then reload Nginx:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 3. Verify
1. Go to `https://kfmx.dreamcode.ng/admin`
2. If the page loads without the "Error connecting" toast, the API is working!
3. Try saving a message and check if it persists on reload.
