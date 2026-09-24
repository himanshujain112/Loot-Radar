// Loot Radar outbound notifications: Resend email + Telegram Bot API.

export async function sendEmail(env, to, subject, html) {
  const key = (env && env.RESEND_API_KEY) || "";
  if (!key) return { ok: false, error: "no api key" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Loot Radar <lootradar@codemeoww.com>", to: [to], subject: subject, html: html }),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data: data };
  } catch (e) { return { ok: false, error: "fetch failed" }; }
}
export async function sendTelegram(env, chatId, text, replyMarkup) {
  const tok = (env && env.TELEGRAM_BOT_TOKEN) || "";
  if (!tok) return { ok: false };
  try {
    const body = { chat_id: chatId, text: text, parse_mode: "HTML", disable_web_page_preview: true };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch("https://api.telegram.org/bot" + tok + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false }; }
}
export async function sendTelegramPhoto(env, chatId, photoUrl, caption) {
  const tok = (env && env.TELEGRAM_BOT_TOKEN) || "";
  if (!tok || !photoUrl) return { ok: false };
  try {
    const res = await fetch("https://api.telegram.org/bot" + tok + "/sendPhoto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, photo: photoUrl, caption: caption.slice(0, 1000), parse_mode: "HTML" }),
    });
    return { ok: res.ok };
  } catch (e) { return { ok: false }; }
}
