// Discord alerts: OAuth2 connect flow + bot DMs through the REST API.
// No gateway connection needed; the bot never has to stay online.
// Users link from the Pro dashboard; the worker DMs them like Telegram.

const API = "https://discord.com/api/v10";
const APP_URL = "https://radar.codemeoww.com";

export function discordClientId(env) {
  return (env && env.DISCORD_CLIENT_ID) || "1552717791885393930";
}

export function discordRedirectUri() {
  return APP_URL + "/api/discord/callback";
}

export function discordAuthorizeUrl(env, state) {
  const q = new URLSearchParams({
    client_id: discordClientId(env),
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify",
    state,
  });
  return "https://discord.com/oauth2/authorize?" + q.toString();
}

// OAuth2 code -> user access token (identity only, no bot install needed).
export async function discordExchangeCode(env, code) {
  try {
    const body = new URLSearchParams({
      client_id: discordClientId(env),
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(),
    });
    const res = await fetch(API + "/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) { return null; }
}

export async function discordOAuthUser(accessToken) {
  try {
    const res = await fetch(API + "/users/@me", {
      headers: { "Authorization": "Bearer " + accessToken },
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) { return null; }
}

function botHeaders(env) {
  return { "Authorization": "Bot " + env.DISCORD_BOT_TOKEN, "Content-Type": "application/json" };
}

// Open (or reuse) a DM channel with the user. Works without a shared server;
// delivery depends on the recipient's DM privacy settings.
export async function discordOpenDM(env, discordUserId) {
  if (!env || !env.DISCORD_BOT_TOKEN || !discordUserId) return null;
  const uid = String(discordUserId);
  try {
    const cached = await env.KV.get("discord:dm:" + uid);
    if (cached) return cached;
  } catch (e) {}
  try {
    const res = await fetch(API + "/users/@me/channels", {
      method: "POST",
      headers: botHeaders(env),
      body: JSON.stringify({ recipient_id: uid }),
    });
    if (!res.ok) return null;
    const ch = await res.json();
    if (ch && ch.id) {
      try { await env.KV.put("discord:dm:" + uid, ch.id, { expirationTtl: 86400 * 30 }); } catch (e) {}
      return ch.id;
    }
  } catch (e) {}
  return null;
}

export async function sendDiscordDM(env, discordUserId, text) {
  const chId = await discordOpenDM(env, discordUserId);
  if (!chId) return false;
  try {
    const res = await fetch(API + "/channels/" + chId + "/messages", {
      method: "POST",
      headers: botHeaders(env),
      body: JSON.stringify({ content: String(text).slice(0, 1900) }),
    });
    return res.ok;
  } catch (e) { return false; }
}

// Plain-text Discord-flavored version of the Telegram alert digest.
export function alertDigestDiscord(items) {
  const n = items.length;
  let out = "🎮 **Loot Radar: " + n + " new drop" + (n === 1 ? "" : "s") + "**";
  for (const it of items) {
    if (it.kind === "deal") {
      out += "\n\n**" + it.title + "**\n" +
        "🔥 " + it.savings + "% off · " + (it.store || "PC") + "\n" +
        "~~$" + it.normal + "~~ → **$" + it.sale + "**" +
        (it.isNewLow ? "\n🏆 **lowest price ever tracked**" : "");
    } else {
      const meta = [it.worth ? "worth " + it.worth : "", it.ends ? "ends " + it.ends : "", it.platforms ? it.platforms : ""]
        .filter(function (x) { return !!x; }).join(" · ");
      out += "\n\n**" + it.title + "**\n🎯 **FREE**" + (meta ? " · " + meta : "");
    }
  }
  return out;
}
