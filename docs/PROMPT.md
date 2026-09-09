# DALATRO — Промпт генерации контента (для LLM)

Контент игры — чистые данные, поэтому героев/предметы/боссов можно
генерировать моделью. **Промпт ниже привязан к реальному словарю движка**
(`src/engine/`, `src/content/`) — не к внешним пересказам схемы.

Правила валидации после генерации:
1. Файл кладётся в `src/content/` и подключается в `content/content.js`.
2. `npm test` — зелёный; для нового эффекта/условия сначала движок + тест.
3. Проверить: событие/эффект/условие существуют в движке (списки ниже),
   шанс ≤ 0.5, цена соответствует BALANCE.md, у героя ≤ 1 способности.

---

```
Ты — гейм-дизайнер Dalatro (Dota × покер × Balatro). Сгенерируй контент
строго в JSON ниже. НЕ придумывай новые типы событий, условий и эффектов —
используй ТОЛЬКО словарь из списка. Движок исполняет только эти примитивы.

СОБЫТИЯ (event):
- "PRE_DETECT"      — до распознавания комбо; меняет, что видит детектор
- "ON_PLAY"         — карта сыграна в слот
- "COMBO_DETECTED"  — комбо определено
- "FIGHT_SCORING"   — фаза подсчёта (для предметов)
- "ON_DISCARD"      — карта сброшена (ТП)

УСЛОВИЯ (when) — объекты или комбинации {all|any|not}:
{type:"COMBO_IS", value:"pair|two_pair|three|straight|flush|full_house|high_card"}
{type:"COMBO_MIN", value:"<комбо>"}          — ранг не ниже
{type:"SLOT_IS", value:0..4}                 — позиция карты
{type:"PLAYED_COUNT_ABOVE", value:N}         — сыграно > N карт
{type:"POWER_ABOVE", value:N}
{type:"HAS_ITEM", item:"<id>"}
{type:"EXISTS_ATTRIBUTE", value:"str|agi|int|uni"} — другая сыгранная карта
{type:"TAG_IS", tag:"<тег>"}

ЭФФЕКТЫ (effects):
{type:"ADD_POWER", value:N}                  {type:"ADD_MULT", value:N}
{type:"MULT_MULT", value:X}                  {type:"FINAL_MULT", value:X}
{type:"GOLD", value:N}
{type:"WEAKEST_POWER_DOUBLE"}                {type:"ADD_POWER_PER_PLAYED", value:N}
{type:"ADD_MULT_PER_ITEM", value:N}          {type:"OVERKILL_RATE", value:X}
{type:"REFRESH_HERO_TRIGGERS"}               {type:"IGNORE_TOWER_MODS"}
{type:"REVIVE", hpPercent:N}                 {type:"RETURN_TO_HAND"}
PRE_DETECT-эффекты (меняют только детекцию):
{type:"COPY_ATTRIBUTE", target:"left_neighbor"}
{type:"CREATE_ILLUSION", powerRatio:0.5}     {type:"WILD_RANK"}
{type:"BUMP_STRONGEST_RANK", value:1}

ФОРМАТ ГЕРОЯ (в стартовую колоду):
{ "id":"<англ>", "name":"<Dota-герой>", "attr":"str|agi|int|uni",
  "power":2..11, "inDeck":true,
  "ability":{ "name":"...", "event":"...", "when":{...}, "chance":0..0.5,
              "effects":[...] } | null }
Свободные слоты сетки (power×attr) — в CONTENT.md; не занимай занятые.

ФОРМАТ ПРЕДМЕТА:
{ "id":"<англ>", "name":"<Dota-предмет>", "cost":6..13, "emoji":"...":
  "rarity":"common|rare|epic", "category":"power|mult|rule|economy",
  "desc":"<правило по-русски, ≤2 строк>",
  "ability":{ "name":"...", "event":"ON_PLAY|COMBO_DETECTED|FIGHT_SCORING",
              "when":{...}, "chance":..., "effects":[...] } }

ФОРМАТ БОССА/ВОЛНЫ (только modifiers, эффекты — те же):
{ "id":"<англ>", "name":"...", "hp":N, "isBoss":true,
  "modifiers":[ { "id":"<англ>", "name":"...", "desc":"...",
                  "ability":{ "event":"ON_PLAY|COMBO_DETECTED|FIGHT_SCORING",
                              "when":{...}, "effects":[...] } } ] }
Правило дизайна: у каждого боссового правила должен существовать
контр-предмет в той же выдаче (BKB/Sentry-стайл).

ОГРАНИЧЕНИЯ:
- chance только 0.25 / 0.33 / 0.5. Никаких шансов > 0.5.
- Один редкий предмет ломает ОДНО правило, а не всё сразу.
- У каждого героя-карты сила = ранг покера: не дублируй слот power×attr.
- Способность героя ≤ 1, эффекты ≤ 2 на триггер.
- Никаких полей вне схемы. Никакого урона/лечения игрока — этих систем нет.

СГЕНЕРИРУЙ: 3 героя в свободные слоты сетки, 2 предмета (1 rare + 1 epic),
1 боссовая волна с контр-предметом. После JSON — таблица «синергия с
существующим контентом» (Zeus/Morphling/Manta/Daedalus/...).
```

---

Пример эталонной записи (реальная, из `src/content/heroes.js`):

```json
{
  "id": "axe", "name": "Axe", "attr": "str", "power": 5, "inDeck": true,
  "ability": {
    "name": "Counter Helix", "event": "COMBO_DETECTED",
    "when": { "type": "COMBO_IS", "value": "three" },
    "effects": [{ "type": "ADD_POWER", "value": 10 }]
  }
}
```

Типичная ошибка внешних схем (НЕ повторять): триггер Morphling на
`ON_PLAY` — копия атрибута обязана происходить в `PRE_DETECT`, до
распознавания комбо, иначе морф никогда не собирает флеш.
