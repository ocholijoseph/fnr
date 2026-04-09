export async function onRequest(context: any) {
    const { request, env } = context;

    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Password",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, {
            headers: corsHeaders,
        });
    }

    if (request.method === "GET") {
        try {
            if (!env.SCROLL_KV) {
                // Fallback or error if KV not bound
                return new Response(JSON.stringify([]), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }
            const dataRaw = await env.SCROLL_KV.get("socials");
            if (!dataRaw) {
                // Return default socials if none exist
                const defaultSocials = [
                    { id: "1", platform: "instagram", url: "https://instagram.com/freedomnaijaradio", enabled: true },
                    { id: "2", platform: "facebook", url: "https://facebook.com/freedomnaijaradio", enabled: true },
                    { id: "3", platform: "x", url: "https://twitter.com/freedomnaijaradio", enabled: true },
                    { id: "4", platform: "whatsapp", url: "https://wa.me/2348000000000", enabled: true }
                ];
                return new Response(JSON.stringify(defaultSocials), {
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            return new Response(dataRaw, {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: (error as Error).message || "Connection error"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    if (request.method === "POST") {
        try {
            const adminPassword = (env.ADMIN_PASSWORD || 'kfmx-admin-2024').trim();
            const authHeader = request.headers.get("Authorization") || "";
            const provided = authHeader.startsWith("Bearer ") ? authHeader.substring(7).trim() : authHeader.trim();

            if (provided !== adminPassword) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), {
                    status: 401,
                    headers: { "Content-Type": "application/json", ...corsHeaders }
                });
            }

            if (!env.SCROLL_KV) {
                throw new Error("SCROLL_KV namespace not bound");
            }
            
            const body = await request.text();
            // Basic validation
            JSON.parse(body);
            await env.SCROLL_KV.put("socials", body);
            
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: (error as Error).message || "Failed to save socials"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
}
