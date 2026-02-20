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
                throw new Error("SCROLL_KV namespace not bound");
            }
            const dataRaw = await env.SCROLL_KV.get("config");
            if (!dataRaw) {
                // Return default if no config exists yet
                return new Response(JSON.stringify({
                    overrideEnabled: false,
                    overrideMessage: "",
                    scrollType: "information"
                }), {
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
                return new Response(JSON.stringify({
                    error: "Unauthorized",
                    diagnostic: {
                        providedLength: provided.length,
                        expectedLength: adminPassword.length,
                        hasEnv: !!env.ADMIN_PASSWORD
                    }
                }), {
                    status: 401,
                    headers: {
                        "Content-Type": "application/json",
                        ...corsHeaders
                    }
                });
            }

            if (!env.SCROLL_KV) {
                throw new Error("SCROLL_KV namespace not bound");
            }
            const body = await request.text();
            // Basic validation
            JSON.parse(body);
            await env.SCROLL_KV.put("config", body);
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        } catch (error) {
            return new Response(JSON.stringify({
                error: (error as Error).message || "Failed to save settings"
            }), {
                status: 400,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
}
