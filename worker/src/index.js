
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
      "access-control-allow-headers": "content-type, authorization, x-owner-id"
    }
  });
}

function getOwnerId(request) {
  const ownerId = request.headers.get("x-owner-id") || "";

  if (!/^[a-zA-Z0-9-]{8,80}$/.test(ownerId)) {
    return null;
  }

  return ownerId;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type, authorization, x-owner-id"
        }
      });
    }

    if (url.pathname === "/health" && method === "GET") {
      return json({
        status: "ok",
        service: "valorant-notifier-api"
      });
    }

    if (url.pathname === "/internal/poll" && method === "POST") {
      const supplied = request.headers.get("authorization") || "";

      if (!env.POLL_SECRET || supplied !== `Bearer ${env.POLL_SECRET}`) {
        return json({ error: "unauthorized" }, 401);
      }

      return json({
        status: "not_configured",
        message: "Riot Production API integration is not configured yet."
      }, 501);
    }

    // Temporary prototype account API.
    if (url.pathname.startsWith("/api/accounts")) {
      const ownerId = getOwnerId(request);

      if (!ownerId) {
        return json({ error: "invalid_owner_id" }, 400);
      }

      if (url.pathname === "/api/accounts" && method === "GET") {
        const result = await env.DB.prepare(`
          SELECT id, game_name, tag_line, region, created_at
          FROM accounts
          WHERE owner_id = ?
          ORDER BY created_at DESC
        `).bind(ownerId).all();

        return json({ accounts: result.results });
      }

      if (url.pathname === "/api/accounts" && method === "POST") {
        let body;

        try {
          body = await request.json();
        } catch {
          return json({ error: "invalid_json" }, 400);
        }

        const gameName = String(body.game_name || "").trim();
        const tagLine = String(body.tag_line || "").trim();
        const region = String(body.region || "ap").trim().toLowerCase();

        if (!gameName || !tagLine || gameName.length > 32 || tagLine.length > 16) {
          return json({ error: "invalid_riot_id" }, 400);
        }

        if (!/^[a-z0-9]+$/.test(region)) {
          return json({ error: "invalid_region" }, 400);
        }

        const id = crypto.randomUUID();
        const testPuuid = `test-${crypto.randomUUID()}`;

        await env.DB.prepare(`
          INSERT INTO accounts
            (id, puuid, game_name, tag_line, region, owner_id, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).bind(
          id,
          testPuuid,
          gameName,
          tagLine,
          region,
          ownerId
        ).run();

        return json({
          status: "created",
          account: {
            id,
            game_name: gameName,
            tag_line: tagLine,
            region,
            is_test: true
          }
        }, 201);
      }

      const match = url.pathname.match(/^\/api\/accounts\/([a-f0-9-]+)$/i);

      if (match && method === "DELETE") {
        const result = await env.DB.prepare(`
          DELETE FROM accounts
          WHERE id = ? AND owner_id = ?
        `).bind(match[1], ownerId).run();

        if (!result.meta.changes) {
          return json({ error: "account_not_found" }, 404);
        }

        return json({ status: "deleted" });
      }

      return json({ error: "method_or_route_not_allowed" }, 405);
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
