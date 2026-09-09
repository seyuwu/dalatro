import { useEffect, useRef, useState } from 'react';
import { ArrowDownUp, ArrowRight, BookOpen, Check, ChevronRight, Coins, Crown, Ghost, Heart, History, Layers3, Leaf, Maximize2, Plus, RotateCcw, Settings2, Shield, ShoppingBag, Skull, Sparkles, Swords, Target, Volume2, VolumeX, X, Castle } from 'lucide-react';
import { COMBOS, ITEMS, MOD_INFO, attack, discard, evaluate, heroById, heroImage, initialGame, itemImage, loadGame, rankOf, waveName } from './game';
import type { Game, Item } from './game';
import { BrandMark, Coin, FallbackImage, HeroCard } from './ui';
import Modals from './modals';
import type { ModalKind } from './modals';
import Shop from './shop';
import type { Picker } from './shop';
import RouteChoice from './route';

const TIPS:[string,string][] = [
  ['Маленькая синергия. Большая разница.','Поставь Juggernaut первым — получишь +8 силы.'],
  ['Порядок — всё.','Morphling копирует атрибут героя слева. Поставь его после нужного соседа.'],
  ['Кэш — тоже урон.','Оверкилл и точный ластхит дают дополнительное золото для лавки.'],
  ['Развилка решает.','Элитная башня даёт +1 слот предмета, но её проклятие раскрыто заранее.'],
  ['Тонкая колода — сильная колода.','Уволив лишнего героя в лавке, ты чаще соберёшь нужное комбо.'],
  ['Иллюзии считаются.','Manta Style добавляет копию высшего ранга прямо в комбинацию.'],
  ['Контрпик боссов.','Nullifier снимает проклятия элитных башен и поздних Рошанов.'],
  ['Экономия казарм.','Bloodstone один раз за забег полностью поглощает поражение.'],
];

export default function App(){
  const [game,setGame]=useState<Game>(loadGame);
  const [selected,setSelected]=useState<string[]>(()=>game.phase==='battle'&&game.totalDamage===0&&['juggernaut','pudge','axe'].every(id=>game.hand.includes(id))?['juggernaut','pudge','axe']:[]);
  const [modal,setModal]=useState<ModalKind>(null);
  const [detail,setDetail]=useState<Item|null>(null);
  const [sort,setSort]=useState<'deal'|'rank'|'attr'>('deal');
  const [collectionTab,setCollectionTab]=useState('heroes');
  const [search,setSearch]=useState('');
  const [sound,setSound]=useState(()=>localStorage.getItem('dalatro-sound')==='on');
  const [motion,setMotion]=useState(()=>localStorage.getItem('dalatro-motion')!=='off');
  const [toast,setToast]=useState('');
  const [burst,setBurst]=useState<number|null>(null);
  const [saveOk,setSaveOk]=useState(true);
  const [picker,setPicker]=useState<Picker>(null);
  const soundContext=useRef<AudioContext|null>(null);
  const prevPhase=useRef(game.phase);
  const preview=evaluate(selected,game);
  const hand=[...game.hand].sort((a,b)=>sort==='rank'?rankOf(game,b)-rankOf(game,a):sort==='attr'?heroById(a).attr.localeCompare(heroById(b).attr):0);
  const isBattle=game.phase==='battle';
  useEffect(()=>{ try{ localStorage.setItem('dalatro-v3',JSON.stringify(game)); setSaveOk(true); }catch{ setSaveOk(false); } },[game]);
  useEffect(()=>{ localStorage.setItem('dalatro-sound',sound?'on':'off'); },[sound]);
  useEffect(()=>{ localStorage.setItem('dalatro-motion',motion?'on':'off'); },[motion]);
  useEffect(()=>{ if(toast){ const t=setTimeout(()=>setToast(''),3600); return ()=>clearTimeout(t); } },[toast]);
  useEffect(()=>{ if(burst!==null){ const t=setTimeout(()=>setBurst(null),1000); return ()=>clearTimeout(t); } },[burst]);
  useEffect(()=>{ if(prevPhase.current!==game.phase){ setSelected([]); setPicker(null); if(game.phase==='shop'&&prevPhase.current==='battle') playTone('win'); if(game.phase==='won') playTone('win'); prevPhase.current=game.phase; } },[game.phase]);
  function tone(freqA:number,freqB:number,dur:number,type:OscillatorType='triangle'){ const ctx=soundContext.current!; const osc=ctx.createOscillator(); const gain=ctx.createGain(); osc.connect(gain); gain.connect(ctx.destination); osc.type=type; osc.frequency.setValueAtTime(freqA,ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(freqB,ctx.currentTime+dur); gain.gain.setValueAtTime(.08,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+dur+.1); osc.start(); osc.stop(ctx.currentTime+dur+.1); }
  function playTone(kind='attack'){ if(!sound)return; try{ soundContext.current??=new AudioContext(); void soundContext.current.resume();
    if(kind==='buy'){ tone(440,660,.12,'sine'); }
    else if(kind==='win'){ tone(392,523,.16); setTimeout(()=>{ if(soundContext.current) tone(523,784,.2); },120); }
    else { tone(330,90,.2); }
  }catch{} }
  function toggle(id:string){ if(!isBattle)return; setSelected(s=>s.includes(id)?s.filter(i=>i!==id):s.length<5?[...s,id]:s); if(selected.length===5&&!selected.includes(id)) setToast('В тимфайте может быть не больше 5 героев'); }
  function doAttack(){ if(!selected.length||!isBattle||burst!==null)return; playTone('attack'); setBurst(preview.damage); setGame(g=>attack(g,selected)); setSelected([]); }
  function doDiscard(){ if(!selected.length||!game.discards||!isBattle)return; playTone('buy'); setGame(g=>discard(g,selected)); setSelected([]); setToast('Подкрепление прибыло. Собери новую комбинацию.'); }
  function reset(){ setGame(initialGame()); setSelected([]); setBurst(null); setModal(null); setToast('Новый забег начался. Удачи на линии!'); }
  useEffect(()=>{ function key(e:KeyboardEvent){ if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return; if(e.key==='Escape'){ setModal(null); setDetail(null); setSelected([]); setPicker(null); return; } if(modal||detail)return; if(/^[1-8]$/.test(e.key)){ e.preventDefault(); const id=hand[Number(e.key)-1]; if(id)toggle(id); } if(e.key==='Enter'){ e.preventDefault(); doAttack(); } if(e.key.toLowerCase()==='r'||e.key.toLowerCase()==='к'){ e.preventDefault(); doDiscard(); } }
    window.addEventListener('keydown',key); return ()=>window.removeEventListener('keydown',key); });
  function openCollection(tab='heroes'){ setCollectionTab(tab); setSearch(''); setModal('collection'); }
  const waveRule=['Без модификаторов','Броня: первая атака ×0.5','Глиф: третья атака = 0','Aegis: возрождение с 50% HP'][game.wave%4];
  const hpPercent=Math.max(0,game.hp/game.hpMax*100);
  const act=Math.floor(game.wave/4);
  const tip=TIPS[(game.wave+game.plays.reduce((a,b)=>a+b,0))%TIPS.length];
  const modInfo=MOD_INFO[game.mod];
  return <div className={`app ${!motion?'reduced-motion':''}`}>
    <header className="topbar"><a className="brand" href="#" onClick={e=>{ e.preventDefault(); setModal(null); }} aria-label="Dalatro — игра"><BrandMark/><span>DALATRO<span className="brand-dot">.</span></span></a><div className="brand-divider"/><span className="brand-caption">DOTA В КАРТАХ.<br/>ВЕЗЕНИЕ — В ТВОИХ РУКАХ.</span>
      <nav className="main-nav"><button className={!modal?'active':''} onClick={()=>{ setModal(null); setDetail(null); }}><Swords size={16}/>Играть</button><button className={modal==='collection'?'active':''} onClick={()=>openCollection()}><Layers3 size={16}/>Коллекция</button><button className={modal==='help'?'active':''} onClick={()=>setModal('help')}><BookOpen size={16}/>Как играть</button></nav>
      <div className="header-right"><span className="version">BETA <span>0.3</span></span><button className="icon-button" title={sound?'Выключить звук':'Включить звук'} onClick={()=>setSound(!sound)}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button><button className="icon-button" title="Настройки" onClick={()=>setModal('settings')}><Settings2 size={18}/></button></div>
    </header>
    <main className="page-shell">
      <section className="run-bar"><div className="run-heading"><span className="live-dot"/><h1>Твой забег</h1><span className="run-id">#DL–0743</span><span className="run-divider"/><span className="act-pill"><Leaf size={12}/> АКТ {act+1}</span><span className="act-name">{['На линии','Вражеская территория','Последний рубеж'][act]}</span></div><div className="run-tools"><span className="autosave"><Check size={12}/>{saveOk?'Прогресс сохранён':'Сохранение недоступно'}</span><button className="subtle-button" onClick={()=>setModal('new')}><RotateCcw size={13}/>Новый забег</button></div></section>
      <div className="game-layout">
        <aside className="sidebar">
          <section className="encounter-panel panel"><div className="section-label"><span>ТЕКУЩАЯ ЦЕЛЬ</span><span className="wave-badge">{game.wave%4+1} / 4</span></div>
            <div className={`tower-emblem ${game.wave%4===3?'boss':''} ${game.elite?'elite':''}`}>{game.elite?<Swords size={37} strokeWidth={1.3}/>:game.wave%4===3?<Skull size={37} strokeWidth={1.4}/>:<Castle size={37} strokeWidth={1.3}/>}<span className="emblem-ring"/></div>
            <span className="enemy-faction">{game.elite?'ЭЛИТНАЯ БАШНЯ':game.wave%4===3?'БОСС АКТА':'ПОСТРОЙКА СВЕТА'}</span>
            <h2>{waveName(game.wave)}</h2>
            <div className="target-health"><Heart size={13}/><strong>{game.hp.toLocaleString('ru')}</strong><span>/ {game.hpMax.toLocaleString('ru')}</span></div>
            <div className="health-track"><div className={game.elite?'elite-hp':''} style={{width:`${hpPercent}%`}}/></div>
            <div className="wave-rule"><Shield size={13}/><span>{waveRule}</span></div>
            {game.mod!=='none'&&<div className="mod-chip" title={modInfo.rule}><Ghost size={12}/><span><b>{modInfo.name}</b> · {modInfo.short}</span></div>}
            <div className="reward-row"><span>Награда за победу</span><b><Coin/>6+{game.elite&&<em className="gold"> ×1.6</em>}</b></div>
          </section>
          <section className="resource-panel panel"><div className="resource-stat"><span><Swords size={13}/>Тимфайты</span><strong className="mint">{game.hands}<small> / 4</small></strong><div className="resource-pips">{[0,1,2,3].map(i=><i key={i} className={i<game.hands?'filled mint-bg':''}/>)}</div></div><div className="resource-stat"><span><RotateCcw size={13}/>ТП-сбросы</span><strong className="blue">{game.discards}<small> / 3</small></strong><div className="resource-pips">{[0,1,2].map(i=><i key={i} className={i<game.discards?'filled blue-bg':''}/>)}</div></div></section>
          <section className="economy-panel panel"><div><span><Coins size={15}/>Твоё золото</span><strong className="gold">{game.gold}<small> G</small></strong></div><div><span><Castle size={15}/>Казармы</span><div className="lives">{[0,1,2,3,4,5].map(i=><span key={i} className={i<game.lives?'alive':''}><Shield size={13} fill={i<game.lives?'currentColor':'none'}/></span>)}</div></div></section>
          <section className="journal-panel panel"><div className="section-label"><span><History size={13}/>ЖУРНАЛ БОЯ</span><button className="icon-button small" title="Весь журнал" onClick={()=>setModal('history')}><Maximize2 size={12}/></button></div><div className="journal-entries">{game.log.slice(0,3).map((entry,i)=><div key={`${entry}-${i}`} className={i===0?'latest':''}><span className="log-dot"/><p>{entry}</p></div>)}</div><button className="text-button" onClick={()=>setModal('history')}>Вся история <ArrowRight size={12}/></button></section>
          <button className="combo-guide" onClick={()=>setModal('help')}><div className="guide-icon"><BookOpen size={18}/></div><span><strong>Знание — сила</strong><small>Справочник комбинаций</small></span><ChevronRight size={15}/></button>
        </aside>
        <div className="play-area">
          <section className="inventory-panel panel"><div className="inventory-heading"><div className="section-label"><span><ShoppingBag size={14}/>ТВОЙ БИЛД</span><span className="slot-count">{game.items.length} <span>/ {game.slots}</span></span></div><span className="inventory-help">Предметы меняют правила игры <Sparkles size={11}/></span></div>
            <div className="inventory-slots">{Array.from({length:game.slots},(_,i)=>{ const item=ITEMS.find(x=>x.id===game.items[i]); return item?<button key={i} className={`item-slot ${item.rarity==='Легендарный'?'legendary':''}`} onClick={()=>setDetail(item)}><div className="item-art"><FallbackImage src={itemImage(item.id)} alt={item.name}/></div><span><strong>{item.name}</strong><small>{item.short}</small></span><span className="item-slot-dot"/></button>:<button key={i} className="item-slot empty-slot" onClick={()=>setToast('Новые предметы появятся в лавке после победы над башней.')}><Plus size={18}/><span>Слот предмета</span></button>; })}</div>
          </section>
          {isBattle ? <>
            <section className={`battlefield ${burst!==null&&motion?'attacking':''}`}><div className="battlefield-shade"/><div className="battlefield-content"><div className="battlefield-eyebrow"><span className="live-dot"/>БОЕВОЕ ПОЛЕ <span> / </span> ВОЛНА {game.wave+1}</div><h2>{game.elite?'Сломай элитную оборону.':'Сломай их оборону.'}</h2><p>Не просто герои. Твоя победная комбинация.</p>
              <div className="formation"><div className="formation-cards">{Array.from({length:5},(_,i)=><div key={i} className={`formation-slot ${selected[i]?'occupied':''}`}>{selected[i]?<><FallbackImage src={heroImage(selected[i])} alt={heroById(selected[i]).name}/><span>{i+1}</span></>:<><Plus size={14}/><span>{i+1}</span></>}</div>)}</div><span className="formation-note">Порядок выбора —<br/>порядок в бою</span></div></div>
              <div className="arena-label"><span className="radial-dot"/><span>ТЕРРИТОРИЯ СВЕТА</span></div><div className="enemy-mark"><Target size={17}/></div>
              {game.mod!=='none'&&<div className="curse-mark" title={modInfo.rule}><Ghost size={14}/><span>{modInfo.name}</span></div>}
              {burst!==null&&<div className="damage-burst">−{burst}<small>УРОНА</small></div>}
            </section>
            <section className="hand-section"><div className="hand-heading"><div><h2>Твоя рука <span>{game.hand.length}<small> / 8</small></span></h2><span className="hand-instruction">Выбери до 5 героев для тимфайта</span></div>
              <div className="hand-tools"><span>Сортировка</span><button className={sort==='rank'?'sort-button active':'sort-button'} onClick={()=>setSort(sort==='rank'?'deal':'rank')}><ArrowDownUp size={12}/>Сила</button><button className={sort==='attr'?'sort-button active':'sort-button'} onClick={()=>setSort(sort==='attr'?'deal':'attr')}>Атрибут</button><button className="deck-button" onClick={()=>openCollection('deck')} title="Посмотреть колоду"><Layers3 size={17}/><span>{game.deck.length}</span></button></div></div>
              <div className="hero-hand">{hand.map((id,i)=><HeroCard key={id} hero={heroById(id)} rankOverride={rankOf(game,id)!==heroById(id).rank?rankOf(game,id):undefined} selected={selected.includes(id)} order={selected.indexOf(id)+1} index={i} onClick={()=>toggle(id)}/>)}</div>
              <div className="under-hand"><span><span className="selection-dot"/>Выбрано <strong>{selected.length} / 5</strong>{selected.length>0&&<button onClick={()=>setSelected([])}>Снять выбор</button>}</span><span><kbd>1</kbd>–<kbd>8</kbd> выбрать героя <span className="keyboard-divider">·</span> наведи, чтобы узнать способность</span></div>
            </section>
            <section className="play-controls panel"><button className="combo-preview" onClick={()=>selected.length?setModal('score'):setModal('help')}><span className="section-label">{selected.length?'ТВОЯ КОМБИНАЦИЯ':'ТВОЙ СЛЕДУЮЩИЙ ХОД'}</span><strong>{selected.length?COMBOS[preview.combo].name:'Собери тимфайт'} <ChevronRight size={14}/></strong><small>{selected.length?<>{COMBOS[preview.combo].poker}<span className="level-badge">Ур. {game.levels[preview.combo]}</span></>:'Сила героев × множитель'}</small></button>
              <div className="score-formula"><div className="score-block power"><strong>{preview.power}</strong><span>СИЛА</span></div><X size={14}/><div className="score-block multiplier"><strong>{Number(preview.mult.toFixed(2))}</strong><span>МНОЖ.</span></div><span className="equals">=</span><div className="total-score"><strong>{preview.damage.toLocaleString('ru')}</strong><span>УРОНА {preview.modifier!==1&&selected.length>0&&<Shield size={10}/>}</span></div></div>
              <div className="action-buttons"><button className="primary-button attack-button" disabled={!selected.length||burst!==null} onClick={doAttack}><Swords size={17}/>В бой<kbd>↵</kbd></button><button className="discard-button" disabled={!selected.length||!game.discards} onClick={doDiscard}><RotateCcw size={14}/>ТП-сброс<kbd>R</kbd></button></div>
            </section>
            <div className="strategy-tip"><Sparkles size={14}/><p><strong>{tip[0]}</strong> {tip[1]}</p><button onClick={()=>setModal('help')}>Больше советов <ArrowRight size={12}/></button></div>
          </> : game.phase==='shop' ? <Shop game={game} setGame={setGame} toast={setToast} playTone={playTone} onDetail={id=>setDetail(ITEMS.find(i=>i.id===id)!)} picker={picker} setPicker={setPicker}/>
          : game.phase==='route' ? <RouteChoice game={game} setGame={setGame} playTone={playTone}/>
          : <section className="end-screen panel"><div className="end-emblem">{game.phase==='won'?<Crown size={64}/>:<Skull size={64}/>}</div>
            <span className="section-label">{game.phase==='won'?'ДРЕВНИЙ ПАЛ':'КРЕПОСТЬ РАЗРУШЕНА'}</span>
            <h2>{game.phase==='won'?'Это был легендарный забег.':'Каждый конец — новая раздача.'}</h2>
            <p>{game.phase==='won'?'12 волн. Три акта. Один невероятный билд.':'Попробуй другой билд. Улучшай комбинации, нанимай героев и выбирай маршрут под силу руки.'}</p>
            <div className="end-stats"><div><strong>{game.wave+1}</strong><span>Волн</span></div><div><strong>{game.totalDamage.toLocaleString('ru')}</strong><span>Всего урона</span></div><div><strong>{game.best.toLocaleString('ru')}</strong><span>Лучший тимфайт</span></div><div><strong>{game.elites}</strong><span>Элитных побед</span></div></div>
            <button className="primary-button" onClick={reset}><RotateCcw size={16}/>Ещё один забег</button>
          </section>}
        </div>
      </div>
      <footer className="footer"><div className="act-progress">{[0,1,2,3].map((v)=><span key={v} className={v===game.wave%4?'current':v<game.wave%4?'complete':''}>{v===3?<Skull size={12}/>:v<game.wave%4?<Check size={11}/>:<Castle size={12}/>}<span>{['T1','T2','T3','ROSHAN'][v]}</span>{v<3&&<i/>}</span>)}</div><span className="footer-tagline">Немного Dota. Немного покера. Ещё один забег.</span><a href="https://github.com/seyuwu/dalatro" target="_blank" rel="noreferrer">DALATRO <span>v0.3</span><ArrowRight size={11}/></a></footer>
    </main>
    <div className="sr-only" role="status" aria-live="polite">{game.log[0]}</div>
    {toast&&<div className="toast" role="status"><Sparkles size={16}/>{toast}<button onClick={()=>setToast('')} aria-label="Закрыть уведомление"><X size={13}/></button></div>}
    <Modals modal={modal} setModal={setModal} detail={detail} setDetail={setDetail} game={game} setGame={setGame} preview={preview} sound={sound} setSound={setSound} motion={motion} setMotion={setMotion} collectionTab={collectionTab} setCollectionTab={setCollectionTab} search={search} setSearch={setSearch} reset={reset} toast={setToast}/>
  </div>;
}
