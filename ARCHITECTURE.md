# DALATRO — Architecture

> **Golden rule: Content never mutates GameState directly.**
> Content produces conditions and effects. The Engine resolves them.
> The State is mutated only by the Engine.

Следствие: новый Techies / Invoker / curse / neutral item — это данные в
`src/content/`, а не правка движка.

## Поток

```
UI (State → Render)  →  Action  →  Game.dispatch
                                        ↓
                              Combat.resolveFight
                                        ↓
                        PRE_DETECT → Detection → Base
                              → Hero triggers → Item triggers
                              → Refresher → Tower mods
                              → Damage → Death/Aegis → Gold
                                        ↓
                              Resolution (steps[]) → UI preview / анимация / debug
```

## Решения

### 1. Классические скрипты вместо ESM
`<script src>` в порядке зависимостей, каждый файл — IIFE-модуль (`const Rng = (function(){...})()`.
Это даёт **запуск двойным кликом с file://** (ES-модули с file:// блокируются CORS) без сборщика.
`build.js` инлайнит всё в один `dist/index.html` для распространения.
Миграция на ESM/Vite тривиальна, когда понадобится.

### 2. Контент в .js, не в .json
`content/*.js` объявляют `const HEROES_DATA = [...]` — ноль fetch/CORS-проблем,
формат данных тот же, что задумывался под JSON.

### 3. RNG вне state
`Rng.current()` — модульный синглтон с seed забега. State остаётся
`structuredClone`-able. Режим suppress (превью) возвращает константу, **не
расходуя стрим** — превью никогда не ломает реальный забег.

### 4. Preview = simulate
`Sim.simulate(state, action)` = `structuredClone` + `Rng.suppress` + тот же
`dispatch`. Никакой отдельной preview-логики. Chance-триггеры в превью не
разыгрываются, а помечаются `🎲` шагом.

### 5. Resolution stack — один объект, четыре потребителя
`{ steps: [{icon, label, kind}], power, mult, damage, goldGained, towerHpAfter }`
используется движком для расчёта, UI — для превью и анимации боя, debug — для
инспектора событий.

## Порядок срабатывания (фиксированный)

1. **PRE_DETECT** — герои по слотам + предметы меняют то, что видит детектор
   (Morphling копирует атрибут соседа слева, Manta создаёт иллюзию,
   Butterfly готовит wild-ранг).
2. **Detection** — `PokerSys.evaluate` по effective-набору; butterfly/manta
   дают кандидатов, берётся лучшее комбо.
3. **Base** — сила комбо + сумма силы карт (иллюзия даёт пол-силы; wild
   влияет только на детекцию, не на силу).
4. **Hero triggers** по слотам: `ON_PLAY`, затем `COMBO_DETECTED`.
5. **Item triggers** по порядку покупки: `FIGHT_SCORING`.
6. **Refresher** — герои (п.4) срабатывают второй раз.
6.5. **Ставка** — тир по числу сыгранных карт: ×1.1 (4 героя), ×1.25 (5);
   1 герой даёт +1 золото в фазе золота (`COMMIT_TIERS`).
6.6. **Импульс** — `state.run.momentum` (зачищенные волны подряд,
   сброс при провале): ×1.05 за волну, кэп ×1.5.
7. **Tower mods** — BKB блокирует полностью, Butterfly катит 25% уклонение,
   затем Armor (×0.5 первый бой) / Glyph (каждый 3-й бой = 0).
8. **Damage** = round(power × mult × finalMult × towerMult).
9. **Death/Aegis** — revive один раз на 50%.
10. **Gold** — оверкилл с затуханием (первые 50% maxHP по курсу 1/20,
    дальше 1/40, ×Midas) + точный ласт-хит +5 + харас +1.

Важно: `ADD_MULT` у героев применяется ДО `MULT_MULT` предметов — это
осознанный баланс (героев усиливают предметы, а не наоборот).

## Формат контента

Триггер (один для героев, предметов и модификаторов):

```js
{
  id: "axe", name: "Axe", attr: "str", power: 5, emoji: "🪓",
  ability: {
    name: "Counter Helix",
    event: "COMBO_DETECTED",            // PRE_DETECT | ON_PLAY | COMBO_DETECTED |
                                        // FIGHT_SCORING | ON_DISCARD | ON_DEATH
    when: { type: "COMBO_IS", value: "three" },  // см. conditions.js
    chance: 0.5,                        // опционально, честный seeded rng
    effects: [{ type: "ADD_POWER", value: 10 }], // см. effects.js
  },
}
```

Условия: `COMBO_IS, COMBO_MIN, SLOT_IS, PLAYED_COUNT_ABOVE, POWER_ABOVE,
HAS_ITEM, TAG_IS, EXISTS_ATTRIBUTE` + комбинаторы `all/any/not`.
Эффекты: `ADD_POWER, ADD_MULT, MULT_MULT, FINAL_MULT, GOLD, WEAKEST_POWER_DOUBLE,
OVERKILL_RATE, REFRESH_HERO_TRIGGERS, IGNORE_TOWER_MODS, REVIVE, RETURN_TO_HAND` +
PRE_DETECT-семейство (`COPY_ATTRIBUTE, CREATE_ILLUSION, WILD_RANK`), которое
интерпретирует детекционный пайплайн.

Башни/боссы — тот же формат: `waves: [{ id, hp, isBoss, miniBoss,
modifiers: [{id}] }]`, модификаторы живут в `content/world.js` и
исполняются движком как обычные триггеры (Aegis = `ON_DEATH → REVIVE`).
Исключение — **мины Techies**: они меняют, какие карты вообще можно
выбрать, поэтому назначаются движком (`Game.assignMines`, 2 случайные
карты руки на каждый бой) до детекции, а Sentry/BKB выключают их до
назначения.

## Тесты

`npm test` — раннер грузит те же файлы, что и браузер, в том же порядке в
node:vm и гоняет `tests/*.test.js` внутри контекста. 51 тест покрывает:
покер (все комбо + detectPower), детекционные хуки (Morph/Butterfly/Manta),
математику боя, позиции, Refresher, Armor/BKB, Glyph, Aegis, ласт-хит,
оверкилл-затухание, Rapier-цикл, цикл колоды, магазин, сбросы,
превью-детерминизм + риск-слой (`risk.test.js`): тиры ставки, харас,
импульс (рост/сброс), мины (назначение/гвард/контры), Bloodstone.

## Shop v2, советчик и автосейв

- `systems/economy.js`: 5 предложений `{ id, locked }`, веса редкостей
  62/28/10, реролл сохраняет залоченные.
- `systems/advisor.js`: чистый анализ state — синергии предметов для модалки
  разбора («что даст твоему забегу»). UI-текст, не движок.
- Автосейв: `main.js` пишет state + счётчик дриплов RNG в localStorage
  после каждого dispatch; восстановление пересоздаёт seeded-стрим и
  перематывает его точно (`fastForward`). Превью по-прежнему не расходует
  стрим (suppress).

## UI v3 («lane» edition)

Каркас перенесён с React-прототипа (`test/`) на ванильный DOM:
`ui/icons.js` (инлайн-SVG, ноль зависимостей) → `ui/ui.js` (State → Render,
никакого своего состояния кроме UIState: модалки, сортировка, онбординг)
→ `main.js` (делегирование data-action, клавиши 1–7/Enter/R/Esc/D, звук
WebAudio, флаги настроек в localStorage). Комбинации — постоянная правая
колонка с подсветкой «собрано/есть в руке» (`handComboState` — статический
анализ руки, не движок). Онбординг — 5 шагов с демо-картами, флаг
`dalatro_onboard_v3`. Фон линии `images/battlefield.jpg` копируется сборкой
в `dist/images/`. Превью боя по-прежнему `Sim.simulate` — UI только читает.

## Известные упрощения v0.2

- `straight_flush` скорится как flush (расширение таблицы — в ROADMAP).
- Каре попадает в `three` (в стартовой колоде недостижимо).
- Butterfly-уклонение и BKB захардкожены в фазе tower mods, мины — в
  `Game.assignMines`; при появлении боссов с дебаффами вынести в
  контент-триггеры (TODO из ROADMAP).
- Shadow Blade (±1 ранг сильнейшей) в стартовой колоде почти всегда no-op —
  движок честно выбирает лучший кандидат, раскрывается с дубликатами рангов.
- Иллюзии не триггерят абилки (правило из спеки), но сами могут быть
  скопированы Morphling'ом.
- Старые сейвы (до v0.2) без `run.momentum`/`combat.minedUids` совместимы:
  движок читает их с fallback'ом `0`/`[]`.
