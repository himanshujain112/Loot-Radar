// Loot Radar pure utilities: HTML escaping, crypto helpers, cookies,
// giveaway title cleanup and expiry helpers. No local imports.

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function randHex(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return Array.from(b, x => ("0" + x.toString(16)).slice(-2)).join("");
}

export function getCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : "";
}

export async function sha256hex(s) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join("");
}

export function cleanTitle(t) {
  // Display cleanup only, dedup keys always use the RAW title so already-sent
  // items never change identity and can't resend. Also strips the trailing
  // "(Epic Games)" style store tag since the platform line already says it.
  return String(t || "Untitled").replace(/\s+giveaway\s*$/i, "")
    .replace(/\s*\((epic games|steam|gog|ubisoft connect|ubisoft|itch\.io|indiegala|stove|fanatical|humble bundle|humble)\)\s*$/i, "").trim() || "Untitled";
}

export function endsMs(f) {
  // GamerPower end_date looks like "2026-09-29 23:59:00" (UTC). 0 = unknown.
  if (!f || !f.ends) return 0;
  const t = Date.parse(String(f.ends).replace(" ", "T") + "Z");
  return isNaN(t) ? 0 : t;
}
export function endsLabel(ms) {
  // Server-rendered initial countdown text; the tick script takes over in-browser.
  const d = ms - Date.now();
  if (d <= 0) return "expired";
  const days = Math.floor(d / 864e5), h = Math.floor(d % 864e5 / 36e5), m = Math.floor(d % 36e5 / 6e4);
  return (days > 0 ? days + "d " : "") + (h > 0 || days > 0 ? h + "h " : "") + m + "m left";
}
export function isJustDropped(g) {
  if (!g || !g.published) return false;
  const t = Date.parse(String(g.published).replace(" ", "T") + "Z");
  return !isNaN(t) && (Date.now() - t) <= 48 * 36e5;
}
