// Feature flag: server (guild) channel alerts. Off for now; only DMs.
// When re-enabled, the dashboard server-picker section renders again.
export const DISCORD_SERVER_ALERTS = false;

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

// Open (or reuse) a DM channel with the user. Only works when the bot shares
// a server with the user; otherwise Discord refuses the channel create.
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

// Server (guild) alerts: invite the bot to a server, then post alerts to a
// channel there. This is the reliable path: a bot cannot open DMs with a user
// it shares no server with, so DMs only work once the bot is in a server
// the user is in. Channel posts work as soon as the invite lands.
export function discordInviteUrl(env) {
  const q = new URLSearchParams({
    client_id: discordClientId(env),
    // Send Messages (2048) + Embed Links (16384). Nothing else needed.
    permissions: "18432",
    scope: "bot",
  });
  return "https://discord.com/oauth2/authorize?" + q.toString();
}

// Guilds the bot has been added to.
export async function discordBotGuilds(env) {
  if (!env || !env.DISCORD_BOT_TOKEN) return [];
  try {
    const res = await fetch(API + "/users/@me/guilds", { headers: botHeaders(env) });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : []).map(g => ({ id: String(g.id), name: g.name || "server" }));
  } catch (e) { return []; }
}

// Text channels in a guild the bot can see.
export async function discordGuildChannels(env, guildId) {
  if (!env || !env.DISCORD_BOT_TOKEN || !guildId) return [];
  try {
    const res = await fetch(API + "/guilds/" + encodeURIComponent(String(guildId)) + "/channels", { headers: botHeaders(env) });
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [])
      .filter(c => c && (c.type === 0 || c.type === 5))
      .map(c => ({ id: String(c.id), name: c.name || "channel" }));
  } catch (e) { return []; }
}

export async function sendDiscordChannel(env, channelId, text) {
  if (!env || !env.DISCORD_BOT_TOKEN || !channelId) return false;
  try {
    const res = await fetch(API + "/channels/" + encodeURIComponent(String(channelId)) + "/messages", {
      method: "POST",
      headers: botHeaders(env),
      body: JSON.stringify({ content: String(text).slice(0, 1900) }),
    });
    return res.ok;
  } catch (e) { return false; }
}
export function alertDigestDiscord(items) {
  const n = items.length;
  const t = function (s) { return String(s || "").replace(/[\[\]]/g, ""); }; // keep [..](..) links intact
  let out = "🎮 **Loot Radar: " + n + " new drop" + (n === 1 ? "" : "s") + "**";
  for (const it of items) {
    const title = it.url ? "[**" + t(it.title) + "**](" + it.url + ")" : "**" + t(it.title) + "**";
    if (it.kind === "deal") {
      out += "\n\n" + title + "\n" +
        "🔥 " + it.savings + "% off · " + (it.store || "PC") + "\n" +
        "~~$" + it.normal + "~~ → **$" + it.sale + "**" +
        (it.isNewLow ? "\n🏆 **lowest price ever tracked**" : "");
    } else {
      const meta = [it.worth ? "worth " + it.worth : "", it.ends ? "ends " + it.ends : "", it.platforms ? it.platforms : ""]
        .filter(function (x) { return !!x; }).join(" · ");
      out += "\n\n" + title + "\n🎯 **FREE**" + (meta ? " · " + meta : "");
    }
  }
  out += "\n\n🌐 [Browse all drops](https://radar.codemeoww.com/deals)";
  return out;
}
