# dotora — Предложения: позиционные способности героев (слоты 1–5)

Дата: 2026-09-12 · Статус: частично реализовано (батч v0.5, см. §1a); остальное — бэклог.
Скоуп: **57 новых способностей** для ростера 44 героев, закрывающих дыру «слот 2 / слот 4 / край», плюс toolbox из ~15 новых декларативных условий и 2–3 эффектов.

## 1a. Реализованный батч (v0.5)

Из каталога §4 внедрены 12 замен (кластеры I–III, V–VIII): Juggernaut **Escort**,
Legion **Moment of Courage**, PL **Spirit Lance**, Tidehunter **Anchor Smash**,
Outworld **Astral Imprisonment**, Dawnbreaker **Fire Ring**, Undying **Risen Legion**,
Io **Tether Pull**, Muerta **Pallbearer**, Storm **Electric Swing**, Void Spirit
**Prism Line**, Tiny **Rock Slide**. Из toolbox — условия `STRONGEST_IS_AHEAD`,
`NEIGHBOR_RANK_ABOVE/BELOW/SAME`, `NO_ADJACENT_SAME_ATTR`; плюс 2 новые формации
**Клещи** и **Зеркальный строй** (с гейтом 4+ героев — на тройках вырождаются).
Axe (Counter Helix), Ursa (Enrage) и остальные системные способности сохранены.
Позиционных способностей в ростере: 14 → 23 из 44; строгих якорей: слот 2: 0 → 2,
слот 4: 0 → 3, последний: 1 → 2; соседских и относительных: 7 → 13.

Документ отвечает на три вопроса: (а) где именно сейчас дыры в слот-зависимостях,
(б) какие практики позиционности есть у похожих игр и что из них переносится,
(в) какие конкретно абилки дать героям — с готовыми спеками в формате движка.

---

## 1. Диагноз: где дыры (по коду)

Прошёлся по `src/content/heroes.js`, `src/content/aghanims.js`, `src/content/items.js`,
`src/content/upgrades.js`, `src/content/world.js`.

### 1.1 Базовые способности (44 героя)

| Зависимость | Герои | Кол-во |
|---|---|---|
| **Слот 1** (`SLOT_IS 0`) | Centaur (Trample), Juggernaut (Blade Fury), Storm Spirit (Ball Lightning) | **3** |
| **Третья позиция** (`SLOT_IS 2`) | Primal (точный центр, только при 5), Kunkka (3-й из 4+), Muerta (3-й из 3+, т.е. «последний» при коротком строе) | **3** |
| **Слот 2** (`SLOT_IS 1`) | — | **0** |
| **Слот 4** (`SLOT_IS 3`) | — | **0** |
| **Последний** (`SLOT_IS_LAST`) | Snapfire | **1** |
| **Соседские** (позиционные, но без жёсткого слота) | Tusk (за соседа), Morphling (копия слева), Terrorblade (копия справа), Zeus/Meepo/Rubick (атрибут соседа), Marci (сосед отличается) | 7 |
| Системные (комбо/сброс/экономика/атрибуты) | остальные 23 | 23 |

**Строгих позиционных 7 из 44 (16%), и все семь сидят на слотах 1, 3 и «последний». Слоты 2 и 4 не упражняет ни одна базовая способность.**

### 1.2 Почему ощущается «очень много от первого и центрального»

Строгих героев мало, но субъективно нагрузка на слот 1/центр выше, потому что:

- **Формации** (`world.js`) наказывают за тот же выбор: Стена (первые два — Силовики),
  Клин (сильнейший в центре), Рампа (по возрастанию), 4 Protect 1 (кэрри в центре),
  связки «Фронт»/«Тыл». Советчик и подсказки героев транслируют это прямо в бой.
- **Агианимы** дублируют те же якоря: Centaur-sc («не первый»), Primal-sc (слоты 1–3),
  Kez-sc и Axe-sh («середина»), Marci-sc/sh (соседи), Muerta-sh (3-й или последний).
- Тонкость: `IS_MIDDLE_SLOT` при строе из 3–4 карт указывает на **index 1, т.е. слот 2**
  (`floor((n−1)/2)`), но игрок читает это как «середина» и слоты в голове не разделяются.

Итог: слоты 1 и «центр» получают три слоя внимания (формации + герои + агианимы),
слоты 2 и 4 — ноль прямых причин их выбирать, кроме соседских условий.

### 1.3 Что уже есть и работает — опора для новых абилок

- Движок триггеров прогоняет героев **в порядке слотов**, в контексте есть
  `slotIndex`, `playedCards`, `card` (`engine/triggers.js`) — любые позиционные
  условия ложатся без изменения пайплайна.
- 25+ готовых примитивов условий/эффектов: `SLOT_IS`, `SLOT_IS_LAST`,
  `IS_MIDDLE_SLOT`, `NEIGHBOR_ATTR_IS`, `BOTH_NEIGHBORS_*`, `SLOT_CHANGED`,
  `SLOT_LEFT/RIGHT_EXISTS`, `ADD_POWER_PER_NEIGHBOR[_ATTR]`,
  `ADD_POWER_FIRST/LAST/CENTER/EDGES/WEAKEST`, `ADD_POWER_PER_PLAYED`,
  `ADD_MULT_PER_PLAYED/ATTRIBUTE`, `ADD_POWER_PER_SAME_RANK`, `OVERKILL_RATE` и т.д.
- Формат «данные, не код» выдержит +57 абилок: каждая — объект `{event, when?, chance?, effects[]}`.

---

## 2. Практики похожих игр: что берём, что нет

| Игра | Механика | Что адаптируем |
|---|---|---|
| **Luck Be a Landlord** | Ядро дохода — соседство: символы платят только рядом с X; предметы переопределяют правила соседства (углы считаются соседями всем) | Соседство как **первоклассная** валюта; идея «сломанного правила соседства» — кандидат в предмет/элитку, не в героев |
| **Balatro** | Джокеры «held in hand» (Baron, Shoot the Moon, Mime): карты, оставшиеся в руке, скорят сами | Новый слот событий **ON_HELD** — «герои, оставшиеся в руке, вносят вклад в бой» (кластер VIII) |
| **Monster Train** | Этажи + front/back: танк спереди держит, скалится тыл; «super floor» — стек усиления на одной позиции | Роль = позиция: фронт — инициаторы/танки, тыл — скалирующиеся. Осознанное назначение слотов 4 |
| **Slice & Dice** | Задняя линия недостижима для ближнего боя, обмены героев — ресурс | Перестановка как **ресурс решения**: динамические условия (тот же/другой слот, чем в прошлом бою) |
| **Wildfrost** | Перестановки каждый ход обязательны — позиция главный ресурс хода | То же: каждое перетаскивание должно иметь шанс что-то включить, а не только «Клин собрать» |
| **Inscryption** | Лейны + сигилы: Mirror (копия напротив), Guardian (обмен) | **Зеркальные условия**: слот `i` ↔ слот `n−1−i` (симметрия строя) |
| **Cobalt Core / Gordian Quest** | Ряды и инициатива, абилки с условиями «в какой линии стою» | Абсолютные слоты как дешёвый телеграф (понятно с первой секунды) |
| **Hearthstone Battlegrounds** | Контрпример: позиция почти не важна → бои сводятся к статам | Чего избегаем: чтобы позиция была НЕобязательной косметикой |

Ключевой вывод: **лучшие реализации разнообразия — не «каждому слоту по константе»,
а смесь трёх якорей**: (1) абсолютные слоты — телеграф для новичка; (2) относительные
якоря («рядом с сильнейшим») — масштабируются на любой размер строя; (3) форма/симметрия
строя — поздняя глубина. Ровно их я и раскладываю на героев в §4.

---

## 3. Toolbox: минимальные дополнения движка

Все абилки из §4 делятся на две группы: **S** — собираются из существующих
примитивов, **M** — нужен один новый декларативный примитив. Ни одна не требует
менять `combat.js`/`game.js` (кроме ON_HELD).

### 3.1 Новые условия (`engine/conditions.js`, каждый 3–8 строк, тестируемый)

| Условие | Семантика | Для кого |
|---|---|---|
| `SLOT_FROM_END_IS` | Слот с конца: 0 = последний, 1 = предпоследний | Oracle, Pudge |
| `SLOT_PARITY_IS` | Чётный/нечётный слот (по счёту с 1) | Rubick, CM |
| `SLOT_IS_EDGE` | На левом/правом/любом краю строя | Dawnbreaker |
| `NEXT_TO_STRONGEST` / `NEXT_TO_WEAKEST` | Сосед по слоту — сильнейший/слабейший из строя | Centaur, Huskar, Sven, Tiny |
| `STRONGEST_IS_AHEAD` | Сильнейший стоит раньше меня (защищает) | Juggernaut, Kunkka |
| `NEIGHBOR_RANK_ABOVE/BELOW/SAME` | Сосед сильнее/слабее/той же силы | Storm, Kez, Meepo |
| `BOTH_NEIGHBORS_WEAKER` | Оба соседа слабее меня («пик в центре» на уровне абилки) | Primal |
| `MIRROR_SLOT_ATTR_SAME` / `_RANK_SAME` | Зеркальная карта (n−1−i) того же атрибута/ранга | Morphling, Terrorblade |
| `RANKS_DESCENDING` | Силы строго убывают (зеркало Рампы) | Tusk |
| `RANKS_PALINDROME` | Строй-палиндром по рангам | Enigma |
| `NO_ADJACENT_SAME_ATTR` | Никакие два соседа не одного атрибута | Void Spirit |
| `SLOT_SAME_AS_LAST` | Стою на том же слоте, что в прошлом бою (инверсия `SLOT_CHANGED`) | Centaur |
| `RANK_RUN` | Серия из N подряд рангов (перенос из formation-слоя в общий `Cond`) | Beastmaster |

### 3.2 Новые эффекты (`engine/effects.js`)

| Эффект | Семантика | Для кого |
|---|---|---|
| `ADD_MULT_PER_NEIGHBOR_ATTR` | +множитель за соседа атрибута X (mult-версия существующего power-эффекта) | Lina |
| `ADD_POWER_PER_STEP_FROM_STRONGEST` | +сила × расстояние до сильнейшего (дальше — больше) | Faceless |

### 3.3 Новое событие (единственная точка в `combat.js`)

- **`ON_HELD`** — срабатывает один раз за бой после детекции; в контекст приходит
  `handCards` (кто остался в руке). Абилки «сидящих на скамейке» — прямой порт
  Balatro-практики. Трудозатраты M: одна строка диспетча + ctx-поле.

### 3.4 Переиспользуется без изменений

`SLOT_IS`, `SLOT_IS_LAST`, `IS_MIDDLE_SLOT`, `ADD_POWER`, `ADD_MULT`, `MULT_MULT`,
`ADD_POWER_PER_PLAYED`, `ADD_MULT_PER_PLAYED`, `ADD_MULT_PER_ATTRIBUTE`,
`ADD_POWER_PER_NEIGHBOR`, `ADD_POWER_PER_NEIGHBOR_ATTR`, `ADD_POWER_PER_SAME_RANK`,
`ADD_POWER_PER_DISCARD`, `ADD_POWER_FIRST_CARD`, `ADD_POWER_LAST_CARD`,
`ADD_POWER_EDGES`, `OVERKILL_RATE`, `LAST_HIT_GOLD`.

---

## 4. Каталог: 57 способностей

Формат: герой — **название** — спек в формате движка. Метка:
`[замена]` — предлагаю заменить текущую базовую способность,
`[альт]` — альтернативная версия (пул перековки/выбора, см. §7).
Числа держатся в существующих коридорах: +7…12 силы, +1…2 множителя, ×1.4–1.6.

### Кластер I — Слот 2 («второй номер», index 1) — 8

До сих пор слот 2 не выбирал ни один герой. Здесь его назначение: **темповой
второй номер**, который усиливает заход первого.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 1 | Legion Commander | **Moment of Courage** `[замена]` | `ON_PLAY, SLOT_IS 1 → ADD_POWER 10` (Duel остаётся в виде скипетра Duel+) |
| 2 | Ogre Magi | **Ignite** `[альт]` | `ON_PLAY, SLOT_IS 1 → ADD_MULT 2` |
| 3 | Phantom Lancer | **Spirit Lance** `[альт]` | `ON_PLAY, SLOT_IS 1 → ADD_POWER 7` |
| 4 | Slark | **Shadow Dance** `[альт]` | `FIGHT_SCORING, SLOT_IS 1 → ADD_POWER 8` |
| 5 | Marci | **Dispose** `[альт]` | `ON_PLAY, SLOT_IS 1 → ADD_POWER_FIRST_CARD pct 30` — швыряет первого вперёд |
| 6 | Zeus | **Arc Lightning** `[альт]` | `FIGHT_SCORING, SLOT_IS 1 → ADD_MULT_PER_ATTRIBUTE int 0.5` — гроза собирает магов |
| 7 | Undying | **Corpse Shield** `[альт]` | `FIGHT_SCORING, SLOT_IS 1 → ADD_POWER_PER_DISCARD 2, cap 10` |
| 8 | Beastmaster | **Inner Beast** `[альт]` | `FIGHT_SCORING, SLOT_IS 1 → ADD_MULT_PER_PLAYED 0.3` |

### Кластер II — Слот 4 («тыл», index 3) — 7

Назначение слота 4: **скалирующийся тыл** (урок Monster Train) — герой, которому
не нужен фронт, он копит мощь до финального удара.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 9 | Outworld Destroyer | **Astral Imprisonment** `[альт]` | `ON_PLAY, SLOT_IS 3 → ADD_POWER 12` |
| 10 | Ancient Apparition | **Cold Front** `[альт]` | `ON_PLAY, SLOT_IS 3 → ADD_MULT 2` |
| 11 | Invoker | **Sun Strike** `[альт]` | `FIGHT_SCORING, SLOT_IS 3 → ADD_MULT_PER_PLAYED 0.5` |
| 12 | Ursa | **Fury Swipes** `[альт]` | `ON_PLAY, SLOT_IS 3 → ADD_POWER_PER_SAME_RANK 5` — добивает тех же рангов |
| 13 | Terrorblade | **Metamorphosis** `[альт]` | `FIGHT_SCORING, SLOT_IS 3 → ADD_POWER 12` |
| 14 | Tidehunter | **Anchor Smash** `[альт]` | `FIGHT_SCORING, SLOT_IS 3 → ADD_POWER 10` |
| 15 | Dawnbreaker | **Fire Ring** `[альт]` | `FIGHT_SCORING, SLOT_IS 3 → ADD_MULT_PER_ATTRIBUTE uni 1` |

### Кластер III — Последний и предпоследний — 8

Край справа — **финишер/саппорт**: добивает, добирает золото, закрывает строй.
Новый якорь «предпоследний» (`SLOT_FROM_END_IS 1`) добавляет вторую точку и
заодно работает при любом размере строя.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 16 | Phantom Assassin | **Shadow Strike** `[альт]` | `ON_PLAY, SLOT_IS_LAST → MULT_MULT 1.4` — удар из тени |
| 17 | Muerta | **Pallbearer** `[альт]` | `FIGHT_SCORING, SLOT_IS_LAST → ADD_MULT 1` |
| 18 | Oracle | **Last Rites** `[альт]` | `FIGHT_SCORING, SLOT_FROM_END_IS 1 → ADD_MULT 2` |
| 19 | Tinker | **March of the Machines** `[альт]` | `ON_PLAY, SLOT_IS_LAST → ADD_POWER 12` |
| 20 | Bounty Hunter | **Cutpurse** `[альт]` | `FIGHT_SCORING, SLOT_IS_LAST → OVERKILL_RATE 1.5` — добиваешь с тыла: больше золота |
| 21 | Snapfire | **Seconds** `[альт]` | `FIGHT_SCORING, SLOT_IS_LAST → ADD_POWER_PER_PLAYED 3` |
| 22 | Io | **Parting Gift** `[альт]` | `FIGHT_SCORING, SLOT_IS_LAST → ADD_MULT_PER_ATTRIBUTE str 0.5` |
| 23 | Pudge | **Backdoor** `[альт]` | `FIGHT_SCORING, SLOT_FROM_END_IS 1 → ADD_POWER 9` |

### Кластер IV — Середина при любом размере строя — 4

`IS_MIDDLE_SLOT` уже в движке, но в базе его нет вовсе. Приятная деталь:
при строе из 3–4 карт «середина» = слот 2, при 5 — слот 3. То есть этот кластер
**мягко упражняет и слот 2, и центр** одной механикой.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 24 | Axe | **Helix Pivot** `[альт]` | `ON_PLAY, IS_MIDDLE_SLOT → ADD_POWER 8` (синергия с шардом Berserker) |
| 25 | Ursa | **Enrage** `[альт]` | `FIGHT_SCORING, IS_MIDDLE_SLOT → ADD_POWER 12` — прикрытый в центре бьёт злее |
| 26 | Skywrath Mage | **Eye of the Storm** `[альт]` | `FIGHT_SCORING, IS_MIDDLE_SLOT → MULT_MULT 1.4` |
| 27 | Kez | **Falcon Glide** `[альт]` | `FIGHT_SCORING, all[IS_MIDDLE_SLOT, PLAYED_COUNT_IS 4] → ADD_POWER 10` — середина четвёрки |

### Кластер V — Относительные якоря — 10

Главный ответ на «мёртвые слоты»: условия относительные («рядом с сильнейшим»),
а **какой физический слот для этого выбрать — решает игрок**. Работают при любом
размере строя и учат читать состав, а не заучивать позиции.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 28 | Sven | **Bodyguard** `[альт]` | `FIGHT_SCORING, NEXT_TO_WEAKEST → ADD_MULT 1` |
| 29 | Centaur | **Bulwark** `[альт]` | `ON_PLAY, NEXT_TO_STRONGEST → ADD_POWER 10` |
| 30 | Juggernaut | **Escort** `[альт]` | `FIGHT_SCORING, STRONGEST_IS_AHEAD → ADD_MULT 1` — идёт за кэрри |
| 31 | Storm Spirit | **Electric Swing** `[альт]` | `ON_PLAY, NEIGHBOR_RANK_ABOVE → ADD_POWER 9` — прыгает к сильному |
| 32 | Kez | **Grappling Claw** `[альт]` | `ON_PLAY, NEIGHBOR_RANK_BELOW → ADD_MULT 1` |
| 33 | Tiny | **Big Little Brother** `[альт]` | `FIGHT_SCORING, NEXT_TO_WEAKEST → ADD_POWER 8` |
| 34 | Primal Beast | **Earthshatter** `[альт]` | `FIGHT_SCORING, BOTH_NEIGHBORS_WEAKER → MULT_MULT 1.5` — «пик в центре» без привязки к 5 картам |
| 35 | Huskar | **Life Break** `[альт]` | `ON_PLAY, NEXT_TO_STRONGEST → ADD_POWER 9` |
| 36 | Meepo | **Poof Chain** `[альт]` | `ON_PLAY, NEIGHBOR_RANK_SAME → ADD_POWER 7` — прыжок к тёзке по рангу |
| 37 | Kunkka | **X Marks** `[альт]` | `FIGHT_SCORING, STRONGEST_IS_AHEAD → ADD_POWER_PER_PLAYED_AFTER 3` |

### Кластер VI — Соседство и зеркала — 7

Развитие соседской школы (Tusk/Morphling/Zeus) новыми типами связи: не «атрибут
соседа», а ранг соседа, пара соседей, зеркальная симметрия строя.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 38 | Anti-Mage | **Counterspell** `[альт]` | `FIGHT_SCORING, NEIGHBOR_ATTR_DIFFERS → ADD_MULT 1` — mult-версия Sidekick |
| 39 | Lina | **Ember Link** `[альт]` | `FIGHT_SCORING, ADD_MULT_PER_NEIGHBOR_ATTR int 0.5` (новый эффект) |
| 40 | Pudge | **Rot Cloud** `[альт]` | `ON_PLAY, ADD_POWER_PER_NEIGHBOR 5` |
| 41 | Undying | **Risen Legion** `[альт]` | `ON_PLAY, ADD_POWER_PER_NEIGHBOR_ATTR str 4` — зомби жмутся к Силе |
| 42 | Morphling | **Mirror Image** `[альт]` | `FIGHT_SCORING, MIRROR_SLOT_ATTR_SAME → ADD_MULT 1` |
| 43 | Terrorblade | **Reflection** `[альт]` | `FIGHT_SCORING, MIRROR_SLOT_RANK_SAME → ADD_POWER 10` — зеркальная пара рангов |
| 44 | Io | **Tether Pull** `[альт]` | `ON_PLAY, NEIGHBOR_ATTR_IS str → ADD_MULT 1` — перевод Tether из силы в множитель |

### Кластер VII — Форма строя, чёт/нечёт, симметрия — 7

Поздний слой глубины: игрок читает **весь строй** как фигуру. Пары «чёт/нечёт»
(Rubick+CM) — осознанный приём: две карты-двойняшки с одной механикой.

| # | Герой | Способность | Спек |
|---|---|---|---|
| 45 | Rubick | **Arcane Symmetry** `[альт]` | `FIGHT_SCORING, SLOT_PARITY_IS odd → ADD_POWER 6` |
| 46 | Crystal Maiden | **Twin Frost** `[альт]` | `FIGHT_SCORING, SLOT_PARITY_IS even → ADD_MULT 1` |
| 47 | Tusk | **Glacier Drop** `[альт]` | `FIGHT_SCORING, RANKS_DESCENDING → ADD_POWER 12` — снежок катится вниз |
| 48 | Enigma | **Paradox** `[альт]` | `FIGHT_SCORING, RANKS_PALINDROME → ADD_MULT 2` |
| 49 | Tiny | **Rock Slide** `[альт]` | `FIGHT_SCORING, ADD_POWER_EDGES pct 25` — бьёт краями строя |
| 50 | Void Spirit | **Prism Line** `[альт]` | `FIGHT_SCORING, NO_ADJACENT_SAME_ATTR → ADD_MULT 2` |
| 51 | Beastmaster | **Stampede** `[альт]` | `FIGHT_SCORING, RANK_RUN 3 → ADD_POWER 10` — стадо тремя волнами |

### Кластер VIII — Динамика позиций, память, «в руке» — 6

Позиция как ресурс во времени: тот же/другой слот, чем в прошлом бою; расстояние
до сильнейшего; вклад героев, оставшихся в руке (порт Balatro-практики).

| # | Герой | Способность | Спек |
|---|---|---|---|
| 52 | Centaur | **Guard the Line** `[альт]` | `FIGHT_SCORING, SLOT_SAME_AS_LAST → ADD_POWER 8` — сторож не покидает пост |
| 53 | Faceless Void | **Time Step** `[альт]` | `FIGHT_SCORING, ADD_POWER_PER_STEP_FROM_STRONGEST 2` (новый эффект) |
| 54 | Kunkka | **Broadside** `[альт]` | `FIGHT_SCORING, ADD_POWER_FIRST_CARD pct 25 + ADD_POWER_LAST_CARD pct 25` — залп по краям |
| 55 | Dawnbreaker | **Beacon** `[альт]` | `FIGHT_SCORING, SLOT_IS_EDGE → ADD_MULT 1` — свет на флангах |
| 56 | Crystal Maiden | **Cold Reserve** `[альт]` | `ON_HELD → GOLD 1` — сидит в резерве, копит золото |
| 57 | Oracle | **Prophecy** `[альт]` | `ON_HELD → ADD_POWER 4` — предсказывает удар из руки |

---

## 5. Покрытие после внедрения

При сборке «все `[замена]` + по одной `[альт]` на героя» распределение зависимостей
меняется так:

| Якорь | Было (база) | Станет | Новые условия |
|---|---|---|---|
| Слот 1 | 3 | 3–4 | — |
| **Слот 2** | **0** | **8–10** | `SLOT_IS 1`, `IS_MIDDLE_SLOT` (при n=3–4), парность |
| Третья/центр | 3 | 5–6 | `IS_MIDDLE_SLOT` |
| **Слот 4** | **0** | **7–9** | `SLOT_IS 3`, `SLOT_FROM_END_IS 1` |
| Последний | 1 | 7–8 | `SLOT_IS_LAST`, `SLOT_FROM_END_IS 0` |
| Относительные якоря | 7 | 16–17 | `NEXT_TO_*`, `STRONGEST_*`, `NEIGHBOR_RANK_*` |
| Форма/симметрия/чёт-нечёт | 0 | 7 | `RANKS_*`, `MIRROR_*`, `SLOT_PARITY_IS` |
| Динамика/рука | 0 (только агианимы) | 6 | `SLOT_SAME_AS_LAST`, `ON_HELD` |

Системные (не-позиционные) способности при этом **сохраняются**: `[альт]`-версии —
это пул выбора, а не тотальная замена (см. §7, вопрос 1). Даже при худшем раскладе
(все `[альт]` введены) минимум 15 героев остаются системными: Axe-комбо, PA-крит,
CM/Pudge-сброс, Undying/Slark-дискард, Dawnbreaker-универсалы и т.д.

---

## 6. Риски и правила балансировки

1. **Позиционная усталость.** 57 позиционных абилок из 44 героев — потолок; дальше
   слоты начинают «съедать» все остальные решения. Правило: **не больше одной
   позиционной абилки на героя**, вторая всегда системная (комбо/сброс/экономика).
2. **Не дублировать формации.** `Earthshatter` (Primal) — «пик в центре» без
   привязки к 5 картам — сознательно слабее «Клина» (tier 3): абилка ×1.5 против
   формационной базы. Не делать безусловных абилок-клонов Клина/Рампы, иначе
   формации обесценятся.
3. **Превью и советчик** продолжают работать бесплатно: все условия — чистые
   функции от `playedCards + slotIndex`. Для новых якорей нужно добавить строки
   в `systems/advisor.js` («поставь Huskar рядом с сильнейшим») — это отдельная
   небольшая задача контента, не движка.
4. **Каждый новый примитив — тест до мерджа** (`tests/abilities.test.js`, формат
   проекта: «новая механика = тест»). Особенно `MIRROR_*` и `RANKS_PALINDROME`
   (граничные случаи n=1, n=2).
5. **ON_HELD — единственное касание боевого пайплайна.** Требует осторожности с
   `Silence` (Безмолвие глушит и held-способности) и с превью (held-эффекты
   детерминированы — лотерей там нет).
6. **×-стек.** Все предложения — `ADD_*` или одиночные скромные `MULT_MULT`
   (×1.4–1.6 со строгими условиями). Урок фазы D соблюдён: новых безусловных × нет.

## 7. Открытые вопросы (решить человеку)

1. **Модель внедрения `[альт]`-версий:** (а) точечные замены слабых/дубльных
   способностей; (б) вторая абилка у героя (движок уже умеет `abilities[]` —
   формат агианимов); (в) «перековка» в лавке — платная смена способности героя
   (новая механика лавки). Моя рекомендация: (а) для 6–8 героев сейчас,
   (в) как контейнер для остальных позже.
2. **ON_HELD:** вводить ли «вклад скамейки» вообще? Это новая ось (7-я карта руки
   становится значимой), мощная, но добавляет поверхность правил. Минимальная
   доза — 2 абилки из кластера VIII.
3. **Слот 2 vs слот 4 — асимметрия ролей:** сейчас предложений поровну. Стоит ли
   назначить слотам «роли» явно (2 = темп/мид, 4 = тыл/скалирование) в
   онбординге, или оставить игроку выводить это самому?
4. **Пары-двойняшки** (Rubick/CM чёт-нечёт, Sven/Tiny `NEXT_TO_WEAKEST`): ок ли
   повторение условия у двух героев как приём, или каждая механика должна быть
   уникальной?
5. **Порядок работ:** сначала toolbox-условия (§3, M-цена, ~половина дня с
   тестами), потом кластеры I–III (абсолютные слоты, S-цена), потом V–VIII
   (якоря/формы/динамика). Согласовать с планом фазы I-full из
   `PROPOSALS_PHASE_I.md` — этот батч не трогает экономику и не конфликтует.

## 8. Источники практик

- [Symbols — Luck be a Landlord Wiki](https://luck-be-a-landlord.fandom.com/wiki/Symbols) — соседство как ядро выплат
- [Items — Luck be a Landlord Wiki](https://luck-be-a-landlord.fandom.com/wiki/Items) — предметы, переопределяющие правила соседства
- [Slice & Dice Wiki: Back-row](https://slice-and-dice.fandom.com/wiki/Back-row) — задняя линия как роль
- [Eurogamer: Monster Train](https://www.eurogamer.net/monster-train-brings-a-new-idea-to-a-genre-i-love) — этажи и вертикальная позиция
- [Wildfrost — Steam discussions](https://steamcommunity.com/app/1811990/discussions/0/5440953210426903790/?ctp=3) — перестановка каждый ход как ресурс
- [Glyph Shuffle: Best Tactical Deckbuilders Where Positioning Actually Matters](https://glyphshuffle.com/blog/best-tactical-deckbuilders-positioning) — обзор позиционных декбилдеров
- [Game Developer: Roguebook](https://www.gamedeveloper.com/design/tackling-deckbuilding-design-in-abrakam-s-roguebook) — позиция как «little extra to juggle»
- [Inscryption Wiki: сигилы](https://inscryption.fandom.com/wiki/Mechanics) — зеркальные/обменные механики лейнов
