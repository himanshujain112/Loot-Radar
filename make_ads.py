#!/usr/bin/env python3
"""Loot Radar sponsored ad banners for OtterGames. Exact sizes: 512x512, 728x90."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/your_files/loot-radar-ads")
os.makedirs(OUT, exist_ok=True)

BG = (11, 14, 20)        # #0b0e14 site dark
GREEN = (34, 255, 136)   # #22ff88 brand
WHITE = (255, 255, 255)
MUTED = (154, 163, 178)
DARK = (11, 14, 20)

FB = "/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf"
FM = "/usr/share/fonts/truetype/noto/NotoSans-Medium.ttf"
FR = "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf"

def font(path, size):
    return ImageFont.truetype(path, size)

def draw_logo(d, cx, cy, size):
    """Redraw the Loot Radar cat mark (viewBox 256) centered at (cx,cy) with given size."""
    s = size / 256.0
    ox, oy = cx - 128 * s, cy - 128 * s
    def P(x, y): return (ox + x * s, oy + y * s)
    # head path (quadratic corners approximated by polygon)
    pts = [P(56,64), P(56,180), P(78,202), P(178,202), P(200,180), P(200,64), P(128,112)]
    d.polygon(pts, fill=GREEN)
    for ex in (102, 154):
        d.ellipse([P(ex-20,132), P(ex+20,172)], fill=WHITE)
    for px in (89, 141):
        d.ellipse([P(px-9,143), P(px+9,161)], fill=DARK)

def text_w(d, s, fnt):
    b = d.textbbox((0,0), s, font=fnt)
    return b[2]-b[0], b[3]-b[1]

def centered_text(d, cx, y, s, fnt, fill):
    w, h = text_w(d, s, fnt)
    d.text((cx - w/2, y), s, font=fnt, fill=fill)
    return h

def ad_label(d, x, y, size=16):
    f = font(FM, size)
    t = "AD"
    w, h = text_w(d, t, f)
    pad = 7
    d.rounded_rectangle([x, y, x + w + pad*2, y + h + pad*2], radius=5, outline=MUTED, width=2)
    d.text((x + pad, y + pad - 1), t, font=f, fill=MUTED)

# ---------------- 512 x 512 ----------------
W = H = 512
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
ad_label(d, 22, 22, 17)

y = 66
logo_size = 158
draw_logo(d, W/2, y + logo_size/2, logo_size)
y += logo_size + 22

y += centered_text(d, W/2, y, "Loot Radar", font(FB, 60), WHITE) + 12
y += centered_text(d, W/2, y, "Never miss a free game again", font(FM, 28), GREEN) + 10
y += centered_text(d, W/2, y, "Steam deals + free games, fast Telegram alerts", font(FR, 20), MUTED) + 22

cta = "Get deal alerts"
cf = font(FB, 26)
cw, ch = text_w(d, cta, cf)
bw, bh = cw + 60, ch + 28
bx, by = (W - bw)/2, y
d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh//2, fill=GREEN)
d.text((bx + 30, by + 14 - 2), cta, font=cf, fill=DARK)
y = by + bh + 18
centered_text(d, W/2, y, "radar.codemeoww.com", font(FM, 20), MUTED)

img.save(f"{OUT}/loot-radar-ad-512x512.png")
print("saved 512x512")

# ---------------- 728 x 90 ----------------
W, H = 728, 90
img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
ad_label(d, 10, 8, 12)

logo_size = 58
draw_logo(d, 16 + logo_size/2 + 6, H/2 + 2, logo_size)
tx = 16 + logo_size + 22

d.text((tx, 12), "Loot Radar", font=font(FB, 30), fill=WHITE)
d.text((tx, 50), "Never miss a free game again", font=font(FM, 20), fill=MUTED)

cta = "Get alerts"
cf = font(FB, 20)
cw, ch = text_w(d, cta, cf)
bw, bh = cw + 44, 46
bx = W - bw - 16
by = (H - bh)/2
d.rounded_rectangle([bx, by, bx + bw, by + bh], radius=bh//2, fill=GREEN)
d.text((bx + 22, by + (bh - ch)/2 - 2), cta, font=cf, fill=DARK)

img.save(f"{OUT}/loot-radar-ad-728x90.png")
print("saved 728x90")
