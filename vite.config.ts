import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 80,
    },
    plugins: [
        react(),
        mode === "development" && componentTagger(),
        {
            name: 'api-scroll',
            configureServer(server) {
                server.middlewares.use(async (req, res, next) => {
                    if (req.url === '/api/scroll' || req.url === '/api/prayer-request' || req.url === '/api/testimonies') {
                        const fs = await import('fs/promises');
                        const url = req.url.split('?')[0];

                        const adminPassword = (process.env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
                        const verifyAuthHeader = (req) => {
                            const provided = (req.headers['x-admin-password'] || '').trim();
                            return provided === adminPassword;
                        };

                        // Handle preflight OPTIONS requests for custom routes
                        if (req.method === 'OPTIONS') {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');
                            res.statusCode = 204;
                            res.end();
                            return;
                        }

                        // Handler for /api/scroll
                        if (url === '/api/scroll') {
                            const scrollPath = path.resolve(__dirname, 'scroll.json');
                            if (req.method === 'GET') {
                                try {
                                    const data = await fs.readFile(scrollPath, 'utf-8');
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(data);
                                } catch (error) {
                                    res.statusCode = 404;
                                    res.end(JSON.stringify({ error: 'Not found' }));
                                }
                                return;
                            }
                            if (req.method === 'POST') {
                                if (!verifyAuthHeader(req)) {
                                    res.statusCode = 401;
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                                    return;
                                }
                                let body = '';
                                req.on('data', chunk => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        await fs.writeFile(scrollPath, body, 'utf-8');
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify({ success: true }));
                                    } catch (error) {
                                        res.statusCode = 500;
                                        res.end(JSON.stringify({ error: 'Failed to write' }));
                                    }
                                });
                                return;
                            }
                        }

                        // Handler for submissions
                        if (url === '/api/prayer-request' || url === '/api/testimonies') {
                            const fileName = url === '/api/prayer-request' ? 'prayer_requests.json' : 'testimonies.json';
                            const filePath = path.resolve(__dirname, fileName);

                            if (req.method === 'GET') {
                                if (!verifyAuthHeader(req)) {
                                    res.statusCode = 401;
                                    res.end(JSON.stringify({ error: 'Unauthorized' }));
                                    return;
                                }
                                try {
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
                                        res.statusCode = 500;
                                        res.end(JSON.stringify({ error: 'Failed to process submission' }));
                                    }
                                });
                                return;
                            }
                        }
                    }
                    next();
                });
            }
        }
    ].filter(Boolean),
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    base: mode === "production" ? "/" : "/",
    build: {
        outDir: "dist",
        sourcemap: mode === "development",
        minify: "terser",
        rollupOptions: {
            output: {
                manualChunks: {
                    vendor: ["react", "react-dom"],
                    ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "lucide-react"],
                },
            },
        },
    },
}));
