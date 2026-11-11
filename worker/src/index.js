
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
  return /^[a-zA-Z0-9-]{8,80}$/.test(ownerId) ? ownerId : null;
}

function toBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptWebhook(webhookUrl, secret) {
  const keyBytes = Uint8Array.from(atob(secret), c => c.charCodeAt(0));

  if (keyBytes.length !== 32) {
    throw new Error("Invalid encryption key");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(webhookUrl)
  );

  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

function isValidWebhook(urlString) {
  try {
    const url = new URL(urlString);

    return (
      url.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(url.hostname) &&
      /^\/api\/webhooks\/\d+\/[A-Za-z0-9._-]+\/?$/.test(url.pathname) &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    if (method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
          "access-control-allow-headers": "content-type, authorization, x-owner-id"
        }
      });
    }

    if (path === "/health" && method === "GET") {
      return json({
        status: "ok",
        service: "valorant-notifier-api"
      });
    }

    if (path === "/internal/poll" && method === "POST") {
      const supplied = request.headers.get("authorization") || "";

      if (!env.POLL_SECRET || supplied !== `Bearer ${env.POLL_SECRET}`) {
        return json({ error: "unauthorized" }, 401);
      }

      return json({
        status: "not_configured",
        message: "Riot Production API integration is not configured yet."
      }, 501);
    }

    if (path.startsWith("/api/accounts")) {
      const ownerId = getOwnerId(request);

      if (!ownerId) {
        return json({ error: "invalid_owner_id" }, 400);
      }

      if (path === "/api/accounts" && method === "GET") {
        const result = await env.DB.prepare(`
          SELECT
            a.id,
            a.game_name,
            a.tag_line,
            a.region,
            a.created_at,
            EXISTS(
              SELECT 1
              FROM notification_destinations n
              WHERE n.account_id = a.id
            ) AS webhook_configured
          FROM accounts a
          WHERE a.owner_id = ?
          ORDER BY a.created_at DESC
        `).bind(ownerId).all();

        return json({ accounts: result.results });
      }

      if (path === "/api/accounts" && method === "POST") {
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

        await env.DB.prepare(`
          INSERT INTO accounts
            (id, puuid, game_name, tag_line, region, owner_id, is_active)
          VALUES (?, ?, ?, ?, ?, ?, 1)
        `).bind(
          id,
          `test-${crypto.randomUUID()}`,
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

      const webhookMatch = path.match(
        /^\/api\/accounts\/([a-f0-9-]+)\/webhook$/i
      );

      if (webhookMatch) {
        const accountId = webhookMatch[1];

        const account = await env.DB.prepare(`
          SELECT id
          FROM accounts
          WHERE id = ? AND owner_id = ?
        `).bind(accountId, ownerId).first();

        if (!account) {
          return json({ error: "account_not_found" }, 404);
        }

        if (method === "GET") {
          const result = await env.DB.prepare(`
            SELECT id
            FROM notification_destinations
            WHERE account_id = ?
            LIMIT 1
          `).bind(accountId).first();

          return json({
            configured: Boolean(result)
          });
        }

        if (method === "POST") {
          let body;

          try {
            body = await request.json();
          } catch {
            return json({ error: "invalid_json" }, 400);
          }

          const webhookUrl = String(body.webhook_url || "").trim();

          if (!isValidWebhook(webhookUrl)) {
            return json({ error: "invalid_discord_webhook" }, 400);
          }

          if (!env.WEBHOOK_ENCRYPTION_KEY) {
            return json({ error: "encryption_not_configured" }, 500);
          }

          const encrypted = await encryptWebhook(
            webhookUrl,
            env.WEBHOOK_ENCRYPTION_KEY
          );

          await env.DB.prepare(`
            DELETE FROM notification_destinations
            WHERE account_id = ?
          `).bind(accountId).run();

          await env.DB.prepare(`
            INSERT INTO notification_destinations
              (id, account_id, discord_webhook_encrypted)
            VALUES (?, ?, ?)
          `).bind(
            crypto.randomUUID(),
            accountId,
            encrypted
          ).run();

          return json({ status: "webhook_saved" });
        }

        if (method === "DELETE") {
          await env.DB.prepare(`
            DELETE FROM notification_destinations
            WHERE account_id = ?
          `).bind(accountId).run();

          return json({ status: "webhook_deleted" });
        }
      }

      const accountMatch = path.match(
        /^\/api\/accounts\/([a-f0-9-]+)$/i
      );

      if (accountMatch && method === "DELETE") {
        const result = await env.DB.prepare(`
          DELETE FROM accounts
          WHERE id = ? AND owner_id = ?
        `).bind(accountMatch[1], ownerId).run();

        if (!result.meta.changes) {
          return json({ error: "account_not_found" }, 404);
        }

        return json({ status: "deleted" });
      }

      return json({ error: "method_or_route_not_allowed" }, 405);
    }

    if (path.startsWith("/auth/")) {
      return json({
        error: "rso_not_configured",
        message: "Riot Sign On must be approved and configured."
      }, 501);
    }

    return json({ error: "not_found" }, 404);
  }
};
