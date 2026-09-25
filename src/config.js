// Loot Radar shared constants.
// Feed URLs, user agent, cache TTLs, brand assets, store directory constants.

export const FREEBIES_URL = "https://www.gamerpower.com/api/giveaways?platform=pc&type=game&sort-by=date";
export const DEALS_URL = "https://www.cheapshark.com/api/1.0/deals?storeID=1&upperPrice=5&pageSize=60&sortBy=Savings";
export const CS_BASE = "https://www.cheapshark.com/api/1.0";
export const UA = "LootRadar/1.0 (https://radar.codemeoww.com; contact lootradar@codemeoww.com)";
export const CACHE_TTL = 900; // 15 minutes

export const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M56 64 L56 180 Q56 202 78 202 L178 202 Q200 202 200 180 L200 64 L128 112 Z" fill="#22ff88"/><circle cx="102" cy="152" r="20" fill="#ffffff"/><circle cx="154" cy="152" r="20" fill="#ffffff"/><circle cx="89" cy="152" r="9" fill="#0b0e14"/><circle cx="141" cy="152" r="9" fill="#0b0e14"/></svg>';

// Alert-worthy stores only: the big-userbase ones. Smaller storefronts are noise.
// Every storefront users may pick for deal alerts (CheapShark active stores, verified 2026-09-22).
export const ACTIVE_ALERT_STORES = ["1", "2", "3", "7", "11", "13", "15", "21", "23", "25", "27", "28", "30", "35"];
export const DEFAULT_DEAL_STORES = ["1", "25", "7", "30"];

export const STORE_ALIASES = { steam: "1", gamersgate: "2", greenmangaming: "3", gog: "7", humble: "11", uplay: "13", fanatical: "15", wingamestore: "21", gamebillet: "23", epic: "25", gamesplanet: "27", gamesload: "28", indiegala: "30", dreamgame: "35" };
export const STORE_NAMES = { "1": "Steam", "2": "GamersGate", "3": "GreenManGaming", "7": "GOG", "11": "Humble Store", "13": "Uplay", "15": "Fanatical", "21": "WinGameStore", "23": "GameBillet", "25": "Epic Games Store", "27": "Gamesplanet", "28": "Gamesload", "30": "IndieGala", "35": "DreamGame" };
export const STORE_PICK_ORDER = ["1", "25", "7", "30", "2", "3", "11", "13", "15", "21", "23", "27", "28", "35"];
