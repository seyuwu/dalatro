import { useState, type ReactNode } from 'react';
import { ATTRS, heroById, heroImage, itemById, itemImage, RARITY_STYLE } from '../game/data';
import { cn } from '../utils/cn';

const SIZES = {
  xs: 'w-12 h-16',
  sm: 'w-20 h-28',
  md: 'w-24 h-36',
};

export function HeroPortrait({ id, className }: { id: string; className?: string }) {
  const [err, setErr] = useState(false);
  const hero = heroById(id);
  if (err) {
    return (
      <div className={cn('flex items-center justify-center bg-gradient-to-br from-indigo-900 to-slate-950', className)}>
        <span className="font-display text-lg text-slate-300">{hero.name.slice(0, 2).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <img
      src={heroImage(id)}
      alt={hero.name}
      loading="lazy"
      onError={() => setErr(true)}
      className={cn('object-cover object-top', className)}
      draggable={false}
    />
  );
}

export function HeroCard({
  id,
  selected,
  order,
  onClick,
  size = 'md',
  disabled,
  hotkey,
  dimmed,
}: {
  id: string;
  selected?: boolean;
  order?: number;
  onClick?: () => void;
  size?: keyof typeof SIZES;
  disabled?: boolean;
  hotkey?: number;
  dimmed?: boolean;
}) {
  const hero = heroById(id);
  const attr = ATTRS[hero.attr];
  return (
    <div className="group relative flex flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'hero-card relative overflow-hidden rounded-xl border-2 card-frame',
          SIZES[size],
          selected ? 'selected border-amber-300' : 'border-slate-600/60 hover:border-slate-300/80',
          disabled && 'cursor-not-allowed opacity-40 hover:!translate-y-0',
          dimmed && 'saturate-[0.35]',
        )}
        style={selected ? { boxShadow: `0 0 26px ${attr.glow}, 0 0 10px rgba(245,197,80,.5)` } : undefined}
      >
        <HeroPortrait id={id} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/10 to-transparent" />
        <div
          className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-md font-display text-sm text-white shadow-lg"
          style={{ background: 'rgba(8,11,26,.82)', border: `1px solid ${attr.color}`, color: attr.color }}
        >
          {hero.rank}
        </div>
        {typeof hotkey === 'number' && (
          <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-slate-950/80 text-[10px] font-bold text-slate-300">
            {hotkey < 9 ? hotkey + 1 : '·'}
          </div>
        )}
        <div
          className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-xs"
          style={{ color: attr.color, background: 'rgba(8,11,26,.85)', boxShadow: `0 0 8px ${attr.glow}` }}
        >
          {attr.symbol}
        </div>
        {size !== 'xs' && (
          <div className="absolute inset-x-0 bottom-0 px-1 pb-1 text-center">
            <span className="text-[9px] font-bold leading-tight text-slate-200 drop-shadow line-clamp-2">{hero.name}</span>
          </div>
        )}
        {selected && typeof order === 'number' && (
          <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-amber-200 bg-amber-400 font-display text-sm text-slate-900 shadow-lg animate-pop">
            {order + 1}
          </div>
        )}
      </button>
      <div className="pointer-events-none absolute bottom-full z-50 mb-2 hidden w-56 rounded-xl border border-indigo-400/30 bg-slate-950/95 p-3 text-left shadow-2xl group-hover:block">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm" style={{ color: attr.color }}>
            {attr.symbol}
          </span>
          <span className="font-display text-sm text-white">{hero.name}</span>
          <span className="ml-auto rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">ранг {hero.rank}</span>
        </div>
        <div className="mt-1 text-[11px] font-semibold text-amber-300">{hero.ability}</div>
        <div className="mt-1 text-[11px] leading-snug text-slate-300">{hero.description}</div>
      </div>
    </div>
  );
}

export function ItemIcon({ id, className }: { id: string; className?: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className={cn('flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-900 to-slate-950 text-lg', className)}>
        ✦
      </div>
    );
  }
  return <img src={itemImage(id)} alt="" loading="lazy" onError={() => setErr(true)} className={cn('object-contain', className)} draggable={false} />;
}

export function ItemChip({ id, onClick, empty, sellPrice }: { id?: string; onClick?: () => void; empty?: boolean; sellPrice?: number }) {
  if (empty || !id) {
    return (
      <div className="flex h-16 w-16 items-center justify-center rounded-xl border-2 border-dashed border-slate-600/50 bg-slate-900/40 text-2xl text-slate-700">
        +
      </div>
    );
  }
  const item = itemById(id);
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.name} — ${item.desc}${sellPrice ? ` (продажа за ${sellPrice})` : ''}`}
      className={cn('group relative h-16 w-16 rounded-xl border-2 bg-slate-900/70 p-1 transition hover:scale-105', RARITY_STYLE[item.rarity].ring)}
    >
      <ItemIcon id={id} className="h-full w-full" />
      {sellPrice !== undefined && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-amber-500 px-1 text-[9px] font-bold text-slate-950 opacity-0 transition group-hover:opacity-100">
          продать {sellPrice}
        </div>
      )}
    </button>
  );
}

export function Badge({ children, tone = 'slate', className }: { children: ReactNode; tone?: 'slate' | 'red' | 'sky' | 'amber' | 'green' | 'violet'; className?: string }) {
  const tones: Record<string, string> = {
    slate: 'bg-slate-700/50 text-slate-200 border-slate-500/40',
    red: 'bg-red-900/50 text-red-200 border-red-500/50',
    sky: 'bg-sky-900/50 text-sky-200 border-sky-400/50',
    amber: 'bg-amber-900/40 text-amber-200 border-amber-400/50',
    green: 'bg-emerald-900/40 text-emerald-200 border-emerald-400/50',
    violet: 'bg-violet-900/50 text-violet-200 border-violet-400/50',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', tones[tone], className)}>{children}</span>;
}
