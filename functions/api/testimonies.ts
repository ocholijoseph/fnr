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
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } });
            }
            const data = await env.SCROLL_KV.get("testimonies");
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

            const existingRaw = await env.SCROLL_KV.get("testimonies");
            let existing = existingRaw ? JSON.parse(existingRaw) : [];

            existing.push(submission);
            await env.SCROLL_KV.put("testimonies", JSON.stringify(existing));

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to process testimony" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    return new Response("Not Found", { status: 404 });
}
