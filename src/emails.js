// Loot Radar email templates: the HTML shell, magic login link,
// and the daily digest email.

import { esc } from "./util.js";

export function emailShell(inner) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"></head>' +
    '<body style="margin:0;padding:0;background:#0d1219;color:#e8edf2;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="background:#0d1219;padding:32px 16px"><tr><td align="center">' +
    '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#151d29;border:1px solid #26303d;border-radius:14px">' +
    '<tr><td style="padding:26px 30px 6px"><span style="color:#22ff88;font-weight:800;letter-spacing:3px;font-size:13px">LOOT RADAR</span></td></tr>' +
    '<tr><td style="padding:8px 30px 28px">' + inner + '</td></tr>' +
    '<tr><td style="padding:18px 30px;border-top:1px solid #26303d;color:#8b95a3;font-size:12px;line-height:1.7">Loot Radar · <a href="https://radar.codemeoww.com" style="color:#6cb4f5;text-decoration:none">radar.codemeoww.com</a><br>Questions? Write to <a href="mailto:lootradar@codemeoww.com" style="color:#6cb4f5;text-decoration:none">lootradar@codemeoww.com</a></td></tr>' +
    '</table></td></tr></table></body></html>';
}
export function magicLinkEmail(link) {
  return emailShell(
    '<h1 style="margin:12px 0 10px;font-size:24px;line-height:1.25;color:#ffffff">Log in to Loot Radar</h1>' +
    '<p style="color:#aeb8c4;font-size:15px;line-height:1.65">Click the button below to log in. This link expires in <b style="color:#ffffff">15 minutes</b> and works only once.</p>' +
    '<p style="margin:26px 0"><a href="' + link + '" style="display:inline-block;background:#22ff88;color:#06281a;font-weight:800;font-size:16px;padding:14px 36px;border-radius:10px;text-decoration:none">Log in &rarr;</a></p>' +
    '<p style="color:#8b95a3;font-size:13px;line-height:1.6">Button not working? Paste this link into your browser:<br><span style="color:#6cb4f5;word-break:break-all">' + link + '</span></p>' +
    '<p style="color:#8b95a3;font-size:13px;line-height:1.6;margin-bottom:0">If you didn\'t request this, ignore it. No one can log in without access to your inbox.</p>'
  );
}
export function dailyDigestEmail(freebies, deals, wishlist) {
  // Card: image on top, title, then badges (freebies) or price row (deals), quiet text CTA.
  const badge = function (text, bg, color) {
    return '<span style="display:inline-block;font-size:11px;font-weight:700;letter-spacing:.5px;padding:3px 8px;border-radius:4px;background:' + bg + ';color:' + color + ';margin:0 6px 6px 0">' + esc(text) + '</span>';
  };
  const card = function (it) {
    const isDeal = it.kind === "deal";
    const cta = isDeal ? "Get the deal &rarr;" : "Claim it &rarr;";
    let mid;
    if (isDeal) {
      const priceRow = '<s style="color:#8b95a3">$' + esc(it.normal) + '</s>&nbsp;<b style="color:#ffffff">$' + esc(it.sale) + '</b>&nbsp;' +
        '<span style="display:inline-block;background:rgba(34,255,136,.14);color:#22ff88;font-weight:700;font-size:12px;padding:2px 8px;border-radius:999px">-' + it.savings + '%</span>';
      mid = (it.store ? '<div style="font-size:12px;color:#8b95a3;margin:0 0 10px;line-height:1.5">' + esc(it.store) + '</div>' : '') +
        '<div style="font-size:14px;margin:0 0 12px">' + priceRow + '</div>';
    } else {
      let badges = badge("FREE", "rgba(255,255,255,.12)", "#ffffff");
      if (it.worth) badges += badge(it.worth, "rgba(255,176,32,.12)", "#ffb020");
      if (it.ends) {
        let endsTxt = "ends " + it.ends;
        const t = Date.parse(String(it.ends).replace(" ", "T") + "Z");
        if (!isNaN(t)) {
          const d = t - Date.now(), days = Math.floor(d / 864e5), h = Math.round((d % 864e5) / 36e5);
          endsTxt = d <= 0 ? "ending soon" : days >= 2 ? "ends in " + days + "d" : days === 1 ? "ends tomorrow" : "ends in " + Math.max(h, 1) + "h";
        }
        badges += badge(endsTxt, "rgba(255,210,122,.10)", "#ffd27a");
      }
      mid = '<div style="margin:0 0 10px">' + badges + '</div>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#101724;border:1px solid #26303d;border-radius:12px">' +
      (it.image ? '<tr><td style="padding:0;font-size:0;line-height:0"><a href="' + esc(it.url) + '">' +
        '<img src="' + esc(it.image) + '" width="254" alt="' + esc(it.title) + '" style="display:block;width:100%;max-width:254px;height:auto;border-radius:11px 11px 0 0;border:0"></a></td></tr>' : '') +
      '<tr><td style="padding:14px 16px 16px">' +
      '<div style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.35;margin:0 0 8px"><a href="' + esc(it.url) + '" style="color:#ffffff;text-decoration:none">' + esc(it.title) + '</a></div>' +
      mid +
      '<a href="' + esc(it.url) + '" style="font-size:13px;font-weight:700;color:#22ff88;text-decoration:none;white-space:nowrap">' + cta + '</a>' +
      '</td></tr></table>';
  };
  // Hybrid 2-col grid: inline-block columns stack naturally on narrow screens
  // (no media queries, so it works in the Gmail app). MSO ghost tables for Outlook.
  const grid = function (items) {
    let out = '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse"><tr>' +
      '<td style="font-size:0;line-height:0;text-align:center;padding:0">';
    for (let i = 0; i < items.length; i += 2) {
      const a = items[i], b = items[i + 1];
      out += '<!--[if mso]><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="540"><tr><td width="270" valign="top"><![endif]-->';
      out += '<div style="display:inline-block;width:100%;max-width:270px;vertical-align:top;font-size:15px;line-height:1.5;text-align:left">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px 16px">' + card(a) + '</td></tr></table></div>';
      if (b) {
        out += '<!--[if mso]></td><td width="270" valign="top"><![endif]-->';
        out += '<div style="display:inline-block;width:100%;max-width:270px;vertical-align:top;font-size:15px;line-height:1.5;text-align:left">' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:0 8px 16px">' + card(b) + '</td></tr></table></div>';
      }
      out += '<!--[if mso]></td></tr></table><![endif]-->';
    }
    out += '</td></tr></table>';
    return out;
  };
  const wlRow = function (h) {
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;background:#101724;border:1px solid #26303d;border-radius:10px"><tr>' +
      (h.thumb ? '<td width="110" valign="top" style="padding:12px 0 12px 12px;font-size:0;line-height:0"><img src="' + esc(h.thumb) + '" width="100" alt="' + esc(h.title) + '" style="display:block;width:100%;max-width:100px;height:auto;border-radius:8px;border:0"></td>' : '') +
      '<td valign="top" style="padding:14px 16px"><div style="font-size:15px;font-weight:700;color:#ffffff;line-height:1.35;margin:0 0 6px">' + esc(h.title) + '</div>' +
      '<div style="font-size:14px;margin:0 0 10px">Best price right now: <b style="color:#ffffff">$' + esc(h.price) + '</b></div>' +
      '<a href="' + esc(h.url) + '" style="font-size:13px;font-weight:700;color:#22ff88;text-decoration:none;white-space:nowrap">Check the price &rarr;</a></td>' +
      '</tr></table>';
  };
  const sec = function (emoji, label, count, body) {
    return '<div style="margin:28px 0 14px;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8b95a3">' +
      emoji + ' ' + label + ' · ' + count + '</div>' + body;
  };
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" });
  let inner = '<h1 style="margin:12px 0 4px;font-size:22px;color:#ffffff">Today\'s loot</h1>' +
    '<p style="color:#8b95a3;font-size:13px;margin:0 0 6px">' + today + '</p>' +
    '<p style="color:#aeb8c4;font-size:14px;line-height:1.6;margin:0 0 8px">Your daily roundup: one email, everything worth grabbing.</p>';
  if (wishlist.length) inner += sec("&#127919;", "Wishlist watch", wishlist.length, wishlist.map(wlRow).join(""));
  if (freebies.length) inner += sec("&#127918;", "Free to claim", freebies.length, grid(freebies));
  if (deals.length) inner += sec("&#128293;", "Steepest PC discounts", deals.length, grid(deals));
  if (!wishlist.length && !freebies.length && !deals.length) {
    inner += '<p style="color:#aeb8c4;font-size:14px;line-height:1.6">Quiet day on the radar. No fresh freebies or 70%+ deals right now. Add games to your <a href="https://radar.codemeoww.com/pro" style="color:#6cb4f5">wishlist</a> and we\'ll watch their prices.</p>';
  }
  inner += '<p style="color:#8b95a3;font-size:12px;line-height:1.6;margin-top:24px">You\'re getting this because you\'re a Loot Radar Pro member. One digest a day, nothing more.<br><a href="https://radar.codemeoww.com/pro" style="color:#6cb4f5">Manage your alerts</a> · <a href="mailto:lootradar@codemeoww.com" style="color:#6cb4f5">lootradar@codemeoww.com</a></p>';
  return emailShell(inner);
}
