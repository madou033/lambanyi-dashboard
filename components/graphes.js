'use client';

/**
 * Graphes maison — pur CSS/SVG, zéro dépendance. cf. DESIGN_SYSTEM.md §6.
 * Chaque composant reçoit des valeurs déjà agrégées ; aucun fetch ici.
 */

// `cn` est redéfini ici plutôt qu'importé de ui.js : ui.js consomme
// MiniBarres, et le cycle d'imports casserait au chargement.
function cn(...parts) {
  return parts.filter(Boolean).join(' ');
}

/* ------------------------------------------------------------------ */
/* Sparkline — micro-histogramme des compteurs                         */
/* ------------------------------------------------------------------ */

export function MiniBarres({ valeurs, accent = 'var(--lp-green)', className }) {
  const max = Math.max(1, ...valeurs);
  return (
    <div className={cn('flex h-5 items-end gap-[2px]', className)} aria-hidden>
      {valeurs.map(function (v, i) {
        return (
          <div
            key={i}
            className="min-h-[2px] flex-1 rounded-[1px] transition-[height] duration-500"
            style={{
              height: `${Math.max(6, (v / max) * 100)}%`,
              background: i === valeurs.length - 1 ? accent : 'var(--lp-line2)',
              opacity: v === 0 && i !== valeurs.length - 1 ? 0.45 : 1,
            }}
          />
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Histogramme multi-séries                                            */
/* ------------------------------------------------------------------ */

/** @param series [{ label, couleur, valeurs: number[] }] */
export function BarresActivite({ series, etiquettes, uniteVide = 'Aucune activité sur la période' }) {
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs));
  const vide = series.every((s) => s.valeurs.every((v) => v === 0));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {series.map(function (s) {
            return (
              <span key={s.label} className="flex items-center gap-1.5 text-[10.5px] text-muted">
                <span className="size-2 rounded-sm" style={{ background: s.couleur }} />
                {s.label}
              </span>
            );
          })}
        </div>
        <span className="font-mono text-[10px] text-muted2 tabular-nums">pic · {max}</span>
      </div>

      <div className="relative h-44">
        <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map(function (i) {
            return <div key={i} className="h-px w-full bg-line opacity-60" />;
          })}
          <div className="h-px w-full bg-line" />
        </div>

        <div className="absolute inset-x-0 top-1 bottom-px flex items-end gap-[3px]">
          {etiquettes.map(function (etiquette, i) {
            return (
              <div
                key={i}
                title={`${etiquette} — ${series.map((s) => `${s.label} : ${s.valeurs[i]}`).join(' · ')}`}
                className="group flex h-full flex-1 items-end justify-center gap-[2px] rounded-sm transition-colors hover:bg-[color-mix(in_srgb,var(--lp-txt)_4%,transparent)]"
              >
                {series.map(function (s) {
                  return (
                    <div
                      key={s.label}
                      className="w-full max-w-[7px] rounded-t-[2px] transition-[height] duration-500"
                      style={{
                        height: `${(s.valeurs[i] / max) * 100}%`,
                        minHeight: s.valeurs[i] > 0 ? 3 : 0,
                        background: s.couleur,
                      }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>

        {vide ? (
          <div className="absolute inset-0 grid place-items-center">
            <span className="text-[12px] text-muted2">{uniteVide}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-muted2">
        {etiquettes
          .filter(function (_, i) {
            return i % 4 === 0;
          })
          .map(function (e, i) {
            return <span key={`${e}-${i}`}>{e}</span>;
          })}
        <span>{etiquettes[etiquettes.length - 1]}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Donut multi-segments                                                */
/* ------------------------------------------------------------------ */

/** @param parts [{ label, n, couleur }] */
export function Donut({ parts, libelleCentre, vide }) {
  const total = parts.reduce(function (somme, p) {
    return somme + p.n;
  }, 0);

  if (total === 0) return <p className="m-0 text-[12px] text-muted2">{vide}</p>;

  // Bornes cumulées calculées par réduction : réassigner un compteur externe
  // depuis un map serait une mutation pendant le rendu.
  const stops = parts
    .filter(function (p) {
      return p.n > 0;
    })
    .reduce(
      function (acc, p) {
        const fin = acc.cumul + p.n;
        acc.segments.push(
          `${p.couleur} ${(acc.cumul / total) * 100}% ${(fin / total) * 100}%`,
        );
        return { cumul: fin, segments: acc.segments };
      },
      { cumul: 0, segments: [] },
    )
    .segments.join(', ');

  return (
    <div className="flex items-center gap-5">
      <div
        className="relative size-[104px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops})` }}
        role="img"
        aria-label={parts.map((p) => `${p.label} : ${p.n}`).join(', ')}
      >
        <div className="absolute inset-[9px] grid place-items-center rounded-full bg-bg">
          <div className="text-center">
            <div className="font-mono text-[20px] leading-none font-bold text-txt tabular-nums">
              {total}
            </div>
            <div className="mt-0.5 text-[8.5px] tracking-wide text-muted2 uppercase">
              {libelleCentre}
            </div>
          </div>
        </div>
      </div>
      <ul className="m-0 flex min-w-0 flex-1 list-none flex-col gap-1.5 p-0">
        {parts.map(function (p) {
          return (
            <li key={p.label} className="flex items-center gap-2 text-[11.5px]">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: p.couleur }} />
              <span className="min-w-0 flex-1 truncate text-muted">{p.label}</span>
              <span className="font-mono text-[12px] font-bold text-txt tabular-nums">{p.n}</span>
              <span className="w-9 text-right font-mono text-[10px] text-muted2 tabular-nums">
                {Math.round((p.n / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Répartition horizontale                                             */
/* ------------------------------------------------------------------ */

/** @param lignes [{ label, n, couleur }] */
export function BarresReparties({ lignes, vide }) {
  const max = Math.max(...lignes.map((l) => l.n), 0);
  if (max === 0) return <p className="m-0 text-[12px] text-muted2">{vide}</p>;

  return (
    <div className="flex flex-col gap-2.5">
      {lignes.map(function (l) {
        return (
          <div key={l.label} className="grid grid-cols-[104px_1fr_auto] items-center gap-3">
            <span className="truncate text-[11px] text-muted">{l.label}</span>
            <div className="h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{ width: `${(l.n / max) * 100}%`, background: l.couleur }}
              />
            </div>
            <span
              className={cn(
                'w-8 text-right font-mono text-[12px] font-bold tabular-nums',
                l.n > 0 ? 'text-txt' : 'text-muted2',
              )}
            >
              {l.n}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Jauge — une seule valeur en anneau                                  */
/* ------------------------------------------------------------------ */

/** @param details [{ label, valeur, ton }] rendus en <dl> à droite */
export function Jauge({ pourcentage, libelle, couleur = 'var(--lp-green)', details = [] }) {
  const pct = Math.max(0, Math.min(100, Math.round(pourcentage || 0)));
  return (
    <div className="flex items-center gap-6">
      <div
        className="relative size-[104px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(${couleur} ${pct}%, var(--lp-line) 0)` }}
        role="img"
        aria-label={`${pct}% — ${libelle}`}
      >
        <div className="absolute inset-[9px] grid place-items-center rounded-full bg-bg">
          <div className="text-center">
            <div className="font-mono text-[20px] leading-none font-bold text-txt tabular-nums">
              {pct}%
            </div>
            <div className="mt-0.5 text-[8.5px] tracking-wide text-muted2 uppercase">{libelle}</div>
          </div>
        </div>
      </div>
      {details.length > 0 ? (
        <dl className="m-0 flex min-w-0 flex-1 flex-col gap-2 text-[12px]">
          {details.map(function (d, i) {
            return (
              <div
                key={d.label}
                className={cn(
                  'flex justify-between gap-3',
                  i === details.length - 1 && details.length > 2 && 'border-t border-line pt-2',
                )}
              >
                <dt className="text-muted">{d.label}</dt>
                <dd
                  className="m-0 font-mono font-bold tabular-nums"
                  style={{ color: d.couleur ?? 'var(--lp-txt)' }}
                >
                  {d.valeur}
                </dd>
              </div>
            );
          })}
        </dl>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Barre de répartition empilée                                        */
/* ------------------------------------------------------------------ */

/** @param segments [{ label, n, couleur }] */
export function BarreEmpilee({ segments, vide }) {
  const total = segments.reduce(function (s, x) {
    return s + x.n;
  }, 0);
  if (total === 0) return <p className="m-0 text-[12px] text-muted2">{vide}</p>;

  return (
    <>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-line">
        {segments.map(function (s) {
          if (s.n === 0) return null;
          return (
            <div
              key={s.label}
              className="transition-[width] duration-700"
              style={{ width: `${(s.n / total) * 100}%`, background: s.couleur }}
              title={`${s.label} : ${s.n}`}
            />
          );
        })}
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
        {segments.map(function (s) {
          return (
            <div key={s.label} className="flex items-baseline gap-1.5">
              <span
                className="size-2 shrink-0 self-center rounded-sm"
                style={{ background: s.couleur }}
              />
              <span
                className="font-mono text-[15px] font-bold tabular-nums"
                style={{ color: s.couleur }}
              >
                {s.n}
              </span>
              <span className="truncate text-[10px] text-muted2">{s.label}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
