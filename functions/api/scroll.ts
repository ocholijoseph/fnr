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
        // Attempt to get from KV if configured, else return default/mock
        // For now, returning a static message or checking if there's a file
        // Note: Cloudflare Functions can't write to the filesystem.
        return new Response(JSON.stringify({
            overrideEnabled: false,
            overrideMessage: "Standard Mode (Cloudflare Function Active)"
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    if (request.method === "POST") {
        return new Response(JSON.stringify({
            error: "Persistence requires KV storage on Cloudflare. Please configure KV to enable saves."
        }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response("Not Found", { status: 404 });
}
