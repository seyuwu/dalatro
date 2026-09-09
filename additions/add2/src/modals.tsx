import { BookOpen, Check, CircleHelp, Crown, History, Layers3, RotateCcw, ArrowRight, Settings2, Sparkles, Tent, X, Zap } from 'lucide-react';
import { ATTRS, COMBOS, HEROES, ITEMS, allCards, heroImage, itemImage, rankOf, sellItem } from './game';
import type { Game, Item } from './game';
import { Coin, FallbackImage } from './ui';

export type ModalKind = 'help'|'collection'|'settings'|'history'|'new'|'score'|null;
export type Preview = { combo:number; power:number; mult:number; damage:number; effects:string[]; modifier:number };

export default function Modals({modal, setModal, detail, setDetail, game, setGame, preview, sound, setSound, motion, setMotion, collectionTab, setCollectionTab, search, setSearch, reset, toast}:{
  modal:ModalKind; setModal:(m:ModalKind)=>void; detail:Item|null; setDetail:(i:Item|null)=>void;
  game:Game; setGame:(fn:(g:Game)=>Game)=>void; preview:Preview;
  sound:boolean; setSound:(b:boolean)=>void; motion:boolean; setMotion:(b:boolean)=>void;
  collectionTab:string; setCollectionTab:(t:string)=>void; search:string; setSearch:(s:string)=>void;
  reset:()=>void; toast:(m:string)=>void;
}){
  if(!modal&&!detail) return null;
  const owned=allCards(game);
  return <div className="modal-backdrop" onClick={()=>{ setModal(null); setDetail(null); }}>
    <section className={`modal ${modal==='collection'||modal==='help'?'wide-modal':''}`} role="dialog" aria-modal="true" aria-label={detail?.name||'Меню Dalatro'} onClick={e=>e.stopPropagation()}>
      <button className="modal-close icon-button" aria-label="Закрыть" onClick={()=>{ setModal(null); setDetail(null); }}><X size={20}/></button>

      {detail?<><div className="item-detail-image"><FallbackImage src={itemImage(detail.id)} alt={detail.name}/></div>
        <span className="section-label gold">{detail.rarity} предмет</span>
        <h2>{detail.name}</h2>
        <p className="modal-description">{detail.desc}</p>
        <div className="detail-tip"><Sparkles size={18}/><p>Предмет действует на каждый тимфайт. Его вклад отображается в подробном расчёте урона.</p></div>
        {game.phase==='shop'&&game.items.includes(detail.id)
          ? <button className="secondary-button full-width" onClick={()=>{ setGame(g=>sellItem(g,detail.id)); setDetail(null); toast(`Предмет продан за ${Math.floor(detail.price/2)} золота`); }}>Продать за {Math.floor(detail.price/2)} <Coin/></button>
          : <div className="muted-note">Продажа доступна в лавке между волнами.</div>}
      </>:null}

      {!detail&&modal==='help'&&<><span className="section-label mint"><BookOpen size={15}/>СПРАВОЧНИК</span>
        <h2>Покерные правила. Дотовские привычки.</h2>
        <p className="modal-description">Собери до 5 героев. Сила комбинации и героев умножается на множитель — это урон по башне. Снеси её за 4 тимфайта.</p>
        <div className="help-steps">
          <div><span>01</span><strong>Собери руку</strong><p>Кликни по героям. Ранг — число на карте, атрибут — её цвет. Порядок кликов задаёт позиции.</p></div>
          <div><span>02</span><strong>Найди синергию</strong><p>Zeus даёт +2 множителя. Morphling копирует атрибут слева. Juggernaut любит первую позицию.</p></div>
          <div><span>03</span><strong>Развивай билд</strong><p>Побеждай, покупай предметы и улучшай комбинации. Каждые 3 розыгрыша комбо получает уровень.</p></div>
          <div><span>04</span><strong>Выбирай маршрут</strong><p>После лавки — развилка: элитная башня с проклятием и трофеями или тихий крип-лагерь для передышки.</p></div>
        </div>
        <div className="combo-table"><div className="table-head"><span>КОМБИНАЦИЯ</span><span>УСЛОВИЕ</span><span>СИЛА × МНОЖ.</span></div>{COMBOS.map((c,i)=><div key={c.name}><span><strong>{c.name}</strong><small>{c.poker} · ур. {game.levels[i]}</small></span><span>{c.rule}</span><span><b className="mint">{c.base+(game.levels[i]-1)*10}</b><X size={10}/><b className="gold">{c.mult+game.levels[i]-1}</b></span></div>)}</div>
        <div className="help-note"><CircleHelp size={17}/><p><strong>Лаборатория колоды.</strong> В лавке можно нанять героя из таверны, уволить лишнего или натренировать ранг. Тонкая колода — стабильные комбо. Shadow Blade и Manta Style меняют само определение комбинаций, а Nullifier снимает проклятия элитных башен.</p></div>
      </>}

      {!detail&&modal==='collection'&&<><span className="section-label mint"><Layers3 size={15}/>КОЛЛЕКЦИЯ</span>
        <h2>{collectionTab==='deck'?'Твоя колода':'Всё для идеального тимфайта'}</h2>
        <div className="collection-toolbar"><div className="tabs">{[['heroes','Герои'],['items','Предметы'],['deck','Колода']].map(([key,label])=><button className={collectionTab===key?'active':''} key={key} onClick={()=>{ setCollectionTab(key); setSearch(''); }}>{label}<span>{key==='items'?ITEMS.length:key==='deck'?owned.length:HEROES.length}</span></button>)}</div>
          <input aria-label="Поиск в коллекции" placeholder="Найти по имени..." value={search} onChange={e=>setSearch(e.target.value)}/></div>
        {collectionTab==='deck'&&<div className="deck-summary"><span>В руке <b>{game.hand.length}</b></span><span>В колоде <b>{game.deck.length}</b></span><span>В сбросе <b>{game.discarded.length}</b></span></div>}
        <div className="collection-grid">{collectionTab==='items'
          ? ITEMS.filter(i=>(i.name+' '+i.desc).toLowerCase().includes(search.toLowerCase())).map(item=><button className="collection-item" key={item.id} onClick={()=>setDetail(item)}><FallbackImage src={itemImage(item.id)} alt={item.name}/><div><strong>{item.name}</strong><p>{item.desc}</p><small className="gold">{item.price} G · {item.rarity}</small></div>{game.items.includes(item.id)&&<Check size={15} className="mint"/>}</button>)
          : (collectionTab==='deck'?HEROES.filter(h=>owned.includes(h.id)):HEROES).filter(h=>h.name.toLowerCase().includes(search.toLowerCase())).map(h=><div className={`collection-hero ${h.attr}`} key={h.id}><div className="collection-portrait"><FallbackImage src={heroImage(h.id)} alt={h.name}/><b>{rankOf(game,h.id)}</b></div><div><strong>{h.name}</strong><span className="hero-attribute">{ATTRS[h.attr].symbol} {ATTRS[h.attr].name}</span><p>{h.description}</p>{collectionTab==='deck'?<small>{game.hand.includes(h.id)?'● В руке':game.deck.includes(h.id)?'◈ В колоде':'↺ В сбросе'}</small>:h.tavern&&!owned.includes(h.id)?<small className="tavern-tag"><Tent size={11}/> В таверне</small>:<small><Check size={11}/> В команде</small>}</div></div>)}</div>
        {search&&!(collectionTab==='items'?ITEMS:HEROES).some(x=>(x.name+('desc'in x?' '+x.desc:'')).toLowerCase().includes(search.toLowerCase()))&&<div className="empty-search">Ничего не найдено. Попробуй другое имя.</div>}
      </>}

      {!detail&&modal==='settings'&&<><span className="section-label mint"><Settings2 size={15}/>НАСТРОЙКИ</span>
        <h2>Твой комфортный темп.</h2>
        <div className="setting-row"><div><strong>Звуки боя</strong><p>Короткие эффекты атаки, покупок и побед</p></div><button className={`toggle ${sound?'on':''}`} role="switch" aria-checked={sound} aria-label="Звуки боя" onClick={()=>setSound(!sound)}><span/></button></div>
        <div className="setting-row"><div><strong>Анимации</strong><p>Удары, подъём карт и эффекты урона</p></div><button className={`toggle ${motion?'on':''}`} role="switch" aria-checked={motion} aria-label="Анимации" onClick={()=>setMotion(!motion)}><span/></button></div>
        <div className="settings-shortcuts"><h3>Горячие клавиши</h3><p><span>Выбрать героя</span><kbd>1 – 8</kbd></p><p><span>Начать тимфайт</span><kbd>Enter</kbd></p><p><span>ТП-сброс</span><kbd>R</kbd></p><p><span>Закрыть / снять выбор</span><kbd>Esc</kbd></p></div>
        <div className="muted-note"><Check size={13}/> Забег автоматически сохраняется в этом браузере.</div>
      </>}

      {!detail&&modal==='history'&&<><span className="section-label mint"><History size={15}/>ЖУРНАЛ БОЯ</span>
        <h2>История твоего забега</h2>
        <div className="history-summary"><span>Всего урона <strong>{game.totalDamage.toLocaleString('ru')}</strong></span><span>Лучший удар <strong>{game.best.toLocaleString('ru')}</strong></span><span>Элитных побед <strong>{game.elites}</strong></span></div>
        <div className="full-history">{game.log.map((line,i)=><div key={i}><span>{String(game.log.length-i).padStart(2,'0')}</span><p>{line}</p></div>)}</div>
      </>}

      {!detail&&modal==='new'&&<><div className="reset-icon"><RotateCcw size={28}/></div>
        <h2>Ещё один забег?</h2>
        <p className="modal-description">Текущий прогресс будет сброшен. Начнёшь с первой линии, 12 золота и стартового набора предметов.</p>
        <div className="modal-actions"><button className="secondary-button" onClick={()=>setModal(null)}>Продолжить текущий</button><button className="primary-button" onClick={reset}>Начать заново <ArrowRight size={15}/></button></div>
      </>}

      {!detail&&modal==='score'&&<><span className="section-label mint"><Zap size={15}/>РАСЧЁТ ТИМФАЙТА</span>
        <h2>{COMBOS[preview.combo].name}</h2>
        <p className="modal-description">Порядок срабатываний: комбинация → способности героев → предметы → проклятия и защита башни.</p>
        <div className="score-breakdown">{preview.effects.map((effect,i)=><div key={i}><span>{i+1}</span><p>{effect}</p><Check size={13}/></div>)}</div>
        <div className="breakdown-total"><span>{preview.power} силы × {Number(preview.mult.toFixed(2))}{preview.modifier!==1?` × ${preview.modifier}`:''}</span><strong>{preview.damage} <small>урона</small></strong></div>
        {preview.damage>500&&<div className="muted-note"><Crown size={13}/> Это будет легендарный удар.</div>}
      </>}
    </section>
  </div>;
}
