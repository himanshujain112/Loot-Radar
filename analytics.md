# Loot Radar traffic log

Daily traffic snapshots from the Microsoft Clarity Data Export API.
Each row covers the trailing 24h UTC window at pull time (pulled ~05:30 UTC / ~11:00 IST).
Bot sessions are excluded from page counts where shown separately.

| Date (IST) | Sessions | Bots | / | /deals | /freebies | /pricing | Other pages | Top source | Notes |
|---|---|---|---|---|---|---|---|---|---|
| 2026-09-24 | 278 | 4 | 238 | 11 | 10 | 10 | about 5, api/docs 2, faq 1, refunds 1 | n/a (source pull starts 2026-09-25) | First record. Reddit post at 60k views. 0 signups, $0 revenue. |
| 2026-09-24 | 371 | 6 | 319 | 11 | 18 | 13 | about 5, api/docs 2, faq 1, refunds 2 | n/a (source pull starts 2026-09-25) | Daily pull ~11:00 IST. +93 sessions (+33%) vs baseline, all on homepage. Reddit follow-up spike. |
| 2026-09-25 | 480 | 8 | 384 | 16 | 42 | 26 | faq 5, about 3, login 3, api/docs 1 | direct 282 (reddit app 85, www.reddit.com 13, t.co 3, google 1) | +109 (+29%) vs 09-24. freebies x2.3, pricing x2. deals page quickback 56%. 0 rage clicks, 0 script errors. shallow homepage engagement (35% scroll, ~15s active). |
| 2026-09-26 | 120 | 0 | 84 | 10 | 15 | 4 | about 3, faq 4 | direct 62 (radar.codemeoww.com 28, www.reddit.com 9, com.reddit.frontpage 6, shipwithmuse.live 1, feishu 1) | -360 (-75%) vs 09-25, reddit spike faded (reddit 98 -> 15). 0 rage clicks, 0 script errors. 7 dead clicks (5 homepage, 1 faq, 1 deals). deals quickback up to 60%. homepage 36% scroll, ~13s active. |
| 2026-09-27 | 145 | 4 | 112 | 10 | 16 | 4 | faq 3 | direct 77 (radar.codemeoww.com 27, com.reddit.frontpage 20, www.reddit.com 14, google 2) | +25 (+21%) vs 09-26. homepage scroll down to 31% (was 36%), ~27s active. 9 dead clicks (homepage 4, /?sessionid= 5). 0 rage clicks, 0 script errors. quickback still high on deals (30%) and faq (33%). |
| 2026-09-28 | 109 | 1 | 80 | 6 | 18 | 3 | faq 2 | direct 56 (radar.codemeoww.com 25, com.reddit.frontpage 18, www.reddit.com 6) | -36 (-25%) vs 09-27, back near the 09-26 baseline. 0 rage clicks, 0 script errors. 5 dead clicks (homepage 4, freebies 1). homepage scroll steady 31%, ~14s active. quickback: freebies 17%, deals 17%, homepage 11%. |
| 2026-09-29 | 35 | 0 | 30 | 2 | 1 | 2 | - | direct 23 (radar.codemeoww.com 5, www.reddit.com 3, com.reddit.frontpage 3, google 1) | -74 (-68%) vs 09-28, lowest of the week. 1 dead click (homepage), 1 quickback (homepage). 0 rage clicks, 0 script errors. homepage scroll 27%, ~14s active; pricing scroll 85%. google referral 1 session browsed 7 pages. |
| 2026-09-30 | 42 | 0 | 33 | 2 | 6 | 2 | faq 2 | direct 27 (radar.codemeoww.com 9, www.reddit.com 3, com.reddit.frontpage 2, reddit_sync 1) | +7 (+20%) vs 09-29, slight bounce off the low. 1 dead click (homepage), 8 quickbacks (6 homepage, 2 freebies). 0 rage clicks, 0 script errors. homepage scroll 40%, deals 84%, pricing 84%, freebies 49%. |
| 2026-10-01 | 40 | 4 | 24 | 4 | 8 | 1 | faq 3 | direct 19 (radar.codemeoww.com 10, www.reddit.com 4, com.reddit.frontpage 1) | -2 (-5%) vs 09-30, flat. 3 dead clicks (homepage), 10 quickbacks (6 homepage, 2 deals, 1 freebies, 1 pricing). 0 rage clicks, 0 script errors. scroll: faq 68%, freebies 52%, home 35%, deals 30%. /login hit by bots only (2). |
