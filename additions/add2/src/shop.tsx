import { ArrowRight, Check, Coins, Dumbbell, RotateCcw, ShoppingBag, Sparkles, Tent, UserMinus, UserPlus, X } from 'lucide-react';
import { COMBOS, ITEMS, allCards, buyItem, buyRecruit, claimReward, exileHero, heroById, itemImage, maxHp, nextWave, openRoutes, rankOf, recruitPrice, reroll, trainHero, waveName } from './game';
import type { Game } from './game';
import { Coin, FallbackImage, MiniHero } from './ui';

export type Picker = 'exile' | 'train' | null;

export default function Shop({game, setGame, toast, playTone, onDetail, picker, setPicker}:{
  game:Game; setGame:(fn:(g:Game)=>Game)=>void; toast:(m:string)=>void; playTone:(k?:string)=>void;
  onDetail:(id:string)=>void; picker:Picker; setPicker:(p:Picker)=>void;
}){
  const next=game.wave+1, nextIsBoss=next%4===3;
  const owned=allCards(game);
  const pickerCost=picker==='train'?5:(game.campBoon?0:4);
  function applyPicker(id:string){
    if(picker==='exile'){ setGame(g=>exileHero(g,id)); toast(`${heroById(id).name} покинул колоду. Вероятности перекроились.`); }
    if(picker==='train'){ setGame(g=>trainHero(g,id)); toast(`${heroById(id).name} натренирован: ранг ${rankOf(game,id)+1}`); }
    setPicker(null); playTone('buy');
  }
  return <section className="shop panel">
    <div className="shop-banner">
      <div className="shop-emblem"><ShoppingBag size={30}/></div>
      <div><span className="section-label gold">{game.campBoon?'КРИП-ЛАГЕРЬ ЗАЧИЩЕН':'ЛИНИЯ ЗАЧИЩЕНА'}</span><h2>Тайная лавка</h2><p>Хороший предмет усиливает руку. Отличный — меняет весь билд.</p></div>
      <span className="shop-gold"><Coin size={24}/>{game.gold}</span>
    </div>

    {game.campBoon&&!picker&&<div className="boon-banner"><Tent size={15}/><p><strong>Трофеи лагеря.</strong> Увольнение героя в этой лавке бесплатно — почисти колоду.</p></div>}

    <div className="shop-section-title"><h3>Предметы торговца</h3><button className="secondary-button" onClick={()=>setGame(reroll)} disabled={game.gold<2}><RotateCcw size={13}/>Обновить <span>2 <Coin size={12}/></span></button></div>
    <div className="shop-items">{game.offer.map(id=>{ const item=ITEMS.find(i=>i.id===id)!;
      return <div className={`shop-card ${item.rarity==='Легендарный'?'legendary':''}`} key={id}>
        <span className="rarity">{item.rarity}</span>
        <button className="shop-card-art" onClick={()=>onDetail(id)} aria-label={`Подробнее о ${item.name}`}><FallbackImage src={itemImage(id)} alt={item.name}/></button>
        <h3>{item.name}</h3><p>{item.desc}</p>
        <button className="buy-button" disabled={game.gold<item.price||game.items.length>=game.slots} onClick={()=>{ setGame(g=>buyItem(g,id)); playTone('buy'); }}>
          <span>{game.items.length>=game.slots?'Нет места':'Купить'}</span><span>{item.price} <Coin size={13}/></span>
        </button>
      </div>; })}
      {game.offer.length===0&&<div className="empty-shop">Всё раскуплено. Обнови товары или отправляйся в бой.</div>}
    </div>

    <div className="shop-section-title lab-title"><h3><UserPlus size={15}/> Лаборатория колоды</h3><span className="lab-caption">Колода: <b>{owned.length}</b> героев</span></div>
    <div className="lab-grid">
      <div className="lab-card recruits-card">
        <div className="lab-card-head"><span className="lab-icon"><UserPlus size={15}/></span><div><strong>Таверна</strong><small>Найми нового героя в колоду</small></div></div>
        <div className="recruit-row">{game.recruits.map(id=>{ const h=heroById(id), price=recruitPrice(id);
          return <div className="recruit-offer" key={id}>
            <MiniHero id={id} g={game} onClick={()=>toast(`${h.name} — ${h.ability}: ${h.description}`)} badge="NEW"/>
            <button className="buy-button recruit-buy" disabled={game.gold<price} onClick={()=>{ setGame(g=>buyRecruit(g,id)); playTone('buy'); toast(`${h.name} в команде! Он появится в следующих раздачах.`); }}><span>Нанять</span><span>{price} <Coin size={12}/></span></button>
          </div>; })}
          {game.recruits.length===0&&<div className="empty-shop">Таверна пуста — все герои уже с тобой.</div>}
        </div>
      </div>
      <div className="lab-card">
        <div className="lab-card-head"><span className="lab-icon"><UserMinus size={15}/></span><div><strong>Уволить героя</strong><small>Убери карту из колоды навсегда</small></div></div>
        <p className="lab-text">Тонкая колода = нужные комбо чаще. Особенно ценно перед элитными боями.</p>
        <button className="secondary-button full-width" disabled={!game.campBoon&&game.gold<4} onClick={()=>setPicker(picker==='exile'?null:'exile')}>
          {picker==='exile'?'Отмена':'Выбрать героя'} <span>{game.campBoon?<b className="mint">бесплатно</b>:<>4 <Coin size={12}/></>}</span>
        </button>
      </div>
      <div className="lab-card">
        <div className="lab-card-head"><span className="lab-icon"><Dumbbell size={15}/></span><div><strong>Тренировка</strong><small>+1 к рангу героя (максимум 12)</small></div></div>
        <p className="lab-text">Ранг — это и сила карты, и её комбо-потенциал. Доведи ключевого героя до 12.</p>
        <button className="secondary-button full-width" disabled={game.gold<5} onClick={()=>setPicker(picker==='train'?null:'train')}>
          {picker==='train'?'Отмена':'Выбрать героя'} <span>5 <Coin size={12}/></span>
        </button>
      </div>
    </div>

    {picker&&<div className="picker-panel">
      <div className="picker-head"><strong>{picker==='exile'?'Кого уволить из колоды?':'Кого отправить на тренировку?'}</strong><span>стоимость: {pickerCost===0?<b className="mint">бесплатно</b>:<>{pickerCost} G</>}</span><button className="icon-button small" onClick={()=>setPicker(null)} aria-label="Отмена"><X size={13}/></button></div>
      <div className="picker-row">{owned.map(id=><MiniHero key={id} id={id} g={game} onClick={()=>applyPicker(id)} badge={picker==='train'?`${rankOf(game,id)}→${Math.min(12,rankOf(game,id)+1)}`:undefined}/>)}</div>
    </div>}

    <div className="experience-reward">
      <div><Sparkles size={19}/><span><strong>{game.reward?'Боевой опыт получен':'Боевой опыт — выбери улучшение'}</strong><small>{game.reward?'Сила комбинации выросла. Время проверить её в бою.':'+10 базовой силы и +1 множителя выбранной комбинации'}</small></span></div>
      {!game.reward&&<div className="reward-options">{[1,3,5].map(c=><button key={c} onClick={()=>setGame(g=>claimReward(g,c))}>{COMBOS[c].name}<span>Ур. {game.levels[c]} <ArrowRight size={10}/> {game.levels[c]+1}</span></button>)}</div>}
      {game.reward&&<Check size={22} className="mint"/>}
    </div>

    <div className="shop-bottom">
      <div><span className="section-label">СЛЕДУЮЩАЯ ЦЕЛЬ</span>
        <strong>{waveName(next)} <span>· {maxHp(next)}–{Math.round(maxHp(next)*1.5)} HP</span></strong>
        <small>{nextIsBoss?'Босс акта: возрождается с половиной здоровья':'Развилка: обычная башня, элитная (HP ×1.5) или крип-лагерь'}</small>
      </div>
      {nextIsBoss
        ? <button className="primary-button" onClick={()=>{ if(!game.reward){ toast('Сначала забери бесплатное улучшение комбинации.'); return; } setGame(nextWave); }}>К Рошану <ArrowRight size={17}/></button>
        : <button className="primary-button" onClick={()=>{ if(!game.reward){ toast('Сначала забери бесплатное улучшение комбинации.'); return; } setGame(openRoutes); }}>Выбрать маршрут <ArrowRight size={17}/></button>}
    </div>
    <p className="shop-hint">Инвентарь заполнен? Нажми на свой предмет в панели билда, чтобы продать его за половину цены. <Coins size={11}/></p>
  </section>;
}
