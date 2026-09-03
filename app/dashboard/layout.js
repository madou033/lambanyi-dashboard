'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/components/ui';
import { useTheme } from '@/components/ThemeProvider';
import {
  IconDeconnexion,
  IconLune,
  IconRecherche,
  IconSoleil,
  IconUtilisateur,
} from '@/components/icons';
import {
  LARGEUR_PANNEAU,
  LARGEUR_RAIL,
  Sidebar,
  useRaccourcisNav,
  useSidebarEpinglee,
} from '@/components/Sidebar';
import { PaletteCommandes } from '@/components/PaletteCommandes';
import { ContexteProvider, useContexte } from '@/components/ContexteProvider';

/* ------------------------------------------------------------------ */
/* Utilitaires                                                         */
/* ------------------------------------------------------------------ */

function horlogeLocale() {
  return new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function initialesDe(nomComplet, secours) {
  const parts = String(nomComplet ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return String(secours ?? 'AG')
    .slice(0, 2)
    .toUpperCase();
}

const LIBELLES_ROLE = {
  admin: 'Administrateur',
  superviseur: 'Superviseur',
  observateur_regional: 'Observateur régional',
  gerant_pme: 'Gérant PME',
  collecteur: 'Collecteur',
  citoyen: 'Citoyen',
};

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

export default function DashboardLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="grid h-full place-items-center bg-bg">
          <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
            Ouverture de la session…
          </p>
        </div>
      }
    >
      <ContexteProvider>
        <DashboardShell>{children}</DashboardShell>
      </ContexteProvider>
    </Suspense>
  );
}

function DashboardShell({ children }) {
  const router = useRouter();
  const { theme, basculer } = useTheme();
  const { ctx, profil, communeLecture } = useContexte();
  const emailSession = null;
  const [enLigne, setEnLigne] = useState(true);
  const [horloge, setHorloge] = useState('--:--:--');
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [badges, setBadges] = useState({});
  const [compteurs, setCompteurs] = useState({});

  const { epingle, basculer: basculerEpingle } = useSidebarEpinglee();
  useRaccourcisNav(ctx);

  const seDeconnecter = useCallback(
    async function () {
      await supabase.auth.signOut();
      router.push('/login');
    },
    [router],
  );

  /* Horloge — démarrée après montage pour ne pas diverger du rendu serveur */
  useEffect(function () {
    function majHorloge() {
      setHorloge(horlogeLocale());
    }
    // Première pose différée d'un tick : écrire l'état synchroniquement dans
    // l'effet provoquerait un rendu en cascade au montage.
    const amorce = window.setTimeout(majHorloge, 0);
    const id = window.setInterval(majHorloge, 1000);
    return function () {
      window.clearTimeout(amorce);
      window.clearInterval(id);
    };
  }, []);

  /* Alertes et compteurs de navigation — ce sont eux qui font du panneau un
     instrument de pilotage plutôt qu'une liste de liens. */
  useEffect(function () {
    let annule = false;
    const nb = function (r) {
      return r.count || 0;
    };
    async function charger() {
      const communeId = ctx?.lectureCommuneId || null;
      const requeteSignalements = communeId
        ? supabase
            .from('signalements')
            .select('id, quartiers!inner(commune_id)', { count: 'exact', head: true })
            .eq('quartiers.commune_id', communeId)
            .in('statut', ['nouveau', 'en_cours'])
        : supabase
            .from('signalements')
            .select('id', { count: 'exact', head: true })
            .in('statut', ['nouveau', 'en_cours']);
      const requetePaiements = communeId
        ? supabase
            .from('paiements')
            .select('id, menages!inner(commune_id)', { count: 'exact', head: true })
            .eq('menages.commune_id', communeId)
            .in('statut', ['initie', 'en_attente'])
        : supabase
            .from('paiements')
            .select('id', { count: 'exact', head: true })
            .in('statut', ['initie', 'en_attente']);
      const requeteCollecteurs = supabase
        .from('profils')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'collecteur')
        .eq('actif', true);
      if (communeId) requeteCollecteurs.eq('commune_id', communeId);
      const requeteTournees = communeId
        ? supabase
            .from('tournees')
            .select('id, quartiers!inner(commune_id)', { count: 'exact', head: true })
            .eq('quartiers.commune_id', communeId)
            .eq('actif', true)
        : supabase.from('tournees').select('id', { count: 'exact', head: true }).eq('actif', true);
      const requetePoints = communeId
        ? supabase
            .from('points_depot')
            .select('id, quartiers!inner(commune_id)', { count: 'exact', head: true })
            .eq('quartiers.commune_id', communeId)
            .eq('actif', true)
        : supabase
            .from('points_depot')
            .select('id', { count: 'exact', head: true })
            .eq('actif', true);
      const requeteTarifs = supabase
        .from('plans_tarifaires')
        .select('id', { count: 'exact', head: true })
        .eq('actif', true);
      if (communeId) requeteTarifs.eq('commune_id', communeId);
      const [
        signalements,
        paiements,
        menages,
        qr,
        collecteurs,
        tournees,
        points,
        tarifs,
        pmes,
      ] = await Promise.all([
        requeteSignalements,
        requetePaiements,
        (ctx?.lectureCommuneId
          ? supabase
              .from('menages')
              .select('id', { count: 'exact', head: true })
              .eq('commune_id', ctx.lectureCommuneId)
          : supabase.from('menages').select('id', { count: 'exact', head: true })),
        supabase
          .from('menages')
          .select('id', { count: 'exact', head: true })
          .not('code_menage', 'is', null),
        requeteCollecteurs,
        requeteTournees,
        requetePoints,
        requeteTarifs,
        supabase.from('pme').select('id', { count: 'exact', head: true }).eq('actif', true),
      ]);
      if (annule) return;

      setEnLigne(!(signalements.error || paiements.error));
      setBadges({
        '/dashboard/signalements': {
          valeur: nb(signalements),
          tone: 'rouge',
          pulse: nb(signalements) > 0,
        },
        '/dashboard/paiements': { valeur: nb(paiements), tone: 'or' },
      });
      setCompteurs({
        '/dashboard/menages': nb(menages),
        '/dashboard/qr-menages': nb(qr),
        '/dashboard/collecteurs': nb(collecteurs),
        '/dashboard/tournees': nb(tournees),
        '/dashboard/points-depot': nb(points),
        '/dashboard/tarifs': nb(tarifs),
        '/dashboard/pme': nb(pmes),
      });
    }
    charger();
    const id = window.setInterval(charger, 30_000);
    return function () {
      annule = true;
      window.clearInterval(id);
    };
  }, [ctx]);

  /* Ctrl/Cmd+K — palette de commandes */
  useEffect(function () {
    function surTouche(e) {
      if (!(e.key === 'k' || e.key === 'K')) return;
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.altKey) return;
      e.preventDefault();
      setPaletteOuverte(function (v) {
        return !v;
      });
    }
    window.addEventListener('keydown', surTouche);
    return function () {
      window.removeEventListener('keydown', surTouche);
    };
  }, []);

  const actionsPalette = useMemo(
    function () {
      return [
        {
          id: 'profil',
          label: 'Mon profil',
          description: 'Compte et préférences',
          Icon: IconUtilisateur,
          executer: function () {
            router.push('/dashboard/profil');
          },
        },
        {
          id: 'theme',
          label: theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre',
          description: 'Apparence du dashboard',
          Icon: theme === 'dark' ? IconSoleil : IconLune,
          executer: basculer,
        },
        {
          id: 'deconnexion',
          label: 'Se déconnecter',
          description: 'Fermer la session',
          Icon: IconDeconnexion,
          executer: seDeconnecter,
          danger: true,
        },
      ];
    },
    [theme, basculer, router, seDeconnecter],
  );

  const role = profil ? (LIBELLES_ROLE[profil.role] ?? profil.role) : null;
  const nomBrut = String(profil?.nom_complet ?? '').trim();
  const roleTexte = String(role ?? '').trim();
  const pseudoEmail = emailSession ? emailSession.split('@')[0] : null;
  const nom =
    !nomBrut || (roleTexte && nomBrut.toLowerCase() === roleTexte.toLowerCase())
      ? pseudoEmail || 'Agent'
      : nomBrut;
  const initiales = initialesDe(nom, 'AG');

  if (!profil || !ctx) {
    return (
      <div className="grid h-full place-items-center bg-bg">
        <p className="font-mono text-[12px] tracking-[2px] text-muted2 uppercase">
          Ouverture de la session…
        </p>
      </div>
    );
  }

  const territoire =
    ctx.niveau === 'region'
      ? ctx.lectureCommuneId
        ? `Conakry → ${communeLecture?.nom ?? ctx.lectureCommuneId}`
        : 'Région de Conakry'
      : ctx.niveau === 'pme'
        ? profil.pme?.nom ?? 'PME'
        : profil.communes?.nom ?? 'Commune';

  return (
    <div
      className="grid h-full grid-rows-[60px_1fr] transition-[grid-template-columns] duration-300 ease-out"
      style={{ gridTemplateColumns: `${epingle ? LARGEUR_PANNEAU : LARGEUR_RAIL}px 1fr` }}
    >
      {/* Épinglée, la barre occupe sa colonne ; repliée, elle se réduit au rail
          et son panneau se révèle par-dessus le contenu sans le décaler. */}
      <Sidebar
        epingle={epingle}
        onBasculerEpingle={basculerEpingle}
        badges={badges}
        compteurs={compteurs}
        ctx={ctx}
        nom={nom}
        role={role}
        initiales={initiales}
        onDeconnexion={seDeconnecter}
      />

      <header className="lp-topbar flex items-center gap-3.5 border-b border-line px-4">
        <div className="hidden rounded-full border border-line2 px-3 py-1 font-mono text-[12px] tracking-wide text-green sm:block">
          {ctx.niveau === 'region' && ctx.lectureCommuneId ? (
            <Link
              href="/dashboard"
              className="cursor-pointer text-txt outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              <span className="text-[10px] tracking-[1.5px] text-muted2 uppercase">Conakry</span>
              <b className="ml-1.5">{`→ ${communeLecture?.nom ?? ctx.lectureCommuneId}`}</b>
            </Link>
          ) : (
            <>
              <span className="text-[10px] tracking-[1.5px] text-muted2 uppercase">Conakry</span>
              <b className="ml-1.5 text-txt">
                {ctx.niveau === 'region' ? 'Région' : territoire}
              </b>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={function () {
            setPaletteOuverte(true);
          }}
          aria-keyshortcuts="Control+K Meta+K"
          aria-haspopup="dialog"
          title="Rechercher une page (Ctrl K)"
          className={cn(
            'group flex min-w-0 max-w-md flex-1 cursor-pointer items-center gap-2.5 rounded-xl border border-line2 bg-panel px-3 py-1.5 text-left outline-none transition-colors',
            'hover:border-muted focus-visible:ring-2 focus-visible:ring-blue',
          )}
        >
          <IconRecherche className="size-3.5 shrink-0 text-muted group-hover:text-txt" />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted group-hover:text-txt">
            Rechercher…
          </span>
          <kbd className="hidden shrink-0 rounded border border-line2 px-1.5 py-0.5 font-mono text-[10px] text-muted2 sm:inline">
            Ctrl K
          </kbd>
        </button>

        <div className="flex-1" />

        <div className="hidden items-center gap-1.5 text-[11.5px] text-muted md:flex">
          <span
            className={cn(
              'size-2 rounded-full',
              enLigne ? 'bg-teal motion-safe:animate-[lp-pulse_2s_infinite]' : 'bg-red',
            )}
          />
          {enLigne ? 'Base en ligne' : 'Base hors ligne'}
        </div>

        <div className="font-mono text-[19px] tracking-wide text-txt tabular-nums">{horloge}</div>

        <button
          type="button"
          onClick={basculer}
          title={theme === 'dark' ? 'Passer en clair' : 'Passer en sombre'}
          aria-label="Basculer le thème"
          className="cursor-pointer rounded-lg border border-line2 bg-panel px-2.5 py-1.5 text-muted outline-none transition-colors hover:text-txt focus-visible:ring-2 focus-visible:ring-blue"
        >
          {theme === 'dark' ? <IconSoleil className="size-4" /> : <IconLune className="size-4" />}
        </button>
      </header>

      <main className="min-w-0 overflow-auto px-5 py-4 pb-8">{children}</main>

      <PaletteCommandes
        ouvert={paletteOuverte}
        onFermer={function () {
          setPaletteOuverte(false);
        }}
        onNaviguer={function (to) {
          router.push(to);
        }}
        actions={actionsPalette}
        ctx={ctx}
      />
    </div>
  );
}
