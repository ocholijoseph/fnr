// functions/api/news.ts

export async function onRequest(context: any) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS, GET, DELETE, PUT",
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
            const dataRaw = await env.SCROLL_KV.get("news");
            let data = dataRaw ? JSON.parse(dataRaw) : [];

            // If not admin, only return published ones
            if (!isAdmin) {
                data = data.filter((item: any) => item.status === "Published");
            }

            // Sort: Pinned first, then newest first
            data.sort((a: any, b: any) => {
                if (a.pinned && !b.pinned) return -1;
                if (!a.pinned && b.pinned) return 1;
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            });

            return new Response(JSON.stringify(data), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
    }

    // All other methods require Admin
    if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json", ...corsHeaders }
        });
    }

    if (request.method === "POST") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "KV not bound" }), { status: 500, headers: corsHeaders });
            }
            const body = await request.json();
            const newItem = {
                id: Date.now().toString(),
                title: body.title,
                content: body.content,
                status: body.status || "Draft",
                pinned: !!body.pinned,
                createdAt: new Date().toISOString()
            };

            const dataRaw = await env.SCROLL_KV.get("news");
            let data = dataRaw ? JSON.parse(dataRaw) : [];
            data.push(newItem);
            await env.SCROLL_KV.put("news", JSON.stringify(data));

            return new Response(JSON.stringify(newItem), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to create news" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    if (request.method === "PUT") {
        try {
            if (!env.SCROLL_KV) {
                return new Response(JSON.stringify({ error: "KV not bound" }), { status: 500, headers: corsHeaders });
            }
            const body = await request.json();
            const dataRaw = await env.SCROLL_KV.get("news");
            let data = dataRaw ? JSON.parse(dataRaw) : [];

            const index = data.findIndex((item: any) => item.id === body.id);
            if (index === -1) {
                return new Response(JSON.stringify({ error: "News not found" }), { status: 404, headers: corsHeaders });
            }

            data[index] = {
                ...data[index],
                title: body.title,
                content: body.content,
                status: body.status,
                pinned: !!body.pinned,
                updatedAt: new Date().toISOString()
            };

            await env.SCROLL_KV.put("news", JSON.stringify(data));

            return new Response(JSON.stringify(data[index]), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to update news" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
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

            const dataRaw = await env.SCROLL_KV.get("news");
            let data = dataRaw ? JSON.parse(dataRaw) : [];
            data = data.filter((item: any) => item.id !== id);
            await env.SCROLL_KV.put("news", JSON.stringify(data));

            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({ error: "Failed to delete news" }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
}
