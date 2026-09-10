// Dalatro content — развилки после лавки (спек §4, фаза E+). Реализовано 92/100
// вариантов на расширенном наборе примитивов. Отложены с причинами:
//   #61 Свободная перестройка — перестановка в бою и так бесплатна;
//   #65 Перевёрнутая формация — требует инверсии всех позиционных правил;
//   #68 Кластер — слоты отряда в этой игре всегда непрерывны (1..N);
//   #73/76/79/97 — предсказания и обмен судьбы требуют ролла развилок вперёд
//   за пределы текущего сида.
// Примитивы: hp/reward/mods/modsRandom/gold/shopPrice/shopSlots/hand/fights/
// itemRarity/extraRecruit/recruitDiscount/gamble/gambleDice/gambleThree/allin/
// altar/loan/power/powerPerGold/hpPerItem/defensePerItem/defense/maxSlots/
// handShape/dupeHero/burnUnused/randomCardMult/banAttrs/banCount/bannedHero/
// noRepeat/wildcardCopy/twinsBonus/goldenSlot/blockedSlot/mercyWave/echoFirst/
// minFights/exileWeakestPower/returnHero/momentumBonus/pawnBonus/sin/curse.
const ROUTES_DATA = [
  // ===== КОРЕВЫЕ (1–3) =====
  { id: "normal", name: "Обычная башня", emoji: "🗼", group: "core", weight: 0,
    desc: "Стандартный следующий бой; нормальная награда." },
  { id: "camp", name: "Крип-лагерь", emoji: "🏕️", group: "core", weight: 0,
    desc: "Пропуск следующего боя: +6 золота, привал (+1 казарма), бесплатное увольнение." },

  // ===== БОЕВЫЕ (4–20) =====
  { id: "strong", name: "Сильная башня", emoji: "🏗️", group: "combat", weight: 30,
    hp: 1.35, reward: 1.6, desc: "Усиленная башня — и заметно жирнее награда." }, // #2
  { id: "elite", name: "Элитная башня", emoji: "💀", group: "combat", weight: 22,
    hp: 1.5, reward: 1.5, curse: true, itemRarity: "epic",
    desc: "Очень сильная башня с проклятием; награда ×1.5 и эпик в лавке." }, // #3
  { id: "fragile", name: "Хрупкая", emoji: "🧨", group: "combat", weight: 14,
    hp: 0.45, mods: ["thorns"], desc: "Мало HP, но большой отряд она наказывает." }, // #4
  { id: "berserk", name: "Берсерк", emoji: "😤", group: "combat", weight: 14,
    hp: 0.7, mods: ["reflection"], desc: "Меньше HP, зато каждый чётный бой слабее." }, // #5
  { id: "twin", name: "Двойная башня", emoji: "🗼", group: "combat", weight: 12, minAct: 2,
    hp: 1.6, fights: 1, reward: 1.6, desc: "Как две цели: толще, на один бой дольше, награда ×1.6." }, // #6
  { id: "siege", name: "Осадная", emoji: "🏰", group: "combat", weight: 12, minAct: 2,
    hp: 1.5, shopPrice: 0.85, desc: "Толстая башня; после её падения лавка со скидкой." }, // #7
  { id: "swift", name: "Быстрая", emoji: "💨", group: "combat", weight: 12,
    hp: 0.5, fights: -1, reward: 1.3, desc: "Полбашни HP, но тимфайтов меньше — бей точно." }, // #8
  { id: "nullarmor", name: "Нулевая броня", emoji: "🕳", group: "combat", weight: 12, minAct: 2,
    defense: 0.4, hp: 1.35, reward: 1.4, desc: "Броня и сопротивление вчетверо слабее, но HP больше." }, // #9
  { id: "lastbastion", name: "Последний бастион", emoji: "🏯", group: "combat", weight: 8, minAct: 3,
    hp: 2.2, reward: 2.5, desc: "Очень сильная башня — и очень жирная добыча." }, // #10
  { id: "reflector", name: "Отражатель", emoji: "🪞", group: "combat", weight: 10, minAct: 2,
    mods: ["reflection"], reward: 1.3, desc: "Чётные бои наносят ×0.75. Награда за риск." }, // #11
  { id: "devourer", name: "Пожиратель", emoji: "🕳️", group: "combat", weight: 10, minAct: 2,
    mods: ["regen"], reward: 1.4, desc: "Лечится после каждого боя — не растягивай волну." }, // #12
  { id: "shieldbearer", name: "Щитоносец", emoji: "🛡️", group: "combat", weight: 10,
    hp: 1.15, mods: ["glyph"], reward: 1.4, desc: "Каждый 3-й бой блокируется глифом." }, // #13
  { id: "disarmer", name: "Разоружитель", emoji: "🚫", group: "combat", weight: 10, minAct: 2,
    mods: ["disarm"], reward: 1.5, desc: "Не больше 4 героев в отряде. Награда ×1.5." }, // #14
  { id: "mutetower", name: "Немая", emoji: "🤐", group: "combat", weight: 10, minAct: 2,
    mods: ["silence"], reward: 1.5, desc: "Способности героев отключены; предметы работают." }, // #15
  { id: "thief", name: "Вор", emoji: "🦹", group: "combat", weight: 10, minAct: 2,
    mods: ["greed"], reward: 1.4, desc: "Слабый бой — башня крадёт золото." }, // #16
  { id: "formationjam", name: "Глушитель формаций", emoji: "📻", group: "combat", weight: 10, minAct: 2,
    mods: ["fog"], reward: 1.5, desc: "Герои ранга ≤4 не дают силы. Награда ×1.5." }, // #17
  { id: "hunter", name: "Охотник", emoji: "🏹", group: "combat", weight: 10, minAct: 2,
    mods: ["adaptation"], reward: 1.5, desc: "Повтор комбинации наносит ×0.5 — меняй тактики." }, // #18
  { id: "mirror", name: "Зеркало", emoji: "🪞", group: "combat", weight: 10, minAct: 2,
    hpPerItem: 40, reward: 1.6, desc: "Отражает твой билд: +40 HP за каждый твой предмет." }, // #19
  { id: "archivist", name: "Архивариус", emoji: "📚", group: "combat", weight: 10, minAct: 2,
    mods: ["archivist"], reward: 1.6, desc: "Твоё самое частое комбо наносит ×0.75." }, // #20
  { id: "anomaly", name: "Аномалия", emoji: "🌀", group: "combat", weight: 6, minRank: 6,
    reward: 1.8, modsRandom: 2, desc: "Два случайных правила на этот бой. Награда ×1.8." }, // #99
  { id: "papochka", name: "??? ПАПОЧКА", emoji: "👨", group: "combat", weight: 2, minRank: 10,
    hp: 1.4, reward: 3, modsRandom: 2,
    desc: "Он всё видел. Награда ×3 — если доживёшь." }, // #100

  // ===== ЭКОНОМИКА (21–40) =====
  { id: "goldvein", name: "Золотая жила", emoji: "⛏️", group: "economy", weight: 12,
    gold: 8, hp: 1.3, desc: "Сразу +8 золота, но следующая башня толще на треть." }, // #21
  { id: "banker", name: "Банкир", emoji: "🏦", group: "economy", weight: 10,
    gold: -5, reward: 2.2, desc: "Инвестиция −5G сейчас — победа отдаст вдвое больше." }, // #22
  { id: "greed", name: "Жадность", emoji: "💰", group: "economy", weight: 10,
    gold: 14, shopPrice: 1.25, desc: "Много золота сразу, но следующая лавка дороже." }, // #23
  { id: "taxoffice", name: "Налоговая", emoji: "🧾", group: "economy", weight: 10,
    gold: -3, reward: 1.8, desc: "Взнос −3G сейчас — следующая победа богаче." }, // #24
  { id: "wealth", name: "Богатство", emoji: "💎", group: "economy", weight: 10,
    powerPerGold: 0.2, desc: "Каждые 5G казны конвертируются в +1 сила этому бою (золото остаётся)." }, // #25
  { id: "bankruptcy", name: "Банкротство", emoji: "🕳️", group: "economy", weight: 8,
    goldAll: true, shopPrice: 0, desc: "Сбросить ВСЁ золото → следующая лавка полностью бесплатна." }, // #26
  { id: "inflationroute", name: "Инфляция", emoji: "📈", group: "economy", weight: 9,
    shopInflation: true, reward: 1.4, desc: "Первая покупка −2G, каждая следующая +1G. Награда ×1.4." }, // #27
  { id: "usury", name: "Лихва", emoji: "🤲", group: "economy", weight: 9,
    loan: { gain: 12, repay: 15 }, desc: "Заём: +12G сейчас, −15G после следующей зачистки." }, // #28
  { id: "casinoroute", name: "Казино", emoji: "🎰", group: "economy", weight: 8,
    gamble: { chance: 0.5, win: 12 }, desc: "50%: +12 золота. 50%: пусто." }, // #29
  { id: "loanshark", name: "Ростовщик", emoji: "🕴️", group: "economy", weight: 7, minAct: 2,
    loan: { gain: 25, repay: 32 }, desc: "Большой аванс: +25G сейчас, −32G после зачистки." }, // #30
  { id: "blackmarket", name: "Чёрный рынок", emoji: "🕶️", group: "economy", weight: 9, minAct: 2,
    itemRarity: "rare", shopPrice: 1.1, desc: "В следующей лавке ждёт редкий товар (чуть дороже)." }, // #31
  { id: "salered", name: "Распродажа", emoji: "🏷️", group: "economy", weight: 9,
    shopPrice: 0.7, shopSlots: -2, reward: 1.2, desc: "Лавка −30%, но на 2 товара беднее." }, // #32
  { id: "junkyard", name: "Уценка хлама", emoji: "🗑️", group: "economy", weight: 8,
    freeCommons: 2, desc: "Два слабых (обычных) товара в следующей лавке — бесплатно." }, // #33
  { id: "smuggling", name: "Контрабанда", emoji: "📦", group: "economy", weight: 7, minAct: 1,
    itemRarity: "epic", hp: 1.25, desc: "Эпик раньше времени — но башня под охраной (+25% HP)." }, // #34
  { id: "repairshop", name: "Ремонтная мастерская", emoji: "🔧", group: "economy", weight: 9,
    momentumBonus: 3, desc: "Импульс +3 серии сразу (не выше капа)." }, // #35
  { id: "forge", name: "Кузница", emoji: "⚒️", group: "economy", weight: 9,
    power: 8, gold: -3, desc: "Кузнец наточит отряд: +8 силы бою, работа стоит 3G." }, // #36
  { id: "exchanger", name: "Обменник", emoji: "🔄", group: "economy", weight: 8, minAct: 2,
    exchangeItem: true, desc: "Случайный твой предмет заменяется на случайный той же редкости." }, // #37
  { id: "pawnshop", name: "Ломбард", emoji: "🏮", group: "economy", weight: 8,
    pawnBonus: 50, desc: "Следующая продажа предмета идёт за +50% к половине цены." }, // #38
  { id: "brokenrelic", name: "Сломанная реликвия", emoji: "⚒️", group: "economy", weight: 7, minAct: 2,
    itemGiftNow: "epic", modsRandom: 1, desc: "Эпический предмет сразу, но башня получает случайное правило." }, // #39
  { id: "cursedshop", name: "Проклятая лавка", emoji: "☠️", group: "economy", weight: 7, minAct: 2,
    shopPrice: 0.55, curse: true, desc: "Лавка почти даром — но на башне проклятие." }, // #40

  // ===== РУКА И ОТРЯД (41–60) =====
  { id: "extendedhand", name: "Расширенная рука", emoji: "🖐️", group: "hand", weight: 10,
    hand: 2, desc: "Следующая волна играется с +2 картами в руке." }, // #41
  { id: "emptyhand", name: "Пустая рука", emoji: "🤏", group: "hand", weight: 8,
    hand: -1, power: 8, desc: "−1 карта в руке, зато +8 силы каждому бою волны." }, // #42
  { id: "dupe", name: "Дублирование", emoji: "👥", group: "hand", weight: 8,
    dupeHero: true, desc: "Случайный герой руки получает копию в колоду — пара из одного героя!" }, // #43
  { id: "burningcard", name: "Горящая карта", emoji: "🔥", group: "hand", weight: 8,
    burnUnused: true, reward: 1.5, desc: "Не зачистишь волну с первого раза — случайная карта руки сгорит." }, // #44
  { id: "instability", name: "Нестабильность", emoji: "🎲", group: "hand", weight: 8,
    randomCardMult: true, reward: 1.4, desc: "Случайная карта боя получает множитель от ×0.5 до ×2 — узнаешь по факту." }, // #45
  { id: "ban", name: "Запрет", emoji: "🚫", group: "hand", weight: 8,
    banAttrs: 1, reward: 1.4, desc: "Случайный атрибут запрещён в следующем бою." }, // #46
  { id: "sequence", name: "Последовательность", emoji: "➡️", group: "hand", weight: 8, minAct: 2,
    noRepeat: true, reward: 1.4, desc: "Герой, ходивший в прошлом бою, не идёт в следующем." }, // #47
  { id: "wildcardroute", name: "Wildcard", emoji: "🃏", group: "hand", weight: 8, minAct: 2,
    wildcardCopy: true, reward: 1.3, desc: "Слабейший герой боя копирует сильнейшего (75% силы)." }, // #48
  { id: "bloodhand", name: "Кровавая рука", emoji: "🩸", group: "hand", weight: 8, minAct: 2,
    handShape: { firstN: 1, firstMult: 1.3, restMult: 0.9 }, reward: 1.4,
    desc: "Первая карта ×1.3, остальные ×0.9 — порядок решает." }, // #49
  { id: "lifeexchange", name: "Обмен жизнью", emoji: "💔", group: "hand", weight: 7, minAct: 2,
    exileWeakestPower: 10, desc: "Слабейший герой колоды уходит — +10 силы бою за его жизнь." }, // #50
  { id: "tavernroute", name: "Таверна", emoji: "🍺", group: "hand", weight: 9,
    extraRecruit: 1, desc: "Таверна предложит третьего героя." }, // #51
  { id: "mercenary", name: "Наёмник", emoji: "💪", group: "hand", weight: 8, minAct: 2,
    power: 15, reward: 0.9, desc: "Наёмник сражается за тебя: +15 силы, награда скромнее." }, // #52
  { id: "halfhero", name: "Герой за полцены", emoji: "🪙", group: "hand", weight: 8,
    recruitDiscount: 0.5, desc: "Рекруты в следующей таверне за полцены." }, // #53
  { id: "rotation", name: "Ротация", emoji: "🔄", group: "hand", weight: 7, minAct: 2,
    bannedHero: true, reward: 1.4, desc: "Твой самый используемый герой отдыхает этот бой." }, // #54
  { id: "duel", name: "Героическая дуэль", emoji: "⚔️", group: "hand", weight: 8, minAct: 2,
    fights: -2, reward: 1.5, power: 5, desc: "Минимум движений: на 2 тимфайта меньше, награда ×1.5." }, // #55
  { id: "ascension", name: "Вознесение", emoji: "🌟", group: "hand", weight: 8,
    heroAscend: true, reward: 0.9, desc: "Сильнейший герой боя восходит: ×1.5 к его силе." }, // #56
  { id: "sacrifice", name: "Жертва", emoji: "🔪", group: "hand", weight: 7, minAct: 2,
    exileWeakestPower: 12, desc: "Слабейший уходит в жертву — +12 силы бою." }, // #57
  { id: "twinsroute", name: "Близнецы", emoji: "👯", group: "hand", weight: 8,
    twinsBonus: 8, desc: "Два одинаковых героя в отряде: +8% урона." }, // #58
  { id: "conflict", name: "Конфликт", emoji: "⚡", group: "hand", weight: 7, minAct: 3,
    banAttrs: 2, reward: 2, desc: "ДВА случайных атрибута под запретом. Награда ×2." }, // #59
  { id: "returnroute", name: "Возвращение", emoji: "👻", group: "hand", weight: 8,
    returnHero: true, desc: "Последний уволенный герой бесплатно возвращается в колоду." }, // #60

  // ===== ПОЗИЦИИ (62–70) =====
  { id: "blockedslot", name: "Заблокированная клетка", emoji: "⛔", group: "hand", weight: 8, minAct: 2,
    blockedSlot: true, reward: 1.4, desc: "Одна позиция строя недоступна." }, // #62
  { id: "goldslot", name: "Золотая клетка", emoji: "🟨", group: "hand", weight: 9,
    goldenSlot: true, reward: 1.2, desc: "Случайная позиция даёт стоящему на ней +50% силы." }, // #63
  { id: "floatingpos", name: "Плавающие позиции", emoji: "🌀", group: "hand", weight: 7, minAct: 2,
    floatingHands: true, reward: 1.2, desc: "После каждого боя рука перемешивается." }, // #64
  { id: "lonewolf", name: "Одинокий волк", emoji: "🐺", group: "hand", weight: 8, minAct: 2,
    maxSlots: 1, power: 18, reward: 1.6, desc: "Только один слот в отряде — но +18 силы." }, // #69
  { id: "architect", name: "Архитектор", emoji: "🏗", group: "hand", weight: 7, minRank: 4,
    maxSlots: 6, desc: "Временный шестой слот формации!" }, // #70

  // ===== ИНФОРМАЦИЯ (71–79) =====
  { id: "scout", name: "Разведка", emoji: "🔭", group: "info", weight: 9,
    scout: true, desc: "Показывает следующие три башни маршрута." }, // #71
  { id: "shoppeek", name: "Просмотр магазина", emoji: "👁️", group: "info", weight: 9,
    shopPeek: true, desc: "Показывает товары следующей лавки прямо на развилке." }, // #75
  { id: "scanner", name: "Сканер", emoji: "📡", group: "info", weight: 8,
    scanner: true, desc: "Показывает точные броню и сопротивление следующей башни." }, // #77

  // ===== РИСК (80–100) =====
  { id: "secondtry", name: "Вторая попытка", emoji: "↩️", group: "risk", weight: 8,
    routeUndo: true, desc: "Выберешь путь — сможешь один раз отменить решение." }, // #80
  { id: "coinflip", name: "Монетка", emoji: "🪙", group: "risk", weight: 6,
    gamble: { chance: 0.5, win: 20 }, desc: "Огромный куш или ничего." }, // #81
  { id: "dice", name: "Кости", emoji: "🎲", group: "risk", weight: 8,
    gambleDice: [2, 4, 6, 8, 12, 18], desc: "Бросок 1–6: от +2G до +18G." }, // #82
  { id: "allin", name: "Ва-банк", emoji: "💸", group: "risk", weight: 6, minAct: 2,
    allin: { chance: 0.5, mult: 2.5 }, desc: "Ставишь ВСЁ золото: 50% — ×2.5, 50% — пусто." }, // #83
  { id: "blackcontract", name: "Чёрный контракт", emoji: "🖤", group: "risk", weight: 8, minAct: 2,
    power: 20, hp: 1.5, reward: 1.3, desc: "+20 силы бою — но башня толще в полтора раза." }, // #84
  { id: "devildeal", name: "Сделка с дьяволом", emoji: "😈", group: "risk", weight: 6, minAct: 2,
    handSlots: 1, curse: true, desc: "+1 слот руки сейчас — но на башне проклятие." }, // #85
  { id: "riskypath", name: "Рискованный путь", emoji: "🎯", group: "risk", weight: 8, minAct: 2,
    randomHp: [0.6, 1.8], itemRarity: "rare", desc: "HP башни случайно от ×0.6 до ×1.8. Зато редкий товар в лавке." }, // #86
  { id: "threedoors", name: "Три двери", emoji: "🚪", group: "risk", weight: 7, minAct: 2,
    gambleThree: true, desc: "Три исхода наудачу: +15G, редкий предмет или пусто." }, // #87
  { id: "debt", name: "Долг", emoji: "📜", group: "risk", weight: 8,
    power: 15, debtGold: 12, desc: "+15 силы бою — но −12G после следующей зачистки." }, // #88
  { id: "lastchance", name: "Последний шанс", emoji: "🌅", group: "risk", weight: 7, minAct: 2,
    mercyWave: true, desc: "Провал этого боя не отнимет казарму — но заберёт всё золото." }, // #89
  { id: "altar", name: "Алтарь", emoji: "🗿", group: "risk", weight: 7, minAct: 2,
    altar: true, desc: "Пожертвуй до 10G: случайный мощный бонус — эпик, +25 силы или пусто." }, // #90
  { id: "mirrorreality", name: "Зеркальная реальность", emoji: "🔮", group: "risk", weight: 7, minAct: 3,
    defensePerItem: 3, reward: 2, desc: "Башня отражает билд: +3 брони за каждый твой предмет. Награда ×2." }, // #91
  { id: "overheat", name: "Перегрев", emoji: "🌡️", group: "risk", weight: 8, minAct: 2,
    handShape: { firstN: 2, firstMult: 1.5, restMult: 0.6 }, reward: 1.5,
    desc: "Первые две карты ×1.5, остальные ×0.6." }, // #92
  { id: "voidhand", name: "Пустота", emoji: "🌌", group: "risk", weight: 7, minAct: 3,
    hand: -1, power: 14, reward: 1.3, desc: "−1 слот руки, оставшиеся усиливаются: +14 силы." }, // #93
  { id: "timepress", name: "Время", emoji: "⏱️", group: "risk", weight: 7, minAct: 2,
    minFights: 2, reward: 1.5, desc: "Победа за один тимфайт? Награда режется вдвое — растяни бой." }, // #94
  { id: "secondlife", name: "Вторая жизнь", emoji: "🕯️", group: "risk", weight: 6, minAct: 2,
    secondLife: true, desc: "Раз за забег провал не отнимет последнюю казарму — но награды забега −25%." }, // #95
  { id: "echo", name: "Эхо", emoji: "📢", group: "risk", weight: 7, minRank: 4,
    echoFirst: true, desc: "В первом бою волны способности героев срабатывают дважды." }, // #96
  { id: "sin", name: "Грех", emoji: "🖤", group: "risk", weight: 7, minAct: 3,
    sin: { dmg: 3, discards: -1 }, desc: "Постоянно: +3% урона, но −1 ТП-сброс за волну. До конца забега." }, // #98
];
