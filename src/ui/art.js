// dotora — art pool.
// Hero portraits come from Valve's public Dota 2 CDN (the canonical look).
// The hand-drawn SVG sigils stay as an automatic fallback when the CDN is
// unreachable — and as the original- art path for a public release, see
// VISUAL_SPEC.md (IP note).
const Art = (function () {
  const S = 'viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"';
  const CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes";
  const ITEM_CDN = "https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items";

  // heroId -> Steam internal name (legacy names: antimage, wisp,
  // obsidian_destroyer).
  const DOTA_IMG = {
    tusk: "tusk", axe: "axe", pudge: "pudge", sven: "sven", centaur: "centaur",
    morphling: "morphling", juggernaut: "juggernaut", pa: "phantom_assassin",
    cm: "crystal_maiden", zeus: "zeus", dawnbreaker: "dawnbreaker", primal: "primal_beast",
    undying: "undying", ogre_magi: "ogre_magi", legion: "legion_commander",
    huskar: "huskar", tidehunter: "tidehunter",
    meepo: "meepo", bounty: "bounty_hunter", slark: "slark",
    phantom_lancer: "phantom_lancer", anti_mage: "antimage", faceless: "faceless_void",
    terrorblade: "terrorblade",
    oracle: "oracle", skywrath: "skywrath_mage", lina: "lina", rubick: "rubick",
    invoker: "invoker", storm_spirit: "storm_spirit", outworld: "obsidian_destroyer",
    ancient_apparition: "ancient_apparition",
    io: "wisp", muerta: "muerta", marci: "marci", snapfire: "snapfire",
    void_spirit: "void_spirit", kez: "kez", beastmaster: "beastmaster", tiny: "tiny",
  };

  const SIGILS = {
    axe: `<rect x="30" y="8" width="4" height="52"/>
      <path d="M32 6L6 12l6 12 20-4z"/>
      <path d="M32 6l26 6-6 12-20-4z"/>`,

    morphling: `<path d="M32 5c11 15 18 24 18 33a18 18 0 1 1-36 0c0-9 7-18 18-33z"/>
      <path d="M20 40c4-4 8-4 12 0s8 4 12 0" fill="none" stroke="var(--card-bg)" stroke-width="4" stroke-linecap="round"/>`,

    zeus: `<path d="M36 4L16 35h12l-5 25 21-34H31z"/>`,

    cm: `<g fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
      <path d="M32 6v52"/><path d="M10 19l44 26"/><path d="M10 45l44-26"/></g>
      <circle cx="32" cy="32" r="7"/>`,

    juggernaut: `<path d="M13 36a19 22 0 0 1 38 0v10H13z"/>
      <path d="M12 32L4 18l12 6zM52 32l8-14-12 6z"/>
      <rect x="19" y="38" width="26" height="6" fill="var(--card-bg)"/>`,

    pa: `<path d="M32 4l9 14-3 24H26l-3-24z"/>
      <rect x="18" y="42" width="28" height="5"/>
      <rect x="28" y="47" width="8" height="13"/>`,

    pudge: `<path d="M42 4v16c0 8-24 6-24 22a13 13 0 1 0 26-2h-8a5 5 0 1 1-10-1c0-8 16-8 16-19V4z"/>`,

    tusk: `<rect x="12" y="18" width="40" height="36" rx="9"/>
      <path d="M12 30h40M12 40h40" stroke="var(--card-bg)" stroke-width="4"/>
      <path d="M22 18v-8M32 18v-8M42 18v-8" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,

    sven: `<path d="M32 4l21 8v22c0 15-11 22-21 26-10-4-21-11-21-26V12z"/>
      <path d="M32 12v40M20 24h24" stroke="var(--card-bg)" stroke-width="5"/>`,

    centaur: `<path d="M50 4l6 6-28 34-8-8z"/>
      <path d="M10 52l8-10 8 10 8-10 8 10 8-10" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,

    dawnbreaker: `<circle cx="32" cy="32" r="13"/>
      <g stroke="currentColor" stroke-width="5" stroke-linecap="round">
        <path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M18 46l-6 6"/></g>`,

    primal: `<path d="M14 26L32 10l18 16v16L32 58 14 42z"/>
      <path d="M22 30h20M22 38h20" stroke="var(--card-bg)" stroke-width="4"/>`,
  };

  // Attribute rune fallback for roster heroes without a bespoke sigil.
  const RUNES = {
    str: `<path d="M8 54L26 20l10 18 6-8 14 24z"/>`,
    agi: `<path d="M20 6l14 12-10 2 18 14-10 2 14 12-24-6 8-8-14-2 10-10-14-4z"/>`,
    int: `<path d="M32 12c14 0 24 12 26 20-2 8-12 20-26 20S10 40 6 32c2-8 12-20 26-20z"/>
      <circle cx="32" cy="32" r="8" fill="var(--card-bg)"/><circle cx="32" cy="32" r="4"/>`,
    uni: `<path d="M32 4l7 21h21l-17 13 7 22-18-14-18 14 7-22L4 25h21z"/>`,
  };

  function svg(inner, cls) {
    return `<svg ${S} class="${cls || ""}" aria-hidden="true">${inner}</svg>`;
  }

  function sigilFor(hero) {
    const inner = SIGILS[hero.id] || RUNES[hero.attr];
    return svg(inner, "sigil" + (SIGILS[hero.id] ? "" : " sigil-rune"));
  }

  // Portrait layered over the sigil: while the CDN image loads (or if it
  // fails offline), the sigil shows through. One removal = clean fallback.
  function heroArt(hero) {
    const key = DOTA_IMG[hero.id];
    if (!key) return sigilFor(hero);
    const url = `${CDN}/${key}.png`;
    return `<div class="hero-art">
      ${sigilFor(hero)}
      <img src="${url}" alt="${hero.name}" loading="lazy" onerror="this.remove()">
    </div>`;
  }

  // itemId -> Steam internal name (все имена проверены запросами к CDN;
  // легаси-имена держатся: invis_sword = Shadow Blade, ancient_janggo = Drum,
  // greater_crit = Daedalus, manta = Manta Style).
  const DOTA_ITEM_IMG = {
    battle_fury: "bfury", meteor_hammer: "meteor_hammer", drum: "ancient_janggo",
    midas: "hand_of_midas", bkb: "black_king_bar", kaya: "kaya_and_sange",
    vladmir: "vladmir", sentry: "ward_sentry", daedalus: "greater_crit", satanic: "satanic",
    shadow_blade: "invis_sword", heart: "heart", refresher: "refresher",
    bloodstone: "bloodstone", butterfly: "butterfly", manta: "manta", rapier: "rapier",
    radiance: "radiance", octarine: "octarine_core",
    orb_corrosion: "orb_of_corrosion", dragon_lance: "dragon_lance",
    ethereal_blade: "ethereal_blade", mkb: "monkey_king_bar", skadi: "skadi",
    desolator: "desolator", pipe: "pipe", ledger: "enchanted_quiver",
    bloodthorn: "bloodthorn", tempest_double: "cyclone", misers_chest: "gem",
    assault: "assault", blink: "blink",
  };

  // Улучшения лавки → официальные иконки той же дота-палитры (единый стиль
  // с героями и предметами). Имена проверены запросами к CDN; при 404
  // остаётся эмодзи-фолбэк, как у предметов.
  const UPGRADE_IMG = {
    chistyy_dabor: "magic_stick", koshelek: "sobi_mask", boyevoy_opyt: "tome_of_knowledge",
    svobodnaya_kletka: "phase_boots", iskra: "energy_booster", tochnyy_raschet: "quelling_blade",
    trenzal: "gloves_of_haste", vdohn: "aether_lens", assortiment: "guardian_greaves",
    podkova: "wind_lace", krolichya_lapka: "magic_wand", klever: "cheese",
    kartograf: "ward_observer", dezertir: "travel_boots", podsmotr: "ward_sentry",
    torgash: "ring_of_aquila", magnit: "lotus_orb", insider: "shadow_amulet",
    surprise: "spirit_vessel", v_dolg: "crown", obhodchik: "smoke_of_deceit",
    vozvrat: "void_stone", ignor: "talisman_of_evasion", schastlivy: "moon_shard",
    vabank: "silver_edge", peresdacha: "ghost", kondensator: "point_booster",
    peregruzka: "mjollnir", katalizator: "kaya", optimist: "headdress",
    posledniy_bilet: "voodoo_mask", pakt_fortunes: "phylactery", sakvoyazh: "hurricane_pike",
    ladon: "blades_of_attack", askesis: "ring_of_health", talisman: "ultimate_orb",
    nastavnik: "staff_of_wizardry",
  };

  function upgradeIcon(up) {
    const key = UPGRADE_IMG[up.id];
    if (!key) return `<span class="upg-fallback">${up.emoji}</span>`;
    return `<span class="upg-art"><span class="upg-fallback">${up.emoji}</span>
      <img src="${ITEM_CDN}/${key}.png" alt="${up.name}" loading="lazy" onload="const f=this.previousElementSibling; if (f) f.style.display='none';" onerror="this.remove()"></span>`;
  }

  // Item art: CDN icon over the emoji fallback (same pattern as heroArt).
  function itemIcon(item) {
    const key = DOTA_ITEM_IMG[item.id];
    if (!key) return `<span class="item-gem rar-${item.rarity}">${item.emoji}</span>`;
    return `<span class="item-gem rar-${item.rarity}">
      <span class="item-fallback">${item.emoji}</span>
      <img src="${ITEM_CDN}/${key}.png" alt="${item.name}" loading="lazy" onload="const f=this.previousElementSibling; if (f) f.style.display='none';" onerror="this.remove()">
    </span>`;
  }

  return { heroArt, sigilFor, itemIcon, upgradeIcon, hasCustomSigil: (id) => !!SIGILS[id] };
})();
