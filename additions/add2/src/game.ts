// Dalatro — игровой движок. Итерация 0.3: маршруты, развитие колоды, новые герои и предметы.
export type Attribute = 'str' | 'agi' | 'int' | 'uni';
export type Hero = { id: string; name: string; rank: number; attr: Attribute; ability: string; description: string; art?: string; tavern?: boolean };

export const HEROES: Hero[] = [
  { id:'axe', name:'Axe', rank:5, attr:'str', ability:'Counter Helix', description:'В комбинации «Ганг» или выше даёт +10 силы.' },
  { id:'juggernaut', name:'Juggernaut', rank:7, attr:'agi', ability:'Blade Fury', description:'На первой позиции даёт +8 силы.' },
  { id:'crystal_maiden', name:'Crystal Maiden', rank:2, attr:'int', ability:'Frostbite', description:'При ТП-сбросе приносит 2 золота.' },
  { id:'pudge', name:'Pudge', rank:7, attr:'str', ability:'Flesh Heap', description:'Даёт +3 силы за каждого другого героя Силы в тимфайте.' },
  { id:'morphling', name:'Morphling', rank:5, attr:'agi', ability:'Morph', description:'Копирует атрибут героя слева. Порядок выбора важен!' },
  { id:'zuus', name:'Zeus', rank:5, attr:'int', ability:'Static Field', description:'Даёт +2 множителя. Refresher Orb повторяет эффект.' },
  { id:'sven', name:'Sven', rank:8, attr:'str', ability:'God’s Strength', description:'В тимфайте из 5 героев даёт +12 силы.' },
  { id:'phantom_assassin', name:'Phantom Assassin', rank:9, attr:'agi', ability:'Coup de Grace', description:'На паре и выше множитель ×1.5. Без случайности — только расчёт.' },
  { id:'tusk', name:'Tusk', rank:3, attr:'str', ability:'Walrus Punch', description:'На последней позиции даёт +5 силы.' },
  { id:'centaur', name:'Centaur Warrunner', rank:10, attr:'str', ability:'Double Edge', description:'Надёжная карта Силы для стрита 7–11.' },
  { id:'dawnbreaker', name:'Dawnbreaker', rank:9, attr:'uni', ability:'Solar Guardian', description:'Если в тимфайте 3 разных атрибута, даёт +1 множителя.' },
  { id:'primal_beast', name:'Primal Beast', rank:11, attr:'uni', ability:'Pulverize', description:'Самый сильный герой стартовой колоды.' },
  // Таверна — recruitable герои итерации 0.3
  { id:'windranger', name:'Windranger', rank:6, attr:'agi', art:'windrunner', ability:'Focus Fire', description:'Если она сыграна в одиночку, множитель ×3.', tavern:true },
  { id:'antimage', name:'Anti-Mage', rank:6, attr:'agi', ability:'Mana Break', description:'+4 силы за каждую пустую позицию в тимфайте.' , tavern:true },
  { id:'drow_ranger', name:'Drow Ranger', rank:7, attr:'agi', ability:'Precision Aura', description:'+3 силы за каждого героя Ловкости в тимфайте.', tavern:true },
  { id:'lion', name:'Lion', rank:4, attr:'int', ability:'Mana Drain', description:'Первый ТП-сброс волны с его участием возвращает 1 тимфайт.', tavern:true },
  { id:'earthshaker', name:'Earthshaker', rank:6, attr:'str', ability:'Echo Slam', description:'+7 силы за каждого другого героя того же ранга.', tavern:true },
  { id:'invoker', name:'Invoker', rank:12, attr:'uni', ability:'Quas Wex Exort', description:'+1 множителя за каждый уникальный ранг в тимфайте (максимум +4).', tavern:true },
  { id:'shadow_fiend', name:'Shadow Fiend', rank:9, attr:'agi', art:'nevermore', ability:'Necromastery', description:'+2 силы за каждого героя в сбросе (максимум +20).', tavern:true },
  { id:'bounty_hunter', name:'Bounty Hunter', rank:5, attr:'agi', ability:'Track', description:'Точный ластхит с его участием приносит +8 золота.', tavern:true },
];
export const ATTRS = { str:{name:'Сила',symbol:'◆'}, agi:{name:'Ловкость',symbol:'✦'}, int:{name:'Интеллект',symbol:'✺'}, uni:{name:'Универсальный',symbol:'◈'} };
export const heroImage = (id:string) => { const h=HEROES.find(x=>x.id===id); return `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${h?.art??id}.png`; };
export const itemImage = (id:string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${id}.png`;
export const heroById = (id:string) => HEROES.find(h=>h.id===id)!;

export type Item = { id:string; name:string; price:number; rarity:'Обычный'|'Редкий'|'Легендарный'; desc:string; short:string };
export const ITEMS: Item[] = [
  { id:'bfury', name:'Battle Fury', price:7, rarity:'Обычный', desc:'Сила самого слабого сыгранного героя учитывается дважды.', short:'Повтор силы' },
  { id:'hand_of_midas', name:'Hand of Midas', price:7, rarity:'Обычный', desc:'Вдвое больше золота за урон сверх здоровья башни.', short:'Золото ×2' },
  { id:'meteor_hammer', name:'Meteor Hammer', price:6, rarity:'Обычный', desc:'+12 силы, если сыграно 3 или больше героев.', short:'+12 силы' },
  { id:'ancient_janggo', name:'Drum of Endurance', price:7, rarity:'Обычный', desc:'+2 множителя, если сыграно 4 или больше героев.', short:'+2 множителя' },
  { id:'maelstrom', name:'Maelstrom', price:6, rarity:'Обычный', desc:'Множитель ×1.5 на комбинациях «Харас» и «Дуо на линии».', short:'Малые комбо ×1.5' },
  { id:'desolator', name:'Desolator', price:6, rarity:'Обычный', desc:'Первая атака на каждой волне наносит ×1.4 урона.', short:'Первая атака ×1.4' },
  { id:'heart', name:'Heart of Tarrasque', price:10, rarity:'Редкий', desc:'+25 силы к каждому тимфайту.', short:'+25 силы' },
  { id:'satanic', name:'Satanic', price:10, rarity:'Редкий', desc:'Множитель ×1.5 на любой комбинации от пары и выше.', short:'Множитель ×1.5' },
  { id:'refresher', name:'Refresher Orb', price:11, rarity:'Редкий', desc:'Все способности сыгранных героев срабатывают дважды.', short:'Повтор способностей' },
  { id:'black_king_bar', name:'Black King Bar', price:8, rarity:'Редкий', desc:'Игнорирует броню и глиф башен. Не отменяет возрождение Рошана.', short:'Иммунитет к башням' },
  { id:'invis_sword', name:'Shadow Blade', price:9, rarity:'Редкий', desc:'Сильнейший сыгранный герой считается на 1 ранг выше при определении комбинации. Реальная сила не меняется.', short:'Ранг +1 для комбо' },
  { id:'bloodstone', name:'Bloodstone', price:10, rarity:'Редкий', desc:'Первая проигранная волна за забег не отнимает казарму — вместо этого Bloodstone разбивается.', short:'Второй шанс' },
  { id:'radiance', name:'Radiance', price:12, rarity:'Легендарный', desc:'+5 силы за каждого сыгранного героя.', short:'+5 силы / герой' },
  { id:'rapier', name:'Divine Rapier', price:13, rarity:'Легендарный', desc:'Удваивает итоговый урон. Теряется при провале волны.', short:'Урон ×2 · риск' },
  { id:'octarine_core', name:'Octarine Core', price:12, rarity:'Легендарный', desc:'+1 множителя за каждый предмет в инвентаре, включая себя.', short:'Множитель от билда' },
  { id:'manta', name:'Manta Style', price:13, rarity:'Легендарный', desc:'Иллюзия: к комбинации добавляется копия высшего ранга среди сыгранных героев. Условия «4+ героев» считают только настоящих.', short:'Иллюзия в комбо' },
  { id:'nullifier', name:'Nullifier', price:12, rarity:'Легендарный', desc:'Игнорирует особые правила элитных башен и боссов.', short:'Снятие проклятий' },
];

export const COMBOS = [
  { name:'Харас', poker:'Старшая карта', base:5, mult:1, rule:'Любая карта' },
  { name:'Дуо на линии', poker:'Пара', base:10, mult:2, rule:'2 героя одного ранга' },
  { name:'Ротация', poker:'Две пары', base:20, mult:2, rule:'Две пары одинаковых рангов' },
  { name:'Ганг', poker:'Тройка', base:30, mult:3, rule:'3 героя одного ранга' },
  { name:'Смок на Рошана', poker:'Стрит', base:35, mult:4, rule:'5 последовательных рангов' },
  { name:'Тимфайт атрибута', poker:'Флеш', base:40, mult:4, rule:'5 героев одного атрибута' },
  { name:'4 Protect 1', poker:'Фулл-хаус', base:45, mult:6, rule:'Тройка и пара' },
  { name:'Rampage', poker:'Каре', base:60, mult:8, rule:'4 героя одного ранга' },
];

// Особые правила элитных башен и поздних боссов (итерация 0.3)
export type EliteMod = 'none' | 'adaptation' | 'bastion' | 'hunt' | 'dispersion';
export const ELITE_MODS: EliteMod[] = ['adaptation','bastion','hunt','dispersion'];
export const MOD_INFO: Record<EliteMod, { name:string; rule:string; short:string }> = {
  none:       { name:'Без проклятия', rule:'Особых правил нет', short:'Чистый бой' },
  adaptation: { name:'Адаптация', rule:'Одна и та же комбинация дважды подряд наносит ×0.5 урона', short:'×0.5 за повтор' },
  bastion:    { name:'Фортификация', rule:'«Харас», «Дуо на линии» и «Ротация» наносят ×0.5 урона', short:'×0.5 малым комбо' },
  hunt:       { name:'Охота на кэрри', rule:'Бонусы первой и последней позиции не работают', short:'Позиции отключены' },
  dispersion: { name:'Рассеивание', rule:'Бонусы за атрибуты (Flesh Heap, Precision Aura, Solar Guardian) не работают', short:'Атрибуты отключены' },
};

export type RouteKind = 'camp' | 'normal' | 'elite';
export type Phase = 'battle' | 'shop' | 'route' | 'won' | 'lost';
export type Game = {
  version:3; hand:string[]; deck:string[]; discarded:string[]; seed:number;
  wave:number; hp:number; hpMax:number; hands:number; discards:number; lives:number;
  gold:number; items:string[]; slots:number; phase:Phase;
  log:string[]; levels:number[]; plays:number[]; totalDamage:number; best:number;
  offer:string[]; reward:boolean; revived:boolean; battles:number;
  elite:boolean; mod:EliteMod; lastCombo:number; routeMod:EliteMod;
  recruits:string[]; campBoon:boolean; lionUsed:boolean;
  ranks:Record<string,number>; elites:number;
};

export function maxHp(wave:number) { return Math.round([300,500,750,1200][wave%4]*Math.pow(2.1,Math.floor(wave/4))); }
export function waveName(wave:number) { return ['Башня первой линии','Башня второй линии','Башня у казарм','Рошан'][wave%4]; }
function random(seed:number) { const next=(seed*1664525+1013904223)>>>0; return { seed:next, value:next/4294967296 }; }
function shuffle(ids:string[], seed:number) { const a=[...ids]; for(let i=a.length-1;i>0;i--){ const r=random(seed); seed=r.seed; const j=Math.floor(r.value*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return { cards:a, seed }; }
export const rankOf = (g:Game, id:string) => g.ranks[id] ?? heroById(id).rank;
export const allCards = (g:Game) => [...g.hand, ...g.deck, ...g.discarded];

export function initialGame():Game {
  return {
    version:3, hand:HEROES.slice(0,8).map(h=>h.id), deck:HEROES.slice(8,12).map(h=>h.id), discarded:[], seed:74329,
    wave:0, hp:300, hpMax:300, hands:4, discards:3, lives:6, gold:12, items:['bfury','hand_of_midas'], slots:5, phase:'battle',
    log:['Ты на линии. Самое время собрать сильный тимфайт.'], levels:Array(8).fill(1), plays:Array(8).fill(0),
    totalDamage:0, best:0, offer:[], reward:false, revived:false, battles:0,
    elite:false, mod:'none', lastCombo:-1, routeMod:'adaptation', recruits:[], campBoon:false, lionUsed:false, ranks:{}, elites:0,
  };
}
export function loadGame():Game {
  try { const g=JSON.parse(localStorage.getItem('dalatro-v3')||'null'); if(g?.version===3 && Array.isArray(g.hand)) return g; } catch {}
  try {
    const old=JSON.parse(localStorage.getItem('dalatro-v2')||'null');
    if(old?.version===2 && Array.isArray(old.hand)) {
      return { ...initialGame(), ...old, version:3, hpMax:maxHp(old.wave??0), slots:5, elite:false, mod:'none', lastCombo:-1,
        routeMod:'adaptation', recruits:[], campBoon:false, lionUsed:false, ranks:{}, elites:0, phase:'battle' };
    }
  } catch {}
  return initialGame();
}

export function evaluate(ids:string[], g:Game) {
  const cards = ids.map(heroById);
  const ranksTrue = ids.map(id=>rankOf(g,id));
  // Shadow Blade: сильнейший герой +1 ранг только для определения комбинации
  const det = [...ranksTrue];
  if(g.items.includes('invis_sword') && det.length){ const im=det.indexOf(Math.max(...det)); det[im]=Math.min(13,det[im]+1); }
  // Manta Style: иллюзия высшего ранга участвует в комбинации
  const illusion = g.items.includes('manta') && det.length ? Math.max(...det) : null;
  const effRanks = illusion!==null ? [...det, illusion] : det;
  const attrs = cards.map(h=>h.attr);
  cards.forEach((h,i)=>{ if(h.id==='morphling'&&i>0) attrs[i]=attrs[i-1]; });
  const effAttrs = illusion!==null ? [...attrs, attrs[det.indexOf(Math.max(...det))]] : attrs;

  const counts = Object.values(effRanks.reduce((acc,r)=>({...acc,[r]:(acc[r]||0)+1}),{} as Record<number,number>)).sort((a,b)=>b-a);
  const uniq = [...new Set(effRanks)].sort((a,b)=>a-b);
  let combo=0;
  if(counts[0]>=2) combo=1;
  if(counts[0]===2&&counts[1]===2) combo=2;
  if(counts[0]>=3) combo=3;
  if(uniq.length===5&&uniq[4]-uniq[0]===4) combo=4;
  if(effAttrs.length>=5&&effAttrs.every(a=>a===effAttrs[0])) combo=5;
  if(counts[0]===3&&counts[1]===2) combo=6;
  if(counts[0]>=4) combo=7;
  if(!cards.length) return { combo:0, power:0, mult:0, damage:0, effects:[] as string[], modifier:1 };

  const heroPower = ranksTrue.reduce((s,r)=>s+r,0) + (illusion??0);
  let power = COMBOS[combo].base + (g.levels[combo]-1)*10 + heroPower;
  let mult = COMBOS[combo].mult + (g.levels[combo]-1);
  const effects:string[] = [`${COMBOS[combo].poker}: ${COMBOS[combo].base+(g.levels[combo]-1)*10} силы + ${heroPower} от героев`];
  if(g.items.includes('invis_sword')) effects.push('Shadow Blade: сильнейший герой считается на ранг выше');
  if(illusion!==null) effects.push(`Manta Style: иллюзия ранга ${illusion} вступила в бой`);

  const times = g.items.includes('refresher')?2:1;
  const pure = !g.items.includes('nullifier');
  const positionalOk = !(pure && g.mod==='hunt');
  const attrOk = !(pure && g.mod==='dispersion');
  for(let t=0;t<times;t++) cards.forEach((h,i)=>{
    if(h.id==='axe'&&combo>=3){ power+=10; effects.push('Counter Helix: +10 силы'); }
    if(h.id==='juggernaut'&&i===0){ if(positionalOk){ power+=8; effects.push('Blade Fury: +8 силы (первая позиция)'); } else effects.push('Blade Fury подавлена: Охота на кэрри'); }
    if(h.id==='zuus'){ mult+=2; effects.push('Static Field: +2 множителя'); }
    if(h.id==='pudge'){ if(attrOk){ const bonus=attrs.filter(a=>a==='str').length*3-3; if(bonus>0){ power+=bonus; effects.push(`Flesh Heap: +${bonus} силы`); } } else effects.push('Flesh Heap подавлен: Рассеивание'); }
    if(h.id==='sven'&&cards.length===5){ power+=12; effects.push('God’s Strength: +12 силы'); }
    if(h.id==='tusk'&&i===cards.length-1){ if(positionalOk){ power+=5; effects.push('Walrus Punch: +5 силы (последняя позиция)'); } else effects.push('Walrus Punch подавлен: Охота на кэрри'); }
    if(h.id==='dawnbreaker'){ if(attrOk&&new Set(attrs).size>=3){ mult+=1; effects.push('Solar Guardian: +1 множителя'); } }
    if(h.id==='antimage'){ const bonus=(5-cards.length)*4; if(bonus>0){ power+=bonus; effects.push(`Mana Break: +${bonus} силы за пустые позиции`); } }
    if(h.id==='drow_ranger'){ if(attrOk){ const bonus=attrs.filter(a=>a==='agi').length*3; power+=bonus; effects.push(`Precision Aura: +${bonus} силы`); } }
    if(h.id==='earthshaker'){ const same=ranksTrue.filter(r=>r===ranksTrue[i]).length-1; if(same>0){ power+=same*7; effects.push(`Echo Slam: +${same*7} силы`); } }
    if(h.id==='invoker'){ const bonus=Math.min(4,new Set(ranksTrue).size); mult+=bonus; effects.push(`Quas Wex Exort: +${bonus} множителя`); }
    if(h.id==='shadow_fiend'){ const bonus=Math.min(20,g.discarded.length*2); if(bonus>0){ power+=bonus; effects.push(`Necromastery: +${bonus} силы из сброса`); } }
  });
  if(cards.some(h=>h.id==='morphling')&&cards.findIndex(h=>h.id==='morphling')>0) effects.push('Morph: атрибут скопирован у соседа слева');

  for(const id of g.items){
    if(id==='bfury'){ const bonus=Math.min(...ranksTrue); power+=bonus; effects.push(`Battle Fury: +${bonus} силы`); }
    if(id==='heart'){ power+=25; effects.push('Heart of Tarrasque: +25 силы'); }
    if(id==='meteor_hammer'&&cards.length>=3){ power+=12; effects.push('Meteor Hammer: +12 силы'); }
    if(id==='ancient_janggo'&&cards.length>=4){ mult+=2; effects.push('Drum of Endurance: +2 множителя'); }
    if(id==='radiance'){ power+=cards.length*5; effects.push(`Radiance: +${cards.length*5} силы`); }
    if(id==='octarine_core'){ mult+=g.items.length; effects.push(`Octarine Core: +${g.items.length} множителя`); }
  }
  if(cards.some(h=>h.id==='phantom_assassin')&&combo>=1){ mult*=Math.pow(1.5,times); effects.push(`Coup de Grace: ×${Math.pow(1.5,times)} множителя`); }
  if(cards.some(h=>h.id==='windranger')&&cards.length===1){ mult*=3; effects.push('Focus Fire: ×3 множителя в одиночку'); }
  if(g.items.includes('satanic')&&combo>=1){ mult*=1.5; effects.push('Satanic: ×1.5 множителя'); }
  if(g.items.includes('maelstrom')&&combo<=1){ mult*=1.5; effects.push('Maelstrom: ×1.5 множителя на малом комбо'); }

  let modifier=1;
  if(!g.items.includes('black_king_bar')){
    if(g.wave%4===1&&g.battles===0){ modifier=.5; effects.push('Броня башни: итоговый урон ×0.5'); }
    if(g.wave%4===2&&g.battles===2){ modifier=0; effects.push('Глиф: третья атака не наносит урона!'); }
  }
  if(pure){
    if(g.mod==='adaptation'&&g.lastCombo===combo){ modifier*=.5; effects.push('Адаптация: повтор комбинации ×0.5'); }
    if(g.mod==='bastion'&&combo<=2){ modifier*=.5; effects.push('Фортификация: малое комбо ×0.5'); }
  }
  if(g.items.includes('desolator')&&g.battles===0){ modifier*=1.4; effects.push('Desolator: первая атака по волне ×1.4'); }
  if(g.items.includes('rapier')){ modifier*=2; effects.push('Divine Rapier: итоговый урон ×2'); }
  return { combo, power, mult, damage:Math.floor(power*mult*modifier), effects, modifier };
}

function refill(g:Game, removed:string[]) {
  let hand=g.hand.filter(id=>!removed.includes(id)), deck=[...g.deck], discarded=[...g.discarded,...removed], seed=g.seed;
  while(hand.length<8){ if(!deck.length){ const s=shuffle(discarded,seed); deck=s.cards; seed=s.seed; discarded=[]; } if(!deck.length)break; hand.push(deck.shift()!); }
  return { ...g, hand, deck, discarded, seed };
}
function deal(g:Game){ const s=shuffle(allCards(g),g.seed); return { ...g, hand:s.cards.slice(0,8), deck:s.cards.slice(8), discarded:[], seed:s.seed }; }
function offers(g:Game, legendary=false){
  let s=shuffle(ITEMS.filter(i=>!g.items.includes(i.id)).map(i=>i.id),g.seed), seed=s.seed, cards=s.cards;
  if(legendary && !cards.slice(0,4).some(id=>ITEMS.find(i=>i.id===id)?.rarity==='Легендарный')){
    const legs=cards.filter(id=>ITEMS.find(i=>i.id===id)!.rarity==='Легендарный');
    if(legs.length){ const r=random(seed); seed=r.seed; const pick=legs[Math.floor(r.value*legs.length)]; cards=[pick,...cards.filter(id=>id!==pick).slice(0,3)]; }
  }
  return { ...g, offer:cards.slice(0,4), seed };
}
export function pickRecruits(g:Game){
  const owned=allCards(g);
  const s=shuffle(HEROES.filter(h=>h.tavern&&!owned.includes(h.id)).map(h=>h.id),g.seed);
  return { ...g, recruits:s.cards.slice(0,2), seed:s.seed };
}
export const recruitPrice = (id:string) => 4 + Math.floor(heroById(id).rank/2);

export function attack(g:Game, selected:string[]):Game {
  if(g.phase!=='battle'||!selected.length||selected.length>5) return g;
  const r=evaluate(selected,g);
  let n=refill({ ...g, hp:Math.max(0,g.hp-r.damage), hands:g.hands-1, battles:g.battles+1, lastCombo:r.combo,
    totalDamage:g.totalDamage+r.damage, best:Math.max(g.best,r.damage) }, selected);
  n.plays=[...g.plays]; n.plays[r.combo]++; n.levels=[...g.levels];
  const messages=[`${COMBOS[r.combo].name} → ${r.damage} урона`];
  if(n.plays[r.combo]%3===0){ n.levels[r.combo]++; messages.unshift(`${COMBOS[r.combo].name}: уровень ${n.levels[r.combo]}!`); }
  if(n.hp<=0&&g.wave%4===3&&!g.revived){
    n.hp=Math.round(g.hpMax*.5); n.revived=true; messages.unshift('Aegis! Рошан возродился с 50% здоровья.');
  } else if(n.hp<=0){
    const bonus=Math.min(20,Math.floor(Math.max(0,r.damage-g.hp)/25))*(g.items.includes('hand_of_midas')?2:1);
    const lasthit=r.damage===g.hp?5:0;
    const track=lasthit&&selected.includes('bounty_hunter')?8:0;
    let income=6+n.hands+bonus+lasthit+track;
    if(g.elite){ income=Math.round(income*1.6); messages.push('Элитная добыча: золото ×1.6'); if(n.slots<7){ n.slots++; messages.push(`Трофей элитной башни: +1 слот предмета (${n.slots})`); } n.elites++; }
    messages.push(`Волна пройдена! +${income} золота${bonus?` · оверкилл +${bonus}`:''}${track?' · Track: +8':''}`);
    if(track) messages.push('Track: +8 золота за точный ластхит');
    n.gold+=income; n.phase=g.wave===11?'won':'shop'; n.reward=false; n.lionUsed=false; n.campBoon=false;
    n=offers(n,g.elite); n=pickRecruits(n);
  }
  if(n.hp>0&&n.hands<=0){
    if(n.items.includes('bloodstone')){
      n.items=n.items.filter(i=>i!=='bloodstone');
      n=deal({ ...n, hp:g.hpMax, hands:4, discards:3, battles:0, lastCombo:-1, lionUsed:false });
      messages.unshift('Bloodstone разбился, поглотив поражение. Волна начинается заново!');
    } else {
      n.lives--; n.items=n.items.filter(i=>i!=='rapier');
      if(n.lives<=0){ n.phase='lost'; messages.unshift('Крепость пала. Новый забег — новый билд.'); }
      else { n=deal({ ...n, hp:g.hpMax, hands:4, discards:3, battles:0, lastCombo:-1, lionUsed:false }); messages.unshift('Казарма потеряна. Перегруппировка — попробуй ещё!'); }
    }
  }
  n.log=[...messages,...g.log].slice(0,30);
  return n;
}
export function discard(g:Game, selected:string[]):Game {
  if(g.phase!=='battle'||!g.discards||!selected.length) return g;
  const bonus=selected.includes('crystal_maiden')?2:0;
  let n=refill({ ...g, discards:g.discards-1, gold:g.gold+bonus }, selected);
  const msgs=[`ТП-сброс: ${selected.length} героев${bonus?' · Frostbite: +2 золота':''}`];
  if(selected.includes('lion')&&!g.lionUsed){ n={ ...n, hands:Math.min(4,n.hands+1), lionUsed:true }; msgs.unshift('Mana Drain: +1 тимфайт восстановлен'); }
  return { ...n, log:[...msgs,...g.log].slice(0,30) };
}
export function buyItem(g:Game, id:string):Game {
  const item=ITEMS.find(i=>i.id===id);
  if(!item||g.phase!=='shop'||g.gold<item.price||g.items.length>=g.slots||!g.offer.includes(id)) return g;
  return { ...g, gold:g.gold-item.price, items:[...g.items,id], offer:g.offer.filter(i=>i!==id), log:[`${item.name} добавлен в билд`,...g.log].slice(0,30) };
}
export function sellItem(g:Game, id:string):Game {
  const item=ITEMS.find(i=>i.id===id);
  if(!item||g.phase!=='shop'||!g.items.includes(id)) return g;
  return { ...g, items:g.items.filter(i=>i!==id), gold:g.gold+Math.floor(item.price/2) };
}
export function reroll(g:Game):Game {
  if(g.gold<2||g.phase!=='shop') return g;
  return pickRecruits(offers({ ...g, gold:g.gold-2 }));
}
export function buyRecruit(g:Game, id:string):Game {
  const price=recruitPrice(id);
  if(g.phase!=='shop'||g.gold<price||!g.recruits.includes(id)) return g;
  return { ...g, gold:g.gold-price, deck:[...g.deck,id], recruits:g.recruits.filter(r=>r!==id),
    log:[`${heroById(id).name} присоединился к команде`,...g.log].slice(0,30) };
}
export function exileHero(g:Game, id:string):Game {
  if(g.phase!=='shop') return g;
  const free=g.campBoon;
  if(!free&&g.gold<4) return g;
  return { ...g, gold:free?g.gold:g.gold-4, campBoon:false,
    hand:g.hand.filter(h=>h!==id), deck:g.deck.filter(h=>h!==id), discarded:g.discarded.filter(h=>h!==id),
    log:[`${heroById(id).name} покинул колоду${free?' (крип-лагерь)':''}`,...g.log].slice(0,30) };
}
export function trainHero(g:Game, id:string):Game {
  if(g.phase!=='shop'||g.gold<5||rankOf(g,id)>=12) return g;
  return { ...g, gold:g.gold-5, ranks:{ ...g.ranks, [id]:rankOf(g,id)+1 },
    log:[`Тренировка: ${heroById(id).name} → ранг ${rankOf(g,id)+1}`,...g.log].slice(0,30) };
}
export function openRoutes(g:Game):Game {
  if(g.phase!=='shop') return g;
  const r=random(g.seed);
  return { ...g, phase:'route', routeMod:ELITE_MODS[Math.floor(r.value*ELITE_MODS.length)], seed:r.seed };
}
export function takeRoute(g:Game, kind:RouteKind):Game {
  if(g.phase!=='route') return g;
  const wave=g.wave+1;
  if(kind==='camp'){
    return { ...g, wave, hp:maxHp(wave), hpMax:maxHp(wave), phase:'shop', gold:g.gold+6, lives:Math.min(6,g.lives+1),
      campBoon:true, elite:false, mod:'none', lastCombo:-1, lionUsed:false, battles:0, revived:false,
      log:['Крип-лагерь зачищен без боя: +6 золота, привал (+1 казарма), бесплатное увольнение героя в лавке',...g.log].slice(0,30) };
  }
  const elite=kind==='elite';
  const hp=elite?Math.round(maxHp(wave)*1.5):maxHp(wave);
  return deal({ ...g, wave, hp, hpMax:hp, elite, mod:elite?g.routeMod:'none', hands:4, discards:3, battles:0, revived:false,
    lastCombo:-1, lionUsed:false, campBoon:false, phase:'battle',
    log:[elite?`Элитная цель: ${waveName(wave)} — ${MOD_INFO[g.routeMod].name}!`:`Новая цель: ${waveName(wave)}`,...g.log].slice(0,30) });
}
export function nextWave(g:Game):Game {
  if(g.phase!=='shop') return g;
  const wave=g.wave+1;
  const boss=wave%4===3;
  let mod:EliteMod='none', seed=g.seed;
  if(boss&&wave>=7){ const r=random(seed); seed=r.seed; mod=ELITE_MODS[Math.floor(r.value*ELITE_MODS.length)]; }
  const hp=maxHp(wave);
  return deal({ ...g, wave, hp, hpMax:hp, hands:4, discards:3, battles:0, revived:false, phase:'battle', elite:false, mod, seed,
    lastCombo:-1, lionUsed:false, campBoon:false,
    log:[mod!=='none'?`Новая цель: ${waveName(wave)} — ${MOD_INFO[mod].name}!`:`Новая цель: ${waveName(wave)}`,...g.log].slice(0,30) });
}
export function claimReward(g:Game, combo:number):Game {
  if(g.reward||g.phase!=='shop') return g;
  const levels=[...g.levels]; levels[combo]++;
  return { ...g, levels, reward:true, log:[`Боевой опыт: ${COMBOS[combo].name} → ур. ${levels[combo]}`,...g.log] };
}
