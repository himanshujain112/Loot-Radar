// Loot Radar DodoPayments webhook verification (Svix-style HMAC signatures).

export function dodoHeader(h, names) {
  for (const n of names) { const v = h.get(n); if (v) return v; }
  return "";
}

export async function verifyDodoWebhook(request, rawBody, secret) {
  const h = request.headers;
  const id = dodoHeader(h, ["webhook-id", "svix-id"]);
  const ts = dodoHeader(h, ["webhook-timestamp", "svix-timestamp"]);
  const sig = dodoHeader(h, ["webhook-signature", "svix-signature"]);
  if (!id || !ts || !sig) return { ok: false, reason: "missing signature headers" };
  const age = Math.abs(Date.now() / 1000 - parseInt(ts, 10));
  if (!isFinite(age) || age > 300) return { ok: false, reason: "stale timestamp" };
  try {
    const raw = secret.replace(/^whsec_/, "");
    const keyBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id + "." + ts + "." + rawBody));
    const expected = btoa(String.fromCharCode.apply(null, new Uint8Array(mac)));
    const ok = sig.split(" ").some(s => {
      const v = s.indexOf("v1,") === 0 ? s.slice(3) : s;
      return v === expected;
    });
    return ok ? { ok: true } : { ok: false, reason: "signature mismatch" };
  } catch (e) {
    return { ok: false, reason: "verification error" };
  }
}

export function dodoCustomerEmail(evt) {
  if (!evt || !evt.data) return null;
  const d = evt.data;
  return (d.customer && d.customer.email) || d.customer_email || d.email || null;
}
