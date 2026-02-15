export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // In Cloudflare, we'd ideally use KV. 
    // For a basic mock that matches the user's current static deployment:
    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (request.method === "GET") {
        try {
            if (!env.SCROLL_KV) {
                throw new Error("SCROLL_KV namespace not bound");
            }
            const data = await env.SCROLL_KV.get("config");
            if (!data) {
                // Return default if no config exists yet
                return new Response(JSON.stringify({
                    overrideEnabled: false,
                    overrideMessage: ""
                }), {
                    headers: { "Content-Type": "application/json" }
                });
            }
            return new Response(data, {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: "Persistence requires KV storage on Cloudflare. Please configure KV binding 'SCROLL_KV' in Dash."
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    if (request.method === "POST") {
        try {
            if (!env.SCROLL_KV) {
                throw new Error("SCROLL_KV namespace not bound");
            }
            const body = await request.text();
            // Basic validation
            JSON.parse(body);
            await env.SCROLL_KV.put("config", body);
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: "Persistence requires KV storage on Cloudflare. Please configure KV binding 'SCROLL_KV' to enable saves."
            }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response("Not Found", { status: 404 });
}
