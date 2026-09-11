// UI smoke: рендер всех фаз с улучшениями v2 под DOM-заглушкой. Ловит
// шаблонные ошибки (undefined в HTML, отсутствующие поля), которые
// движковые тесты не видят.
suite("UI smoke — улучшения v2 во всех фазах");

function uiRun(seed) {
  return Game.dispatch(Game.createInitialState(""), { type: "START_RUN", seedCode: seed || "UISM", rules: "formation", rank: 1, starterId: "standard" });
}
function renderHtml(s) {
  UI.render(s);
  return document.getElementById("app").innerHTML;
}

test("Титул и волна без улучшений рендерятся; панель приглашает в лавку", () => {
  const s = uiRun("UIT1");
  UI.render(s); // титул не падает
  s.phase = "wave";
  const html = renderHtml(s);
  assert(html.includes("УЛУЧШЕНИЯ"), "панель улучшений в сайдбаре");
  assert(html.includes("Пока ни одного"), "пустое состояние панели");
});

test("Волна с активками: кнопки Игнора/Счастливого случая, энергия, чипы", () => {
  const s = uiRun("UIT2");
  s.run.upgrades = ["ignor", "schastlivy", "kondensator", "optimist", "pakt_fortunes"];
  s.run.energy = 2;
  s.run.fortune = 2;
  s.run.pendingIgnoreMods = true;
  const html = renderHtml(s);
  assert(html.includes("Игнор"), "кнопка Игнора у «В бой»");
  assert(html.includes("Счастливый случай"), "кнопка гарантии");
  assert(html.includes("⚡ 2"), "бейдж энергии");
  assert(html.includes("Фортуна: 2/5"), "строка Пакта");
  assert(html.includes("ИГНОР"), "чип готовой активации в ставки");
  assert(html.includes("Оптимист"), "пассивка в панели");
});

test("Лавка: карточки улучшений, кнопки на товарах и в шапке полки, удача", () => {
  const s = uiRun("UIT3");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.upgrades = ["torgash", "v_dolg", "insider", "magnit", "surprise", "podkova"];
  const html = renderHtml(s);
  assert(html.includes("upgrade-card"), "карточки улучшений на полке");
  assert(html.includes("Торгаш"), "кнопка на товаре");
  assert(html.includes("Инсайдер"), "кнопка полки");
  assert(html.includes("Удача 1"), "бейдж удачи");
  assert((html.match(/data-action="activate-upgrade"/g) || []).length >= 5, "не меньше 5 кнопок активации (2 на товарах + 3 полочных)");
});

test("Развилка: Картограф над путями, Дезертир — кнопки замены путей", () => {
  const s = uiRun("UIT4");
  s.combat.outcome = "cleared";
  Game.dispatch(s, { type: "ENTER_SHOP" });
  s.run.upgrades = ["kartograf", "dezertir", "podsmotr"];
  Game.dispatch(s, { type: "LEAVE_SHOP" });
  assertEq(s.phase, "route", "на развилке");
  const html = renderHtml(s);
  assert(html.includes("Картограф"), "кнопка перевыброса путей");
  assert(html.includes("Подсмотр"), "кнопка вскрытия жребиев");
  assert(html.includes("route-replace"), "кнопки замены путей у Дезертира");
});

test("Провал: кнопка Пересдачи в модалке; пикер Второго дыхания", () => {
  const s = uiRun("UIT5");
  s.run.upgrades = ["peresdacha", "vozvrat"];
  s.combat.outcome = "failed";
  let html = renderHtml(s);
  assert(html.includes("Пересдача"), "кнопка пересдачи в модалке провала");
  s.combat.outcome = null;
  s.run.pickDiscard = "vozvrat";
  UI.UIState.modal = "discard-pick";
  html = renderHtml(s);
  assert(html.includes("ВТОРОЕ ДЫХАНИЕ"), "пикер сброса открыт");
  assert(html.includes("Кого вернуть"), "заголовок пикера");
  UI.UIState.modal = null;
  s.run.pickDiscard = null;
});

test("Победа и поражение забега рендерятся без ошибок", () => {
  const s = uiRun("UIT6");
  s.phase = "victory";
  renderHtml(s);
  s.phase = "gameover";
  renderHtml(s);
  assert(true, "оба экрана конца не упали");
});
