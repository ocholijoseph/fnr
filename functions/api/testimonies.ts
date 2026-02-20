export async function onRequest(context: any) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: corsHeaders,
        });
    }

    const adminPassword = (env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
    const authHeader = request.headers.get("Authorization") || "";
    const provided = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();
    const isAdmin = provided === adminPassword;

    if (request.method === "GET") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", ...corsHeaders } });
            }

            const dataRaw = await env.SCROLL_KV.get("testimonies");
            let data = dataRaw ? JSON.parse(dataRaw) : [];

            // If authenticated, return all
            if (isAdmin) {
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

            const submission = {
                id: data.id || Date.now().toString(),
                name: data.name,
                email: data.email || "",
                message: data.message,
                allow_public: data.allow_public === true || data.allowPublicShare === true,
                createdAt: data.createdAt || new Date().toISOString()
            };

            const existingRaw = await env.SCROLL_KV.get("testimonies");
            let existing = existingRaw ? JSON.parse(existingRaw) : [];

            existing.push(submission);
            await env.SCROLL_KV.put("testimonies", JSON.stringify(existing));

            return new Response(JSON.stringify({ success: true, item: submission }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to process testimony" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    // Admin only methods
    if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    if (request.method === "PUT") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "KV not bound" }), { status: 500, headers: corsHeaders });
            }
            const body = await request.json();
            const dataRaw = await env.SCROLL_KV.get("testimonies");
            let data = dataRaw ? JSON.parse(dataRaw) : [];

            const index = data.findIndex((item: any) => item.id.toString() === body.id.toString());
            if (index === -1) {
                return new Response(JSON.stringify({ error: "Testimony not found" }), { status: 404, headers: corsHeaders });
            }

            data[index] = {
                ...data[index],
                name: body.name,
                email: body.email,
                message: body.message,
                allow_public: body.allow_public === true || body.allowPublicShare === true,
                updatedAt: new Date().toISOString()
            };

            await env.SCROLL_KV.put("testimonies", JSON.stringify(data));

            return new Response(JSON.stringify(data[index]), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to update testimony" }), { status: 400, headers: corsHeaders });
        }
    }

    if (request.method === "DELETE") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "KV not bound" }), { status: 500, headers: corsHeaders });
            }
            const url = new URL(request.url);
            const id = url.searchParams.get("id");
            if (!id) {
                return new Response(JSON.stringify({ error: "ID required" }), { status: 400, headers: corsHeaders });
            }

            const dataRaw = await env.SCROLL_KV.get("testimonies");
            let data = dataRaw ? JSON.parse(dataRaw) : [];
            const newData = data.filter((item: any) => item.id.toString() !== id.toString());

            await env.SCROLL_KV.put("testimonies", JSON.stringify(newData));

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to delete testimony" }), { status: 400, headers: corsHeaders });
        }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
}
