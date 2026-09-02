'use client';

import { cn, couleurTon } from '@/components/ui';

/** Tons publics (anglais) → clés de `couleurTon`. */
const TON_VERS_VAR = {
  green: 'vert',
  teal: 'teal',
  gold: 'or',
  red: 'rouge',
  blue: 'bleu',
  muted: 'muted',
};

const TON_TEXTE = {
  green: 'text-green',
  teal: 'text-teal',
  gold: 'text-gold',
  red: 'text-red',
  blue: 'text-blue',
  muted: 'text-muted',
};

export function TuileCategorie({ label, chiffre, ton = 'green', sous, onClick, actif }) {
  const couleur = couleurTon(TON_VERS_VAR[ton] ?? ton);
  const className = cn(
    'flex w-full flex-col gap-1 rounded-xl border border-solid p-4 text-left',
    onClick &&
      'cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue',
    actif && 'ring-1',
  );
  const style = {
    background: `color-mix(in srgb, ${couleur} 12%, transparent)`,
    borderColor: `color-mix(in srgb, ${couleur} ${actif ? 70 : 40}%, transparent)`,
    ...(actif
      ? { boxShadow: `0 0 0 1px color-mix(in srgb, ${couleur} 45%, transparent)` }
      : {}),
  };

  const contenu = (
    <>
      <span
        className={cn(
          'text-[11px] tracking-[1.8px] uppercase',
          actif ? (TON_TEXTE[ton] ?? 'text-muted') : 'text-muted',
        )}
      >
        {label}
      </span>
      <span className={cn('font-mono text-[24px] leading-none font-bold tabular-nums', TON_TEXTE[ton] ?? 'text-txt')}>
        {chiffre}
      </span>
      {sous ? <span className="text-[11px] text-muted2">{sous}</span> : null}
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={actif || undefined} className={className} style={style}>
        {contenu}
      </button>
    );
  }

  return (
    <div className={className} style={style}>
      {contenu}
    </div>
  );
}
