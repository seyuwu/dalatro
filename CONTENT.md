# DALATRO — Content Catalog v0.1

Все таблицы контента. Правка контента не требует правок движка.
Форматы триггеров — GAME_SPEC.md §13–15.

## Стартовая колода (12) — сетка «сила × атрибут»

| Сила | STR | AGI | INT | UNI |
|-----:|-----|-----|-----|-----|
| 2 | — | — | ❄️ Crystal Maiden | — |
| 3 | 🥊 Tusk | — | — | — |
| 5 | 🪓 Axe | 💧 Morphling | ⚡ Zeus | — |
| 7 | 🪝 Pudge | ⚔️ Juggernaut | — | — |
| 8 | 🛡️ Sven | — | — | — |
| 9 | — | 🗡️ Phantom Assassin | — | ☀️ Dawnbreaker |
| 10 | 🐴 Centaur Warrunner | — | — | — |
| 11 | — | — | — | 🐲 Primal Beast |

Остальные 28 героев ростера (Undying … Tiny) лежат в `content/heroes.js`
с `inDeck: false` — ждут рекрутмента (ROADMAP).

### Способности стартовых героев

| Герой | Событие | Условие | Эффект |
|---|---|---|---|
| Axe — Counter Helix | COMBO_DETECTED | COMBO_IS three | +10 силы |
| Morphling — Morph | PRE_DETECT | — | COPY_ATTRIBUTE ← сосед слева |
| Zeus — Static Field | ON_PLAY | EXISTS_ATTRIBUTE int | +2 множителя |
| Juggernaut — Blade Fury | ON_PLAY | SLOT_IS 0 | +8 силы |
| Phantom Assassin — Coup de Grace | COMBO_DETECTED | COMBO_MIN pair, 50% | ×2 множителя |
| Crystal Maiden — Frostbite | ON_DISCARD | — | +2 золота |
| Pudge — Meathook | ON_DISCARD | 50% | RETURN_TO_HAND |

## Предметы (17)

### Common (62%, 6–8g)

| Предмет | Категория | Эффект |
|---|---|---|
| Battle Fury 7 | сила | сила слабейшей сыгранной карты учится дважды |
| Meteor Hammer 6 | сила | +8 силы при 3+ сыгранных |
| Drum of Endurance 7 | множитель | +2 множителя при 4+ сыгранных |
| Hand of Midas 7 | экономика | золото с оверкилла ×2 |
| Black King Bar 7 | правила | игнор модификаторов башен |
| Kaya and Sange 8 | сила | +10 силы, +1 множитель |
| Vladmir's Offering 8 | экономика | +2 золота за каждый бой |

### Rare (28%, 8–11g)

| Предмет | Категория | Эффект |
|---|---|---|
| Daedalus 9 | множитель | 25%: ×2 множителя |
| Shadow Blade 9 | правила | сильнейшая карта ±1 ранг для комбо (выбирает лучшее) |
| Satanic 10 | множитель | ×1.5 на паре/двух парах |
| Refresher Orb 10 | множитель | способности героев срабатывают дважды |
| Manta Style 10 | правила | иллюзия сильнейшего: тот же ранг/атрибут, 50% силы |
| Heart of Tarrasque 11 | сила | +25 силы |

### Epic (10%, 12–13g)

| Предмет | Категория | Эффект |
|---|---|---|
| Divine Rapier 12 | множитель | ×2 урона; провал → враг держит (твой урон ×0.5 по нему) |
| Octarine Core 12 | множитель | +1 множителя за каждый твой предмет |
| Radiance 13 | сила | +3 силы за каждого сыгранного героя |

## Волны акта 1

| Волна | Враг | HP | Модификаторы |
|---|---|---:|---|
| 1 | T1 Башня | 300 | — |
| 2 | T2 Башня | 550 | Armor: первый бой ×0.5 |
| 3 | T3 Башня | 800 | Glyph: каждый 3-й бой = 0 |
| 4 | **Roshan** (босс) | 1600 | Aegis: одно возрождение на 50% |

## Комбо

| Комбо | Dota-имя | База | Множитель |
|---|---|---:|---:|
| High card | Харас | 5 | 1 |
| Pair | Дуо на линии | 10 | 2 |
| Two pair | Ротация | 20 | 2 |
| Three | Ганг | 30 | 3 |
| Straight | Смок на Рошана | 30 | 4 |
| Flush | Тимфайт атрибута | 35 | 4 |
| Full house | 4 Protect 1 | 40 | 6 |

## Билд-направления советчика (`systems/advisor.js`)

Стартовая колода порождает: Тимфайт Силы 5/5 · Смок-стрит 7–11 5/5 ·
Ганг силы 5 3/3 · Тимфайт Ловкости 3/5 · Крит-билд (Daedalus+PA+Refresher)
· Морф-движок (Morphling+Zeus) · Кузня рангов (Butterfly+Manta+Shadow Blade).
Советчик чисто аналитический: читает state, ничего не мутирует.
