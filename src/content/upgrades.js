// Dalatro content — улучшения лавки (спек §5, фаза F). Отдельный слой
// прогресса: НЕ занимают слоты предметов, накопительная ценность ~1–5%.
// Два формата:
//   scalar — агрегируются в systems/upgrades.js (одна точка интеграции на ключ);
//   ability — хуки через СУЩЕСТВУЮЩУЮ триггерную систему (kind: "upgrade").
// Реализовано 48 из 100 строк спека. Отложено с причинами (см. конец файла).
const UPGRADES_DATA = [
  // ===== СКАЛЯРЫ =====
  { id: "ostryi_kraj", name: "Острый край", emoji: "🗡️", rarity: "common", cost: 2,
    scalar: { dmg: 1 }, desc: "+1% к итоговому урону каждого боя." }, // #11
  { id: "krepkaya_mast", name: "Крепкая масть", emoji: "🃏", rarity: "common", cost: 2,
    scalar: { cardBuffPct: 2 }, desc: "Случайная карта в бою получает +2% силы." }, // #2
  { id: "bystryy_dabor", name: "Быстрый добор", emoji: "📥", rarity: "common", cost: 2,
    scalar: { extraDrawChance: 5 }, desc: "5% шанс: следующая волна играется с +1 картой в руке." }, // #3
  { id: "chistyy_dabor", name: "Чистый добор", emoji: "♻️", rarity: "common", cost: 2,
    scalar: { discardsBonus: 1 }, desc: "+1 ТП-сброс за волну." }, // #4
  { id: "maly_rezerv", name: "Малый резерв", emoji: "📦", rarity: "uncommon", cost: 3,
    scalar: { discardsBonus: 1 }, desc: "+1 ТП-сброс за волну. Складывается с «Чистым добором»." }, // #9
  { id: "koshelek", name: "Кошелёк", emoji: "👛", rarity: "common", cost: 2,
    scalar: { goldPerAct: 5 }, desc: "+5 золота при переходе в новый акт." }, // #51
  { id: "meloch", name: "Мелочь", emoji: "🪙", rarity: "common", cost: 2,
    scalar: { goldChance: 5 }, desc: "5% шанс +1 золота после зачистки волны." }, // #52
  { id: "berezhlivost", name: "Бережливость", emoji: "🧮", rarity: "common", cost: 2,
    scalar: { thirdRerollOff: 1 }, desc: "Каждый третий реролл лавки дешевле на 1." }, // #53
  { id: "torg", name: "Торг", emoji: "🤝", rarity: "uncommon", cost: 3,
    scalar: { itemDiscountPct: 5 }, desc: "Случайный товар каждой лавки −5% (метка на карточке)." }, // #54
  { id: "loyalnost", name: "Лояльность", emoji: "💗", rarity: "uncommon", cost: 3,
    scalar: { shopLoyalty: 1 }, desc: "После трёх покупок в лавке следующий товар −1 золото." }, // #55
  { id: "pereprodazha", name: "Перепродажа", emoji: "🏷️", rarity: "common", cost: 2,
    scalar: { sell: 3 }, desc: "Продажа предметов +3% к цене." }, // #56
  { id: "sberezheniya", name: "Сбережения", emoji: "🐖", rarity: "common", cost: 3,
    scalar: { rerollRich: 1 }, desc: "При 15+ золоте реролл дешевле на 1." }, // #57
  { id: "nalogovyy_vychet", name: "Налоговый вычет", emoji: "🧾", rarity: "common", cost: 2,
    scalar: { postBossDiscount: 1 }, desc: "Первая покупка после босса акта −1 золото." }, // #58
  { id: "monetka", name: "Монетка", emoji: "🪙", rarity: "common", cost: 2,
    scalar: { purchaseRefundChance: 10 }, desc: "10% шанс вернуть 1 золото после покупки предмета." }, // #59
  { id: "rezervnyy_fond", name: "Резервный фонд", emoji: "🏦", rarity: "common", cost: 2,
    scalar: { brokeBonus: 1 }, desc: "Опустошили кошелёк покупкой? Вам дадут 1 золото." }, // #60
  { id: "assortiment", name: "Хороший ассортимент", emoji: "🛍️", rarity: "rare", cost: 4,
    scalar: { itemRareBias: 2 }, desc: "Редкие товары в лавке выпадают заметно чаще." }, // #61
  { id: "pylnaya_polka", name: "Пыльная полка", emoji: "🕸️", rarity: "rare", cost: 4,
    scalar: { dustChance: 15 }, desc: "15% шанс: в лавке будет редкий товар." }, // #62
  { id: "bystryy_prodavets", name: "Быстрый продавец", emoji: "🏃", rarity: "common", cost: 2,
    scalar: { firstRerollOff: 1 }, desc: "Первый реролл каждой лавки дешевле на 1." }, // #63
  { id: "taynyy_yaschik", name: "Тайный ящик", emoji: "🎁", rarity: "rare", cost: 4,
    scalar: { secretSlotChance: 15 }, desc: "15% шанс: в лавке появится лишний товар." }, // #65
  { id: "boyevoy_opyt", name: "Боевой опыт", emoji: "📜", rarity: "uncommon", cost: 3,
    scalar: { winMilestoneGold: 3 }, desc: "Каждая 5-я зачистка за забег: +3 золота." }, // #72
  { id: "seriya", name: "Серия", emoji: "🔗", rarity: "uncommon", cost: 3,
    scalar: { streakGold: 2 }, desc: "Серия 2+ зачисток подряд: награда за зачистку +2%." }, // #73
  { id: "staryy_amulet", name: "Старый амулет", emoji: "🧿", rarity: "rare", cost: 4,
    scalar: { upgradeLoyalty: 1 }, desc: "Каждая пятая покупка улучшения дешевле на 1." }, // #96
  { id: "malenkaya_udacha", name: "Маленькая удача", emoji: "✨", rarity: "common", cost: 2,
    scalar: { shopCoinChance: 10 }, desc: "10% шанс: лавка встречает вас +2 золотами." }, // #100
  { id: "podkova", name: "Подкова", emoji: "🧲", rarity: "common", cost: 3,
    scalar: { luck: 1 }, desc: "+1 удача: улучшения в лавках выпадают жирнее." },
  { id: "krolichya_lapka", name: "Кроличья лапка", emoji: "🐇", rarity: "rare", cost: 5,
    scalar: { luck: 2 }, desc: "+2 удачи: редкие и эпические улучшения заметно чаще." },
  { id: "klever", name: "Четырёхлистный клевер", emoji: "🍀", rarity: "mythic", cost: 8,
    scalar: { luck: 3 }, desc: "+3 удачи. Топовые улучшения почти ваши." },
  { id: "zolotoe_serdtse", name: "Золотое сердце", emoji: "💛", rarity: "mythic", cost: 7,
    scalar: { dmg: 2, goldOnClear: 1 }, desc: "+2% урона и +1 золота после каждой зачистки." },

  // ===== ХУКИ (триггерная система, kind: "upgrade") =====
  { id: "iskra", name: "Искра", emoji: "⚡", rarity: "common", cost: 2,
    ability: { name: "Искра", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_RANDOM_CARD", value: 2 }] },
    desc: "Каждый бой случайный герой получает +2 силы." }, // #92
  { id: "posl_shtrih", name: "Последний штрих", emoji: "🖌️", rarity: "common", cost: 2,
    ability: { name: "Последний штрих", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_LAST_CARD", pct: 3 }] },
    desc: "Последняя карта боя даёт +3% своей силы." }, // #5
  { id: "pervaya_karta", name: "Первая карта", emoji: "🥇", rarity: "common", cost: 2,
    ability: { name: "Первая карта", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_FIRST_CARD", pct: 3 }] },
    desc: "Первая карта боя даёт +3% своей силы." }, // #6
  { id: "podderzhka", name: "Поддержка", emoji: "🤲", rarity: "uncommon", cost: 3,
    ability: { name: "Поддержка", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_WEAKEST", pct: 3 }] },
    desc: "Слабейший герой отряда добавляет +3% своей силы." }, // #26
  { id: "prochnyy_centr", name: "Прочный центр", emoji: "🗿", rarity: "uncommon", cost: 3,
    ability: { name: "Прочный центр", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_CENTER", pct: 2 }] },
    desc: "Центральная позиция отряда даёт +2% своей силы." }, // #32
  { id: "krepkiy_kray", name: "Крепкий край", emoji: "🧱", rarity: "uncommon", cost: 3,
    ability: { name: "Крепкий край", event: "FIGHT_SCORING",
      effects: [{ type: "ADD_POWER_EDGES", pct: 2 }] },
    desc: "Крайние позиции отряда дают +2% своей силы." }, // #33
  { id: "svobodnaya_kletka", name: "Свободная клетка", emoji: "⬜", rarity: "uncommon", cost: 3,
    ability: { name: "Свободная клетка", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 0 },
      effects: [{ type: "ADD_POWER_PER_EMPTY_SLOT", value: 2 }] },
    desc: "+2 силы за каждую пустую позицию." }, // #38
  { id: "poslednij_udar", name: "Последний удар", emoji: "🩸", rarity: "common", cost: 2,
    ability: { name: "Последний удар", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_BELOW", pct: 10 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 3 }] },
    desc: "Башня ниже 10% HP: +3% урона." }, // #13
  { id: "vtoroe_dyhanie", name: "Второе дыхание", emoji: "💨", rarity: "uncommon", cost: 3,
    ability: { name: "Второе дыхание", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_BELOW", pct: 10 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "Башня ниже 10% HP: ещё +2% урона. Копится с «Последним ударом»." }, // #97
  { id: "ritm", name: "Ритм", emoji: "🥁", rarity: "uncommon", cost: 3,
    ability: { name: "Ритм", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 2 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 3 }] },
    desc: "3+ героя в отряде: +3% урона." }, // #15
  { id: "polnyy_sostav", name: "Полный состав", emoji: "🎖️", rarity: "uncommon", cost: 3,
    ability: { name: "Полный состав", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 5 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "Полная пятёрка: +2% урона." },
  { id: "plotnyy_stroy", name: "Плотный строй", emoji: "🛡️", rarity: "uncommon", cost: 3,
    ability: { name: "Плотный строй", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_ABOVE", value: 3 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 1 }] },
    desc: "Отряд 4+ героя: +1% урона." }, // #39
  { id: "universalnost", name: "Универсальность", emoji: "🌐", rarity: "uncommon", cost: 3,
    ability: { name: "Универсальность", event: "FIGHT_SCORING",
      when: { type: "DISTINCT_ATTRIBUTES_ABOVE", value: 2 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "3+ разных атрибута в отряде: +2% урона." }, // #43
  { id: "specializaciya", name: "Специализация", emoji: "🔱", rarity: "uncommon", cost: 3,
    ability: { name: "Специализация", event: "FIGHT_SCORING",
      when: { type: "SAME_ATTRIBUTE_COUNT_ABOVE", value: 2 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "3+ героя одного атрибута: +2% урона." }, // #44
  { id: "tochnaya_rasstanovka", name: "Точная расстановка", emoji: "🧩", rarity: "uncommon", cost: 3,
    ability: { name: "Точная расстановка", event: "FIGHT_SCORING",
      when: { type: "MODE_IS", value: "formation" },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "Режим формаций: +2% урона." }, // #31
  { id: "nestandart", name: "Нестандартное мышление", emoji: "🧠", rarity: "uncommon", cost: 3,
    ability: { name: "Нестандартное мышление", event: "FIGHT_SCORING",
      when: { type: "COMBO_DIFFERENT_FROM_LAST" },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "Комбо отличается от предыдущего боя: +2% урона." }, // #99
  { id: "uporstvo", name: "Упорство", emoji: "🔥", rarity: "uncommon", cost: 3,
    ability: { name: "Упорство", event: "FIGHT_SCORING",
      when: { type: "AFTER_FAILURE" },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 2 }] },
    desc: "После проваленной волны: +2% урона до первой победы." }, // #78
  { id: "ekonomnyy", name: "Экономный бой", emoji: "🪙", rarity: "common", cost: 2,
    ability: { name: "Экономный бой", event: "FIGHT_SCORING", chance: 0.15,
      when: { type: "FIGHTS_LEFT_ABOVE", value: 1 },
      effects: [{ type: "GOLD", value: 1 }] },
    desc: "15%: +1 золото, если победа взята малой кровью." }, // #19
  { id: "tochnyy_raschet", name: "Точный расчёт", emoji: "🎯", rarity: "rare", cost: 4,
    ability: { name: "Точный расчёт", event: "FIGHT_SCORING",
      effects: [{ type: "LAST_HIT_GOLD", value: 3 }] },
    desc: "Точный ласт-хит приносит +3 золота." }, // #18
  { id: "bossslayer", name: "Боссобой", emoji: "👑", rarity: "rare", cost: 4,
    ability: { name: "Боссобой", event: "FIGHT_SCORING",
      when: { type: "IS_BOSS_WAVE" },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 3 }] },
    desc: "На волне босса: +3% урона." },
  { id: "odinokiy_volk", name: "Одинокий волк", emoji: "🐺", rarity: "uncommon", cost: 3,
    ability: { name: "Одинокий волк", event: "FIGHT_SCORING",
      when: { type: "PLAYED_COUNT_IS", value: 1 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 4 }] },
    desc: "Соло-рейд: +4% урона, если в бою ровно один герой." },
  { id: "perelom", name: "Перелом", emoji: "📉", rarity: "uncommon", cost: 3,
    ability: { name: "Перелом", event: "FIGHT_SCORING",
      when: { type: "TOWER_HP_BELOW", pct: 25 },
      effects: [{ type: "ADD_DAMAGE_PCT", value: 3 }] },
    desc: "Башня ниже четверти HP: +3% урона." }, // #20

  // Отложено с причинами: XP-апгрейды (#21/23/24/25/27/28/30) — ждут фазу G;
  // Архив руки/Дубликатор/Запас/Замок/Продавец знакомых (#8/10/64/66/68) —
  // UI-механики переноса и хранения; ослабления штрафов (#7/41/46/50/76/77) —
  // у игрока пока нет негативных случайных эффектов; информационные
  // (#80–90) — тип, HP и моды башни уже видны до боя в базовом UI.
];
