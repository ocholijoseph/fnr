export async function onRequest(context: any) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: corsHeaders,
        });
    }

    if (request.method === "GET") {
        try {
            const adminPassword = (env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
            const authHeader = request.headers.get("Authorization") || "";
            const provided = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();

            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            const dataRaw = await env.SCROLL_KV.get("testimonies");
            let data = dataRaw ? JSON.parse(dataRaw) : [];

            // If authenticated, return all
            if (provided === adminPassword) {
                return new Response(JSON.stringify(data), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            // If not authenticated, return only public ones
            // Sort by newest first as per requirement
            const publicData = data
                .filter((t: any) => t.allow_public === true || t.allowPublicShare === true)
                .map(({ email, ...rest }: any) => rest) // Do NOT show email in public view
                .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            return new Response(JSON.stringify(publicData), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            console.error("GET testimonies error:", error);
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    }

    if (request.method === "POST") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "SCROLL_KV binding not found" }), { status: 500, headers: corsHeaders });
            }

            const data = await request.json();

            // Validate input
            if (!data.name || !data.message) {
                return new Response(JSON.stringify({ error: "Name and message are required" }), { status: 400, headers: corsHeaders });
            }

            // Limit message length
            if (data.message.length > 1000) {
                return new Response(JSON.stringify({ error: "Testimony too long (max 1000 characters)" }), { status: 400, headers: corsHeaders });
            }

            const submission = {
                id: Date.now(),
                name: data.name,
                email: data.email || "",
                message: data.message,
                allow_public: data.allow_public === true || data.allowPublicShare === true,
                createdAt: new Date().toISOString()
            };

            const existingRaw = await env.SCROLL_KV.get("testimonies");
            let existing = existingRaw ? JSON.parse(existingRaw) : [];

            existing.push(submission);
            await env.SCROLL_KV.put("testimonies", JSON.stringify(existing));

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to process testimony" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
}
