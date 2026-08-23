'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/components/ui';
import { IconDeconnexion, IconMarque, IconPunaise, IconUtilisateur } from '@/components/icons';
import { LIENS_DISPONIBLES, SECTIONS_NAV, lienEstActif } from '@/lib/navigation';

/**
 * Barre de navigation — cf. DESIGN_SYSTEM.md §3.
 *
 * Deux régimes, commandés par la punaise du panneau (ou Alt+B) :
 *  · épinglée → le panneau de 268 px occupe sa colonne, le contenu se décale ;
 *  · détachée → un rail de 56 px, et le panneau se révèle PAR-DESSUS le
 *               contenu au survol ou au focus, sans le décaler.
 *
 * La commande vit DANS le panneau qu'elle épingle, et non sur la bordure :
 * on épingle ce qu'on est en train de regarder.
 *
 * Le panneau n'est pas une liste de liens : chaque destination porte son
 * chiffre du moment, de sorte que la navigation renseigne avant le clic.
 */

export const LARGEUR_RAIL = 56;
export const LARGEUR_PANNEAU = 268;

const CLE_EPINGLE = 'lp_sidebar_epinglee';

/* ------------------------------------------------------------------ */
/* Briques                                                             */
/* ------------------------------------------------------------------ */

function Badge({ info, className }) {
  if (!info || info.valeur <= 0) return null;
  return (
    <span
      key={info.valeur}
      className={cn(
        'grid min-w-[18px] shrink-0 place-items-center rounded-full px-1 py-px font-mono text-[10px] leading-[14px] font-bold tabular-nums',
        info.pulse
          ? 'motion-safe:animate-[lp-badge-pop_.25s_ease-out,lp-pulse-red_1.6s_.25s_infinite]'
          : 'motion-safe:animate-[lp-badge-pop_.25s_ease-out]',
        info.tone === 'rouge' ? 'bg-red text-white' : 'bg-gold text-[#1a1406]',
        className,
      )}
    >
      {info.valeur > 99 ? '99+' : info.valeur}
    </span>
  );
}

/** Compteur discret — le chiffre du moment d'une destination. */
function Compte({ valeur, attenue }) {
  if (valeur == null) return null;
  return (
    <span
      className={cn(
        'shrink-0 font-mono text-[11px] tabular-nums transition-colors duration-150',
        attenue ? 'text-muted2 group-hover/lien:text-muted' : 'text-muted',
      )}
    >
      {valeur > 999 ? `${Math.floor(valeur / 1000)}k` : valeur}
    </span>
  );
}

/** Badge le plus urgent d'une section (rouge prioritaire sur or). */
function badgeDeSection(section, badges) {
  const actifs = section.liens
    .map(function (l) {
      return badges[l.to];
    })
    .filter(function (b) {
      return b && b.valeur > 0;
    });
  return (
    actifs.find(function (b) {
      return b.tone === 'rouge';
    }) ?? actifs[0]
  );
}

function indexRaccourci(lien) {
  const i = LIENS_DISPONIBLES.findIndex(function (l) {
    return l.to === lien.to;
  });
  return i >= 0 ? i + 1 : undefined;
}

/* ------------------------------------------------------------------ */
/* Rail — la couche compacte                                           */
/* ------------------------------------------------------------------ */

/**
 * Purement visuel : le panneau porte la navigation réelle, accessible au
 * clavier. Dupliquer les liens ici doublerait l'arbre pour un lecteur d'écran.
 */
function Rail({ badges, pathname, initiales }) {
  return (
    <div aria-hidden className="flex h-full flex-col items-center px-2">
      <div className="flex h-[60px] shrink-0 items-center">
        <span className="grid size-[34px] place-items-center rounded-[10px] bg-green shadow-[0_4px_12px_color-mix(in_srgb,var(--lp-green)_35%,transparent)]">
          <IconMarque className="size-[18px]" />
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-1 pt-2">
        {SECTIONS_NAV.map(function (section) {
          const Icon = section.Icon;
          const actif = section.liens.some(function (l) {
            return lienEstActif(pathname, l);
          });
          return (
            <span
              key={section.id}
              className={cn(
                'relative grid size-10 place-items-center rounded-xl transition-colors duration-150',
                actif ? 'bg-panel2 text-green' : 'text-muted',
              )}
            >
              {actif ? (
                <span className="absolute top-1/2 -left-2 h-6 w-[3px] origin-center -translate-y-1/2 rounded-r-full bg-green motion-safe:animate-[lp-indicator_.22s_ease-out]" />
              ) : null}
              <Icon className="size-[19px]" />
              <Badge info={badgeDeSection(section, badges)} className="absolute -top-1 -right-1" />
            </span>
          );
        })}
      </div>

      <div className="flex h-[60px] shrink-0 items-center">
        <span className="relative grid size-9 place-items-center rounded-full border border-line2 bg-panel2 font-mono text-[12px] font-bold text-txt">
          {initiales}
          <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-bg2 bg-teal" />
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau — la navigation chiffrée                                    */
/* ------------------------------------------------------------------ */

/**
 * Une destination : libellé, puis soit son badge d'alerte, soit son compteur
 * du moment. C'est ce chiffre qui distingue ce panneau d'une liste de liens.
 */
function SousLien({ lien, badge, compteur, actif }) {
  const raccourci = indexRaccourci(lien);
  const alerte = badge && badge.valeur > 0;
  return (
    <Link
      href={lien.to}
      aria-current={actif ? 'page' : undefined}
      className={cn(
        'group/lien flex items-center gap-2 rounded-lg py-[7px] pr-2 pl-2.5 text-[12.5px] outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-blue',
        actif
          ? 'bg-panel2 font-semibold text-txt'
          : lien.disponible
            ? 'text-muted hover:bg-panel hover:text-txt'
            : 'text-muted2 hover:bg-panel hover:text-muted',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 shrink-0 rounded-full transition-colors duration-150',
          actif ? 'bg-green' : 'bg-line2 group-hover/lien:bg-muted',
        )}
      />
      <span className="min-w-0 flex-1 truncate">{lien.label}</span>

      {lien.disponible && raccourci !== undefined ? (
        <kbd className="shrink-0 rounded border border-line2 px-1 font-mono text-[9px] text-muted opacity-0 transition-opacity duration-150 group-hover/lien:opacity-60">
          Alt {raccourci}
        </kbd>
      ) : null}

      {!lien.disponible ? (
        <span className="shrink-0 rounded border border-line2 px-1 py-px text-[8.5px] tracking-wide text-muted2 uppercase">
          bientôt
        </span>
      ) : alerte ? (
        <Badge info={badge} />
      ) : (
        <Compte valeur={compteur} attenue={!actif} />
      )}
    </Link>
  );
}

function Panneau({
  visible,
  epingle,
  onBasculerEpingle,
  badges,
  compteurs,
  pathname,
  nom,
  role,
  initiales,
  onDeconnexion,
  menuOuvert,
  setMenuOuvert,
}) {
  const menuRef = useRef(null);

  useEffect(
    function () {
      if (!menuOuvert) return undefined;
      function surPointeur(e) {
        if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOuvert(false);
      }
      document.addEventListener('pointerdown', surPointeur);
      return function () {
        document.removeEventListener('pointerdown', surPointeur);
      };
    },
    [menuOuvert, setMenuOuvert],
  );

  const ITEM =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-blue';

  return (
    <div
      style={{ width: LARGEUR_PANNEAU }}
      className={cn(
        'absolute inset-y-0 left-0 z-30 flex flex-col bg-bg2',
        'transition-[opacity,transform,box-shadow] duration-200 ease-out',
        visible ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-1 opacity-0',
        // L'ombre ne sert qu'à détacher le panneau du contenu qu'il recouvre :
        // épinglé, il occupe sa propre colonne et n'en a pas besoin.
        visible && !epingle
          ? 'border-r border-line2 shadow-[18px_0_50px_rgba(0,0,0,.45)]'
          : 'border-r border-line',
      )}
    >
      {/* Marque — le pictogramme reste exactement à la place qu'il occupe dans
          le rail, seul le texte apparaît : le panneau se lit comme une
          croissance du rail, pas comme un calque distinct. */}
      <div className="flex h-[60px] shrink-0 items-center gap-2.5 px-2">
        <span className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-green shadow-[0_4px_12px_color-mix(in_srgb,var(--lp-green)_35%,transparent)]">
          <IconMarque className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-bold tracking-wide text-txt">
            Lambanyi Propre
          </span>
          <span className="mt-0.5 block truncate text-[9px] tracking-[1.8px] text-muted uppercase">
            Assainissement · Commune
          </span>
        </span>

        {/* Punaise — premier élément focusable du panneau, pour qu'un
            utilisateur au clavier puisse l'épingler dès qu'il y entre. */}
        <button
          type="button"
          onClick={onBasculerEpingle}
          aria-pressed={epingle}
          aria-label={epingle ? 'Détacher la barre de navigation' : 'Épingler la barre de navigation'}
          title={epingle ? 'Détacher (Alt+B)' : 'Épingler (Alt+B)'}
          className={cn(
            'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg outline-none transition-colors duration-150',
            'focus-visible:ring-2 focus-visible:ring-blue',
            epingle
              ? 'bg-panel2 text-green hover:brightness-110'
              : 'text-muted2 hover:bg-panel hover:text-txt',
          )}
        >
          {/* Couchée quand la barre n'est pas retenue, droite quand elle l'est. */}
          <IconPunaise
            className={cn(
              'size-[15px] transition-transform duration-200',
              !epingle && 'rotate-45',
            )}
          />
        </button>
      </div>

      <nav
        aria-label="Navigation principale"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2 pt-2 pb-3"
      >
        {SECTIONS_NAV.map(function (section) {
          const Icon = section.Icon;
          const actif = section.liens.some(function (l) {
            return lienEstActif(pathname, l);
          });
          const solo = section.liens.length === 1;

          // Une section à lien unique n'a pas besoin d'un en-tête en plus :
          // la ligne d'en-tête EST le lien.
          if (solo) {
            const lienSolo = section.liens[0];
            const badge = badges[lienSolo.to];
            return (
              <Link
                key={section.id}
                href={lienSolo.to}
                aria-current={actif ? 'page' : undefined}
                className={cn(
                  'group/lien flex items-center gap-2.5 rounded-xl px-2 py-1 outline-none transition-colors duration-150',
                  'hover:bg-panel focus-visible:ring-2 focus-visible:ring-blue',
                )}
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-150',
                    actif ? 'bg-panel2 text-green' : 'text-muted group-hover/lien:text-txt',
                  )}
                >
                  <Icon className="size-[19px]" />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[12.5px] transition-colors duration-150',
                    actif ? 'font-semibold text-txt' : 'text-muted group-hover/lien:text-txt',
                  )}
                >
                  {section.titre}
                </span>
                {badge && badge.valeur > 0 ? (
                  <Badge info={badge} />
                ) : (
                  <Compte valeur={compteurs[lienSolo.to]} attenue={!actif} />
                )}
                <span className="shrink-0 rounded border border-line2 px-1 py-px font-mono text-[8.5px] tracking-wider text-muted2">
                  {section.domaine}
                </span>
              </Link>
            );
          }

          return (
            <div key={section.id} className="pb-0.5">
              <div className="flex items-center gap-2.5 px-2 py-1">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-150',
                    actif ? 'bg-panel2 text-green' : 'text-muted',
                  )}
                >
                  <Icon className="size-[19px]" />
                </span>
                <span
                  className={cn(
                    'min-w-0 flex-1 truncate text-[10px] tracking-[1.5px] uppercase',
                    actif ? 'text-txt' : 'text-muted2',
                  )}
                >
                  {section.titre}
                </span>
                <span className="shrink-0 rounded border border-line2 px-1 py-px font-mono text-[8.5px] tracking-wider text-muted2">
                  {section.domaine}
                </span>
              </div>
              {/* Le filet passe au vert sur la section courante : un fil continu
                  relie l'icône active à ses destinations. */}
              <div
                className={cn(
                  'ml-[27px] flex flex-col gap-0.5 border-l pl-3 transition-colors duration-200',
                  actif ? 'border-green/50' : 'border-line2',
                )}
              >
                {section.liens.map(function (lien) {
                  return (
                    <SousLien
                      key={lien.to}
                      lien={lien}
                      badge={badges[lien.to]}
                      compteur={compteurs[lien.to]}
                      actif={lienEstActif(pathname, lien)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Profil */}
      <div ref={menuRef} className="relative shrink-0 border-t border-line px-2 py-2">
        {menuOuvert ? (
          <div
            role="menu"
            className="absolute right-2 bottom-[calc(100%+6px)] left-2 z-10 rounded-xl border border-line2 bg-panel p-1.5 shadow-[0_14px_40px_rgba(0,0,0,.45)] motion-safe:animate-[lp-rise_.18s_ease-out]"
          >
            <Link
              href="/dashboard/profil"
              role="menuitem"
              onClick={function () {
                setMenuOuvert(false);
              }}
              className={cn(ITEM, 'text-muted hover:bg-panel2 hover:text-txt')}
            >
              <IconUtilisateur className="size-4" /> Mon profil
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={function () {
                setMenuOuvert(false);
                onDeconnexion();
              }}
              className={cn(
                ITEM,
                'text-red hover:bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)]',
              )}
            >
              <IconDeconnexion className="size-4" /> Se déconnecter
            </button>
          </div>
        ) : null}

        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOuvert}
          onClick={function () {
            setMenuOuvert(function (v) {
              return !v;
            });
          }}
          className={cn(
            'flex w-full cursor-pointer items-center gap-2.5 rounded-xl p-1 text-left outline-none transition-colors',
            'hover:bg-panel focus-visible:ring-2 focus-visible:ring-blue',
            menuOuvert && 'bg-panel',
          )}
        >
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full border border-line2 bg-panel2 font-mono text-[12px] font-bold text-txt">
            {initiales}
            <span
              aria-hidden
              className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-bg2 bg-teal"
            />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-txt">{nom}</span>
            <span className="block truncate text-[10px] text-muted">{role ?? 'En session'}</span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aside                                                               */
/* ------------------------------------------------------------------ */

export function Sidebar({
  epingle,
  onBasculerEpingle,
  badges = {},
  compteurs = {},
  nom,
  role,
  initiales,
  onDeconnexion,
}) {
  const pathname = usePathname();
  const [survol, setSurvol] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [routeVue, setRouteVue] = useState(pathname);
  const asideRef = useRef(null);

  const visible = epingle || survol;

  const replier = useCallback(function () {
    setSurvol(false);
    setMenuOuvert(false);
  }, []);

  // Le panneau volant se referme au changement d'écran. Ajustement pendant le
  // rendu plutôt qu'un effet, qui déclencherait un rendu en cascade.
  if (routeVue !== pathname) {
    setRouteVue(pathname);
    setSurvol(false);
    setMenuOuvert(false);
  }

  useEffect(
    function () {
      if (!survol) return undefined;
      function surTouche(e) {
        if (e.key !== 'Escape') return;
        setSurvol(false);
        setMenuOuvert(false);
        // Sort du panneau, sinon le focus le rouvre aussitôt.
        if (asideRef.current?.contains(document.activeElement)) document.activeElement.blur();
      }
      window.addEventListener('keydown', surTouche);
      return function () {
        window.removeEventListener('keydown', surTouche);
      };
    },
    [survol],
  );

  function surBlur(e) {
    // Ne referme que si le focus quitte réellement la barre.
    if (asideRef.current && !asideRef.current.contains(e.relatedTarget)) replier();
  }

  return (
    <aside
      ref={asideRef}
      data-theme="dark"
      style={{ width: epingle ? LARGEUR_PANNEAU : LARGEUR_RAIL }}
      onMouseEnter={function () {
        if (!epingle) setSurvol(true);
      }}
      onMouseLeave={replier}
      onFocus={function () {
        if (!epingle) setSurvol(true);
      }}
      onBlur={surBlur}
      className={cn(
        'relative z-40 row-span-2 bg-bg2 transition-[width] duration-300 ease-out',
        !epingle && 'border-r border-line',
      )}
    >
      {!epingle ? <Rail badges={badges} pathname={pathname} initiales={initiales} /> : null}

      <Panneau
        visible={visible}
        epingle={epingle}
        onBasculerEpingle={onBasculerEpingle}
        badges={badges}
        compteurs={compteurs}
        pathname={pathname}
        nom={nom}
        role={role}
        initiales={initiales}
        onDeconnexion={onDeconnexion}
        menuOuvert={menuOuvert}
        setMenuOuvert={setMenuOuvert}
      />
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* État épinglé — persistant + Alt+B                                   */
/* ------------------------------------------------------------------ */

export function useSidebarEpinglee() {
  // Démarre repliée pour rester identique au rendu serveur ; la préférence
  // stockée est appliquée juste après le montage.
  const [epingle, setEpingle] = useState(false);

  useEffect(function () {
    const id = window.setTimeout(function () {
      try {
        if (localStorage.getItem(CLE_EPINGLE) === '1') setEpingle(true);
      } catch {
        /* stockage indisponible */
      }
    }, 0);
    return function () {
      window.clearTimeout(id);
    };
  }, []);

  const basculer = useCallback(function () {
    setEpingle(function (v) {
      const suivant = !v;
      try {
        localStorage.setItem(CLE_EPINGLE, suivant ? '1' : '0');
      } catch {
        /* stockage indisponible */
      }
      return suivant;
    });
  }, []);

  useEffect(
    function () {
      function surTouche(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key !== 'b' && e.key !== 'B') return;
        e.preventDefault();
        basculer();
      }
      window.addEventListener('keydown', surTouche);
      return function () {
        window.removeEventListener('keydown', surTouche);
      };
    },
    [basculer],
  );

  return { epingle, basculer };
}

/* ------------------------------------------------------------------ */
/* Raccourcis Alt+1…9 — accès direct aux écrans livrés                 */
/* ------------------------------------------------------------------ */

export function useRaccourcisNav() {
  const router = useRouter();
  useEffect(
    function () {
      function surTouche(e) {
        if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        const index = Number.parseInt(e.key, 10) - 1;
        if (Number.isNaN(index) || index < 0 || index >= LIENS_DISPONIBLES.length) return;
        e.preventDefault();
        router.push(LIENS_DISPONIBLES[index].to);
      }
      window.addEventListener('keydown', surTouche);
      return function () {
        window.removeEventListener('keydown', surTouche);
      };
    },
    [router],
  );
}
