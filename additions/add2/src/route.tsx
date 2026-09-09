import { ArrowRight, Castle, Coins, Crown, Ghost, Heart, Shield, Skull, Sparkles, Swords, Tent, UserMinus, Zap } from 'lucide-react';
import { MOD_INFO, maxHp, takeRoute, waveName } from './game';
import type { Game, RouteKind } from './game';

export default function RouteChoice({game, setGame, playTone}:{game:Game; setGame:(fn:(g:Game)=>Game)=>void; playTone:(k?:string)=>void;}){
  const next=game.wave+1;
  const mod=MOD_INFO[game.routeMod];
  function pick(kind:RouteKind){ playTone('buy'); setGame(g=>takeRoute(g,kind)); }
  return <section className="route-screen panel">
    <div className="route-banner">
      <span className="section-label gold"><Sparkles size={13}/> РАЗВИЛКА · ВОЛНА {next+1}</span>
      <h2>Три тропы. Один забег.</h2>
      <p>Обычная башня — проверенный план. Элитная — больше золота и трофей, но с проклятием. Крип-лагерь — передышка без боя.</p>
    </div>
    <div className="route-cards">
      <button className="route-card camp" onClick={()=>pick('camp')}>
        <span className="route-tag safe">БЕЗ БОЯ</span>
        <span className="route-icon"><Tent size={34} strokeWidth={1.4}/></span>
        <h3>Дальний крип-лагерь</h3>
        <p className="route-desc">Тихий фарм и привал. Пропускаешь бой — теряешь награду за победу.</p>
        <ul className="route-rewards">
          <li><Coins size={13}/>+6 золота</li>
          <li><Shield size={13}/>Привал: +1 казарма (до 6)</li>
          <li><UserMinus size={13}/>Бесплатное увольнение героя в лавке</li>
        </ul>
        <span className="route-cta">Зачистить лагерь <ArrowRight size={14}/></span>
      </button>

      <button className="route-card normal" onClick={()=>pick('normal')}>
        <span className="route-tag">ПРОВЕРЕННЫЙ ПЛАН</span>
        <span className="route-icon"><Castle size={34} strokeWidth={1.3}/></span>
        <h3>{waveName(next)}</h3>
        <p className="route-desc">{['Без модификаторов','Броня: первая атака ×0.5','Глиф: третья атака = 0',''][next%4]}</p>
        <ul className="route-rewards">
          <li><Heart size={13}/>{maxHp(next).toLocaleString('ru')} HP</li>
          <li><Coins size={13}/>Стандартная награда</li>
          <li><Zap size={13}/>Полный темп забега</li>
        </ul>
        <span className="route-cta">Атаковать <ArrowRight size={14}/></span>
      </button>

      <button className="route-card elite" onClick={()=>pick('elite')}>
        <span className="route-tag danger"><Skull size={11}/> ЭЛИТНАЯ БАШНЯ</span>
        <span className="route-icon"><Swords size={34} strokeWidth={1.4}/></span>
        <h3>{waveName(next)} <span className="route-hp-bonus">×1.5 HP</span></h3>
        <div className="route-mod"><Ghost size={14}/><div><strong>Проклятие: {mod.name}</strong><small>{mod.rule}</small></div></div>
        <ul className="route-rewards">
          <li><Coins size={13}/>Золото ×1.6 за победу</li>
          <li><Crown size={13}/>Трофей: +1 слот предмета{game.slots>=7?' (максимум)':` (${game.slots}→${game.slots+1})`}</li>
          <li><Sparkles size={13}/>Гарантированный легендарный в лавке</li>
        </ul>
        <span className="route-cta">Вызов принят <ArrowRight size={14}/></span>
      </button>
    </div>
    <p className="route-hint"><Shield size={13}/> Nullifier в билде снимает проклятия элитных башен. Проклятие раскрыто заранее — решай, готов ли твой билд.</p>
  </section>;
}
