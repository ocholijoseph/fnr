import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
    server: {
        host: "::",
        port: 1500,
    },
    plugins: [
        react(),
        mode === "development" && componentTagger(),
        {
            name: 'api-scroll',
            configureServer(server: any) {
                server.middlewares.use(async (req: any, res: any, next: any) => {
                    if (req.url?.startsWith('/api/scroll') || req.url?.startsWith('/api/prayer-request') || req.url?.startsWith('/api/testimonies') || req.url?.startsWith('/api/donations') || req.url?.startsWith('/api/news')) {
                        const fs = await import('fs/promises');
                        const url = req.url.split('?')[0];

                        const adminPassword = (process.env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
                        const verifyAuthHeader = (req: any) => {
                            const authHeader = req.headers['authorization'] || req.headers['x-admin-password'] || '';
                            let provided = authHeader.trim();
                            if (provided.startsWith('Bearer ')) {
                                provided = provided.substring(7).trim();
                            }
                            return provided === adminPassword;
                        };

                        // Handle preflight OPTIONS requests for custom routes
                        if (req.method === 'OPTIONS') {
                            res.setHeader('Access-Control-Allow-Origin', '*');
                            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Password');
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
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
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
                        if (url === '/api/prayer-request' || url === '/api/testimonies' || url === '/api/donations') {
                            const fileName = url === '/api/prayer-request' ? 'prayer_requests.json' : url === '/api/donations' ? 'donations.json' : 'testimonies.json';
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
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const data = JSON.parse(body);
                                        const submission = { ...data, id: Date.now().toString(), createdAt: new Date().toISOString() };

                                        let existing: any[] = [];
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

                            if (req.method === 'PUT') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const data = JSON.parse(body);
                                        let existing: any[] = [];
                                        try {
                                            const fileData = await fs.readFile(filePath, 'utf-8');
                                            existing = JSON.parse(fileData);
                                        } catch (e) { }

                                        const index = existing.findIndex((item: any) => item.id.toString() === data.id.toString());
                                        if (index !== -1) {
                                            existing[index] = { ...existing[index], ...data, updatedAt: new Date().toISOString() };
                                            await fs.writeFile(filePath, JSON.stringify(existing, null, 2), 'utf-8');
                                            res.setHeader('Content-Type', 'application/json');
                                            res.end(JSON.stringify(existing[index]));
                                        } else {
                                            res.statusCode = 404;
                                            res.end(JSON.stringify({ error: 'Not found' }));
                                        }
                                    } catch (error) {
                                        res.statusCode = 500;
                                        res.end(JSON.stringify({ error: 'Failed' }));
                                    }
                                });
                                return;
                            }

                            if (req.method === 'DELETE') {
                                const id = new URL(req.url!, `http://${req.headers.host}`).searchParams.get('id');
                                if (!id) {
                                    res.statusCode = 400;
                                    res.end(JSON.stringify({ error: 'ID required' }));
                                    return;
                                }

                                try {
                                    const fileData = await fs.readFile(filePath, 'utf-8');
                                    let existing: any[] = [];
                                    try {
                                        existing = JSON.parse(fileData);
                                    } catch (e) { }
                                    const filtered = existing.filter((item: any) => item.id.toString() !== id.toString());
                                    await fs.writeFile(filePath, JSON.stringify(filtered, null, 2), 'utf-8');
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ success: true }));
                                } catch (error) {
                                    res.statusCode = 500;
                                    res.end(JSON.stringify({ error: 'Failed' }));
                                }
                                return;
                            }
                        }

                        // Handler for /api/news
                        if (url === '/api/news') {
                            const newsPath = path.resolve(__dirname, 'news.json');

                            if (req.method === 'GET') {
                                try {
                                    const dataRaw = await fs.readFile(newsPath, 'utf-8');
                                    let news = JSON.parse(dataRaw);

                                    // If not admin, filter published
                                    if (!verifyAuthHeader(req)) {
                                        news = news.filter((item: any) => item.status === 'Published');
                                    }

                                    // Sort
                                    news.sort((a: any, b: any) => {
                                        if (a.pinned && !b.pinned) return -1;
                                        if (!a.pinned && b.pinned) return 1;
                                        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                                    });

                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify(news));
                                } catch (error) {
                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify([]));
                                }
                                return;
                            }

                            if (!verifyAuthHeader(req)) {
                                res.statusCode = 401;
                                res.setHeader('Content-Type', 'application/json');
                                res.end(JSON.stringify({ error: 'Unauthorized' }));
                                return;
                            }

                            if (req.method === 'POST') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const bodyData = JSON.parse(body);
                                        const newItem = {
                                            id: Date.now().toString(),
                                            title: bodyData.title,
                                            content: bodyData.content,
                                            status: bodyData.status || "Draft",
                                            pinned: !!bodyData.pinned,
                                            createdAt: new Date().toISOString()
                                        };

                                        let news: any[] = [];
                                        try {
                                            const dataRaw = await fs.readFile(newsPath, 'utf-8');
                                            news = JSON.parse(dataRaw);
                                        } catch (e) { }

                                        news.push(newItem);
                                        await fs.writeFile(newsPath, JSON.stringify(news, null, 2), 'utf-8');

                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify(newItem));
                                    } catch (error) {
                                        res.statusCode = 500;
                                        res.end(JSON.stringify({ error: 'Failed to create news' }));
                                    }
                                });
                                return;
                            }

                            if (req.method === 'PUT') {
                                let body = '';
                                req.on('data', (chunk: any) => { body += chunk.toString(); });
                                req.on('end', async () => {
                                    try {
                                        const bodyData = JSON.parse(body);
                                        const dataRaw = await fs.readFile(newsPath, 'utf-8');
                                        let news: any[] = [];
                                        try {
                                            news = JSON.parse(dataRaw);
                                        } catch (e) { }

                                        const index = news.findIndex((item: any) => item.id === bodyData.id);
                                        if (index === -1) {
                                            res.statusCode = 404;
                                            res.end(JSON.stringify({ error: 'News not found' }));
                                            return;
                                        }

                                        news[index] = {
                                            ...news[index],
                                            title: bodyData.title,
                                            content: bodyData.content,
                                            status: bodyData.status,
                                            pinned: !!bodyData.pinned,
                                            updatedAt: new Date().toISOString()
                                        };

                                        await fs.writeFile(newsPath, JSON.stringify(news, null, 2), 'utf-8');
                                        res.setHeader('Content-Type', 'application/json');
                                        res.end(JSON.stringify(news[index]));
                                    } catch (error) {
                                        res.statusCode = 500;
                                        res.end(JSON.stringify({ error: 'Failed to update news' }));
                                    }
                                });
                                return;
                            }

                            if (req.method === 'DELETE') {
                                const urlObj = new URL(req.url!, `http://${req.headers.host}`);
                                const id = urlObj.searchParams.get("id");
                                if (!id) {
                                    res.statusCode = 400;
                                    res.end(JSON.stringify({ error: 'ID required' }));
                                    return;
                                }

                                try {
                                    const dataRaw = await fs.readFile(newsPath, 'utf-8');
                                    let news: any[] = [];
                                    try {
                                        news = JSON.parse(dataRaw);
                                    } catch (e) { }
                                    const filtered = news.filter((item: any) => item.id !== id);
                                    await fs.writeFile(newsPath, JSON.stringify(filtered, null, 2), 'utf-8');

                                    res.setHeader('Content-Type', 'application/json');
                                    res.end(JSON.stringify({ success: true }));
                                } catch (error) {
                                    res.statusCode = 500;
                                    res.end(JSON.stringify({ error: 'Failed to delete news' }));
                                }
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
    base: "./",
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
