// Envoie une notification push (Web Push) aux appareils d'un ou plusieurs joueurs.
// Appelée uniquement par la base de données (pg_net) avec l'en-tête secret x-push-secret.
import webpush from "npm:web-push@3.6.7";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST" || req.headers.get("x-push-secret") !== Deno.env.get("PUSH_SECRET")) return new Response("forbidden", { status: 403 });
  const { user_ids, title, body, url, tag } = await req.json();
  const ids: string[] = (Array.isArray(user_ids) ? user_ids : []).filter((x) => typeof x === "string" && UUID.test(x));
  if (!ids.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { "content-type": "application/json" } });
  webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT")!, Deno.env.get("VAPID_PUBLIC_KEY")!, Deno.env.get("VAPID_PRIVATE_KEY")!);
  const base = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const h = { apikey: key, Authorization: `Bearer ${key}` };
  const r = await fetch(`${base}/rest/v1/push_subscriptions?user_id=in.(${ids.join(",")})&select=id,endpoint,p256dh,auth`, { headers: h });
  const subs: { id: number; endpoint: string; p256dh: string; auth: string }[] = await r.json();
  let sent = 0; const gone: number[] = [];
  const payload = JSON.stringify({ title: String(title || "The Ashtray King").slice(0, 80), body: String(body || "").slice(0, 160), url: String(url || "/"), tag: String(tag || "ak") });
  await Promise.all(subs.map(async (s) => {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 3600 }); sent++; }
    catch (e) { const code = (e as { statusCode?: number }).statusCode; if (code === 404 || code === 410) gone.push(s.id); }
  }));
  if (gone.length) await fetch(`${base}/rest/v1/push_subscriptions?id=in.(${gone.join(",")})`, { method: "DELETE", headers: h });
  return new Response(JSON.stringify({ sent, gone: gone.length }), { headers: { "content-type": "application/json" } });
});
