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
                    if (req.url === '/api/scroll') {
                        const fs = await import('fs/promises');
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
                            let body = '';
                            req.on('data', chunk => {
                                body += chunk.toString();
                            });
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
