export type Attribute = 'str' | 'agi' | 'int' | 'uni';
export type Hero = { id: string; name: string; rank: number; attr: Attribute; ability: string; description: string };
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
];
export const ATTRS = { str:{name:'Сила',symbol:'◆'}, agi:{name:'Ловкость',symbol:'✦'}, int:{name:'Интеллект',symbol:'✺'}, uni:{name:'Универсальный',symbol:'◈'} };
export const heroImage = (id:string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/${id}.png`;
export const itemImage = (id:string) => `https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/items/${id}.png`;
export const heroById = (id:string) => HEROES.find(h=>h.id===id)!;
export type Item = { id:string; name:string; price:number; rarity:'Обычный'|'Редкий'|'Легендарный'; desc:string; short:string };
export const ITEMS: Item[] = [
  {id:'bfury',name:'Battle Fury',price:7,rarity:'Обычный',desc:'Сила самого слабого сыгранного героя учитывается дважды.',short:'Повтор силы'},
  {id:'hand_of_midas',name:'Hand of Midas',price:7,rarity:'Обычный',desc:'Вдвое больше золота за урон сверх здоровья башни.',short:'Золото ×2'},
  {id:'meteor_hammer',name:'Meteor Hammer',price:6,rarity:'Обычный',desc:'+12 силы, если сыграно 3 или больше героев.',short:'+12 силы'},
  {id:'ancient_janggo',name:'Drum of Endurance',price:7,rarity:'Обычный',desc:'+2 множителя, если сыграно 4 или больше героев.',short:'+2 множителя'},
  {id:'heart',name:'Heart of Tarrasque',price:10,rarity:'Редкий',desc:'+25 силы к каждому тимфайту.',short:'+25 силы'},
  {id:'satanic',name:'Satanic',price:10,rarity:'Редкий',desc:'Множитель ×1.5 на любой комбинации от пары и выше.',short:'Множитель ×1.5'},
  {id:'refresher',name:'Refresher Orb',price:11,rarity:'Редкий',desc:'Все способности сыгранных героев срабатывают дважды.',short:'Повтор способностей'},
  {id:'black_king_bar',name:'Black King Bar',price:8,rarity:'Редкий',desc:'Игнорирует броню и глиф башен. Не отменяет возрождение Рошана.',short:'Иммунитет к башням'},
  {id:'radiance',name:'Radiance',price:12,rarity:'Легендарный',desc:'+5 силы за каждого сыгранного героя.',short:'+5 силы / герой'},
  {id:'rapier',name:'Divine Rapier',price:13,rarity:'Легендарный',desc:'Удваивает итоговый урон. Теряется при провале волны.',short:'Урон ×2 · риск'},
  {id:'octarine_core',name:'Octarine Core',price:12,rarity:'Легендарный',desc:'+1 множителя за каждый предмет в инвентаре, включая себя.',short:'Множитель от билда'},
];
export const COMBOS = [
  {name:'Харас',poker:'Старшая карта',base:5,mult:1,rule:'Любая карта'},
  {name:'Дуо на линии',poker:'Пара',base:10,mult:2,rule:'2 героя одного ранга'},
  {name:'Ротация',poker:'Две пары',base:20,mult:2,rule:'Две пары одинаковых рангов'},
  {name:'Ганг',poker:'Тройка',base:30,mult:3,rule:'3 героя одного ранга'},
  {name:'Смок на Рошана',poker:'Стрит',base:35,mult:4,rule:'5 последовательных рангов'},
  {name:'Тимфайт атрибута',poker:'Флеш',base:40,mult:4,rule:'5 героев одного атрибута'},
  {name:'4 Protect 1',poker:'Фулл-хаус',base:45,mult:6,rule:'Тройка и пара'},
  {name:'Rampage',poker:'Каре',base:60,mult:8,rule:'4 героя одного ранга'},
];
export type Game = { version:2; hand:string[]; deck:string[]; discarded:string[]; seed:number; wave:number; hp:number; hands:number; discards:number; lives:number; gold:number; items:string[]; phase:'battle'|'shop'|'won'|'lost'; log:string[]; levels:number[]; plays:number[]; totalDamage:number; best:number; offer:string[]; reward:boolean; revived:boolean; battles:number; };
export function maxHp(wave:number) {return Math.round([300,500,750,1200][wave%4]*Math.pow(2.1,Math.floor(wave/4)));}
export function waveName(wave:number) {return ['Башня первой линии','Башня второй линии','Башня у казарм','Рошан'][wave%4];}
function random(seed:number) {const next=(seed*1664525+1013904223)>>>0; return {seed:next,value:next/4294967296};}
function shuffle(ids:string[],seed:number) {const a=[...ids]; for(let i=a.length-1;i>0;i--){const r=random(seed); seed=r.seed; const j=Math.floor(r.value*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return {cards:a,seed};}
export function initialGame():Game { return {version:2, hand:HEROES.slice(0,8).map(h=>h.id),deck:HEROES.slice(8).map(h=>h.id),discarded:[],seed:74329,wave:0,hp:300,hands:4,discards:3,lives:6,gold:12,items:['bfury','hand_of_midas'],phase:'battle',log:['Ты на линии. Самое время собрать сильный тимфайт.'],levels:Array(8).fill(1),plays:Array(8).fill(0),totalDamage:0,best:0,offer:[],reward:false,revived:false,battles:0}; }
export function loadGame():Game {try {const g=JSON.parse(localStorage.getItem('dalatro-v2')||'null'); if(g?.version===2 && Array.isArray(g.hand) && g.hand.every((id:string)=>HEROES.some(h=>h.id===id))) return g;}catch{} return initialGame();}
export function evaluate(ids:string[],g:Game) {
  const cards=ids.map(heroById); const attrs=cards.map(h=>h.attr);
  cards.forEach((h,i)=>{if(h.id==='morphling'&&i>0) attrs[i]=attrs[i-1];});
  const counts=Object.values(cards.reduce((acc,h)=>({...acc,[h.rank]:(acc[h.rank]||0)+1}),{} as Record<number,number>)).sort((a,b)=>b-a);
  const ranks=[...new Set(cards.map(h=>h.rank))].sort((a,b)=>a-b);
  let combo=0;
  if(counts[0]>=2) combo=1;
  if(counts[0]===2&&counts[1]===2) combo=2;
  if(counts[0]>=3) combo=3;
  if(ranks.length===5&&ranks[4]-ranks[0]===4) combo=4;
  if(cards.length===5&&attrs.every(a=>a===attrs[0])) combo=5;
  if(counts[0]===3&&counts[1]===2) combo=6;
  if(counts[0]>=4) combo=7;
  if(!cards.length) return {combo:0,power:0,mult:0,damage:0,effects:[] as string[],modifier:1};
  let power=COMBOS[combo].base+(g.levels[combo]-1)*10+cards.reduce((s,c)=>s+c.rank,0);
  let mult=COMBOS[combo].mult+(g.levels[combo]-1);
  const effects:string[]=[`${COMBOS[combo].poker}: ${COMBOS[combo].base+(g.levels[combo]-1)*10} силы + ${cards.reduce((s,c)=>s+c.rank,0)} от героев`];
  const times=g.items.includes('refresher')?2:1;
  for(let t=0;t<times;t++) cards.forEach((h,i)=>{
    if(h.id==='axe'&&combo>=3){power+=10;effects.push('Counter Helix: +10 силы');}
    if(h.id==='juggernaut'&&i===0){power+=8;effects.push('Blade Fury: +8 силы (первая позиция)');}
    if(h.id==='zuus'){mult+=2;effects.push('Static Field: +2 множителя');}
    if(h.id==='pudge'){const bonus=attrs.filter(a=>a==='str').length*3-3;if(bonus>0){power+=bonus;effects.push(`Flesh Heap: +${bonus} силы`);}}
    if(h.id==='sven'&&cards.length===5){power+=12;effects.push('God’s Strength: +12 силы');}
    if(h.id==='tusk'&&i===cards.length-1){power+=5;effects.push('Walrus Punch: +5 силы');}
    if(h.id==='dawnbreaker'&&new Set(attrs).size>=3){mult+=1;effects.push('Solar Guardian: +1 множителя');}
  });
  if(cards.some(h=>h.id==='morphling')&&cards.findIndex(h=>h.id==='morphling')>0) effects.push('Morph: атрибут скопирован у соседа слева');
  for(const id of g.items){
    if(id==='bfury'){const bonus=Math.min(...cards.map(h=>h.rank));power+=bonus;effects.push(`Battle Fury: +${bonus} силы`);}
    if(id==='heart'){power+=25;effects.push('Heart of Tarrasque: +25 силы');}
    if(id==='meteor_hammer'&&cards.length>=3){power+=12;effects.push('Meteor Hammer: +12 силы');}
    if(id==='ancient_janggo'&&cards.length>=4){mult+=2;effects.push('Drum of Endurance: +2 множителя');}
    if(id==='radiance'){power+=cards.length*5;effects.push(`Radiance: +${cards.length*5} силы`);}
    if(id==='octarine_core'){mult+=g.items.length;effects.push(`Octarine Core: +${g.items.length} множителя`);}
  }
  if(cards.some(h=>h.id==='phantom_assassin')&&combo>=1){mult*=Math.pow(1.5,times);effects.push(`Coup de Grace: ×${Math.pow(1.5,times)} множителя`);}
  if(g.items.includes('satanic')&&combo>=1){mult*=1.5;effects.push('Satanic: ×1.5 множителя');}
  let modifier=1;
  if(!g.items.includes('black_king_bar')){
    if(g.wave%4===1&&g.battles===0){modifier=.5;effects.push('Броня башни: итоговый урон ×0.5');}
    if(g.wave%4===2&&g.battles===2){modifier=0;effects.push('Глиф: третья атака не наносит урона!');}
  }
  if(g.items.includes('rapier')){modifier*=2;effects.push('Divine Rapier: итоговый урон ×2');}
  return {combo,power,mult,damage:Math.floor(power*mult*modifier),effects,modifier};
}
function refill(g:Game,removed:string[]) {let hand=g.hand.filter(id=>!removed.includes(id)), deck=[...g.deck], discarded=[...g.discarded,...removed], seed=g.seed;
  while(hand.length<8){if(!deck.length){const s=shuffle(discarded,seed);deck=s.cards;seed=s.seed;discarded=[];} if(!deck.length)break;hand.push(deck.shift()!);}
  return {...g,hand,deck,discarded,seed};
}
function deal(g:Game){const s=shuffle(HEROES.map(h=>h.id),g.seed);return {...g,hand:s.cards.slice(0,8),deck:s.cards.slice(8),discarded:[],seed:s.seed};}
function offers(g:Game){const s=shuffle(ITEMS.filter(i=>!g.items.includes(i.id)).map(i=>i.id),g.seed);return {...g,offer:s.cards.slice(0,4),seed:s.seed};}
export function attack(g:Game,selected:string[]):Game {
  if(g.phase!=='battle'||!selected.length||selected.length>5) return g;
  const r=evaluate(selected,g); let n=refill({...g,hp:Math.max(0,g.hp-r.damage),hands:g.hands-1,battles:g.battles+1,totalDamage:g.totalDamage+r.damage,best:Math.max(g.best,r.damage)},selected);
  n.plays=[...g.plays]; n.plays[r.combo]++; n.levels=[...g.levels];
  const messages=[`${COMBOS[r.combo].name} → ${r.damage} урона`];
  if(n.plays[r.combo]%3===0){n.levels[r.combo]++; messages.unshift(`${COMBOS[r.combo].name}: уровень ${n.levels[r.combo]}!`);}
  if(n.hp<=0&&g.wave%4===3&&!g.revived){n.hp=Math.round(maxHp(g.wave)*.5);n.revived=true;messages.unshift('Aegis! Рошан возродился с 50% здоровья.');}
  else if(n.hp<=0){const bonus=Math.min(20,Math.floor(Math.max(0,r.damage-g.hp)/25))*(g.items.includes('hand_of_midas')?2:1);const income=6+n.hands+bonus+(r.damage===g.hp?5:0);n.gold+=income;n.phase=g.wave===11?'won':'shop';n.reward=false;n=offers(n);messages.unshift(`Волна пройдена! +${income} золота${bonus?` · оверкилл +${bonus}`:''}`);}
  if(n.hp>0&&n.hands<=0){n.lives--;n.items=n.items.filter(i=>i!=='rapier');if(n.lives<=0){n.phase='lost';messages.unshift('Крепость пала. Новый забег — новый билд.');}else {n=deal({...n,hp:maxHp(g.wave),hands:4,discards:3,battles:0,revived:false});messages.unshift('Казарма потеряна. Перегруппировка — попробуй ещё!');}}
  n.log=[...messages,...g.log].slice(0,30);return n;
}
export function discard(g:Game,selected:string[]):Game {if(g.phase!=='battle'||!g.discards||!selected.length)return g;const bonus=selected.includes('crystal_maiden')?2:0;return refill({...g,discards:g.discards-1,gold:g.gold+bonus,log:[`ТП-сброс: ${selected.length} героев${bonus?' · Frostbite: +2 золота':''}`,...g.log].slice(0,30)},selected);}
export function buyItem(g:Game,id:string):Game {const item=ITEMS.find(i=>i.id===id);if(!item||g.phase!=='shop'||g.gold<item.price||g.items.length>=5||!g.offer.includes(id))return g;return {...g,gold:g.gold-item.price,items:[...g.items,id],offer:g.offer.filter(i=>i!==id),log:[`${item.name} добавлен в билд`,...g.log].slice(0,30)};}
export function reroll(g:Game):Game {return g.gold>=2&&g.phase==='shop'?offers({...g,gold:g.gold-2}):g;}
export function nextWave(g:Game):Game {if(g.phase!=='shop')return g;const wave=g.wave+1;return deal({...g,wave,hp:maxHp(wave),hands:4,discards:3,battles:0,revived:false,phase:'battle',log:[`Новая цель: ${waveName(wave)}`,...g.log].slice(0,30)});}
export function claimReward(g:Game,combo:number):Game {if(g.reward||g.phase!=='shop')return g;const levels=[...g.levels];levels[combo]++;return {...g,levels,reward:true,log:[`Боевой опыт: ${COMBOS[combo].name} → ур. ${levels[combo]}`,...g.log]};}
