import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Swords,
  Shield,
  Skull,
  Coins,
  RefreshCw,
  Volume2,
  VolumeX,
  Sparkles,
  RotateCcw,
  BookOpen,
  Library,
  X,
  ArrowRight,
  Map as MapIcon,
  Castle,
  Gem,
  UserMinus,
  Flame,
  Trophy,
  Ghost,
  SortAsc,
  Backpack,
  Zap,
  Lock,
} from 'lucide-react';
import {
  HEROES,
  ITEMS,
  COMBOS,
  DECKS,
  ATTRS,
  heroById,
  itemById,
  modifierById,
  RARITY_STYLE,
  type DeckId,
} from './game/data';
import {
  attack,
  discard,
  buyItem,
  sellItem,
  reroll,
  recruit,
  removeHero,
  claimReward,
  evaluate,
  loadGame,
  saveGame,
  newGame,
  menuGame,
  takePath,
  pathsForNextWave,
  waveMaxHp,
  waveName,
  waveModTexts,
  maxHp,
  isBossWave,
  maxSelection,
  baseDiscards,
  recruitPrice,
  loadCodex,
  saveCodex,
  type Codex,
  type Game,
  type PathChoice,
} from './game/engine';
import { HeroCard, HeroPortrait, ItemChip, ItemIcon, Badge } from './components/Cards';
import { play, toggleMuted, isMuted } from './game/audio';
import { cn } from './utils/cn';

type SortMode = 'none' | 'rank' | 'attr';

const COMBO_TIERS = ['#94a3b8', '#38bdf8', '#34d399', '#a3e635', '#facc15', '#fb923c', '#f472b6', '#f87171'];

export default function App() {
  const [game, setGame] = useState<Game>(() => loadGame());
  const [selected, setSelected] = useState<number[]>([]);
  const [sort, setSort] = useState<SortMode>('none');
  const [burst, setBurst] = useState<{ text: string; key: number } | null>(null);
  const [modal, setModal] = useState<'codex' | 'help' | 'remove' | null>(null);
  const [muted, setMuted] = useState(isMuted());
  const [anim, setAnim] = useState(() => localStorage.getItem('dalatro-anim') !== '0');
  const [codex, setCodex] = useState<Codex>(() => loadCodex());
  const codexMarked = useRef<string>('');

  useEffect(() => {
    if (game.phase !== 'menu') saveGame(game);
  }, [game]);

  // отметки для кодекса при открытии лавки
  useEffect(() => {
    if (game.phase !== 'shop') return;
    const tag = `${game.wave}`;
    if (codexMarked.current === tag) return;
    codexMarked.current = tag;
    const c = loadCodex();
    const heroes = new Set([...c.heroes, ...game.hand, ...game.deck, ...game.discarded, ...game.recruits]);
    const items = new Set([...c.items, ...game.offer, ...game.items]);
    const next = { ...c, heroes: [...heroes], items: [...items] };
    saveCodex(next);
    setCodex(next);
  }, [game.phase, game.wave, game.hand, game.deck, game.discarded, game.recruits, game.offer, game.items]);

  // победа в забеге
  useEffect(() => {
    if (game.phase === 'won' && codexMarked.current !== `won-${game.totalDamage}`) {
      codexMarked.current = `won-${game.totalDamage}`;
      const c = loadCodex();
      const next = { ...c, wins: c.wins + 1 };
      saveCodex(next);
      setCodex(next);
      play('win');
    }
    if (game.phase === 'lost') play('lose');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.phase]);

  const sortedHand = useMemo(() => {
    const entries = game.hand.map((id, i) => ({ id, i }));
    if (sort === 'rank') entries.sort((a, b) => heroById(b.id).rank - heroById(a.id).rank || heroById(a.id).attr.localeCompare(heroById(b.id).attr));
    if (sort === 'attr')
      entries.sort((a, b) => heroById(a.id).attr.localeCompare(heroById(b.id).attr) || heroById(a.id).rank - heroById(b.id).rank);
    return entries;
  }, [game.hand, sort]);

  const selectedIds = selected.map((i) => game.hand[i]);
  const preview = evaluate(selectedIds, game);
  const maxSel = maxSelection(game);

  function toggle(idx: number) {
    setSelected((sel) => {
      if (sel.includes(idx)) {
        play('click');
        return sel.filter((x) => x !== idx);
      }
      if (sel.length >= maxSel) return sel;
      play('select');
      return [...sel, idx];
    });
  }

  function doAttack() {
    if (!selected.length) return;
    const dmg = evaluate(selected.map((i) => game.hand[i]), game).damage;
    const after = attack(game, selected);
    setBurst({ text: dmg > 0 ? `−${dmg.toLocaleString('ru')}` : 'ГЛИФ!', key: Date.now() });
    play('attack');
    setSelected([]);
    if (after.log[0]?.includes('уровень')) setTimeout(() => play('level'), 250);
    if (after.phase === 'shop') setTimeout(() => play('gold'), 400);
    if (after.phase === 'lost') setTimeout(() => play('lose'), 300);
    setGame(after);
  }

  function doDiscard() {
    if (!selected.length || game.discards <= 0) return;
    play('discard');
    setGame(discard(game, selected));
    setSelected([]);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (game.phase !== 'battle' || modal) return;
      if (e.key === 'Enter') return doAttack();
      if (e.key.toLowerCase() === 'r') return doDiscard();
      if (e.key === 'Escape') return setSelected([]);
      const n = Number(e.key) - 1;
      if (n >= 0 && n < sortedHand.length) toggle(sortedHand[n].i);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, selected, sort, modal, sortedHand]);

  function startRun(deckId: DeckId) {
    const g = newGame(deckId);
    const c = loadCodex();
    const heroes = new Set([...c.heroes, ...g.hand, ...g.deck]);
    const items = new Set([...c.items, ...g.items]);
    const next = { ...c, runs: c.runs + 1, heroes: [...heroes], items: [...items] };
    saveCodex(next);
    setCodex(next);
    codexMarked.current = '';
    setSelected([]);
    setGame(g);
    play('path');
  }

  const restart = () => {
    if (window.confirm('Начать новый забег? Текущий прогресс будет заменён.')) {
      setGame(menuGame());
      setSelected([]);
      play('click');
    }
  };

  return (
    <div className={cn('min-h-screen battlefield-bg', !anim && 'no-anim')}>
      <Header
        game={game}
        muted={muted}
        anim={anim}
        onMute={() => setMuted(toggleMuted())}
        onAnim={() => {
          const v = !anim;
          setAnim(v);
          localStorage.setItem('dalatro-anim', v ? '1' : '0');
        }}
        onRestart={restart}
        onHelp={() => {
          play('click');
          setModal('help');
        }}
        onCodex={() => {
          play('click');
          setCodex(loadCodex());
          setModal('codex');
        }}
      />

      {game.phase === 'menu' && <MenuScreen onPick={startRun} codex={codex} />}
      {game.phase === 'battle' && (
        <BattleScreen
          game={game}
          sortedHand={sortedHand}
          selected={selected}
          preview={preview}
          maxSel={maxSel}
          burst={burst}
          sort={sort}
          onToggle={toggle}
          onAttack={doAttack}
          onDiscard={doDiscard}
          onClear={() => setSelected([])}
          onCycleSort={() => setSort(sort === 'none' ? 'rank' : sort === 'rank' ? 'attr' : 'none')}
        />
      )}
      {game.phase === 'shop' && (
        <ShopScreen game={game} setGame={(fn) => setGame((g) => fn(g))} onRemove={() => setModal('remove')} />
      )}
      {game.phase === 'map' && <MapScreen game={game} setGame={setGame} />}
      {(game.phase === 'won' || game.phase === 'lost') && (
        <EndScreen game={game} codex={codex} onRestart={() => setGame(menuGame())} />
      )}

      {modal === 'help' && <HelpModal onClose={() => setModal(null)} />}
      {modal === 'codex' && <CodexModal codex={codex} onClose={() => setModal(null)} />}
      {modal === 'remove' && (
        <RemoveModal
          game={game}
          onClose={() => setModal(null)}
          onRemove={(id) =>
            setGame((g) => {
              const n = removeHero(g, id);
              if (n !== g) play('buy');
              return n;
            })
          }
        />
      )}
    </div>
  );
}

/* ================= HEADER ================= */
function Header({
  game,
  muted,
  anim,
  onMute,
  onAnim,
  onRestart,
  onHelp,
  onCodex,
}: {
  game: Game;
  muted: boolean;
  anim: boolean;
  onMute: () => void;
  onAnim: () => void;
  onRestart: () => void;
  onHelp: () => void;
  onCodex: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-indigo-400/15 bg-slate-950/75 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-600 shadow-lg shadow-orange-900/50">
            <Swords className="h-5 w-5 text-slate-950" />
          </div>
          <div className="leading-none">
            <div className="font-display text-lg text-white">
              DALATRO <span className="shimmer-text">ASTRA</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-indigo-300/70">твой следующий тимфайт</div>
          </div>
        </div>

        {game.phase !== 'menu' && (
          <div className="ml-2 flex items-center gap-3 text-sm">
            <span className="hidden items-center gap-1.5 rounded-full bg-slate-800/80 px-3 py-1 font-bold text-slate-200 sm:flex">
              <Castle className="h-3.5 w-3.5 text-indigo-300" />
              Волна {game.wave + 1}/12
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-950/60 px-3 py-1 font-bold text-amber-300">
              <Coins className="h-3.5 w-3.5" />
              {game.gold}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-slate-800/80 px-3 py-1 font-bold text-slate-200" title="Казармы (жизни)">
              {Array.from({ length: 6 }, (_, i) => (
                <Shield key={i} className={cn('h-3.5 w-3.5', i < game.lives ? 'text-emerald-400' : 'text-slate-700')} fill={i < game.lives ? 'currentColor' : 'none'} />
              ))}
            </span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <IconBtn onClick={onCodex} title="Кодекс коллекции">
            <Library className="h-5 w-5" />
          </IconBtn>
          <IconBtn onClick={onHelp} title="Как играть">
            <BookOpen className="h-5 w-5" />
          </IconBtn>
          <IconBtn onClick={onAnim} title="Анимации" active={anim}>
            <Sparkles className="h-5 w-5" />
          </IconBtn>
          <IconBtn onClick={onMute} title="Звук">
            {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </IconBtn>
          {game.phase !== 'menu' && (
            <IconBtn onClick={onRestart} title="Новый забег">
              <RotateCcw className="h-5 w-5" />
            </IconBtn>
          )}
        </div>
      </div>
    </header>
  );
}
function IconBtn({ children, onClick, title, active }: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border text-slate-300 transition hover:bg-slate-800 hover:text-white',
        active ? 'border-amber-400/50 bg-amber-400/10 text-amber-300' : 'border-slate-700/60 bg-slate-900/50',
      )}
    >
      {children}
    </button>
  );
}

/* ================= МЕНЮ / ВЫБОР КОЛОДЫ ================= */
function MenuScreen({ onPick, codex }: { onPick: (d: DeckId) => void; codex: Codex }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="animate-fade-up text-center">
        <Badge tone="amber" className="mb-4">
          <Sparkles className="h-3 w-3" /> Обновление Astra: маршруты, рекруты, 16 новых героев
        </Badge>
        <h1 className="font-display text-5xl text-white sm:text-6xl">
          <span className="shimmer-text">DALATRO</span> ASTRA
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-slate-300">
          Покер-рогалик по мотивам Dota: собирай героев в тимфайты как покерные комбинации, ломай башни, закупай предметы, меняющие правила, и дойди до падения Древнего.
        </p>
        {codex.runs > 0 && (
          <p className="mt-2 text-sm text-slate-400">
            Забегов: {codex.runs} · побед: {codex.wins} · в кодексе {codex.heroes.length}/{HEROES.length} героев и {codex.items.length}/{ITEMS.length} предметов
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {DECKS.map((d, idx) => (
          <div
            key={d.id}
            className="glass animate-pop flex flex-col rounded-2xl p-5"
            style={{ animationDelay: `${idx * 90}ms`, borderColor: `${d.accent}55`, boxShadow: `0 0 40px ${d.accent}22` }}
          >
            <div className="flex -space-x-3">
              {d.cards.slice(0, 6).map((id) => (
                <div key={id} className="h-14 w-11 overflow-hidden rounded-md border border-slate-700 card-frame">
                  <HeroPortrait id={id} className="h-full w-full" />
                </div>
              ))}
            </div>
            <h2 className="mt-4 font-display text-xl" style={{ color: d.accent }}>
              {d.name}
            </h2>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{d.subtitle}</div>
            <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-300">{d.trait}</p>
            <div className="mt-3 rounded-lg bg-slate-950/50 p-2.5 text-xs text-slate-400">
              <div className="flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-amber-400" /> {d.gold} золота на старте
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                {d.items.map((id) => (
                  <span key={id} className="inline-flex items-center gap-1">
                    <ItemIcon id={id} className="h-5 w-5" /> {itemById(id).name}
                  </span>
                ))}
                {d.bonusDiscards > 0 && <Badge tone="green">+{d.bonusDiscards} сброс</Badge>}
              </div>
            </div>
            <p className="mt-3 text-xs italic text-slate-400">{d.tips}</p>
            <button
              type="button"
              onClick={() => onPick(d.id)}
              className="mt-4 flex items-center justify-center gap-2 rounded-xl py-2.5 font-display text-sm text-slate-950 transition hover:brightness-110"
              style={{ background: `linear-gradient(90deg, ${d.accent}, ${d.accent}cc)`, boxShadow: `0 8px 24px ${d.accent}44` }}
            >
              ВЫБРАТЬ КОЛОДУ <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-xs text-slate-500">Портреты и иконки принадлежат Valve — они подгружаются с публичного CDN; игра работает и без сети.</p>
    </div>
  );
}

/* ================= БОЙ ================= */
function BattleScreen({
  game,
  sortedHand,
  selected,
  preview,
  maxSel,
  burst,
  sort,
  onToggle,
  onAttack,
  onDiscard,
  onClear,
  onCycleSort,
}: {
  game: Game;
  sortedHand: { id: string; i: number }[];
  selected: number[];
  preview: ReturnType<typeof evaluate>;
  maxSel: number;
  burst: { text: string; key: number } | null;
  sort: SortMode;
  onToggle: (i: number) => void;
  onAttack: () => void;
  onDiscard: () => void;
  onClear: () => void;
  onCycleSort: () => void;
}) {
  const mod = modifierById(game.modifier);
  const act = Math.floor(game.wave / 4) + 1;
  return (
    <div className="mx-auto grid max-w-[1500px] gap-4 px-3 py-4 lg:grid-cols-12 lg:px-4">
      {/* ------- левая колонка ------- */}
      <aside className="space-y-4 lg:col-span-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            <span>Текущая цель {game.wave % 4 + 1}/4</span>
            <span className="text-indigo-300">Акт {act}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {isBossWave(game.wave) && (
              <Badge tone="red">
                <Skull className="h-3 w-3" /> Босс акта
              </Badge>
            )}
            {game.elite && (
              <Badge tone="violet">
                <Flame className="h-3 w-3" /> Элита
              </Badge>
            )}
            {game.treasure && (
              <Badge tone="amber">
                <Gem className="h-3 w-3" /> Схрон
              </Badge>
            )}
          </div>
          <h2 className="mt-2 font-display text-lg text-white">{waveName(game.wave)}</h2>

          <div className="mt-2">
            <div className="relative h-5 overflow-hidden rounded-full border border-slate-600/60 bg-slate-950/80">
              <div
                key={`${game.wave}-${game.hp}`}
                className="hp-bar-fill hp-bar-shake absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(0, (game.hp / waveMaxHp(game)) * 100)}%` }}
              />
              <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
                {game.hp.toLocaleString('ru')} / {waveMaxHp(game).toLocaleString('ru')} HP
              </div>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            {waveModTexts(game).map((t, i) => (
              <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                <Zap className={cn('mt-0.5 h-3 w-3 shrink-0', i === 0 && game.wave % 4 === 3 ? 'text-red-400' : 'text-sky-400')} />
                <span>{t}</span>
              </div>
            ))}
          </div>
          {mod && game.items.includes('black_king_bar') && <p className="mt-2 text-[10px] font-bold text-emerald-400">BKB игнорирует модификатор этой башни</p>}

          <div className="mt-3 rounded-lg bg-slate-950/50 px-2.5 py-1.5 text-[11px] text-amber-300">
            Награда за победу: 6+ золота
          </div>
        </div>

        <div className="glass rounded-2xl p-4">
          <ResourceLine
            icon={<Swords className="h-4 w-4 text-rose-400" />}
            label="Тимфайты"
            value={`${game.hands} / 4`}
            pips={Array.from({ length: 4 }, (_, i) => i < game.hands)}
          />
          <div className="my-3 h-px bg-slate-700/50" />
          <ResourceLine
            icon={<MapIcon className="h-4 w-4 text-emerald-400" />}
            label="ТП-сбросы"
            value={`${game.discards} / ${baseDiscards(game)}`}
            pips={Array.from({ length: baseDiscards(game) }, (_, i) => i < game.discards)}
            pipColor="bg-emerald-400"
          />
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Журнал боя</div>
          <div className="space-y-1.5">
            {game.log.slice(0, 4).map((entry, i) => (
              <p key={i} className={cn('text-[11px] leading-snug', i === 0 ? 'text-slate-100' : 'text-slate-400')}>
                {entry}
              </p>
            ))}
          </div>
        </div>
      </aside>

      {/* ------- центр ------- */}
      <main className="space-y-4 lg:col-span-6">
        <div className="glass relative overflow-hidden rounded-2xl p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Боевое поле · волна {game.wave + 1}</span>
            <span className="text-[10px] text-slate-500">порядок выбора = порядок в бою</span>
          </div>
          <div className="relative flex min-h-[110px] items-center justify-center gap-2 rounded-xl border border-indigo-400/15 bg-slate-950/40 py-3">
            {Array.from({ length: maxSel }, (_, slot) => {
              const handIdx = selected[slot];
              const id = handIdx !== undefined ? game.hand[handIdx] : undefined;
              return (
                <div key={slot} className="relative">
                  {id ? (
                    <div className="animate-pop">
                      <HeroCard id={id} size="sm" selected order={slot} onClick={() => onToggle(handIdx!)} />
                    </div>
                  ) : (
                    <div className="flex h-28 w-20 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-700 text-slate-600">
                      <span className="font-display text-xl">{slot + 1}</span>
                    </div>
                  )}
                </div>
              );
            })}
            {burst && (
              <div key={burst.key} className="animate-float-up pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="font-display text-5xl text-amber-300 text-glow-gold">{burst.text}</span>
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <div className="pointer-events-none mb-2 flex justify-center">
              <span
                className="animate-pop rounded-full border px-4 py-1 font-display text-sm"
                style={{
                  borderColor: `${COMBO_TIERS[preview.combo]}88`,
                  color: COMBO_TIERS[preview.combo],
                  background: `${COMBO_TIERS[preview.combo]}14`,
                }}
              >
                {COMBOS[preview.combo].name} · {COMBOS[preview.combo].poker}
              </span>
            </div>
          )}

          <div className="mt-3 flex items-center justify-center gap-3">
            <div className="text-center">
              <div className="font-display text-2xl text-sky-300">{preview.power || 0}</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">сила</div>
            </div>
            <span className="pb-4 font-display text-xl text-slate-500">×</span>
            <div className="text-center">
              <div className="font-display text-2xl text-violet-300">{Number(preview.mult.toFixed(2)) || 0}</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">множ.</div>
            </div>
            <span className="pb-4 font-display text-xl text-slate-500">=</span>
            <div className="text-center">
              <div className="font-display text-3xl text-amber-300 text-glow-gold">{preview.damage.toLocaleString('ru')}</div>
              <div className="text-[9px] uppercase tracking-widest text-slate-500">урона</div>
            </div>
            {preview.modifier !== 1 && selected.length > 0 && (
              <Badge tone={preview.modifier === 0 ? 'red' : 'amber'} className="ml-1">
                ×{preview.modifier}
              </Badge>
            )}
          </div>

          {selected.length > 0 && preview.effects.length > 1 && (
            <div className="mx-auto mt-2 max-h-24 overflow-y-auto rounded-lg bg-slate-950/60 p-2">
              {preview.effects.map((e, i) => (
                <div key={i} className={cn('text-[10px] leading-snug', i === 0 ? 'font-bold text-slate-200' : 'text-slate-400')}>
                  {e}
                </div>
              ))}
              {preview.goldGain > 0 && <div className="text-[10px] font-bold text-amber-300">Принесёт {preview.goldGain} золота</div>}
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
              Твоя рука · {game.hand.length}/8 · выбрано {selected.length}/{maxSel}
            </span>
            <button
              type="button"
              onClick={onCycleSort}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/60 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              <SortAsc className="h-3.5 w-3.5" />
              {sort === 'none' ? 'Порядок раздачи' : sort === 'rank' ? 'По рангу' : 'По атрибуту'}
            </button>
          </div>
          <div className="flex flex-wrap items-start justify-center gap-2.5">
            {sortedHand.map(({ id, i }, display) => {
              const order = selected.indexOf(i);
              const dimmed = game.modifier === 'fog' && heroById(id).rank <= 4 && !game.items.includes('black_king_bar');
              return (
                <HeroCard
                  key={`${id}-${i}`}
                  id={id}
                  selected={order !== -1}
                  order={order !== -1 ? order : undefined}
                  onClick={() => onToggle(i)}
                  hotkey={display}
                  disabled={order === -1 && selected.length >= maxSel}
                  dimmed={dimmed}
                />
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={onDiscard}
              disabled={!selected.length || game.discards <= 0}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-900/40 px-4 py-2.5 font-display text-sm text-emerald-200 transition enabled:hover:bg-emerald-800/50 disabled:opacity-35"
            >
              <MapIcon className="h-4 w-4" /> ТП-СБРОС ({game.discards})
            </button>
            <button
              type="button"
              onClick={onAttack}
              disabled={!selected.length}
              className="animate-glow flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-orange-500 px-8 py-2.5 font-display text-base text-white transition enabled:hover:brightness-110 disabled:opacity-40 disabled:animate-none"
            >
              <Swords className="h-5 w-5" /> В АТАКУ
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={!selected.length}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2.5 text-sm text-slate-400 transition enabled:hover:bg-slate-800 disabled:opacity-30"
            >
              <X className="h-4 w-4" /> Сбросить выбор
            </button>
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">1–8 — выбрать героя · Enter — атака · R — ТП-сброс · Esc — очистить</p>
        </div>
      </main>

      {/* ------- правая колонка ------- */}
      <aside className="space-y-4 lg:col-span-3">
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
            <Backpack className="h-4 w-4 text-amber-400" /> Твой билд · {game.items.length}/5
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => {
              const id = game.items[i];
              return <ItemChip key={i} id={id} empty={!id} />;
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Предметы меняют правила каждого розыгрыша</p>
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Комбинации</div>
          <div className="space-y-1.5">
            {COMBOS.map((c, i) => {
              const lvl = game.levels[i];
              const progress = game.plays[i] % 3;
              return (
                <div key={c.name} className="flex items-center gap-2 text-[11px]">
                  <span className={cn('h-1.5 w-1.5 rounded-full', lvl > 1 ? 'bg-amber-400' : 'bg-slate-600')} />
                  <span className="flex-1 truncate text-slate-300">{c.name}</span>
                  <span className="text-slate-500">ур.{lvl}</span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map((p) => (
                      <span key={p} className={cn('h-1.5 w-3 rounded-sm', p < progress ? 'bg-sky-400' : 'bg-slate-800')} />
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Каждые 3 розыгрыша комбинация получает +10 силы и +1 множителя</p>
        </div>

        <div className="glass rounded-2xl p-4 text-[11px] text-slate-400">
          <div className="flex justify-between"><span>Колода</span><span className="font-bold text-slate-200">{game.deck.length}</span></div>
          <div className="flex justify-between"><span>В сбросе</span><span className="font-bold text-slate-200">{game.discarded.length}</span></div>
          <div className="flex justify-between"><span>Лучший тимфайт</span><span className="font-bold text-amber-300">{game.best.toLocaleString('ru')}</span></div>
          <div className="flex justify-between"><span>Всего урона</span><span className="font-bold text-slate-200">{game.totalDamage.toLocaleString('ru')}</span></div>
        </div>
      </aside>
    </div>
  );
}

function ResourceLine({ icon, label, value, pips, pipColor = 'bg-rose-400' }: { icon: React.ReactNode; label: string; value: string; pips: boolean[]; pipColor?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      {icon}
      <div className="flex-1">
        <div className="flex justify-between text-xs">
          <span className="font-semibold text-slate-300">{label}</span>
          <span className="text-slate-400">{value}</span>
        </div>
        <div className="mt-1 flex gap-1">
          {pips.map((on, i) => (
            <span key={i} className={cn('pip h-1.5 flex-1 rounded-full', on ? pipColor : 'bg-slate-800')} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= ЛАВКА ================= */
function ShopScreen({ game, setGame, onRemove }: { game: Game; setGame: (fn: (g: Game) => Game) => void; onRemove: () => void }) {
  const rewardCombos = [1, 3, 5];
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="animate-fade-up text-center">
        <Badge tone="green" className="mb-3">
          <Trophy className="h-3 w-3" /> Линия зачищена · волна {game.wave + 1}
        </Badge>
        <h1 className="font-display text-3xl text-white">Тайная лавка</h1>
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-400">
          Хороший предмет усиливает руку. Отличный — меняет весь билд.
          <span className="flex items-center gap-1 rounded-full bg-amber-950/60 px-3 py-0.5 font-bold text-amber-300">
            <Coins className="h-3.5 w-3.5" /> {game.gold} золота · процент +1 за каждые 5
          </span>
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* предметы */}
        <section className="glass rounded-2xl p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base text-sky-300">Предметы</h2>
            <button
              type="button"
              onClick={() => setGame((g) => reroll(g))}
              disabled={game.gold < 2}
              className="flex items-center gap-1.5 rounded-lg border border-sky-500/40 bg-sky-900/30 px-3 py-1.5 text-xs font-bold text-sky-200 transition enabled:hover:bg-sky-800/40 disabled:opacity-35"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Обновить (2)
            </button>
          </div>
          {game.offer.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Всё раскуплено. Обнови товары или отправляйся в бой.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {game.offer.map((id) => {
                const item = itemById(id);
                const can = game.gold >= item.price && game.items.length < 5;
                return (
                  <div key={id} className={cn('flex gap-3 rounded-xl border-2 bg-slate-950/50 p-3', RARITY_STYLE[item.rarity].ring)}>
                    <div className="shrink-0">
                      <ItemIcon id={id} className="h-14 w-14 rounded-lg" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm text-white">{item.name}</span>
                        <Badge className={RARITY_STYLE[item.rarity].chip}>{item.rarity}</Badge>
                      </div>
                      <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{item.desc}</p>
                      <button
                        type="button"
                        disabled={!can}
                        onClick={() => {
                          play('buy');
                          setGame((g) => buyItem(g, id));
                        }}
                        className="mt-1.5 flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 transition enabled:hover:bg-amber-400 disabled:opacity-35"
                      >
                        <Coins className="h-3 w-3" /> {item.price} {game.items.length >= 5 ? '· билд полон' : ''}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 border-t border-slate-700/50 pt-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Инвентарь — нажми, чтобы продать за полцены</div>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 5 }, (_, i) => {
                const id = game.items[i];
                if (!id) return <ItemChip key={i} empty />;
                return <ItemChip key={i} id={id} sellPrice={Math.floor(itemById(id).price / 2)} onClick={() => setGame((g) => sellItem(g, id))} />;
              })}
            </div>
          </div>
        </section>

        {/* правая колонка лавки */}
        <section className="space-y-4">
          <div className="glass rounded-2xl p-4">
            <h2 className="mb-3 font-display text-base text-emerald-300">Рекруты · новые герои в колоду</h2>
            <div className="flex justify-around gap-2">
              {game.recruits.map((id) => {
                const price = recruitPrice(id);
                return (
                  <div key={id} className="flex flex-col items-center gap-1.5">
                    <HeroCard id={id} size="sm" />
                    <button
                      type="button"
                      disabled={game.gold < price}
                      onClick={() => {
                        play('buy');
                        setGame((g) => recruit(g, id));
                      }}
                      className="flex items-center gap-1 rounded-lg bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 transition enabled:hover:bg-emerald-400 disabled:opacity-35"
                    >
                      <Coins className="h-3 w-3" /> {price}
                    </button>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={game.usedRemove || game.gold < 4}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/40 bg-red-900/30 px-3 py-2 text-xs font-bold text-red-200 transition enabled:hover:bg-red-800/40 disabled:opacity-35"
            >
              <UserMinus className="h-4 w-4" />
              {game.usedRemove ? 'Отчисление уже использовано' : 'Отчислить героя из колоды (4)'}
            </button>
          </div>

          <div className="glass rounded-2xl p-4">
            <h2 className="mb-1 font-display text-base text-amber-300">Боевой опыт</h2>
            {game.reward ? (
              <p className="text-xs text-slate-400">Сила комбинации выросла. Время проверить её в бою.</p>
            ) : (
              <>
                <p className="mb-3 text-xs text-slate-400">Бесплатно: +10 базовой силы и +1 множителя одной из комбинаций.</p>
                <div className="space-y-2">
                  {rewardCombos.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        play('level');
                        setGame((g) => claimReward(g, c));
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-amber-500/30 bg-amber-900/20 px-3 py-2 text-left transition hover:bg-amber-900/35"
                    >
                      <span className="text-xs font-bold text-amber-200">{COMBOS[c].name}</span>
                      <span className="text-[10px] text-slate-400">ур.{game.levels[c]} → {game.levels[c] + 1}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => {
            play('path');
            setGame((g) => ({ ...g, phase: 'map' }));
          }}
          className="animate-glow flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-10 py-3.5 font-display text-lg text-white transition hover:brightness-110"
        >
          <MapIcon className="h-5 w-5" /> ВЫБРАТЬ МАРШРУТ
        </button>
      </div>
    </div>
  );
}

/* ================= КАРТА МАРШРУТОВ ================= */
function MapScreen({ game, setGame }: { game: Game; setGame: React.Dispatch<React.SetStateAction<Game>> }) {
  const paths = pathsForNextWave(game);
  const nextWave = game.wave + 1;
  const act = Math.floor(nextWave / 4) + 1;

  const meta: Record<PathChoice['type'], { title: string; sub: string; icon: React.ReactNode; tone: string; reward: string }> = {
    normal: {
      title: 'Обычная башня',
      sub: 'Стабильный фарм',
      icon: <Castle className="h-10 w-10 text-indigo-300" />,
      tone: '#6e8bff',
      reward: '+6 золота за победу',
    },
    elite: {
      title: 'Элитная башня',
      sub: 'Опасно, но прибыльно',
      icon: <Flame className="h-10 w-10 text-violet-300" />,
      tone: '#a87bff',
      reward: '+6 золота · гарантированный редкий+ товар',
    },
    treasure: {
      title: 'Схрон джунглей',
      sub: 'Ослабленная охрана, куча золота',
      icon: <Gem className="h-10 w-10 text-amber-300" />,
      tone: '#f5c550',
      reward: '+12 золота за победу',
    },
    boss: {
      title: isBossWave(nextWave) ? 'РОШАН · БОСС АКТА' : 'Босс',
      sub: `Акт ${act} · финальное испытание`,
      icon: <Skull className="h-10 w-10 text-red-400" />,
      tone: '#ff5c5c',
      reward: 'Доступ в следующий акт',
    },
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="animate-fade-up text-center">
        <Badge tone="sky" className="mb-3">
          <MapIcon className="h-3 w-3" /> Волна {nextWave + 1}/12
        </Badge>
        <h1 className="font-display text-3xl text-white">Выбор маршрута</h1>
        <p className="mt-1 text-sm text-slate-400">Модификаторы башни видны заранее — собери контрудар в лавке.</p>
      </div>

      <div className={cn('mt-8 grid gap-5', paths.length === 1 ? 'mx-auto max-w-md' : 'md:grid-cols-3')}>
        {paths.map((p, idx) => {
          const m = meta[p.type];
          const hp = Math.round(maxHp(nextWave) * p.hpScale);
          const previewGame: Game = {
            ...game,
            wave: nextWave,
            elite: p.type === 'elite',
            treasure: p.type === 'treasure',
            modifier: p.modifier,
          };
          return (
            <button
              key={p.type}
              type="button"
              onClick={() => {
                play('attack');
                setGame((g) => takePath(g, p));
              }}
              className="glass animate-pop group flex flex-col rounded-2xl p-5 text-left transition hover:-translate-y-1.5"
              style={{ animationDelay: `${idx * 100}ms`, borderColor: `${m.tone}66`, boxShadow: `0 0 36px ${m.tone}1f` }}
            >
              <div className="flex items-center justify-between">
                {m.icon}
                <span className="font-display text-2xl text-white">{hp.toLocaleString('ru')}</span>
              </div>
              <h2 className="mt-3 font-display text-lg" style={{ color: m.tone }}>
                {m.title}
              </h2>
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{m.sub}</div>
              <div className="mt-3 flex-1 space-y-1.5">
                {waveModTexts(previewGame, nextWave, p.modifier).map((t, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-300">
                    <Zap className={cn('mt-0.5 h-3 w-3 shrink-0', p.modifier ? 'text-violet-400' : 'text-sky-400')} />
                    {t}
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-slate-950/55 px-3 py-2 text-[11px] font-semibold text-amber-300">{m.reward}</div>
              <div className="mt-3 flex items-center justify-center gap-2 font-display text-sm text-slate-300 transition group-hover:text-white">
                В БОЙ <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ================= ФИНАЛ ================= */
function EndScreen({ game, codex, onRestart }: { game: Game; codex: Codex; onRestart: () => void }) {
  const won = game.phase === 'won';
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 text-center">
      <div className="animate-pop mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-600 shadow-2xl shadow-orange-900/50">
        {won ? <Trophy className="h-12 w-12 text-slate-950" /> : <Ghost className="h-12 w-12 text-slate-950" />}
      </div>
      <h1 className="font-display text-4xl text-white sm:text-5xl">{won ? 'ДРЕВНИЙ ПАЛ' : 'КРЕПОСТЬ РАЗРУШЕНА'}</h1>
      <p className="mt-3 text-slate-300">
        {won ? '12 волн. Три акта. Один невероятный билд. Это был легендарный забег.' : `Ты продержался до волны ${game.wave + 1}. Каждый конец — новая раздача.`}
      </p>
      <div className="glass mt-8 grid grid-cols-3 gap-3 rounded-2xl p-5">
        <Stat label="Пройдено волн" value={String(won ? 12 : game.wave)} />
        <Stat label="Всего урона" value={game.totalDamage.toLocaleString('ru')} />
        <Stat label="Лучший тимфайт" value={game.best.toLocaleString('ru')} />
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Побед в кодексе: {codex.wins} из {codex.runs} забегов
      </p>
      <button
        type="button"
        onClick={() => {
          play('click');
          onRestart();
        }}
        className="mt-8 flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-10 py-3.5 font-display text-lg text-slate-950 transition hover:brightness-110 mx-auto"
      >
        <RotateCcw className="h-5 w-5" /> НОВЫЙ ЗАБЕГ
      </button>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-display text-2xl text-amber-300">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

/* ================= МОДАЛКИ ================= */
function ModalShell({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className={cn('glass animate-pop my-8 w-full rounded-2xl p-5', wide ? 'max-w-4xl' : 'max-w-lg')} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-white">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="Как играть" onClose={onClose} wide>
      <div className="space-y-4 text-sm text-slate-300">
        <p>
          Каждая волна — вражеская башня с запасом HP. У тебя есть <b className="text-white">4 тимфайта</b> (атаки) и <b className="text-white">3 ТП-сброса</b>. Выбери от 1 до 5 героев из руки —
          они соберут покерную комбинацию по рангам и атрибутам.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {COMBOS.map((c, i) => (
            <div key={c.name} className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-3 py-1.5 text-xs">
              <span className="w-5 text-center font-display text-amber-300">{i}</span>
              <span className="flex-1 font-semibold text-slate-200">{c.name}</span>
              <span className="text-slate-500">{c.poker}</span>
              <span className="text-sky-300">{c.base}×{c.mult}</span>
            </div>
          ))}
        </div>
        <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-400">
          <li>Порядок выбора важен: позиционные способности (Juggernaut, Tusk, Muerta) смотрят на место героя.</li>
          <li>Каждые 3 розыгрыша одной комбинации она получает уровень: +10 базовой силы и +1 множителя. После победы — ещё одно бесплатное улучшение на выбор.</li>
          <li>Кончились тимфайты, а башня стоит? Теряешь казарму (всего 6). С последней — поражение. Divine Rapier сгорает при провале.</li>
          <li>Золото: база 6, бонус за сохранённые атаки, оверкилл (Midas удваивает), точный ласт-хит, проценты +1 за каждые 5 монет.</li>
          <li><b className="text-violet-300">Элитные башни</b> сильнее и с модификатором, но дают +6 золота и редкий товар. <b className="text-amber-300">Схрон</b> — наоборот, лёгкая башня с +12 золота.</li>
          <li><b className="text-emerald-300">Рекруты</b> пополняют колоду, «Отчисление» убирает лишнюю карту — чем тоньше колода, тем стабильнее комбинации.</li>
          <li>Manta Style и Shadow Blade меняют только определение комбинации, но не реальную силу — следи за предпросмотром.</li>
        </ul>
      </div>
    </ModalShell>
  );
}

function CodexModal({ codex, onClose }: { codex: Codex; onClose: () => void }) {
  const [tab, setTab] = useState<'heroes' | 'items'>('heroes');
  return (
    <ModalShell title="Кодекс" onClose={onClose} wide>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setTab('heroes')}
          className={cn('rounded-lg px-4 py-1.5 text-sm font-bold', tab === 'heroes' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400')}
        >
          Герои {codex.heroes.length}/{HEROES.length}
        </button>
        <button
          type="button"
          onClick={() => setTab('items')}
          className={cn('rounded-lg px-4 py-1.5 text-sm font-bold', tab === 'items' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400')}
        >
          Предметы {codex.items.length}/{ITEMS.length}
        </button>
      </div>
      {tab === 'heroes' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {HEROES.map((h) => {
            const seen = codex.heroes.includes(h.id);
            const attr = ATTRS[h.attr];
            return (
              <div key={h.id} className={cn('flex items-center gap-2 rounded-lg border p-2', seen ? 'border-slate-700 bg-slate-900/60' : 'border-slate-800 bg-slate-950/60')}>
                {seen ? <HeroPortrait id={h.id} className="h-10 w-10 rounded-md" /> : <Lock className="h-10 w-10 p-2 text-slate-700" />}
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold" style={{ color: seen ? attr.color : '#475569' }}>{seen ? h.name : '???'}</div>
                  <div className="text-[10px] text-slate-500">{seen ? `ранг ${h.rank} · ${h.ability}` : 'не встречен'}</div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {ITEMS.map((it) => {
            const seen = codex.items.includes(it.id);
            return (
              <div key={it.id} className={cn('rounded-lg border p-2', seen ? cn(RARITY_STYLE[it.rarity].ring, 'bg-slate-900/60') : 'border-slate-800 bg-slate-950/60')}>
                <div className="flex items-center gap-2">
                  {seen ? <ItemIcon id={it.id} className="h-9 w-9" /> : <Lock className="h-9 w-9 p-2 text-slate-700" />}
                  <div className="min-w-0">
                    <div className={cn('truncate text-xs font-bold', seen ? 'text-slate-200' : 'text-slate-600')}>{seen ? it.name : '???'}</div>
                    <div className="text-[10px] text-slate-500">{seen ? it.short : 'не найден'}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ModalShell>
  );
}

function RemoveModal({ game, onClose, onRemove }: { game: Game; onClose: () => void; onRemove: (id: string) => void }) {
  const counts: Record<string, number> = {};
  [...game.hand, ...game.deck, ...game.discarded].forEach((id) => (counts[id] = (counts[id] || 0) + 1));
  const total = game.hand.length + game.deck.length + game.discarded.length;
  return (
    <ModalShell title="Отчислить героя" onClose={onClose}>
      <p className="mb-3 text-xs text-slate-400">
        Убери одного героя из колоды навсегда за 4 золота. Один раз между волнами. Сейчас в колоде {total} карт (минимум 8).
      </p>
      <div className="grid max-h-[55vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
        {Object.entries(counts)
          .sort((a, b) => heroById(a[0]).rank - heroById(b[0]).rank)
          .map(([id, n]) => (
            <div key={id} className="flex flex-col items-center gap-1 rounded-lg bg-slate-950/50 p-2">
              <HeroCard id={id} size="sm" />
              {n > 1 && <span className="text-[10px] font-bold text-slate-400">×{n}</span>}
              <button
                type="button"
                disabled={game.usedRemove || game.gold < 4 || total <= 8}
                onClick={() => {
                  onRemove(id);
                  onClose();
                }}
                className="rounded bg-red-600/80 px-2.5 py-1 text-[10px] font-bold text-white transition enabled:hover:bg-red-500 disabled:opacity-30"
              >
                Отчислить
              </button>
            </div>
          ))}
      </div>
    </ModalShell>
  );
}
