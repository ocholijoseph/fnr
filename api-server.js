import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3002;
const SCROLL_FILE = path.join(__dirname, 'scroll.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kfmx-admin-2024'; // Default password

const verifyAuth = (req) => {
    const authHeader = req.headers['authorization'] || req.headers['x-admin-password'];
    const expected = (process.env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
    let provided = (authHeader || '').trim();
    if (provided.startsWith('Bearer ')) {
        provided = provided.substring(7).trim();
    }

    if (provided !== expected) {
        console.log(`[AUTH] Failed attempt. Provided length: ${provided.length}, Expected length: ${expected.length}`);
        return false;
    }
    return true;
};

const server = http.createServer(async (req, res) => {
    // Add CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');

    if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
    }

    if (req.url === '/api/scroll' || req.url === '/scroll') {
        if (req.method === 'GET') {
            try {
                const data = await fs.readFile(SCROLL_FILE, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                // If file doesn't exist, return a default config instead of 404
                const defaultConfig = { overrideEnabled: false, overrideMessage: "" };
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(defaultConfig));
            }
            return;
        }

        if (req.method === 'POST') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    // Basic validation
                    JSON.parse(body);
                    await fs.writeFile(SCROLL_FILE, body, 'utf-8');
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Invalid JSON or failed to write' }));
                }
            });
            return;
        }
    }

    if (req.url === '/api/prayer-request') {
        if (req.method === 'GET') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            try {
                const filePath = path.join(__dirname, 'prayer_requests.json');
                const data = await fs.readFile(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const submission = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'prayer_requests.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(submission);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process submission' }));
                }
            });
            return;
        }
    }

    if (req.url === '/api/testimonies') {
        if (req.method === 'GET') {
            if (!verifyAuth(req)) {
                res.statusCode = 401;
                res.end(JSON.stringify({ error: 'Unauthorized' }));
                return;
            }
            try {
                const filePath = path.join(__dirname, 'testimonies.json');
                const data = await fs.readFile(filePath, 'utf-8');
                res.setHeader('Content-Type', 'application/json');
                res.end(data);
            } catch (error) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify([]));
            }
            return;
        }
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const submission = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'testimonies.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(submission);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process submission' }));
                }
            });
            return;
        }
    }

    if (req.url === '/api/donations') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const donation = { ...data, id: Date.now(), createdAt: new Date().toISOString() };
                    const filePath = path.join(__dirname, 'donations.json');

                    let existing = [];
                    try {
                        const fileData = await fs.readFile(filePath, 'utf-8');
                        existing = JSON.parse(fileData);
                    } catch (e) { }

                    existing.push(donation);
                    await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ success: true }));
                } catch (error) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: 'Failed to process donation log' }));
                }
            });
            return;
        }
    }


    res.statusCode = 404;
    res.end(JSON.stringify({ error: 'Route not found' }));
});

server.listen(PORT, () => {
    console.log(`API Server running at http://localhost:${PORT}`);
    console.log(`Handling /api/scroll -> ${SCROLL_FILE}`);
});
