'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn, PaginationBar } from '@/components/ui';
import { IconRetour } from '@/components/icons';

export function FilAriane({ items }) {
  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1.5 text-[12px]">
      {items.map(function (item, i) {
        const dernier = i === items.length - 1;
        return (
          <span key={item.label} className="flex items-center gap-1.5">
            {i > 0 ? <span className="text-muted2">/</span> : null}
            {dernier || !item.href ? (
              <span className="text-txt">{item.label}</span>
            ) : (
              <Link
                href={item.href}
                className="cursor-pointer text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function BandeauFiche({ kicker, titre, badges, meta, actions, onRetour, hrefRetour }) {
  const router = useRouter();
  function retour() {
    if (onRetour) {
      onRetour();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(hrefRetour || '/dashboard');
  }

  return (
    <div className="lp-rise">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={retour}
          aria-label="Retour à la liste"
          className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border border-line2 text-muted outline-none transition-colors hover:bg-panel2 hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
        >
          <IconRetour className="size-4" />
        </button>
        <FilAriane items={meta?.fil ?? []} />
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {kicker ? (
            <div className="font-mono text-[10px] tracking-[2.5px] text-muted2 uppercase">
              {kicker}
            </div>
          ) : null}
          <div className="mt-1 flex flex-wrap items-center gap-2.5">
            <h1 className="font-display m-0 text-[27px] leading-tight font-bold text-txt">
              {titre}
            </h1>
            {badges}
          </div>
          {meta?.ligne ? (
            <p className="mt-1.5 mb-0 text-[12.5px] text-muted">{meta.ligne}</p>
          ) : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function LigneMeta({ label, children }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-baseline gap-x-3 gap-y-1 py-1.5">
      <dt className="text-[10px] tracking-[1.4px] text-muted2 uppercase">{label}</dt>
      <dd className="m-0 min-w-0 text-[12.5px] text-txt">{children}</dd>
    </div>
  );
}

export function Journal({ titre, extra, chips, pied, vide, children }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h3 className="m-0 text-[13px] tracking-wide text-muted uppercase">{titre}</h3>
        {extra}
      </div>
      {chips ? (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-2.5">{chips}</div>
      ) : null}
      {vide ? (
        <p className="m-0 px-5 py-8 text-center text-[13px] text-muted2">{vide}</p>
      ) : (
        children
      )}
      {pied}
    </section>
  );
}

export function LigneJournal({ href, rail, titre, sous, droite, rang = 0 }) {
  const classe =
    'lp-rise flex gap-3.5 border-b border-line px-5 py-3 last:border-b-0 transition-colors';
  const style = { animationDelay: `${Math.min(rang, 10) * 45}ms` };
  const corps = (
    <>
      <span
        aria-hidden
        className="w-[3px] shrink-0 self-stretch rounded-full"
        style={{ background: rail }}
      />
      <div className="min-w-0 flex-1">
        <p className="m-0 text-[13px] font-semibold text-txt">{titre}</p>
        {sous ? <p className="m-0 mt-0.5 truncate text-[11.5px] text-muted">{sous}</p> : null}
      </div>
      {droite ? (
        <span className="shrink-0 self-center font-mono text-[11px] text-muted2 tabular-nums">
          {droite}
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          classe,
          'cursor-pointer outline-none hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]',
          'focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-inset',
        )}
        style={style}
      >
        {corps}
      </Link>
    );
  }

  return (
    <div className={classe} style={style}>
      {corps}
    </div>
  );
}

