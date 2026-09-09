import { Check, Coins, Zap } from 'lucide-react';
import { ATTRS, heroImage, heroById, rankOf } from './game';
import type { Game, Hero } from './game';

export function BrandMark(){ return <svg viewBox="0 0 36 36" fill="none" aria-hidden="true"><path d="M4 5L30 3L33 30L6 33Z" stroke="currentColor" strokeWidth="3"/><path d="M10 10L26 26M22 9L27 14M10 23L14 28" stroke="currentColor" strokeWidth="4"/></svg>; }
export function Coin({size=15}:{size?:number}){ return <Coins size={size} className="coin-icon"/>; }
export function FallbackImage({src,alt,className=''}:{src:string;alt:string;className?:string}){
  return <img className={className} src={src} alt={alt} draggable={false} onError={e=>{ e.currentTarget.style.visibility='hidden'; }}/>;
}
export function HeroCard({hero,selected,order,onClick,index,compact=false,rankOverride}:{hero:Hero;selected:boolean;order:number;onClick:()=>void;index:number;compact?:boolean;rankOverride?:number}){
  const rank=rankOverride??hero.rank;
  return <button className={`hero-card ${hero.attr} ${selected?'selected':''} ${compact?'compact':''}`} onClick={onClick} aria-pressed={selected} aria-label={`${hero.name}, ранг ${rank}, ${ATTRS[hero.attr].name}. ${hero.description}`}>
    {selected&&<span className="selection-order">{order}<Check size={10}/></span>}
    <div className="hero-art"><FallbackImage src={heroImage(hero.id)} alt={hero.name}/><div className="hero-vignette"/><span className="hero-rank">{rank}</span><span className="attribute-icon">{ATTRS[hero.attr].symbol}</span><span className="hero-name">{hero.name}</span></div>
    <div className="hero-card-bottom"><span className="hero-attribute">{ATTRS[hero.attr].symbol} {ATTRS[hero.attr].name}</span><span className="hero-ability">{hero.ability}</span><div className="card-foot"><span>{rank} <Zap size={10}/></span><kbd>{index+1}</kbd></div></div>
    <div className="hero-tooltip"><strong>{hero.ability}</strong><p>{hero.description}</p></div>
  </button>;
}
export function MiniHero({id,g,onClick,badge}:{id:string;g:Game;onClick?:()=>void;badge?:string}){
  const h=heroById(id);
  return <button className={`mini-hero ${h.attr}`} onClick={onClick} disabled={!onClick} title={`${h.name} — ${h.ability}: ${h.description}`}>
    <span className="mini-hero-art"><FallbackImage src={heroImage(id)} alt={h.name}/><b>{rankOf(g,id)}</b>{badge&&<em>{badge}</em>}</span>
    <span className="mini-hero-name">{h.name}</span>
  </button>;
}
