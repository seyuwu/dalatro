# dotora — 20 фановых билдов из сообществ других игр, адаптированных под движок

Дата: 2026-09-12 · Статус: РЕАЛИЗОВАНО (v0.9): весь новый контент §0 (7 легенд,
12 предметов, 3 улучшения, ON_HELD + новые эффекты) в коде, тесты —
tests/fun.test.js. Билды §1 — сценарии поверх этого контента (пресеты
советчика/контракты — отдельное решение).

Критерий отбора: билды, которые сообщества (reddit/гайды) называют не
«сильнейшими», а **самыми фановыми** — экспонента, драма, гэмблинг, «сломать
игру по-своему». Каждая адаптация привязана к нашему движку (триггеры,
формации, слоты, сбросы) и снабжена **новым контентом** с готовыми спеками
в формате `src/content/*` — реализация это перенос данных + немного движка.

---

## 0. Новый контент — сводный каталог

### 0.1 Новые герои (7, «вне сетки» — легенды таверны, дороже обычных рекрутов)

Сетка 11×4 заполнена полностью, поэтому легенды идут вне сетки (пометка
`legend: true`, цена рекрута ×2). Спеки в формате `HEROES_DATA`:

```js
{ id: "venomancer", name: "Venomancer", attr: "agi", power: 5, inDeck: false, legend: true,
  ability: { name: "Poison Nova", event: "FIGHT_SCORING",
    effects: [{ type: "TOWER_BURN", value: 7 }] } },          // осадный яд сверх удара
{ id: "wraith_king", name: "Wraith King", attr: "uni", power: 6, inDeck: false, legend: true,
  ability: { name: "Wraithfire", event: "FIGHT_SCORING",
    effects: [{ type: "GAIN_RANK_PER_FIGHT", value: 1, cap: 12 }] } }, // растёт за каждый бой
{ id: "magnus", name: "Magnus", attr: "str", power: 8, inDeck: false, legend: true,
  ability: { name: "Reverse Polarity", event: "FIGHT_SCORING",
    effects: [{ type: "ADD_POWER_NEIGHBOR_PCT", pct: 35 }] } }, // соседи: +35% их силы
{ id: "techies", name: "Techies", attr: "int", power: 4, inDeck: false, legend: true,
  ability: { name: "Suicide", event: "FIGHT_SCORING",
    effects: [{ type: "FAIL_BURN_PCT", pct: 10 }] } },        // провал волны с ним в руке: башня −10% maxHp
{ id: "silencer", name: "Silencer", attr: "int", power: 6, inDeck: false, legend: true,
  ability: { name: "Last Word", event: "ON_HELD",
    effects: [{ type: "ADD_POWER_PER_HELD", value: 2 }] } },  // скамейка бьёт
{ id: "chaos_knight", name: "Chaos Knight", attr: "str", power: 10, inDeck: false, legend: true,
  ability: { name: "Chaos Bolt", event: "FIGHT_SCORING", chance: 0.5,
    effects: [{ type: "MULT_MULT", value: 2 }],
    fallback: [{ type: "ADD_POWER", value: 16 }] } },         // 50/50: ×2 или +16
{ id: "pugna", name: "Pugna", attr: "int", power: 7, inDeck: false, legend: true,
  ability: { name: "Nether Ward", event: "FIGHT_SCORING",
    effects: [{ type: "HEAL_TO_DAMAGE" }] } },                // лечение башни становится уроном
```

### 0.2 Новые предметы (12)

```js
{ id: "baron_scepter", name: "Скипетр Барона", cost: 13, emoji: "👑", rarity: "epic", category: "mult", minRank: 4,
  ability: { name: "Baron", event: "ON_HELD",
    effects: [{ type: "MULT_PER_HELD_RANK", rank: 12, value: 1.35, cap: 2.7 }] } },
  // за каждого героя ранга 12, оставшегося в руке — ×1.35 (макс ×2.7)
{ id: "ripe_banana", name: "Спелый банан", cost: 12, emoji: "🍌", rarity: "epic", category: "mult",
  ability: { name: "Potassium", event: "FIGHT_SCORING", effects: [{ type: "MULT_MULT", value: 3 }] },
  react: [{ event: "WAVE_CLEARED", effects: [{ type: "DESTROY_SELF_CHANCE", chance: 0.3 }] }] },
  // ×3 множитель; после каждой зачистки 30% что банан сгниёт (исчезает)
{ id: "three_stars", name: "Три звезды", cost: 12, emoji: "⭐", rarity: "epic", category: "power", minRank: 4,
  ability: { name: "Star Up", event: "FIGHT_SCORING",
    when: { type: "SAME_RANK_GROUP", size: 3 },
    effects: [{ type: "BUFF_RANK_GROUP", size: 3, pct: 50 }] } },
  // 3+ героя одного ранга: каждый из группы +50% силы
{ id: "heresy", name: "Еретик", cost: 13, emoji: "📜", rarity: "epic", category: "rule", minRank: 4,
  rule: "heresy" }, // Фаланга от 3 героев одного атрибута; Треугольник от 2 атрибутов
{ id: "polaroid", name: "Полароид", cost: 9, emoji: "🖼️", rarity: "rare", category: "mult", minRank: 3,
  ability: { name: "Snapshot", event: "FIGHT_SCORING",
    when: { type: "FIRST_CARD_RANK_ABOVE", value: 9 }, effects: [{ type: "MULT_MULT", value: 2 }] } },
{ id: "demon_form", name: "Демоническая форма", cost: 12, emoji: "😈", rarity: "epic", category: "power", minRank: 4,
  ability: { name: "Demon", event: "FIGHT_SCORING", effects: [{ type: "WAVE_RAMP_POWER", value: 4 }] } },
  // каждый бой волны даёт следующему бою этой волны +4 силы (бой 1: +0, бой 4: +12)
{ id: "one_armed_bandit", name: "Однорукий бандит", cost: 10, emoji: "🎰", rarity: "rare", category: "rule", minRank: 3,
  ability: { name: "Jackpot", event: "PRE_DETECT", chance: 0.3,
    effects: [{ type: "SET_ALL_RANKS", value: 7 }] } },       // весь отряд считается рангом 7
{ id: "mantra", name: "Мантра", cost: 12, emoji: "🧘", rarity: "epic", category: "mult", minRank: 4,
  ability: { name: "Divinity", event: "FIGHT_SCORING",
    when: { type: "FORMATION_STREAK_ABOVE", value: 2 }, effects: [{ type: "MULT_MULT", value: 1.75 }] } },
  // 3 боя подряд одной и той же формации → следующий бой ×1.75
{ id: "small_blades", name: "Мелкие клинки", cost: 9, emoji: "🔪", rarity: "rare", category: "power", minRank: 3,
  ability: { name: "Shivs", event: "FIGHT_SCORING",
    effects: [{ type: "ADD_POWER_PER_WEAK_RANK", value: 5 }] } }, // +5 за героя рангом ≤4
{ id: "siege_axe", name: "Осадный колун", cost: 12, emoji: "🪓", rarity: "epic", category: "power", minRank: 5,
  ability: { name: "Reverse Siege", event: "FIGHT_SCORING", effects: [{ type: "ARMOR_FEED" }] } },
  // броня башни не вычитается, а прибавляется к твоей силе
{ id: "rat_mandate", name: "Крысиный ультиматум", cost: 14, emoji: "🐀", rarity: "epic", category: "rule", minRank: 5,
  ability: { name: "Split Push", event: "FIGHT_SCORING",
    when: { type: "PLAYED_COUNT_BELOW", value: 3 },
    effects: [{ type: "FAIL_BURN_PCT", pct: 8, capFlat: 600, alwaysOn: true }] } },
  // бьёшь 1–2 героями: башня теряет 8% maxHp сверх удара (кап 600)
{ id: "venom_funnel", name: "Воронка яда", cost: 10, emoji: "🧪", rarity: "rare", category: "power", minRank: 3,
  ability: { name: "Funnel", event: "FIGHT_SCORING", effects: [{ type: "PERSISTENT_BURN" }] } },
  // осадный урон (TOWER_BURN) копится между боями волны и не сбрасывается
```

### 0.3 Новые улучшения (3)

```js
{ id: "planetarium", name: "Планетарий", emoji: "🔭", rarity: "rare", cost: 5,
  type: "active", activation: { context: "shop", access: { charges: 3 } },
  effect: { type: "boostFormation", value: 0.15 },
  desc: "Кнопка в лавке: выбери формацию, которую собирал за забег — +0.15 к её множителю навсегда. 3 заряда." },
{ id: "trade_magic", name: "Торговая магия", emoji: "🛍️", rarity: "uncommon", cost: 4,
  react: [{ event: "SHOP_REROLLED", effects: [{ type: "RANDOM_HERO_RANK_UP", value: 1, cap: 12 }] }],
  desc: "Каждое обновление лавки: случайный герой колоды навсегда +1 к силе." },
{ id: "blood_oath", name: "Кровная клятва", emoji: "🩸", rarity: "mythic", cost: 9,
  react: [{ event: "WAVE_FAILED", effects: [{ type: "ALL_HEROES_RANK_UP", value: 1, cap: 12 }] }],
  desc: "Провал волны: весь ростер навсегда +1 к силе. Боль — это опыт." },
```

### 0.4 Движковые потребности (сводка)

- **Событие `ON_HELD`** — уже спроектировано в PROPOSALS_ABILITIES_SLOTS §3.3
  (Silencer, Скипетр Барона — первые потребители).
- **React-события `WAVE_CLEARED` и `SHOP_REROLLED`** — точки уже есть
  (`economy.js` реролл, зачистка в `combat.js`), нужен только emit.
- **Новые эффекты**: `GAIN_RANK_PER_FIGHT` (близнец `GAIN_RANK_PER_USED_DISCARD`),
  `ADD_POWER_NEIGHBOR_PCT`, `ADD_POWER_PER_HELD`, `MULT_PER_HELD_RANK`,
  `DESTROY_SELF_CHANCE`, `BUFF_RANK_GROUP`, `WAVE_RAMP_POWER`,
  `SET_ALL_RANKS` (PRE_DETECT-семейство), `ADD_POWER_PER_WEAK_RANK`,
  `ARMOR_FEED`, `HEAL_TO_DAMAGE`, `FAIL_BURN_PCT`, `PERSISTENT_BURN`,
  `RANDOM_HERO_RANK_UP`, `ALL_HEROES_RANK_UP`, `boostFormation` (активка).
- **Новое условие**: `FIRST_CARD_RANK_ABOVE`, `FORMATION_STREAK_ABOVE`
  (стрик формаций — зеркало `comboStreak`).
- **Правило боя `heresy`** — как `sentry`/`rule`-предметы: флаг в opts
  `FormationSys.evaluate` + ветки в `evalWhen` (Фаланга: size 3; Треугольник: >1).

---

## 1. Двадцать билдов

### Группа «Экспонента и гэмблинг»

**Ф1. «Барон и мимы»** — источник: [Baron+Mime+Steel Kings (r/balatro)](https://www.reddit.com/r/balatro/comments/1lupll3/brag_i_got_a_perfect_baron_build_on_an_unseeded/) — «hold-in-hand» экспонента, любимый «сломанный» билд сообщества.
Адаптация: **Silencer** (скамейка бьёт +2 за карту) + **Скипетр Барона** (каждый ранг 12 в руке ×1.35) + **Wraith King** (сам растёт до 12 за бои). Игра: разыгрываешь минимум, герой-легенда зреет в руке, скамейка стреляет. Страховка: Pudge-крюк возвращает карты.
Баланс: ×1.35 × N королей; реалистичный потолок ×2.7 (кап).

**Ф2. «Банан-рулетка»** — источник: Cavendish/Gros Michel, [tier-list упоминание](https://steelseries.com/blog/balatro-joker-tier-list) — самый знаменитый «предмет-трагедия».
Адаптация: **Спелый банан** (×3 множ, 30% сгниёт после волны) + страховки «Последний билет»/«Пересдача» + Miser's Chest на падающие доходы. Драма: банан умер на боссе — легенда забега.
Баланс: ожидание ×3 на ~2.5 волны — сильнее Bloodthorn, но исчезающий.

**Ф3. «Хаос-рыцарь»** — источник: Chaos Bolt-гэмблинг Dota + «plug-and-play» лотереи Balatro.
Адаптация: **Chaos Knight** (50/50: ×2 или +16) + Ogre Magi + Daedalus + «Счастливый случай». Чистая лотерейная семья: каждый бой — кости.
Баланс: матожидание ×1.5-эквивалент — в коридоре Ogre.

**Ф4. «Однорукий бандит»** — источник: слот-машина Luck Be a Landlord (рандом как ядро).
Адаптация: **Однорукий бандит** (30%: весь отряд = ранг 7) + пары 7-7 (Pudge/Juggernaut) + Satanic. Попал — Ганг/Ротация из чего угодно.
Баланс: 30% на «сложные» комбо из мусора — редкая лотерея, не автопик.

### Группа «Скалирование через боль и темп»

**Ф5. «Уроборос»** — источник: [Ouroboros (r/inscryption)](https://www.reddit.com/r/inscryption/comments/15p8ei0/which_one_would_you_pick/) — «карта, которая растёт каждый раз, когда её играешь».
Адаптация: **Wraith King** (GAIN_RANK_PER_FIGHT, кап 12) + Талисман отряда + тренировки. Ритуал: играй короля каждый бой — к акту 3 он Аегис-ранга и ядро любого строя.
Баланс: +12 рангов максимум за ~12 боёв — сопоставимо с тренировками за золото.

**Ф6. «Демоническая форма»** — источник: [Demon Form (r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/7uscpq/daily_discussiondebate_1_demon_form/) — «билд-рампа: первые бои терпи, потом не остановить».
Адаптация: **Демоническая форма** (+4 силы каждому следующему бою волны) + Штурмовой рог (первый бой +15) + оборонительные common'ы. Волновой темп: слабый старт → разгон к боссу волны.
Баланс: +12 к 4-му бою — сильнее Кровстоуна в волнах, не скейлится между волнами.

**Ф7. «Кровная клятва»** — источник: pain-scaling (Hades keepsakes, RoR2 «чем хуже — тем лучше»).
Адаптация: **Кровная клятва** (провал волны = весь ростер +1 ранг) + Huskar (+3/казарму) + Bloodstone + Перо Феникса. Осознанная «тёмная прокачка»: потеря казармы становится инвестицией.
Баланс: mythic 9G; максимум +3 ранга ростеру за 3 провала — страх уравновешен наградой.

**Ф8. «Торговая империя»** — источник: shop-scaling архетипы HS Battlegrounds; [LBaL endless-стратегии](https://www.reddit.com/r/LuckBeALandlord/comments/1ew57u2/personal_ranking_of_endless_strategies/) — «прокачивай не бой, а экономику».
Адаптация: **Торговая магия** (каждый реролл = +1 ранг случайному герою) + Mida's/Владмир + Золотой пруд (F1 из PROPOSALS_BUILDS). Лавка — твой майн.
Баланс: рост медленный и рандомный — платит золото, не ломает бой.

### Группа «Состав и роли»

**Ф9. «Три звезды»** — источник: [3★ units (r/TeamfightTactics)](https://www.reddit.com/r/TeamfightTactics/comments/1sj1e9l/3star_units/) — «собрать три звезды на юните» — радость автобаттлеров.
Адаптация: **Три звезды** (3+ героя одного ранга → каждый +50%) + Beastmaster (+5/своего ранга) + осколок Oracle «Fate Seal» + тренировки под общий ранг. Трио 7-7-7 бьёт как кэрри.
Баланс: +50% только группе — требует лаборатории, тир-5 формаций не достигает.

**Ф10. «Магнус-комбайн»** — источник: Dota Reverse Polarity — «собрал двух рядом и энчнул».
Адаптация: **Magnus** (соседи по слоту +35% их силы) + кэрри-соседи (Sven рядом с Magnus) + Клин/Стена. Позиционный усилитель: кэрри ставишь вплотную к Магнусу.
Баланс: +35% двух соседей ≈ +0.7 карты силы — сопоставимо с Sven ×1.5, но требует позиции.

**Ф11. «Еретики»** — источник: Four Fingers+Smeared (Balatro) — «правила рук переписаны».
Адаптация: **Еретик** (Фаланга от 3, Треугольник от 2 атрибутов) + монотоп-зачатки (Zeus+Lina) + Ethereal. Строй, который раньше был «почти», теперь легален.
Баланс: эпик 13G, ранг-гейт 4 — правило-ломатель по образцу рапиры.

### Группа «Осада и тех-карты»

**Ф12. «Отравитель»** — источник: [poison Silent (гайд)](https://greghowley.com/1116) — «медленная казнь: яд не смывается».
Адаптация: **Venomancer** (Poison Nova +7 после каждого боя) + **Воронка яда** (яд копится между боями волны) + Meteor Hammer. Волна умирает сама: к боссу на башне уже висит 30+ яда.
Баланс: 7×N боёв — сильный в длинных волнах, слабый в боссах одним ударом.

**Ф13. «Шив-стая»** — источник: [shiv Silent (r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/166i5bh/i_love_building_shiv_decks_with_the_silent_so/) — «мелочь, которой много, и она колет».
Адаптация: **Мелкие клинки** (+5 за героя рангом ≤4) + мелочь ростера (CM, Io, Meepo, Undying, Bounty, Muerta) + Туман-войны тех (туман их и так глушит — клинки возвращают им смысл). «Слабые карты» становятся ролью.
Баланс: 5×N мелочи — до +25 силы за пятёрку мелочи; не даёт множителей.

**Ф14. «Осадный колун»** — источник: Barricade/Body Slam (StS) — «твоя защита становится оружием».
Адаптация: **Осадный колун** (броня башни прибавляется к силе) + игры против T2/T3/броня-башен актов 2–3 + MKB (физический) как напарник. Броня-башня из кошмара становится донором.
Баланс: полезен только против брони (mr/pure обходят) — ситуативный эпик.

**Ф15. «Пугна-антхил»** — источник: anti-heal/convert-тех (Slice & Dice, «преврати их хил в боль»).
Адаптация: **Pugna** (Nether Ward: лечение башни становится уроном) + против Регенерации/Ярости-мутаций рангов 6+ и Aegis-рёллов. Тех-герой, превращающий правила боссов против них.
Баланс: без мутаций молчит — «в колоду берёшь, когда мир злой».

### Группа «Агентность и стиль»

**Ф16. «Крысиный дото»** — источник: [rat doto (r/learndota2)](https://www.reddit.com/r/learndota2/comments/1foorpr/why_has_rat_dota_made_a_comeback/) — «победа без боя» — легендарная мем-стратегия Dota.
Адаптация: **Крысиный ультиматум** (1–2 героя в бою → башня −8% maxHp сверх удара, кап 600) + Skywrath/Oracle соло-ядро + Клинок дуэлянта. Ты не тимвайпишь — ты сносишь трон крысами.
Баланс: эпик 14G, ранг-гейт 5; кап 600 запрещает печатать победу на боссах.

**Ф17. «Планетарий»** — источник: планеты Balatro («левелинг рук») — прокачка того, что ты и так собираешь.
Адаптация: **Планетарий** (3 заряда: +0.15 множителя выбранной формации навсегда) + связка со swap-подсказками: игрок целенаправленно учит ОДНУ формацию. Двойная цель — фан + обучение паттернам (ответ на «формации не выучиваются»).
Баланс: +0.45 к одной формации за забег — скромно, предсказуемо, персонально.

**Ф18. «Полароид-снайпер»** — источник: Photograph (Balatro) — «первая карта-лицо ×2».
Адаптация: **Полароид** (первый герой строю рангом 10+ → ×2) + разведчик-танк слот 1 (Centaur/Primal/Wraith King) + дешёвая свита. Вся формула завязана на «кого показать первым».
Баланс: условие видно в превью — телеграфированная лотерея без рандома.

**Ф19. «Мантра-божество»** — источник: [perma-Divinity Watcher (r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/oygne3/just_a_casual_enter_divinity_every_turn_watcher/) — «войти в божественный режим и не выходить».
Адаптация: **Мантра** (3 боя подряд одной формации → следующий ×1.75) + Juggernaut (сц Blade Dance: серия комбо) + Филактерия. Молитвенный билд: повторяй строй — стань богом.
Баланс: ×1.75 раз в 4 боя — средний ×1.19 безусловно; честно против «Адаптации мира» (штраф за повторы).

**Ф20. «Техники-сапёры»** — источник: Techies-мем Dota («герои-камикадзе») + comeback-культура.
Адаптация: **Techies** (провал волны с ним в руке: башня −10% maxHp) + Перо Феникса + Huskar. Ты допускаешь провал НАМЕРЕННО: башня после «смерти» уже надорвана. Драма в чистом виде.
Баланс: −10% за провал + казарма — дорогая цена; Techies делает её торгом.

---

## 2. Почему именно эти (логика отбора)

- **Спектакль** (Baron, Divinity, Demon Form): экспонента/режим бога — скриншотность.
- **Драма** (банан, Techies, Кровная клятва): риск с лицом — истории «а помнишь забег».
- **Агентность** (Планетарий, Магнус, Полароид): решения, а не числа.
- **Тех и перевороты правил** (Пугна, Осадный колун, Еретик): «мир злой — я злее».
- **Мемы Dota** (крысиный дото, Techies, Magnus): идентичность игры.

## 3. Балансные ручки и риски

1. Легенды вне сетки: цена рекрута ×2, максимум 2 легенды на забег (иначе ростер обесценится).
2. Все ×-множители новых предметов — с условиями или исчезающие (урок фазы D: P90 ×-стека).
3. `FAIL_BURN_PCT`-семейство требует аккуратности с провалами в A/B-боте (проверить, что бот не абузит Techies в спираль).
4. «Еретик» и «Осадный колун» — rule-слои: тестировать в обоих ядрах (classic читает `rule` иначе).
5. ON_HELD — единственная крупная движковая закупка; она же открывает билды «скамейки» из PROPOSALS_ABILITIES_SLOTS §VIII.

## 4. Порядок внедрения (когда позовёшь)

1. **Движок**: ON_HELD + WAVE_CLEARED/SHOP_REROLLED + новые эффекты (M).
2. **Волна 1 контента**: Venomancer, Wraith King, Магнус + Воронка яда, Три звезды, Полароид (6 карточек, без новых правил) — тесты по конвенции.
3. **Волна 2**: Спелый банан, Мантра, Демоническая форма, Мелкие клинки, Бандит (лотереи/рампы).
4. **Волна 3**: rule-слои (Еретик, Осадный колун, Крысиный ультиматум, Пугна, Techies) + улучшения.
5. После каждой волны: `tests/audit.mjs` + свип рангов (связка с PROPOSALS_PHASE_I).

## 5. Источники

- [Baron build (r/balatro)](https://www.reddit.com/r/balatro/comments/1lupll3/brag_i_got_a_perfect_baron_build_on_an_unseeded/) · [Baron-Mime guide (games.gg)](https://games.gg/balatro/guides/baron-mime-balatro-build/) · [Joker tier list (SteelSeries)](https://steelseries.com/blog/balatro-joker-tier-list)
- [Shiv Silent (r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/166i5bh/i_love_building_shiv_decks_with_the_silent_so/) · [Poison Silent guide](https://greghowley.com/1116) · [Demon Form (r/slaythespire)](https://www.reddit.com/r/slaythespire/comments/7uscpq/daily_discussiondebate_1_demon_form/) · [perma-Divinity Watcher](https://www.reddit.com/r/slaythespire/comments/oygne3/just_a_casual_enter_divinity_every_turn_watcher/)
- [Ouroboros (r/inscryption)](https://www.reddit.com/r/inscryption/comments/15p8ei0/which_one_would_you_pick/)
- [LBaL endless strategies (r/LuckBeALandlord)](https://www.reddit.com/r/LuckBeALandlord/comments/1ew57u2/personal_ranking_of_endless_strategies/)
- [TFT 3★ units (r/TeamfightTactics)](https://www.reddit.com/r/TeamfightTactics/comments/1sj1e9l/3star_units/)
- [Monster Train fun builds (r/MonsterTrain)](https://www.reddit.com/r/MonsterTrain/comments/vj9c6v/what_are_your_most_op_heroclan_combinations_and/)
- [Rat doto (r/learndota2)](https://www.reddit.com/r/learndota2/comments/1foorpr/why_has_rat_dota_made_a_comeback/) · [DOTABUFF: split push](https://www.dotabuff.com/blog/2016-07-04-dealing-with-splitpush)
