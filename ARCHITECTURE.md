# dotora — Architecture

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
10. **Gold** — оверкилл с затуханием (первые 50% maxHP по курсу 1/60,
    дальше 1/120, жёсткий кап 5g, ×Midas) + точный ласт-хит +5 + харас +1.

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
                                        // FIGHT_SCORING | ON_DISCARD
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
исполняются движком как обычные триггеры (Aegis — модификатор с полем
`hpPercent`, движок применяет эффект REVIVE в фазе смерти).
Исключение — **мины Techies**: они меняют, какие карты вообще можно
выбрать, поэтому назначаются движком (`Game.assignMines`, 2 случайные
карты руки на каждый бой) до детекции, а Sentry/BKB выключают их до
назначения.

## Тесты

`npm test` — раннер берёт список скриптов из index.html (без main.js/audio.js)
и гоняет `tests/*.test.js` в node:vm. 418 тестов покрывают:
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
анализ руки, не движок). Онбординг — интерактивный сценарий `ui/tutorial.js`
(свой слой вне `#app`, шаги-спотлайты, флаг `dotora_tut_v1`), модалка
«5 шагов» — справка по кнопке. Фон линии `images/battlefield.jpg` копируется
сборкой в `dist/images/`. Превью боя по-прежнему `Sim.simulate` — UI только читает.

## Бэкенд: аккаунты, забеги, лидерборды (`server.js` + `src/net.js`)

Node ≥22, ноль зависимостей. `npm start` → `http://localhost:8787`: тот же
процесс раздаёт статику и принимает `/api/*`. Без сервера игра целиком
работает оффлайн — все сетевые вызовы гасятся в `Net.state`, UI показывает
только локальные данные.

- **Двухслойность.** API-ядро синхронно (`createBackend().call(method, path,
  opts) → {status, json, setCookie}`), HTTP — тонкая обёртка (парсинг тела,
  лимит 240 req/мин на IP, куки). Синхронность не случайна: тесты бэкенда
  гоняет тот же синхронный vm-раннер, что и движок (`tests/run.js` инжектит
  фабрику в песочницу как `Backend`).
- **Хранилище.** `data/accounts.json` + `data/runs.json` (gitignored):
  JSON-файлы с атомарной записью tmp+rename — сбой не оставляет битый файл.
- **Аккаунты.** Имя `^[A-Za-z0-9_.-]{2,20}$`, пароль ≥4: scrypt + случайная
  соль, сравнение `timingSafeEqual`. Сессии — токены в HttpOnly-cookie
  (30 дней), до 10 на аккаунт. `unlockedRank` на сервере = взятый ранг + 1:
  клиент при входе подтягивает чужой прогресс, если он дальше локального.
- **Забеги.** `POST /api/runs` — компоненты (волны, ранг, казармы, лучший
  удар, заряды), **счёт сервер считает сам**, зеркаля `Game.scoreOf`, —
  подменить очки с клиента нельзя. Валидация: победа = все 15 волн и ≥60 с;
  идемпотентность по `seed+startedAt+won` (повтор не удваивает статистику).
  Хвост: 100 забегов на игрока, 20 000 всего.
- **Лидерборды §8.1.** `GET /api/leaderboard?view=score|rank|fastest|
  nodeath&rank=N`: дедуп по игроку — одна строка на человека. `rank` —
  лестница по взятым рангам, фильтр `rank=N` — топ на конкретном ранге.
  Профиль: `GET /api/players/:name` — статистика + последние 20 забегов.
- **Клиент.** `src/net.js` (IIFE, vm-совместим: fetch/localStorage трогаются
  лениво). `recordRun` после локальной записи шлёт компоненты fire-and-forget;
  «Зал славы» получил вкладки Локально/Онлайн, титул и топбар — модалки
  «Таблица лидеров» и «Аккаунт» (вход/регистрация/профиль с историей).

## Аналитика и админка (`analytics.js` + `admin.js`)

- **Сбор.** `analytics.js` считает трафик (каждый запрос HTTP-слоя: метод,
  путь, статус, латентность, IP с учётом X-Forwarded-For) и игровые события
  (register/login/run — уходят из API-ядра через хук `onEvent`). Агрегаты —
  бакеты по дням (30) и часам (48), топы путей/IP, статусы, хвост 200
  свежих записей; карты ips/paths/players антираспухаются (300 ключей).
  `/admin` и `/api/admin` из игровой статистики исключены. Ни UA, ни
  referer не собираем. Сброс на диск — `data/analytics.json` (атомарная
  запись) раз в 30 c и на выходе процесса.
- **Доступ.** `createAdminAuth`: пароль в `data/admin.json` (scrypt). При
  первом запуске генерируется и печатается в консоль; свой —
  `DOTORA_ADMIN_PASSWORD` при первом запуске (файл уже есть — удалите).
  Сессии — токен в HttpOnly-cookie на 24 ч, в памяти процесса. Логин админки
  ограничен отдельно: 15 попыток/мин на IP.
- **Дашборд.** `/admin` — один HTML с ванильным JS (`adminPageHtml`):
  карточки (просмотры/API/посетители/игроки/регистрации/забеги/латентность/
  доля ошибок), SVG-графики «трафик по часам» и «забеги по дням», топы
  путей и посетителей, статусы, таблица игроков (из `backend.players()`),
  живой хвост запросов и журнал событий. Автообновление 30 c.

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
