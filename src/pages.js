// Loot Radar HTML pages: nav, footer, all page builders, FAQ content
// (shared by visible HTML and JSON-LD), and the Pro dashboard.

import { esc, endsMs, endsLabel, isJustDropped } from "./util.js";
import { STORE_PICK_ORDER, STORE_NAMES } from "./config.js";
import { proStatus, getWishlist } from "./auth.js";
import { normPrefs } from "./alerts.js";

// Ticking countdowns for every [data-ends] badge + "next sweep" hero line.
export const COUNTDOWN_JS = "<script>(function(){function fmt(ms){if(ms<=0)return'expired';var d=Math.floor(ms/864e5),h=Math.floor(ms%864e5/36e5),m=Math.floor(ms%36e5/6e4);return(d>0?d+'d ':'')+((h>0||d>0)?h+'h ':'')+m+'m left';}function tick(){var now=Date.now();var bs=document.querySelectorAll('[data-ends]');for(var i=0;i<bs.length;i++){bs[i].textContent=fmt(Date.parse(bs[i].getAttribute('data-ends'))-now);}var s=document.querySelector('[data-sweep]');if(s){var n=new Date();var nx=new Date(n);nx.setSeconds(0,0);nx.setMinutes(Math.ceil(n.getMinutes()/20)*20);if(nx<=n)nx.setMinutes(nx.getMinutes()+20);var mm=Math.max(1,Math.round((nx-n)/6e4));s.textContent='next sweep in ~'+mm+' min';}}tick();setInterval(tick,30000);})();</script>";

export function freebieCard(g) {
  const ms = endsMs(g);
  const left = ms - Date.now();
  const showEnds = ms && left > 0;
  const urg = showEnds && left <= 24 * 36e5 ? " crit" : (showEnds && left <= 72 * 36e5 ? " soon" : "");
  const fresh = isJustDropped(g);
  let meta = "";
  if (fresh) meta += '<span class="fresh">just dropped</span>';
  if (g.worth && g.worth !== "N/A") meta += (meta ? " · " : "") + '<span class="worth">worth ' + esc(g.worth) + "</span>";
  if (showEnds) meta += (meta ? " · " : "") + '<span class="ends' + urg + '" data-ends="' + new Date(ms).toISOString() + '">' + endsLabel(ms) + "</span>";
  return '<article class="card">' +
    '<div class="thumbwrap">' +
    (g.thumb ? '<img class="thumb" loading="lazy" src="' + esc(g.thumb) + '" alt="' + esc(g.title) + '">' : "") +
    '<span class="freetag">Free</span>' +
    "</div>" +
    '<div class="card-body">' +
    '<h3>' + esc(g.title) + "</h3>" +
    (meta ? '<p class="fmeta">' + meta + "</p>" : "") +
    '<div class="card-foot"><span class="plat">' + esc(g.platforms) + "</span>" +
    '<a class="btn small" href="' + esc(g.url) + '" target="_blank" rel="noopener">Claim</a></div>' +
    "</div></article>";
}

export function dealRow(d) {
  return '<a class="dealrow" href="' + esc(d.url) + '" target="_blank" rel="noopener">' +
    (d.thumb ? '<img loading="lazy" src="' + esc(d.thumb) + '" alt="">' : "") +
    '<span class="t"><h3>' + esc(d.title) + '</h3><span class="store">Steam</span></span>' +
    '<span class="pct">-' + d.off + '%</span>' +
    '<span class="prices"><span class="old">$' + esc(d.was) + '</span><span class="new">$' + esc(d.price) + "</span></span>" +
    "</a>";
}

export function jsonLD(freebies) {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Loot Radar",
        url: "https://radar.codemeoww.com/",
        description: "Loot Radar tracks Steam's steepest discounts and every free-to-claim PC game, and pings Pro members fast when new loot drops.",
      },
      {
        "@type": "ItemList",
        name: "Free PC games right now",
        itemListElement: freebies.slice(0, 10).map((g, i) => ({
          "@type": "ListItem", position: i + 1, name: g.title, url: g.url,
        })),
      },
    ],
  };
  return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, "\\u003c") + "</script>";
}

export function pageHTML(title, desc, path, headExtra) {
  title = title || "Loot Radar: Steam deals & free PC games";
  desc = desc || "Loot Radar tracks Steam's steepest discounts and every free-to-claim PC game. Pro members get pinged fast when new loot drops.";
  path = path || "/";
  return "<!DOCTYPE html><html lang=\"en\"><head>" +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
    "<title>" + esc(title) + "</title>" +
    '<meta name="description" content="' + esc(desc) + '">' +
    '<link rel="canonical" href="https://radar.codemeoww.com' + esc(path) + '">' +
    '<meta property="og:type" content="website"><meta property="og:site_name" content="Loot Radar">' +
    '<meta property="og:url" content="https://radar.codemeoww.com' + esc(path) + '">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(desc) + '">' +
    '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(desc) + '">' +
    '<meta property="og:image" content="https://radar.codemeoww.com/logo.svg">' +
    '<meta name="twitter:image" content="https://radar.codemeoww.com/logo.svg">' +
    '<meta name="theme-color" content="#0b0e0c">' +
    '<link rel="icon" href="/logo.svg" type="image/svg+xml">' +
    '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link rel="dns-prefetch" href="https://www.gamerpower.com"><link rel="dns-prefetch" href="https://shared.fastly.steamstatic.com"><link rel="dns-prefetch" href="https://www.clarity.ms">' +
    '<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","ym06hlfz88");</script>' +
    '<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">' +
    "<style>" +
    ":root{--bg:#0b0e0c;--panel:#121614;--line:rgba(255,255,255,.08);--txt:#e8f0ea;--mut:#8a978e;--grn:#22ff88;--gold:#ffb020;--red:#ff5d5d}" +
    "*{box-sizing:border-box;margin:0;padding:0}" +
    "body{background:var(--bg);color:var(--txt);font-family:Inter,system-ui,-apple-system,sans-serif;line-height:1.6}" +
    "h1,h2,h3,.grotesk{font-family:'Space Grotesk',Inter,system-ui,sans-serif}" +
    ".wrap{max-width:1080px;margin:0 auto;padding:0 22px}" +
    "a{color:inherit}" +
    /* nav */
    "nav{position:sticky;top:0;z-index:50;background:#0b0e0c;border-bottom:1px solid var(--line)}" +
    ".nav-in{display:flex;align-items:center;justify-content:space-between;height:58px}" +
    ".logo{font-weight:700;font-size:1.05rem;text-decoration:none;display:flex;align-items:center;gap:9px}" +
    ".logo b{color:var(--grn)}" +
    ".nav-links{display:flex;gap:2px;align-items:center}" +
    ".nav-links a.nl{text-decoration:none;color:var(--mut);font-size:.9rem;font-weight:500;padding:8px 12px;border-radius:6px}" +
    ".nav-links a.nl:hover{color:var(--txt);background:rgba(255,255,255,.05)}" +
    ".nav-links a.nl.active{color:var(--txt);background:rgba(255,255,255,.07)}" +
    ".nav-links .spacer{width:10px}" +
    /* mobile nav strip: links collapse into a scrollable row under the bar (nothing unreachable) */
    ".mnav{display:none}" +
    "@media(max-width:900px){.nav-links a.nl{padding:8px 8px;font-size:.85rem}}" +
    "@media(max-width:720px){.nav-links a.nl{display:none}.nav-links a.nl.keep{display:inline-block;color:#fff}}" +
    /* buttons */
    ".btn{display:inline-block;background:var(--grn);color:#04120a;font-weight:700;text-decoration:none;" +
    "padding:11px 20px;border-radius:6px;font-size:.93rem;border:0;cursor:pointer}" +
    ".btn:hover{background:#5cff9f}" +
    ".btn.ghost{background:transparent;color:var(--txt);border:1px solid var(--line)}" +
    ".btn.ghost:hover{border-color:rgba(255,255,255,.35);color:#fff;background:transparent}" +
    ".btn.small{padding:8px 14px;font-size:.83rem}" +
    ".btn.disabled{background:#1a2440;color:var(--mut);cursor:not-allowed}" +
    /* dashboard */
    ".dash-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:22px;max-width:640px;margin:16px auto 0;text-align:left}" +
    ".dash-card h3{font-size:1.05rem;margin-bottom:2px}" +
    ".dash-sub{color:var(--mut);font-size:.88rem;margin:0 0 16px}" +
    ".dash-sec{font-size:.74rem;font-weight:700;letter-spacing:1.8px;text-transform:uppercase;color:var(--mut);margin:20px 0 10px}" +
    ".pref-row{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 0;border-top:1px solid var(--line)}" +
    ".pref-row:first-of-type{border-top:0}" +
    ".pref-t{font-size:.92rem;font-weight:600}" +
    ".pref-d{font-size:.82rem;color:var(--mut);margin-top:2px;max-width:26rem}" +
    ".tg{position:relative;display:inline-block;width:44px;height:25px;flex:none;cursor:pointer}" +
    ".tg input{opacity:0;width:0;height:0}" +
    ".tg .tr{position:absolute;inset:0;background:#242b25;border:1px solid var(--line);border-radius:999px;transition:.18s}" +
    ".tg .tr:before{content:\"\";position:absolute;width:17px;height:17px;left:3px;top:3px;background:#8a978e;border-radius:50%;transition:.18s}" +
    ".tg input:checked+.tr{background:rgba(34,255,136,.22);border-color:var(--grn)}" +
    ".tg input:checked+.tr:before{transform:translateX(19px);background:var(--grn)}" +
    ".chips{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0 4px}" +
    ".chip{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.06);border:1px solid var(--line);color:var(--txt);border-radius:999px;padding:5px 6px 5px 13px;font-size:.84rem}" +
    ".chip button{background:none;border:0;color:var(--mut);font-size:1rem;line-height:1;cursor:pointer;padding:0 6px 0 0}" +
    ".chip button:hover{color:var(--red)}" +
    ".combo{position:relative}" +
    ".combo input{width:100%;background:#0b0e0c;border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:10px 12px;font-size:.9rem;font-family:inherit}" +
    ".combo input:focus{outline:none;border-color:rgba(255,255,255,.35)}" +
    ".combo-drop{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#141917;border:1px solid var(--line);border-radius:8px;max-height:220px;overflow:auto;z-index:20;display:none;box-shadow:0 12px 32px rgba(0,0,0,.5)}" +
    ".combo-drop.open{display:block}" +
    ".combo-opt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:0;color:var(--txt);padding:10px 12px;font-size:.9rem;cursor:pointer;font-family:inherit}" +
    ".combo-opt:hover{background:rgba(255,255,255,.05)}" +
    ".combo-opt img{width:46px;height:26px;object-fit:cover;border-radius:4px;background:#0a0d0a;flex:none}" +
    ".combo-opt .pr{margin-left:auto;color:var(--txt);font-size:.82rem;flex:none}" +
    ".combo-empty{padding:12px;color:var(--mut);font-size:.86rem}" +
    ".wl-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:8px;margin-bottom:8px;background:#0d100d}" +
    ".wl-row .t{font-size:.9rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".wl-row button{background:none;border:0;color:var(--mut);font-size:1.2rem;cursor:pointer;line-height:1;flex:none;padding:2px 4px}" +
    ".wl-row button:hover{color:var(--red)}" +
    ".fld{background:#0b0e0c;border:1px solid var(--line);border-radius:8px;color:var(--txt);padding:10px 12px;font-size:.9rem;font-family:inherit}" +
    ".fld:focus{outline:none;border-color:rgba(255,255,255,.35)}" +
    /* hero */
    ".hero{padding:42px 0 4px}" +
    ".overline{font-size:.74rem;font-weight:700;letter-spacing:2.2px;text-transform:uppercase;color:var(--mut)}" +
    ".hero h1{font-size:clamp(1.9rem,4.4vw,2.7rem);line-height:1.12;letter-spacing:-.5px;margin:10px 0 12px;max-width:22em}" +
    ".hero p.sub{color:var(--mut);font-size:1.02rem;max-width:38rem;margin-bottom:22px}" +
    ".hero-cta{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px}" +
    /* page heads */
    ".pagehead{padding:36px 0 2px}" +
    ".pagehead h1{font-size:clamp(1.6rem,3.6vw,2.2rem);letter-spacing:-.5px;margin:10px 0 10px}" +
    ".pagehead p{color:var(--mut);max-width:42rem}" +
    /* sections */
    ".sec-head{display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap;row-gap:6px;margin:32px 0 14px}" +
    ".sec-head h2{font-size:.92rem;font-weight:700;letter-spacing:2px;text-transform:uppercase}" +
    "a.more{font-size:.85rem;color:var(--mut);text-decoration:none;white-space:nowrap}" +
    "a.more:hover{color:var(--txt)}" +
    ".sec-sub{color:var(--mut);margin:0 0 18px;max-width:44rem;font-size:.95rem}" +
    /* deal rows */
    ".dealrows{display:flex;flex-direction:column;gap:8px}" +
    ".dealrow{display:flex;align-items:center;gap:14px;background:var(--panel);border:1px solid var(--line);" +
    "border-radius:8px;padding:8px 16px 8px 8px;text-decoration:none}" +
    ".dealrow:hover{border-color:rgba(255,255,255,.16);background:#161c17}" +
    ".dealrow img{width:140px;aspect-ratio:16/7;object-fit:cover;border-radius:4px;background:#0a0d0a;flex:none}" +
    ".dealrow .t{flex:1;min-width:0}" +
    ".dealrow .t h3{font-size:.98rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
    ".dealrow .t .store{font-size:.78rem;color:var(--mut)}" +
    ".dealrow .pct{background:rgba(34,255,136,.13);color:#22ff88;font-weight:800;font-size:1.05rem;padding:8px 10px;border-radius:6px;flex:none}" +
    ".dealrow .prices{text-align:right;flex:none;min-width:78px}" +
    ".dealrow .prices .old{display:block;color:var(--mut);font-size:.78rem;text-decoration:line-through}" +
    ".dealrow .prices .new{color:#fff;font-weight:800;font-size:1.15rem}" +
    /* deal rows: mobile wraps badge+prices under the title so the title column never starves */
    "@media(max-width:560px){" +
    ".dealrow{flex-wrap:wrap;gap:10px;padding:10px}" +
    ".dealrow img{width:88px}" +
    ".dealrow .t{flex:1 1 calc(100% - 98px);min-width:0}" +
    ".dealrow .t h3{white-space:normal;font-size:.9rem;line-height:1.35;overflow:hidden;max-height:2.7em;overflow-wrap:break-word;text-overflow:clip}" +
    ".dealrow .pct{font-size:.88rem;padding:6px 9px;margin-left:98px}" +
    ".dealrow .prices{min-width:0;display:flex;align-items:baseline;gap:8px;text-align:left}" +
    "}" +
    /* freebie cards */
    ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}" +
    ".card{background:var(--panel);border:1px solid var(--line);border-radius:8px;overflow:hidden;display:flex;flex-direction:column}" +
    ".card:hover{border-color:rgba(255,255,255,.16)}" +
    ".thumb{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;background:#0a0d0a}" +
    ".thumbwrap{position:relative}" +
    ".freetag{position:absolute;top:10px;left:10px;background:#fff;color:#0b0e14;font-size:.68rem;font-weight:800;letter-spacing:1px;padding:4px 10px;border-radius:6px;text-transform:uppercase;box-shadow:0 2px 10px rgba(0,0,0,.45)}" +
    ".fmeta{font-size:.8rem;color:var(--mut);margin:0}" +
    ".fmeta .worth{color:var(--gold)}" +
    ".fmeta .fresh{color:#22ff88;font-weight:700}" +
    ".fmeta .ends{font-variant-numeric:tabular-nums}" +
    ".fmeta .ends.soon{color:#ffb020;font-weight:700}" +
    ".fmeta .ends.crit{color:#ff8a8a;font-weight:700;animation:lrblink 1.4s infinite}" +
    ".card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:8px;flex:1}" +
    ".card h3{font-size:.98rem;line-height:1.35;font-weight:600}" +
    ".desc{font-size:.85rem;color:var(--mut)}" +
    ".badges{display:flex;gap:6px;flex-wrap:wrap}" +
    ".badge{font-size:.68rem;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:4px;text-transform:uppercase}" +
    ".badge.free{background:rgba(255,255,255,.12);color:#fff}" +
    ".badge.worth{background:rgba(255,176,32,.12);color:var(--gold)}" +
    ".badge.deal{background:rgba(255,93,93,.12);color:var(--red)}" +
    ".badge.ends{background:rgba(255,176,32,.10);color:#ffd27a;font-variant-numeric:tabular-nums}" +
    ".badge.ends.soon{background:rgba(255,176,32,.18);color:#ffb020}" +
    ".badge.ends.crit{background:rgba(255,93,93,.16);color:#ff8a8a;animation:lrblink 1.4s infinite}" +
    "@keyframes lrblink{50%{opacity:.5}}" +
    ".badge.new{background:rgba(34,255,136,.14);color:#22ff88}" +
    ".sec-head.urgent h2{color:#ff8a8a}" +
    ".hero-urgency{margin:4px 0 26px;color:var(--mut);font-size:.92rem}" +
    ".hero-urgency b{color:#ff8a8a}" +
    ".card-foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:4px}" +
    ".plat{font-size:.78rem;color:var(--mut)}" +
    ".price s{color:var(--mut);font-size:.85rem;margin-right:6px}" +
    ".price b{color:#fff;font-size:1.02rem}" +
    ".empty{color:var(--mut);padding:24px;border:1px dashed var(--line);border-radius:8px;text-align:center}" +
    ".divider{height:1px;background:var(--line);margin:6px 0}" +
    /* pricing */
    ".plans{display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:840px;margin:26px auto 0}" +
    "@media(max-width:700px){.plans{grid-template-columns:1fr}}" +
    ".plan{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:28px}" +
    ".plan.pro{border-color:rgba(34,255,136,.45)}" +
    ".plan h3{font-size:1.1rem;margin-bottom:4px;display:flex;align-items:center;gap:10px}" +
    ".plan .p{font-family:'Space Grotesk';font-size:2.2rem;font-weight:700;margin:10px 0 2px}" +
    ".plan .p small{font-size:.9rem;color:var(--mut);font-family:Inter;font-weight:400}" +
    ".plan .per{color:var(--mut);font-size:.87rem}" +
    ".plan ul{list-style:none;margin:16px 0 22px;display:grid;gap:9px}" +
    ".plan li{font-size:.92rem;color:var(--mut);padding-left:24px;position:relative}" +
    ".plan li::before{content:\"✓\";position:absolute;left:0;color:var(--txt);font-weight:700}" +
    ".plan li.no{opacity:.5}.plan li.no::before{content:\"–\";color:var(--mut)}" +
    ".plan .fine{margin-top:14px;font-size:.8rem;color:var(--mut)}" +
    ".home-plans{margin:18px auto 8px}" +
    /* homepage question links */
    /* faq */
    ".faqwrap{max-width:760px;margin-top:22px}" +
    ".home-faq{margin:16px auto 0}" +
    "details{background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:16px 18px;margin-bottom:10px}" +
    "summary{cursor:pointer;font-weight:600;font-size:.95rem}" +
    "details p{color:var(--mut);font-size:.9rem;margin-top:8px}" +
    "details a{color:var(--txt);text-decoration:underline;text-decoration-color:rgba(255,255,255,.35);text-underline-offset:2px}" +
    "details a:hover{text-decoration-color:var(--txt)}" +
    /* legal pages */
    ".legal{max-width:780px;margin-top:20px}" +
    ".legal h2{font-size:1.08rem;margin:28px 0 8px}" +
    ".legal p,.legal li{color:var(--mut);font-size:.93rem;margin-bottom:10px}" +
    ".legal ul,.legal ol{margin:8px 0 14px 22px}" +
    ".legal strong{color:var(--txt)}" +
    ".legal a{color:var(--txt);text-decoration:underline;text-decoration-color:rgba(255,255,255,.35);text-underline-offset:2px}" +
    ".legal a:hover{text-decoration-color:var(--txt)}" +
    /* api docs */
    "code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.85em;background:#161c17;border:1px solid var(--line);border-radius:4px;padding:2px 6px}" +
    "pre{background:#0d100d;border:1px solid var(--line);border-radius:8px;padding:16px;overflow:auto;font-size:.82rem;margin:12px 0;line-height:1.55}" +
    "pre code{background:none;border:0;padding:0;font-size:1em;color:#c9d4cc}" +
    ".keybox{display:flex;align-items:center;gap:10px;background:#0d100d;border:1px solid var(--line);border-radius:8px;padding:12px 14px;margin:12px 0;flex-wrap:wrap}" +
    ".keybox code{font-size:.95rem;word-break:break-all}" +
    ".apikey-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:6px;margin-bottom:8px;background:#0d100d;font-size:.9rem}" +
    /* forms */
    ".field{flex:1;min-width:220px;padding:12px 14px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--txt);font-size:.95rem}" +
    ".field:focus{outline:none;border-color:rgba(255,255,255,.35)}" +
    /* footer */
    "footer{border-top:1px solid var(--line);padding:30px 0;margin-top:44px;color:var(--mut);font-size:.86rem}" +
    ".foot-in{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center}" +
    ".foot-links{display:flex;gap:18px;flex-wrap:wrap}" +
    ".foot-base{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:20px;padding-top:16px;border-top:1px solid var(--line);font-size:.78rem}" +
    "footer a{color:var(--mut);text-decoration:none}" +
    "footer a:hover{color:var(--txt)}" +
    ".prices,.p,.hero-meta,.pct,.hero .sub b{font-variant-numeric:tabular-nums}" +
    "</style>" + (headExtra || "") + "</head><body>";
}

export function navHTML(active) {
  function nl(path, label) {
    return '<a class="nl' + (active === path ? " active" : "") + '" href="' + path + '">' + label + "</a>";
  }
  function mnl(path, label) {
    return '<a class="' + (active === path ? "on" : "") + '" href="' + path + '">' + label + "</a>";
  }
  return '<nav><div class="wrap nav-in">' +
    '<a class="logo grotesk" href="/"><img src="/logo.svg" width="24" height="24" alt="Loot Radar logo" style="border-radius:6px"><span>Loot<b>Radar</b></span></a>' +
    '<div class="nav-links">' +
    nl("/", "Home") + nl("/deals", "Deals") + nl("/freebies", "Freebies") + nl("/faq", "FAQ") +
    '<span class="spacer"></span><a class="nl keep" id="nav_login" href="/login">Log in</a>' +
    '<a class="btn small" id="nav_gopro" href="/pricing">Go Pro</a>' +
    "</div></div></nav>" +
    "<script>(function(){fetch('/api/auth/me').then(function(r){return r.json();}).then(function(d){" +
    "if(d&&d.email){var li=document.getElementById('nav_login');" +
    "if(li)li.outerHTML='<a class=\"nl keep\" id=\"nav_dash\" href=\"/pro\">Dashboard</a>';" +
    "var gp=document.getElementById('nav_gopro');if(gp)gp.remove();}" +
    "}).catch(function(){});})();</script>";
}

export function footHTML() {
  return "<footer><div class=\"wrap foot-in\">" +
    '<span class="grotesk"><img src="/logo.svg" width="18" height="18" alt="Loot Radar logo" style="vertical-align:-3px;margin-right:8px;border-radius:4px">Loot<b style="color:var(--grn)">Radar</b></span>' +
    '<span class="foot-links"><a href="/pricing">Pricing</a>' +
    '<a href="/about">About</a><a href="/api/docs">API</a>' +
    '<a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a>' +
    '<a href="mailto:lootradar@codemeoww.com">Support</a></span>' +
    "</div>" +
    '<div class="wrap foot-base"><span>© 2026 Loot Radar</span><span>Built &amp; run by Muse AI.</span></div>' +
    "</footer>";
}

export function homeHTML(freebies, deals) {
  const topDeals = deals.slice(0, 8);
  const nowMs = Date.now();
  // FOMO split: anything expiring within 48h gets a "Last call" strip on top,
  // sorted soonest-first (getFreebies already sorts by expiry).
  const urgent = freebies.filter(f => { const t = endsMs(f); return t && t > nowMs && t - nowMs <= 48 * 36e5; });
  const rest = freebies.filter(f => urgent.indexOf(f) < 0);
  const topFree = rest.slice(0, 8);
  const urgLine = urgent.length
    ? '<p class="hero-urgency">⚡ <b>' + urgent.length + '</b> free game' + (urgent.length > 1 ? "s vanish" : " vanishes") + ' in the next 48 hours · <span data-sweep>next sweep soon</span></p>'
    : '<p class="hero-urgency"><span data-sweep>next sweep soon</span> · new drops land every 20 minutes</p>';
  return navHTML("/") +
  '<div class="wrap"><header class="hero">' +
    '<div class="overline">Free games · steep discounts</div>' +
    "<h1>Free PC games, before they're gone.</h1>" +
    '<p class="sub">Right now: <b>' + freebies.length + '</b> games free to claim, <b>' + deals.length + "</b> Steam discounts tracked live. " +
    "We sweep 14 stores every 20 minutes, so when a game goes free or a price craters, it's here within minutes. Browsing is free forever.</p>" +
    '<div class="hero-cta"><a class="btn" href="/freebies">See what\'s free</a>' +
    '<a class="btn ghost" href="/deals">Browse today\'s deals</a></div>' +
    urgLine +
  "</header>" +

  '<div class="sec-head"><h2>Top discounts</h2><a class="more" href="/deals">Browse all deals →</a></div>' +
  '<div class="dealrows">' +
    (topDeals.length ? topDeals.map(dealRow).join("") : '<p class="empty">Deal feed is quiet at the moment.</p>') +
  "</div>" +

  (urgent.length ?
    '<div class="sec-head urgent"><h2>Last call</h2><span class="more">gone within 48 hours</span></div>' +
    '<div class="grid">' + urgent.map(freebieCard).join("") + "</div>" : "") +

  '<div class="sec-head"><h2>Free to claim</h2><a class="more" href="/freebies">Browse all freebies →</a></div>' +
  '<div class="grid">' +
    (topFree.length ? topFree.map(freebieCard).join("") : '<p class="empty">No freebies right now. Check back soon.</p>') +
  "</div>" +

  '<div class="sec-head"><h2>Simple pricing</h2><a class="more" href="/pricing">Compare plans →</a></div>' +
  '<p class="sec-sub">Browsing is free forever. Pro adds alerts.</p>' +
  '<div class="plans home-plans">' +
    '<div class="plan"><h3>Scout</h3><div class="p">$0<small> / forever</small></div>' +
    '<div class="per">Every deal and freebie on this site. No account needed.</div>' +
    '<div style="margin-top:18px"><a class="btn ghost" href="/freebies">Browse free loot</a></div></div>' +
    '<div class="plan pro"><h3>Hunter <span class="badge free">Pro</span></h3>' +
    '<div class="p">$4<small> / month</small></div><div class="per">or <b>$39/year</b> · cancel anytime</div>' +
    '<div class="per" style="margin-top:10px">Fast Telegram alerts (usually within 20 minutes), one morning email digest, wishlist price watch, and API access.</div>' +
    '<div style="margin-top:18px"><a class="btn" href="/pricing">Get Pro alerts</a></div></div>' +
  "</div>" +

  '<div class="sec-head"><h2>Questions, answered</h2><a class="more" href="/faq">Full FAQ →</a></div>' +
  homeFaqHTML() +
  "</div>" + COUNTDOWN_JS + footHTML();
}

export function dealsPageHTML(deals) {
  return navHTML("/deals") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Price drops</div><h1>Steam deals</h1>' +
    "<p>" + deals.length + " deals tracked, sorted by biggest discount first. Prices refresh every 20 minutes.</p>" +
  "</div>" +
  '<div class="dealrows" style="margin-top:20px">' +
    (deals.length ? deals.map(dealRow).join("") : '<p class="empty">Deal feed is quiet at the moment.</p>') +
  "</div></div>" + footHTML();
}

export function freebiesPageHTML(freebies) {
  return navHTML("/freebies") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">On the radar</div><h1>Free to claim</h1>' +
    "<p>Every free PC game live right now, but not for long. Claim buttons go straight to the source, no catch.</p>" +
  "</div>" +
  '<div class="sec-head"><h2>' + freebies.length + ' live now</h2><a class="more" href="/api/docs">API docs →</a></div>' +
  '<div class="grid">' +
    (freebies.length ? freebies.map(freebieCard).join("") : '<p class="empty">No freebies right now. Check back soon.</p>') +
  "</div></div>" + COUNTDOWN_JS + footHTML();
}

export function pricingPageHTML() {
  return navHTML("/pricing") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Pricing</div><h1>Free forever. Pro for loot hunters.</h1>' +
    '<p>Browse every freebie and deal free. Pro alerts you fast, before freebies expire.</p>' +
  "</div>" +
  '<div class="plans">' +
    '<div class="plan"><h3>Scout</h3><div class="p">$0<small> / forever</small></div>' +
    '<div class="per">For casual browsers</div>' +
    "<ul><li>Live freebies feed</li><li>Steam deals feed</li><li>New drops every 20 min</li>" +
    '<li class="no">Fast loot alerts</li><li class="no">Email digest</li></ul>' +
    '<a class="btn ghost" href="/freebies">Browse free loot</a></div>' +
    '<div class="plan pro"><h3>Hunter <span class="badge free">Pro</span></h3>' +
    '<div class="p">$4<small> / month</small></div><div class="per">or <b>$39/yr</b> ($3.25/mo). Two months free.</div>' +
    "<ul><li>Everything in Scout</li><li>Fast Telegram alerts</li><li>Daily email digest</li>" +
    "<li>Every freebie + every deal matching your alert settings</li><li>Wishlist price watch</li><li>Pro API access for the deals & freebies feeds</li><li>Support indie radar development</li></ul>" +
    '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
    '<a class="btn" href="https://checkout.dodopayments.com/buy/pdt_0No6epRAEDlFPuD8vFMT3?quantity=1&redirect_url=https%3A%2F%2Fradar.codemeoww.com%2Fthanks">Monthly: $4/mo</a>' +
    '<a class="btn ghost" href="https://checkout.dodopayments.com/buy/pdt_0No6f9EaIF1CMH6wKBTVl?quantity=1&redirect_url=https%3A%2F%2Fradar.codemeoww.com%2Fthanks">Yearly: $39/yr</a></div>' +
    '<div class="fine">Secure checkout via DodoPayments · cancel anytime</div></div>' +
  "</div></div>" + footHTML();
}

export function aboutPageHTML() {
  return navHTML("/about") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">About</div><h1>A radar for game loot.</h1>' +
  '</div><div class="legal">' +
  "<p>Loot Radar is a deal tracker for PC games. It watches storefronts and deal feeds around the clock and surfaces two things: <strong>free-to-claim games</strong> and <strong>steep PC discounts</strong> across 14 storefronts, including Steam, Epic, GOG and IndieGala.</p>" +
  "<h2>How it works</h2>" +
  "<p>Every 20 minutes the radar sweeps its sources: the GamerPower giveaway feed for free games and deal feeds across 14 PC storefronts for price drops. Everything it finds is shown live and free on this site.</p>" +
  "<h2>What Pro is for</h2>" +
  "<p>Freebies vanish in hours. Pro members get a fast Telegram message, usually within 20 minutes of a drop, plus one email digest every morning and a wishlist price watch. That's the whole business model: no ads, no data selling.</p>" +
  "<h2>Who runs it</h2>" +
  "<p>Loot Radar is built and run by <strong>Muse</strong>, codemeoww's AI assistant, for <strong>codemeoww</strong>, a solo developer also behind <a href=\"https://ottergames.org\">OtterGames.org</a>, a free browser-games portal. Questions, feedback or a deal tip? Write to <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a>. Every email is read by a human.</p>" +
  "</div></div>" + footHTML();
}

export function termsPageHTML() {
  return navHTML("/terms") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Legal</div><h1>Terms of service</h1>' +
    '<p>Last updated: September 2026. By using Loot Radar you agree to these terms.</p>' +
  '</div><div class="legal">' +
  "<h2>1. The service</h2>" +
  "<p>Loot Radar aggregates publicly available information about free PC games and PC game discounts, and offers optional paid alert subscriptions (\"Pro\"). Deal and freebie data comes from third-party feeds; we make no guarantee about the accuracy, availability or duration of any listed game or price.</p>" +
  "<h2>2. Pro subscriptions</h2>" +
  "<p>Pro is billed monthly ($4) or yearly ($39) through our payment provider, DodoPayments. Subscriptions renew automatically until cancelled. Cancel anytime from the billing link in your DodoPayments receipt email. Pro stays active until the end of the paid period.</p>" +
  "<h2>3. No refunds</h2>" +
  "<p><strong>All Pro sales are final and non-refundable.</strong> Because Pro is an instantly delivered digital service, we do not offer refunds, partial refunds or credits for any reason, including unused time after cancellation. See the <a href=\"/refunds\">refund policy</a>.</p>" +
  "<h2>4. Fair use of the API</h2>" +
  "<p>Pro members may use the Loot Radar API (documented at <a href=\"/api/docs\">/api/docs</a>) for personal projects and bots, within the published rate limits (600 requests/hour per key). Do not resell raw API access, scrape the site aggressively, or share your API key publicly. We may revoke keys or suspend accounts that abuse the service.</p>" +
  "<h2>5. Acceptable use</h2>" +
  "<p>Don't use Loot Radar to break the law, harass anyone, or interfere with the service or its sources. One account per person; don't share your login or API keys.</p>" +
  "<h2>6. Liability</h2>" +
  "<p>The service is provided \"as is\". We are not liable for expired deals, missed freebies, or any loss arising from your use of the site, alerts or API. Our total liability is limited to what you paid us in the last 12 months.</p>" +
  "<h2>7. Changes</h2>" +
  "<p>We may update these terms; continued use after changes means you accept them. Questions: <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a>.</p>" +
  "</div></div>" + footHTML();
}

export function privacyPageHTML() {
  return navHTML("/privacy") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Legal</div><h1>Privacy policy</h1>' +
    '<p>Last updated: September 2026. Short version: we collect the minimum needed to run alerts, and we never sell your data.</p>' +
  '</div><div class="legal">' +
  "<h2>What we collect</h2>" +
  "<ul>" +
  "<li><strong>Email address</strong>: for login (magic links), the daily digest, and tying your Pro subscription to your account.</li>" +
  "<li><strong>Telegram chat ID</strong>: only if you connect Telegram, so alerts can reach you.</li>" +
  "<li><strong>Wishlist titles</strong>: the games you add to your price watch.</li>" +
  "<li><strong>Payment details</strong>: handled entirely by DodoPayments; we only store your subscription status, plan and renewal date.</li>" +
  "</ul>" +
  "<h2>What we don't do</h2>" +
  "<p>No ads, and we never sell or rent your data. Pro subscriptions are the entire business model.</p>" +
  "<h2>Analytics</h2>" +
  "<p>We use Microsoft Clarity to understand how visitors use the site: anonymous heatmaps and session replays that help us fix confusing pages. Clarity sets its own cookies and collects device, browser and interaction data under <a href=\"https://privacy.microsoft.com/en-us/privacystatement\">Microsoft's privacy statement</a>. Your email, wishlist, Telegram details and API keys stay in our database.</p>" +
  "<h2>Cookies</h2>" +
  "<p>Our own cookie: <code>lr_sess</code>, your login session (HTTP-only, 30 days). Microsoft Clarity sets its own analytics cookies, as described above.</p>" +
  "<h2>Where data lives</h2>" +
  "<p>Data is stored on Cloudflare's D1 database and KV store. We keep alert-dedup records for 180 days and login tokens only until they expire or are used.</p>" +
  "<h2>Your rights</h2>" +
  "<p>Write to <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a> to get a copy of your data or to have it deleted. Deleting your account ends Pro alerts; active subscriptions still need cancelling via DodoPayments.</p>" +
  "</div></div>" + footHTML();
}

export function refundsPageHTML() {
  return navHTML("/refunds") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Legal</div><h1>Refund policy</h1>' +
    '<p>Last updated: September 2026.</p>' +
  '</div><div class="legal">' +
  "<h2>No refunds</h2>" +
  "<p><strong>All Loot Radar Pro sales are final and non-refundable.</strong> We do not offer refunds, partial refunds or account credits for monthly or yearly subscriptions, including for unused time after you cancel, or if you forget to cancel before renewal.</p>" +
  "<h2>Why</h2>" +
  "<p>Pro is delivered digitally: alerts start with the next scan (usually within 20 minutes of subscribing), and every alert costs us real money to send. We keep the price low ($4/month) instead of building refund overhead into it.</p>" +
  "<h2>Cancel anytime</h2>" +
  "<p>You can cancel in one click from the billing link in your DodoPayments receipt email. Pro stays active until the end of the paid period. You keep every alert you've paid for.</p>" +
  "<h2>Billing mistakes</h2>" +
  "<p>If you were charged twice or for a plan you never bought, that's a billing error. Write to <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a> and we'll make it right.</p>" +
  "</div></div>" + footHTML();
}

export function apiDocsPageHTML() {
  return navHTML("/api/docs") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">Developers</div><h1>Loot Radar API</h1>' +
    "<p>The same live feeds that power this site, free-to-claim PC games and 70%+ Steam deals, as JSON. <strong>Pro members only.</strong> Get your key on the <a href=\"/pro\" style=\"color:var(--txt);text-decoration:underline;text-decoration-color:rgba(255,255,255,.35)\">Pro dashboard</a>.</p>" +
  '</div><div class="legal">' +
  "<h2>Authentication</h2>" +
  "<p>Pass your key in the <code>X-API-Key</code> header, or as <code>?key=</code>. Keys start with <code>lr_</code>. Keep them secret. One account per person, don't publish your key.</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  https://radar.codemeoww.com/api/deals</code></pre>" +
  "<h2>GET /api/deals</h2>" +
  "<p>Live deal listings. Defaults to Steam deals at 70%+ off, sorted by biggest discount. Steam deals link <strong>straight to the Steam store page</strong>; deals from other stores link through the upstream redirect (their data source only exposes deal IDs, not store URLs).</p>" +
  "<p>Filters: <code>storeID</code> (default 1 = Steam), <code>upperPrice</code>, <code>lowerPrice</code>, <code>title</code>, <code>exact</code>, <code>onSale</code>, <code>steamAppID</code>, <code>metacritic</code>, <code>steamRating</code>, <code>minimumReviewCount</code>, <code>maxAge</code> (1-2500 hours), <code>steamworks</code>, <code>AAA</code>, <code>sortBy</code> (Savings, Price, Title, Metacritic, Release, DealRating, Reviews, ReviewCount, Store, Recent), <code>desc</code>, <code>pageNumber</code>, <code>pageSize</code> (max 60), <code>minSavings</code> (default 70, set 0 to disable). Add <code>output=RSS</code> to get the same feed as raw RSS instead of JSON.</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  \"https://radar.codemeoww.com/api/deals?upperPrice=10&amp;sortBy=Price\"</code></pre>" +
  "<pre><code>{\n  \"count\": 30,\n  \"updated\": \"2026-09-22T03:00:00.000Z\",\n  \"items\": [\n    { \"title\": \"Hollow Knight\", \"store\": \"Steam\", \"storeID\": \"1\",\n      \"price\": \"3.74\", \"was\": \"14.99\", \"off\": 75,\n      \"thumb\": \"https://…\", \"url\": \"https://store.steampowered.com/app/367520/\",\n      \"steamAppID\": \"367520\", \"gameID\": \"12345\" }\n  ]\n}</code></pre>" +
  "<h2>GET /api/deals/{dealID}</h2>" +
  "<p>One deal, looked up by its deal ID: game info, cheaper stores and the all-time cheapest price. Links go straight to the store page.</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  https://radar.codemeoww.com/api/deals/HhzMJAgQYGZ%2BFPpBG%2BRFcuUQZJO3KXvlnyYYGwGUfU%3D</code></pre>" +
  "<h2>GET /api/freebies</h2>" +
  "<p>free-to-claim PC games live right now. Up to 12 items.</p>" +
  "<pre><code>{\n  \"count\": 12,\n  \"updated\": \"2026-09-22T03:00:00.000Z\",\n  \"items\": [\n    { \"title\": \"Shogun Showdown\", \"worth\": \"$14.99\",\n      \"thumb\": \"https://…\", \"url\": \"https://…\", \"desc\": \"…\",\n      \"platforms\": \"PC\", \"ends\": \"2026-10-01\" }\n  ]\n}</code></pre>" +
  "<h2>GET /api/games?title=…</h2>" +
  "<p>Search games by title or Steam app ID. At least one of <code>title</code> / <code>steamAppID</code> is required. <code>limit</code> (max 60) and <code>exact</code> are optional. Pass <code>ids</code> (up to 25 comma-separated game IDs) instead to fetch several games at once.</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  \"https://radar.codemeoww.com/api/games?title=portal\"</code></pre>" +
  "<pre><code>{\n  \"count\": 3,\n  \"items\": [\n    { \"gameID\": \"10229\", \"title\": \"Portal\", \"cheapest\": \"0.99\",\n      \"thumb\": \"https://…\", \"steamAppID\": \"400\",\n      \"url\": \"https://store.steampowered.com/app/400/\",\n      \"details\": \"https://radar.codemeoww.com/api/games/10229\" }\n  ]\n}</code></pre>" +
  "<h2>GET /api/games/{id}</h2>" +
  "<p>Full details for one game: current cheapest price, all-time cheapest, and every live deal with direct store links.</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  https://radar.codemeoww.com/api/games/10229</code></pre>" +
  "<h2>GET /api/stores</h2>" +
  "<p>Directory of tracked stores: id, name and whether the store is active. Add <code>?lastChange=1</code> to get each store's last update time instead (handy for skipping a full refresh).</p>" +
  "<pre><code>curl -H \"X-API-Key: lr_your_key_here\" \\\n  https://radar.codemeoww.com/api/stores</code></pre>" +
  "<h2>Rate limits</h2>" +
  "<p><strong>600 requests per hour per key.</strong> Exceeding it returns <code>429</code>. Deal data refreshes every ~20 minutes, so polling faster than that wastes your quota. Cache the response.</p>" +
  "<h2>Errors</h2>" +
  "<p><code>400</code>: bad parameter (e.g. <code>maxAge</code> out of range, or no <code>title</code>/<code>steamAppID</code>/<code>ids</code> on /api/games). <code>401</code>: missing, invalid, revoked key, or the key's owner isn't Pro anymore. <code>404</code>: unknown deal ID. <code>429</code>: rate limit. <code>502</code>: upstream feed hiccup, retry shortly. Every 401 body links back here.</p>" +
  "<h2>Keys</h2>" +
  "<p>Create up to 5 keys and revoke old ones from the <a href=\"/pro\">Pro dashboard</a>. Lost your key? Revoke it and make a new one. Old keys stop working immediately.</p>" +
  "</div></div>" + footHTML();
}

export function faqItem(id, q, a) {
  return '<details id="' + id + '"><summary>' + q + "</summary><p>" + a + "</p></details>";
}

// FAQ content lives here once: visible HTML and JSON-LD are generated from the
// same array so they can never drift (2026 guideline: schema must match visible
// content exactly). Questions are phrased the way people, and AI assistants,
// actually ask them.
export function faqData() {
  return [
    ["q1", "What is Loot Radar?",
      "Loot Radar is a PC game deals tracker. It tracks discounts across 14 PC storefronts, including Steam, Epic, GOG and IndieGala, plus free-to-claim game giveaways, scanning for new loot every 20 minutes."],
    ["q2", "How does Loot Radar work?",
      "Every 20 minutes the radar sweeps deal feeds and giveaway listings. Everything it finds is shown live and free on this site. Pro members also get fast Telegram alerts (usually within 20 minutes), plus one email digest every morning."],
    ["q3", "Is Loot Radar free?",
      "Yes. Browsing every deal and freebie on the site is free forever, no account needed. Loot Radar Pro ($4/month or $39/year) pays for fast Telegram alerts (usually within 20 minutes), the morning email digest, wishlist price tracking and API access."],
    ["q4", "What is Loot Radar Pro?",
      "Pro is the paid tier for loot hunters: fast Telegram alerts for every free-to-claim game and every deal matching your alert settings (your stores, 50-95% off, all deals or wishlist only), one email digest each morning, wishlist price watch, and a Pro API key. $4/month or $39/year, cancel anytime."],
    ["q5", "How do I claim a free PC game?",
      "Open the <a href=\"/freebies\">Freebies</a> page, pick a game and hit Claim. The button takes you straight to the source (Epic, Steam, GOG, IndieGala and more). Most giveaways last hours to days, so Pro alerts help you grab them before they expire."],
    ["q6", "Which stores does Loot Radar track?",
      "Free games come from Steam, Epic Games, GOG, IndieGala, Ubisoft and other storefronts and publishers. Discount alerts cover 14 PC storefronts. You pick the stores and set your own minimum discount from 50% to 95%. The free site feed shows Steam deals."],
    ["q7", "How often are deals and freebies updated?",
      "The radar scans its sources every 20 minutes, and the site updates with each scan. Pro members usually hear about new loot within 20 minutes, well before most freebies expire."],
    ["q8", "How do the Telegram alerts work?",
      "Log in with the email you used at checkout, open your <a href=\"/pro\">Pro dashboard</a> and tap <b>Connect Telegram</b>. It takes about ten seconds. When new loot drops you get <b>one message</b> listing everything new (usually within 20 minutes), capped at 8 items per scan so you're never spammed. The same drop is never alerted twice to the same Telegram account. To switch Telegram accounts, hit <b>Disconnect / switch account</b> on the dashboard, or send /unlink in Telegram, then connect the new one."],
    ["q13", "Can I choose what alerts I get?",
      "Yes. On the <a href=\"/pro\">Pro dashboard</a> you can switch free-game and discount alerts on or off, pick from all 14 tracked stores (Steam, Epic, GOG and IndieGala are on by default), set a minimum discount from 50% to 95%, or limit discounts to your wishlist games only. The same controls work from Telegram: send /prefs to see your settings, /help for the full command list."],
    ["q9", "How many emails will I get?",
      "Exactly one per day: the morning digest at 9 AM IST, with wishlist price hits, fresh freebies and the biggest deals. The only other email is a magic login link when you request one. We never send per-drop emails, and there is no newsletter. Prefer Telegram only? Turn the digest off anytime from the Email section of your <a href=\"/pro\">Pro dashboard</a>."],
    ["q10", "What can I do with the Loot Radar API?",
      "Pro members get an API key from the <a href=\"/pro\">dashboard</a> for live deals, freebies, game search and store listings as JSON, documented at <a href=\"/api/docs\">/api/docs</a>. Up to 5 keys, 600 requests/hour per key. Use it for bots and personal dashboards."],
    ["q11", "How do I cancel Loot Radar Pro?",
      "Cancel anytime from the billing link in your DodoPayments receipt email. Pro stays active until the end of the paid period."],
    ["q12", "Do you offer refunds?",
      "<b>No. All Pro sales are final and non-refundable</b>. Including unused time after cancellation. Billing errors are different: if you were charged twice, email <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a> and we'll make it right. See the full <a href=\"/refunds\">refund policy</a>."],
    ["q14", "Who runs Loot Radar?",
      "Loot Radar is built and run by <b>Muse</b>, the AI assistant, for solo developer codemeoww (also behind <a href=\"https://ottergames.org\">OtterGames.org</a>). Support: <a href=\"mailto:lootradar@codemeoww.com\">lootradar@codemeoww.com</a>. Every message is read by a human."],
  ];
}

export function faqJSONLD() {
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData().map(([id, q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a.replace(/<[^>]+>/g, "") },
    })),
  };
  return '<script type="application/ld+json">' + JSON.stringify(data).replace(/</g, "\\u003c") + "</script>";
}

export function homeFaqHTML() {
  // Homepage: single-column click-to-expand accordion; /faq has the full list.
  const data = faqData();
  const items = ["q1", "q3", "q4", "q6", "q8", "q11"].map(function (id) {
    const f = data.find(function (x) { return x[0] === id; });
    return f ? faqItem("h" + id, f[1], f[2]) : "";
  }).join("");
  return '<div class="faqwrap home-faq">' + items + "</div>";
}

export function faqPageHTML() {
  const items = faqData().map(([id, q, a]) => faqItem(id, q, a));
  return navHTML("/faq") +
  '<div class="wrap"><div class="pagehead">' +
    '<div class="overline">FAQ</div><h1>Questions, answered</h1>' +
    '<p>What Loot Radar is, how alerts work, Pro billing, the API: the stuff people ask.</p>' +
  "</div>" +
  '<div class="faqwrap">' + items.join("") + "</div></div>" + faqJSONLD() + footHTML();
}

export function loginHTML() {
  return navHTML("/login") +
  '<div class="wrap" style="max-width:520px"><div class="pagehead">' +
    '<div class="overline">Pro login</div><h1>Check your loot status</h1>' +
    '<p>Enter the email you used at checkout. We\'ll send a magic login link. No password needed.</p>' +
  "</div>" +
  '<form id="lf" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
  '<input id="le" class="field" type="email" required placeholder="you@example.com">' +
  '<button class="btn" type="submit">Send link</button></form>' +
  '<p id="lm" class="sec-sub" style="margin-top:14px"></p>' +
  "<script>document.getElementById('lf').addEventListener('submit',async function(e){e.preventDefault();var em=document.getElementById('le').value;var m=document.getElementById('lm');m.textContent='Sending…';try{await fetch('/api/auth/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em})});m.textContent='Link sent! Check your inbox (and spam folder). One link per 15 minutes. Use the latest email.';}catch(_){m.textContent='Something went wrong. Try again.';}});</script>" +
  "</div>" + footHTML();
}

export function thanksHTML(prefill) {
  const em = esc(prefill || "");
  return navHTML("/thanks") +
  '<div class="wrap" style="max-width:520px"><div class="pagehead">' +
    '<div class="overline">Payment complete</div><h1>You are Pro now</h1>' +
    '<p>Your subscription is active. One last step: log in with the email you used at checkout, and your Pro dashboard unlocks.</p>' +
  "</div>" +
  '<form id="lf" style="display:flex;gap:10px;flex-wrap:wrap;margin-top:20px">' +
  '<input id="le" class="field" type="email" required placeholder="you@example.com" value="' + em + '">' +
  '<button class="btn" type="submit">Send link</button></form>' +
  '<p id="lm" class="sec-sub" style="margin-top:14px"></p>' +
  '<p class="sec-sub" style="margin-top:14px">Didn\'t land here from Dodo\'s checkout? Log in with your checkout email anyway. Pro is tied to that email.</p>' +
  "<script>document.getElementById('lf').addEventListener('submit',async function(e){e.preventDefault();var em=document.getElementById('le').value;var m=document.getElementById('lm');m.textContent='Sending…';try{await fetch('/api/auth/request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em})});m.textContent='Link sent! Check your inbox (and spam folder). One link per 15 minutes. Use the latest email.';}catch(_){m.textContent='Something went wrong. Try again.';}});</script>" +
  "</div>" + footHTML();
}

export function prefsCard(p) {
  const storeList = JSON.stringify(STORE_PICK_ORDER.map(function (id) { return [id, STORE_NAMES[id]]; }));
  const minOpts = [50, 60, 70, 80, 90].map(function (n) {
    return '<option value="' + n + '"' + (p.min_discount === n ? " selected" : "") + ">" + n + "%+</option>";
  }).join("");
  const tg = function (id, on, title, desc) {
    return '<div class="pref-row"><div><div class="pref-t">' + title + '</div><div class="pref-d">' + desc + "</div></div>" +
      '<label class="tg"><input type="checkbox" id="' + id + '"' + (on ? " checked" : "") + '><span class="tr"></span></label></div>';
  };
  return '<div class="dash-card">' +
    "<h3>Alert preferences</h3>" +
    '<p class="dash-sub">Fast Telegram alerts, one message per scan, only what you pick. You can also change these from Telegram with /prefs.</p>' +
    tg("pf_freebies", p.alert_freebies, "free-to-claim game alerts", "Get pinged the moment a free-to-claim game drops.") +
    tg("pf_deals", p.alert_deals, "Discount alerts", "Price cuts that match your stores, min discount and mode below.") +
    '<div class="dash-sec">Stores for discount alerts</div>' +
    '<p class="dash-sub">Only deals from these stores can trigger an alert. Search to find one, tap to add it.</p>' +
    '<div class="combo" id="store_combo"><input id="store_q" class="fld" type="text" placeholder="Search stores, e.g. Steam" autocomplete="off">' +
    '<div class="combo-drop" id="store_drop"></div></div>' +
    '<div class="chips" id="store_chips"></div>' +
    '<div class="dash-sec">Discount filters</div>' +
    '<div style="display:flex;gap:16px;flex-wrap:wrap">' +
    '<label style="font-size:.88rem;font-weight:600">Min. discount<br><select id="pf_minoff" class="fld" style="margin-top:6px">' + minOpts + "</select></label>" +
    '<label style="font-size:.88rem;font-weight:600">Discounts for<br><select id="pf_mode" class="fld" style="margin-top:6px">' +
    '<option value="all"' + (p.deals_mode === "all" ? " selected" : "") + ">all games</option>" +
    '<option value="wishlist"' + (p.deals_mode === "wishlist" ? " selected" : "") + ">my wishlist only</option></select></label></div>" +
    '<div class="pref-d" style="margin-top:10px">My wishlist only: discount alerts fire only for games on your wishlist. All games: any deal matching your stores and min discount.</div>' +
    '<div class="dash-sec">Email</div>' +
    tg("pf_digest", p.digest_email, "Daily digest email", "One email each morning at 9 AM IST: wishlist price hits, fresh freebies and the biggest deals. Off means alerts stay Telegram-only.") +
    '<div style="margin-top:18px"><button class="btn small" onclick="prefsSave()">Save preferences</button> <span id="pf_msg" class="sec-sub" style="margin-left:8px"></span></div>' +
    "<script>" +
    "var STORE_LIST=" + storeList + ";" +
    "var selStores=" + JSON.stringify(p.deal_stores) + ";" +
    "var storeQ=document.getElementById('store_q'),storeDrop=document.getElementById('store_drop'),storeChips=document.getElementById('store_chips');" +
    "function storeName(id){for(var i=0;i<STORE_LIST.length;i++){if(STORE_LIST[i][0]===id)return STORE_LIST[i][1];}return id;}" +
    "function storeRenderChips(){var h='';for(var i=0;i<selStores.length;i++){h+='<span class=\"chip\">'+storeName(selStores[i])+'<button type=\"button\" data-id=\"'+selStores[i]+'\" onclick=\"storeRm(this)\">&times;</button></span>';}storeChips.innerHTML=h;}" +
    "function storeRm(b){var id=b.getAttribute('data-id');selStores=selStores.filter(function(x){return x!==id;});storeRenderChips();}" +
    "function storeRenderDrop(){var q=storeQ.value.trim().toLowerCase();var h='';for(var i=0;i<STORE_LIST.length;i++){var s=STORE_LIST[i];if(selStores.indexOf(s[0])>=0)continue;if(q&&s[1].toLowerCase().indexOf(q)<0)continue;h+='<button type=\"button\" class=\"combo-opt\" data-id=\"'+s[0]+'\">'+s[1]+'</button>';}storeDrop.innerHTML=h||'<div class=\"combo-empty\">No more stores match.</div>';var btns=storeDrop.querySelectorAll('.combo-opt');for(var j=0;j<btns.length;j++){btns[j].addEventListener('click',function(){selStores.push(this.getAttribute('data-id'));storeQ.value='';storeDrop.classList.remove('open');storeRenderChips();});}}" +
    "storeQ.addEventListener('input',function(){storeRenderDrop();storeDrop.classList.add('open');});" +
    "storeQ.addEventListener('focus',function(){storeRenderDrop();storeDrop.classList.add('open');});" +
    "document.addEventListener('click',function(e){if(!e.target.closest('#store_combo'))storeDrop.classList.remove('open');});" +
    "storeRenderChips();" +
    "async function prefsSave(){var m=document.getElementById('pf_msg');m.textContent='Saving...';" +
    "var body={alert_freebies:document.getElementById('pf_freebies').checked,alert_deals:document.getElementById('pf_deals').checked," +
    "deal_stores:selStores,min_discount:parseInt(document.getElementById('pf_minoff').value,10),deals_mode:document.getElementById('pf_mode').value," +
    "digest_email:document.getElementById('pf_digest').checked};" +
    "try{var r=await fetch('/api/alerts/prefs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});" +
    "var d=await r.json();m.textContent=d.ok?'Saved':('Could not save: '+(d.error||'try again'));}catch(e){m.textContent='Could not save, try again';}}" +
    "</script>" +
    "</div>";
}

export function wishlistCard(items) {
  const rows = items.map(function (t) {
    return '<div class="wl-row"><span class="t">' + esc(t) + "</span>" +
      '<button onclick="wlDel(this)" data-t="' + esc(t) + '" title="Remove">&times;</button></div>';
  }).join("");
  return '<div class="dash-card">' +
    "<h3>Wishlist price watch</h3>" +
    '<p class="dash-sub">Search for a game and add it. Your daily digest shows the cheapest price we can find for each one.</p>' +
    '<div class="combo" id="wl_combo" style="margin-bottom:14px"><input id="wlt" class="fld" type="text" maxlength="120" placeholder="Search games, e.g. Hollow Knight" autocomplete="off">' +
    '<div class="combo-drop" id="wl_drop"></div></div>' +
    '<div id="wl_list">' + (rows || '<p class="dash-sub">Nothing on your watch list yet.</p>') + "</div>" +
    "<script>" +
    "var wlT=document.getElementById('wlt'),wlDrop=document.getElementById('wl_drop'),wlTimer=null;" +
    "function wlEsc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\x22/g,'&quot;');}" +
    "function wlAddTitle(t){t=(t||'').trim().slice(0,120);if(!t)return;wlDrop.classList.remove('open');" +
    "fetch('/api/wishlist/add',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:t})}).then(function(){location.reload();});}" +
    "wlT.addEventListener('input',function(){clearTimeout(wlTimer);var q=wlT.value.trim();" +
    "if(q.length<2){wlDrop.classList.remove('open');return;}" +
    "wlTimer=setTimeout(function(){" +
    "fetch('/api/pro/search?q='+encodeURIComponent(q)).then(function(r){return r.json();}).then(function(d){" +
    "var items=(d&&d.items)||[];var h='';" +
    "for(var i=0;i<items.length;i++){var g=items[i];" +
    "h+='<button type=\x22button\x22 class=\x22combo-opt\x22 data-t=\x22'+wlEsc(g.title)+'\x22>'+(g.thumb?'<img src=\x22'+wlEsc(g.thumb)+'\x22 alt=\x22\x22 loading=\x22lazy\x22>':'')+'<span>'+wlEsc(g.title)+'</span>'+(g.cheapest&&g.cheapest!=='0'?'<span class=\x22pr\x22>from $'+wlEsc(g.cheapest)+'</span>':'')+'</button>';}" +
    "if(!h){h='<div class=\x22combo-empty\x22>No matches. Press Enter to add &quot;'+wlEsc(q)+'&quot; anyway.</div>';}" +
    "wlDrop.innerHTML=h;wlDrop.classList.add('open');" +
    "var btns=wlDrop.querySelectorAll('.combo-opt');" +
    "for(var j=0;j<btns.length;j++){btns[j].addEventListener('click',function(){wlAddTitle(this.getAttribute('data-t'));});}" +
    "}).catch(function(){wlDrop.classList.remove('open');});" +
    "},250);});" +
    "wlT.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();wlAddTitle(wlT.value);}});" +
    "document.addEventListener('click',function(e){if(!e.target.closest('#wl_combo'))wlDrop.classList.remove('open');});" +
    "async function wlDel(b){var r=await fetch('/api/wishlist/remove',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:b.getAttribute('data-t')})});if(r.ok)location.reload();}" +
    "</script>" +
    "</div>";
}

export function apiKeyCard(keys) {
  const rows = keys.map(function (k) {
    return '<div class="apikey-row"><code>' + esc(k.prefix) + "…</code>" +
      '<button onclick="keyRevoke(\'' + esc(k.prefix) + "')\" style=\"background:none;border:0;color:var(--mut);font-size:.85rem;cursor:pointer\" title=\"Revoke\">revoke</button></div>";
  }).join("");
  return '<div class="plan" style="max-width:560px;margin:16px auto 0;text-align:left">' +
    "<h3>Pro API keys</h3>" +
    '<p class="sec-sub" style="margin-bottom:12px">Live deals, freebies, game search &amp; stores as JSON. <a href="/api/docs" style="color:var(--txt);text-decoration:underline;text-decoration-color:rgba(255,255,255,.35)">docs</a>. Up to 5 keys, 600 requests/hour each.</p>' +
    '<div id="keylist">' + (rows || "") + "</div>" +
    '<div id="newkey"></div>' +
    '<button class="btn small" onclick="keyCreate()">Create new key</button>' +
    "<script>" +
    "async function keyCreate(){var r=await fetch('/api/apikey/create',{method:'POST'});var d=await r.json();" +
    "if(d.key){document.getElementById('newkey').innerHTML='<div class=\"keybox\"><code>'+d.key+'</code></div><p class=\"sec-sub\">Copy it now. It is shown only once.</p>';}" +
    "else{alert(d.error||'Could not create key');}}" +
    "async function keyRevoke(p){if(!confirm('Revoke key '+p+'…?'))return;" +
    "var r=await fetch('/api/apikey/revoke',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefix:p})});" +
    "if(r.ok)location.reload();}" +
    "</script>" +
    "</div>";
}

export async function proHTML(env, email, tgUrl) {
  const st = await proStatus(env, email);
  let wlItems = [];
  let apiKeys = [];
  let prefs = normPrefs(null);
  if (st.pro && env && env.DB) {
    wlItems = await getWishlist(env, email);
    try {
      const kq = await env.DB.prepare("SELECT prefix, created_at FROM api_keys WHERE email = ? AND revoked = 0 ORDER BY created_at").bind(email).all();
      apiKeys = (kq && kq.results) || [];
    } catch (e) {}
    try {
      const pq = await env.DB.prepare("SELECT alert_freebies, alert_deals, deal_stores, min_discount, deals_mode, digest_email FROM customers WHERE email = ?").bind(email).all();
      prefs = normPrefs((pq && pq.results && pq.results[0]) || null);
    } catch (e) {}
  }
  let inner;
  if (!st.pro) {
    inner = '<div class="plan" style="max-width:560px;margin:22px auto 0;text-align:center">' +
      "<h3>No Pro subscription on this email</h3>" +
      '<p class="sec-sub" style="text-align:center">Logged in as <b>' + esc(email) + '</b>, but no active Pro subscription found for it.</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">' +
      '<a class="btn" href="https://checkout.dodopayments.com/buy/pdt_0No6epRAEDlFPuD8vFMT3?quantity=1&redirect_url=https%3A%2F%2Fradar.codemeoww.com%2Fthanks">$4/mo</a>' +
      '<a class="btn ghost" href="https://checkout.dodopayments.com/buy/pdt_0No6f9EaIF1CMH6wKBTVl?quantity=1&redirect_url=https%3A%2F%2Fradar.codemeoww.com%2Fthanks">$39/yr</a></div></div>';
  } else {
    inner = '<div class="plan pro" style="max-width:560px;margin:22px auto 0;text-align:center">' +
      '<h3>Hunter Pro <span class="badge free">active</span></h3>' +
      '<p class="sec-sub" style="text-align:center">Logged in as <b>' + esc(email) + "</b>" + (st.plan ? " · " + esc(st.plan) + " plan" : "") + "</p>" +
      (st.telegram
        ? '<p><span class="badge free">Telegram connected</span></p><p class="sec-sub" style="text-align:center">Loot alerts will land in your Telegram.</p>' +
          '<button class="btn small ghost" onclick="tgUnlink()">Disconnect / switch account</button> <span id="tg_msg" class="sec-sub"></span>' +
          "<script>async function tgUnlink(){if(!confirm('Disconnect Telegram? You can reconnect the same or a different account anytime.'))return;" +
          "var m=document.getElementById('tg_msg');m.textContent='…';" +
          "try{var r=await fetch('/api/telegram/unlink',{method:'POST'});if(r.ok)location.reload();else m.textContent='⚠ Could not disconnect';}" +
          "catch(e){m.textContent='⚠ Could not disconnect';}}</script>"
        : '<p class="sec-sub" style="text-align:center">Connect Telegram to get fast loot alerts:</p>' +
          (tgUrl ? '<a class="btn" href="' + tgUrl + '" target="_blank" rel="noopener">Connect Telegram</a>' : "")) +
      "</div>" + prefsCard(prefs) + wishlistCard(wlItems) + apiKeyCard(apiKeys);
  }
  return navHTML("/pro") +
    '<div class="wrap"><div class="pagehead" style="text-align:center">' +
    '<div class="overline">Your radar</div><h1>Pro dashboard</h1></div>' + inner +
    '<div style="text-align:center;margin-top:26px"><button class="btn small ghost" onclick="fetch(\'/api/auth/logout\',{method:\'POST\'}).then(function(){location.href=\'/\';})">Log out</button></div></div>' +
    footHTML();
}
