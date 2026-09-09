export type Attribute = 'str' | 'agi' | 'int' | 'uni';

export type Hero = {
  id: string;
  name: string;
  rank: number;
  attr: Attribute;
  ability: string;
  description: string;
};

export const ATTRS: Record<Attribute, { name: string; symbol: string; color: string; glow: string }> = {
  str: { name: 'Сила', symbol: '◆', color: '#f05c3a', glow: 'rgba(240,92,58,.55)' },
  agi: { name: 'Ловкость', symbol: '✦', color: '#4ed17b', glow: 'rgba(78,209,123,.55)' },
  int: { name: 'Интеллект', symbol: '✺', color: '#5b8cff', glow: 'rgba(91,140,255,.55)' },
  uni: { name: 'Универсальный', symbol: '◈', color: '#e3b341', glow: 'rgba(227,179,65,.55)' },
};

// Порядок героев важен для стартовой Лазурной колоды (она же — оригинальные 12).
export const HEROES: Hero[] = [
  // --- оригинальный ростер dalatro ---
  { id: 'axe', name: 'Axe', rank: 5, attr: 'str', ability: 'Counter Helix', description: 'В комбинации «Ганг» или выше даёт +10 силы.' },
  { id: 'juggernaut', name: 'Juggernaut', rank: 7, attr: 'agi', ability: 'Blade Fury', description: 'На первой позиции даёт +8 силы.' },
  { id: 'crystal_maiden', name: 'Crystal Maiden', rank: 2, attr: 'int', ability: 'Frostbite', description: 'При ТП-сбросе приносит 2 золота.' },
  { id: 'pudge', name: 'Pudge', rank: 7, attr: 'str', ability: 'Flesh Heap', description: 'Даёт +3 силы за каждого другого героя Силы в тимфайте.' },
  { id: 'morphling', name: 'Morphling', rank: 5, attr: 'agi', ability: 'Morph', description: 'Копирует атрибут героя слева. Порядок выбора важен!' },
  { id: 'zuus', name: 'Zeus', rank: 5, attr: 'int', ability: 'Static Field', description: 'Даёт +2 множителя. Refresher Orb повторяет эффект.' },
  { id: 'sven', name: 'Sven', rank: 8, attr: 'str', ability: 'God’s Strength', description: 'В тимфайте из 5 героев даёт +12 силы.' },
  { id: 'phantom_assassin', name: 'Phantom Assassin', rank: 9, attr: 'agi', ability: 'Coup de Grace', description: 'На паре и выше множитель ×1.5. Без случайности — только расчёт.' },
  { id: 'tusk', name: 'Tusk', rank: 3, attr: 'str', ability: 'Walrus Punch', description: 'На последней позиции даёт +5 силы.' },
  { id: 'centaur', name: 'Centaur Warrunner', rank: 10, attr: 'str', ability: 'Double Edge', description: 'Надёжная карта Силы для стрита 7–11.' },
  { id: 'dawnbreaker', name: 'Dawnbreaker', rank: 9, attr: 'uni', ability: 'Solar Guardian', description: 'Если в тимфайте 3 разных атрибута, даёт +1 множителя.' },
  { id: 'primal_beast', name: 'Primal Beast', rank: 11, attr: 'uni', ability: 'Pulverize', description: 'Самый сильный герой стартовой колоды.' },
  // --- новые герои Astra ---
  { id: 'riki', name: 'Riki', rank: 2, attr: 'agi', ability: 'Tricks of the Trade', description: 'На первой позиции даёт +10 силы из невидимости.' },
  { id: 'shadow_shaman', name: 'Shadow Shaman', rank: 2, attr: 'int', ability: 'Hex', description: 'При розыгрыше приносит 2 золота. Тоже любит экономику.' },
  { id: 'sniper', name: 'Sniper', rank: 3, attr: 'agi', ability: 'Assassinate', description: 'На последней позиции даёт +12 силы — достаёт издалека.' },
  { id: 'witch_doctor', name: 'Witch Doctor', rank: 3, attr: 'int', ability: 'Maledict', description: '+4 силы за каждую группу одинаковых рангов в тимфайте.' },
  { id: 'tiny', name: 'Tiny', rank: 4, attr: 'str', ability: 'Grow', description: '+14 силы, если он — герой с наименьшим рангом в тимфайте.' },
  { id: 'drow_ranger', name: 'Drow Ranger', rank: 4, attr: 'agi', ability: 'Precision Aura', description: 'Если все герои — Ловкость, даёт +3 множителя.' },
  { id: 'marci', name: 'Marci', rank: 4, attr: 'uni', ability: 'Sidekick', description: '+8 силы, если соседний по позиции герой другого атрибута.' },
  { id: 'lion', name: 'Lion', rank: 5, attr: 'int', ability: 'Finger of Death', description: '+1 множителя. На волне Рошана дополнительно +15 силы.' },
  { id: 'kunkka', name: 'Kunkka', rank: 6, attr: 'str', ability: 'Ghostship', description: 'На первой или последней позиции даёт +10 силы.' },
  { id: 'slark', name: 'Slark', rank: 6, attr: 'agi', ability: 'Essence Shift', description: '+4 силы за каждый ТП-сброс, сделанный на этой волне.' },
  { id: 'lina', name: 'Lina', rank: 6, attr: 'int', ability: 'Laguna Blade', description: 'Если сыграно 1–2 героя, даёт +20 силы.' },
  { id: 'muerta', name: 'Muerta', rank: 7, attr: 'int', ability: 'Dead Shot', description: 'На третьей позиции даёт +12 силы.' },
  { id: 'ringmaster', name: 'Ringmaster', rank: 7, attr: 'uni', ability: 'The Crowd Goes Wild', description: 'Если в тимфайте есть все 4 атрибута, даёт +3 множителя.' },
  { id: 'wraith_king', name: 'Wraith King', rank: 8, attr: 'str', ability: 'Wraithfire Blast', description: '+1 множителя за каждого героя Силы в тимфайте.' },
  { id: 'tidehunter', name: 'Tidehunter', rank: 9, attr: 'str', ability: 'Kraken Shell', description: 'В тимфайте из 5 героев даёт +2 множителя.' },
  { id: 'invoker', name: 'Invoker', rank: 10, attr: 'int', ability: 'Invoke', description: 'Если в тимфайте 3 разных атрибута, даёт +3 множителя.' },
  { id: 'medusa', name: 'Medusa', rank: 12, attr: 'agi', ability: 'Stone Gaze', description: 'На «Ганге» и выше даёт +2 множителя.' },
];

export const heroImage = (id: string) =>
  `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${id}.png`;
const ITEM_FILE: Record<string, string> = {
  boots: 'boots_of_travel',
  aghamim: 'ultimate_scepter',
  shiva: 'shivas_guard',
};
export const itemImage = (id: string) =>
  `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${ITEM_FILE[id] ?? id}.png`;
export const heroById = (id: string): Hero => HEROES.find((h) => h.id === id)!;

export type Rarity = 'Обычный' | 'Редкий' | 'Легендарный';
export type Item = { id: string; name: string; price: number; rarity: Rarity; desc: string; short: string };

export const RARITY_STYLE: Record<Rarity, { ring: string; chip: string; label: string }> = {
  Обычный: { ring: 'border-slate-500/50', chip: 'bg-slate-600/40 text-slate-200', label: 'text-slate-300' },
  Редкий: { ring: 'border-sky-400/60', chip: 'bg-sky-500/25 text-sky-200', label: 'text-sky-300' },
  Легендарный: { ring: 'border-amber-400/70', chip: 'bg-amber-500/25 text-amber-200', label: 'text-amber-300' },
};

export const ITEMS: Item[] = [
  // --- оригинальные предметы ---
  { id: 'bfury', name: 'Battle Fury', price: 7, rarity: 'Обычный', desc: 'Сила самого слабого сыгранного героя учитывается дважды.', short: 'Повтор силы' },
  { id: 'hand_of_midas', name: 'Hand of Midas', price: 7, rarity: 'Обычный', desc: 'Вдвое больше золота за урон сверх здоровья башни.', short: 'Золото ×2' },
  { id: 'meteor_hammer', name: 'Meteor Hammer', price: 6, rarity: 'Обычный', desc: '+12 силы, если сыграно 3 или больше героев.', short: '+12 силы' },
  { id: 'ancient_janggo', name: 'Drum of Endurance', price: 7, rarity: 'Обычный', desc: '+2 множителя, если сыграно 4 или больше героев.', short: '+2 множителя' },
  { id: 'heart', name: 'Heart of Tarrasque', price: 10, rarity: 'Редкий', desc: '+25 силы к каждому тимфайту.', short: '+25 силы' },
  { id: 'satanic', name: 'Satanic', price: 10, rarity: 'Редкий', desc: 'Множитель ×1.5 на любой комбинации от пары и выше.', short: 'Множитель ×1.5' },
  { id: 'refresher', name: 'Refresher Orb', price: 11, rarity: 'Редкий', desc: 'Все способности сыгранных героев срабатывают дважды.', short: 'Повтор способностей' },
  { id: 'black_king_bar', name: 'Black King Bar', price: 8, rarity: 'Редкий', desc: 'Игнорирует броню, глиф и модификаторы башен. Не отменяет возрождение Рошана.', short: 'Иммунитет к башням' },
  { id: 'radiance', name: 'Radiance', price: 12, rarity: 'Легендарный', desc: '+5 силы за каждого сыгранного героя.', short: '+5 силы / герой' },
  { id: 'rapier', name: 'Divine Rapier', price: 13, rarity: 'Легендарный', desc: 'Удваивает итоговый урон. Теряется при провале волны.', short: 'Урон ×2 · риск' },
  { id: 'octarine_core', name: 'Octarine Core', price: 12, rarity: 'Легендарный', desc: '+1 множителя за каждый предмет в инвентаре, включая себя.', short: 'Множитель от билда' },
  // --- новые предметы Astra ---
  { id: 'boots', name: 'Boots of Travel', price: 5, rarity: 'Обычный', desc: '+1 ТП-сброс на каждой волне.', short: '+1 сброс' },
  { id: 'assault', name: 'Assault Cuirass', price: 9, rarity: 'Редкий', desc: '+12 силы и отменяет броню первой атаки башен.', short: '+12 · броня снята' },
  { id: 'shadow_blade', name: 'Shadow Blade', price: 8, rarity: 'Редкий', desc: 'При определении комбинации самый слабый герой считается рангом самого сильного. Реальная сила не меняется.', short: 'Скрытый ранг' },
  { id: 'manta', name: 'Manta Style', price: 9, rarity: 'Редкий', desc: 'Создаёт иллюзию первого героя: она засчитывается при определении комбинации, но не даёт силы.', short: 'Иллюзия в комбо' },
  { id: 'butterfly', name: 'Butterfly', price: 10, rarity: 'Редкий', desc: '+1 множителя за каждого героя Ловкости в тимфайте.', short: 'Множ. за Ловкость' },
  { id: 'daedalus', name: 'Daedalus', price: 10, rarity: 'Редкий', desc: '+3 множителя на любой комбинации от пары и выше.', short: '+3 множителя' },
  { id: 'shiva', name: "Shiva's Guard", price: 12, rarity: 'Легендарный', desc: '+2 множителя и полностью блокирует регенерацию башен.', short: '+2 множ. · анти-реген' },
  { id: 'aghamim', name: "Aghanim's Scepter", price: 13, rarity: 'Легендарный', desc: 'Способности героев срабатывают ещё раз. Стакается с Refresher Orb — до трёх срабатываний.', short: 'Способности ×2' },
  { id: 'bloodstone', name: 'Bloodstone', price: 13, rarity: 'Легендарный', desc: '+1 множителя за каждые 5 золота в кошельке в момент атаки. Друг экономики.', short: 'Множ. от золота' },
];
export const itemById = (id: string): Item => ITEMS.find((i) => i.id === id)!;

export const COMBOS = [
  { name: 'Харас', poker: 'Старшая карта', base: 5, mult: 1, rule: 'Любая карта' },
  { name: 'Дуо на линии', poker: 'Пара', base: 10, mult: 2, rule: '2 героя одного ранга' },
  { name: 'Ротация', poker: 'Две пары', base: 20, mult: 2, rule: 'Две пары одинаковых рангов' },
  { name: 'Ганг', poker: 'Тройка', base: 30, mult: 3, rule: '3 героя одного ранга' },
  { name: 'Смок на Рошана', poker: 'Стрит', base: 35, mult: 4, rule: '5 последовательных рангов' },
  { name: 'Тимфайт атрибута', poker: 'Флеш', base: 40, mult: 4, rule: '5 героев одного атрибута' },
  { name: '4 Protect 1', poker: 'Фулл-хаус', base: 45, mult: 6, rule: 'Тройка и пара' },
  { name: 'Rampage', poker: 'Каре', base: 60, mult: 8, rule: '4 героя одного ранга' },
];

export type Modifier = {
  id: string;
  name: string;
  desc: string;
  tag: 'ЭЛИТА' | 'БОСС';
};

export const MODIFIERS: Modifier[] = [
  { id: 'fog', name: 'Туман войны', desc: 'Герои ранга ≤4 не дают своей силы (способности работают).', tag: 'ЭЛИТА' },
  { id: 'disarm', name: 'Обезоруживание', desc: 'В тимфайте можно сыграть не более 4 героев.', tag: 'ЭЛИТА' },
  { id: 'mana_fire', name: 'Сжигание маны', desc: 'Каждая ваша атака тратит 1 золото.', tag: 'ЭЛИТА' },
  { id: 'thorns', name: 'Шипы', desc: 'Тимфайт из 5 героев наносит лишь 0.6 урона.', tag: 'ЭЛИТА' },
  { id: 'regen', name: 'Регенерация', desc: 'После каждой атаки башня восстанавливает 12% здоровья. Shiva’s Guard блокирует.', tag: 'ЭЛИТА' },
  { id: 'backdoor', name: 'Backdoor Protection', desc: 'Первые две атаки наносят только половину урона.', tag: 'ЭЛИТА' },
  { id: 'silence', name: 'Безмолвие', desc: 'Способности героев отключены. Предметы и комбинации работают.', tag: 'ЭЛИТА' },
];
export const modifierById = (id: string | null): Modifier | undefined =>
  MODIFIERS.find((m) => m.id === id) || undefined;

export type DeckId = 'crimson' | 'azure' | 'emerald';
export type DeckInfo = {
  id: DeckId;
  name: string;
  subtitle: string;
  cards: string[];
  items: string[];
  gold: number;
  bonusDiscards: number;
  accent: string;
  trait: string;
  tips: string;
};

export const DECKS: DeckInfo[] = [
  {
    id: 'crimson',
    name: 'Багровый драфт',
    subtitle: 'Силовой пролом · флеши',
    cards: ['axe', 'pudge', 'sven', 'tusk', 'centaur', 'tiny', 'kunkka', 'wraith_king', 'tidehunter', 'primal_beast', 'dawnbreaker', 'marci'],
    items: ['heart'],
    gold: 8,
    bonusDiscards: 0,
    accent: '#f05c3a',
    trait: 'Девять героев Силы и Heart of Tarrasque на старте. Колода собирает «Тимфайт атрибута» почти каждый розыгрыш.',
    tips: 'Ищите Pudge и Wraith King — они разгоняются от числа STR-героев. Покупайте Radiance и Satanic.',
  },
  {
    id: 'azure',
    name: 'Лазурная колода',
    subtitle: 'Сбалансированная классика · стриты',
    cards: ['axe', 'juggernaut', 'crystal_maiden', 'pudge', 'morphling', 'zuus', 'sven', 'phantom_assassin', 'tusk', 'centaur', 'dawnbreaker', 'primal_beast'],
    items: ['bfury', 'hand_of_midas'],
    gold: 12,
    bonusDiscards: 0,
    accent: '#5b8cff',
    trait: 'Оригинальный набор Dalatro: равномерные ранги для стритов, два стартовых предмета и больше золота.',
    tips: 'Цельтесь в «Смок на Рошана» (5 рангов подряд) и качайте комбинации боевым опытом.',
  },
  {
    id: 'emerald',
    name: 'Изумрудный караван',
    subtitle: 'Экономика · ТП-сбросы',
    cards: ['crystal_maiden', 'riki', 'shadow_shaman', 'sniper', 'witch_doctor', 'morphling', 'drow_ranger', 'slark', 'lion', 'lina', 'muerta', 'medusa'],
    items: ['hand_of_midas'],
    gold: 14,
    bonusDiscards: 1,
    accent: '#4ed17b',
    trait: '+1 ТП-сброс на каждой волне, каждый сброс приносит +1 золото, а проценты капают на остаток. Богаче всех к третьему акту.',
    tips: 'Сбрасывайте смело, копите 25+ золота и забирайте Bloodstone с Octarine Core.',
  },
];
export const deckById = (id: DeckId): DeckInfo => DECKS.find((d) => d.id === id)!;
