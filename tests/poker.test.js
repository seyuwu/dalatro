suite("Poker");

test("high card — нет совпадений", () => {
  assertEq(PokerSys.detectType([mk(2, "int"), mk(5, "str"), mk(9, "agi")]), "high_card");
});

test("pair", () => {
  assertEq(PokerSys.detectType([mk(5, "str"), mk(5, "agi"), mk(7, "int")]), "pair");
});

test("two pair", () => {
  assertEq(PokerSys.detectType([mk(5, "str"), mk(5, "agi"), mk(7, "int"), mk(7, "uni")]), "two_pair");
});

test("three of a kind", () => {
  assertEq(PokerSys.detectType([mk(5, "str"), mk(5, "agi"), mk(5, "int")]), "three");
});

test("straight 7..11", () => {
  assertEq(PokerSys.detectType([mk(7, "str"), mk(8, "str"), mk(9, "agi"), mk(10, "str"), mk(11, "uni")]), "straight");
});

test("flush — 5 одного атрибута", () => {
  assertEq(PokerSys.detectType([mk(3, "str"), mk(5, "str"), mk(7, "str"), mk(8, "str"), mk(10, "str")]), "flush");
});

test("straight + flush → straight_flush, в слайсе скорится как flush", () => {
  assertEq(PokerSys.detectType([mk(4, "str"), mk(5, "str"), mk(6, "str"), mk(7, "str"), mk(8, "str")]), "straight_flush");
  assertEq(PokerSys.evaluate([mk(4, "str"), mk(5, "str"), mk(6, "str"), mk(7, "str"), mk(8, "str")]).type, "flush");
});

test("full house", () => {
  const combo = PokerSys.evaluate([mk(5, "str"), mk(5, "agi"), mk(5, "int"), mk(7, "str"), mk(7, "agi")]);
  assertEq(combo.type, "full_house");
  assertEq(combo.basePower, 40);
  assertEq(combo.baseMult, 6);
});

test("разрыв стрита — не стрит", () => {
  assertEq(PokerSys.detectType([mk(7, "str"), mk(8, "agi"), mk(9, "int"), mk(10, "uni"), mk(2, "str")]), "high_card");
});

test("detectPower иллюзии учитывается для комбо", () => {
  // пара 5-5 + иллюзия пуджа (ранг 7 для комбо, реальная сила 3) + 7 → two_pair
  const cards = [mk(5, "str"), mk(5, "agi"), { power: 3, detectPower: 7, attr: "str" }, mk(7, "int")];
  assertEq(PokerSys.detectType(cards), "two_pair");
});
