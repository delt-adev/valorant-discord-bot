function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, OPTIONS",
        "access-control-allow-headers": "content-type, authorization"
      }});
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ status: "ok", service: "valorant-notifier-api" });
    }

    if (url.pathname === "/internal/poll" && request.method === "POST") {
      const supplied = request.headers.get("authorization") || "";
      if (!env.POLL_SECRET || supplied !== `Bearer ${env.POLL_SECRET}`) {
        return json({ error: "unauthorized" }, 401);
      }
      // Match polling will be implemented after Riot Production API access is approved.
      return json({
        status: "not_configured",
        message: "Riot Production API integration is not configured yet."
      }, 501);
    }

    if (url.pathname.startsWith("/auth/")) {
      return json({
        error: "rso_not_configured",
        message: "Riot Sign On must be approved and configured before account linking can be enabled."
      }, 501);
    }

    return json({ error: "not_found" }, 404);
  }
};
