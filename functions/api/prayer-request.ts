export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type",
            },
        });
    }

    if (request.method === "GET") {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
            "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
        };

        try {
            const adminPassword = (env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
            const authHeader = (request.headers.get("X-Admin-Password") || '').trim();

            if (authHeader !== adminPassword) {
                return new Response(JSON.stringify([]), {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders
                    }
                });
            }

            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
            }
            const data = await env.SCROLL_KV.get("prayer_requests");
            return new Response(data || "[]", {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
        }
    }

    if (request.method === "POST") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "SCROLL_KV binding not found" }), { status: 500 });
            }

            const data = await request.json();
            const submission = { ...data, id: Date.now(), createdAt: new Date().toISOString() };

            // On Cloudflare, we store in KV. 
            // We can store each submission as a separate key or in a list.
            // A list is easier for bulk reading later.
            const existingRaw = await env.SCROLL_KV.get("prayer_requests");
            let existing = existingRaw ? JSON.parse(existingRaw) : [];

            existing.push(submission);
            await env.SCROLL_KV.put("prayer_requests", JSON.stringify(existing));

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to process prayer request" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response("Not Found", { status: 404 });
}
