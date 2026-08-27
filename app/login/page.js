'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Btn, Champ, cn } from '@/components/ui';
import { IconMarque } from '@/components/icons';

const ROLES_AUTORISES = ['admin', 'superviseur'];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState(null);
  const [chargement, setChargement] = useState(false);

  async function seConnecter() {
    setErreur(null);
    setChargement(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: motDePasse,
    });

    if (error) {
      setErreur('Email ou mot de passe incorrect.');
      setChargement(false);
      return;
    }

    const { data: profil } = await supabase
      .from('profils')
      .select('role')
      .eq('id', data.user.id)
      .single();

    if (!profil || !ROLES_AUTORISES.includes(profil.role)) {
      await supabase.auth.signOut();
      setErreur('Accès réservé au personnel de la commune.');
      setChargement(false);
      return;
    }

    router.push('/dashboard');
  }

  function surTouche(e) {
    if (e.key === 'Enter' && !chargement) seConnecter();
  }

  return (
    <main className="grid h-full grid-cols-1 overflow-auto bg-bg lg:grid-cols-[1.1fr_1fr]">
      {/* Volet éditorial — masqué sur petit écran */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-bg2 p-10 lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, var(--lp-green) 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, var(--lp-green) 0 1px, transparent 1px 64px)',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-green text-encre shadow-[0_4px_12px_color-mix(in_srgb,var(--lp-green)_35%,transparent)]">
            <IconMarque className="size-[18px]" />
          </div>
          <div>
            <p className="m-0 text-[13.5px] font-bold tracking-wide text-txt">Lambanyi Propre</p>
            <span className="mt-0.5 block text-[9px] tracking-[1.8px] text-muted uppercase">
              Assainissement · Commune
            </span>
          </div>
        </div>

        <div className="relative max-w-md">
          <div className="text-[10px] tracking-[2.5px] text-muted2 uppercase">
            Dashboard communal
          </div>
          <h1 className="font-display m-0 mt-2 text-[38px] leading-[1.15] font-bold text-txt">
            Piloter la collecte, quartier par quartier.
          </h1>
          <p className="mt-3 mb-0 text-[13px] leading-relaxed text-muted">
            Registre des ménages, tournées de collecte, encaissements et signalements citoyens —
            réunis dans un seul poste de commande.
          </p>
        </div>

        <dl className="relative m-0 grid max-w-md grid-cols-3 gap-4 border-t border-line pt-6">
          {[
            { k: 'Ménages', v: 'Registre' },
            { k: 'Tournées', v: 'Terrain' },
            { k: 'Signalements', v: 'Citoyen' },
          ].map(function (x) {
            return (
              <div key={x.k}>
                <dt className="text-[9px] tracking-[1.6px] text-muted2 uppercase">{x.v}</dt>
                <dd className="m-0 mt-1 font-mono text-[13px] font-bold text-txt">{x.k}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      {/* Formulaire */}
      <section className="flex items-center justify-center p-6">
        <div className="lp-rise w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="grid size-[34px] shrink-0 place-items-center rounded-[10px] bg-green text-encre">
              <IconMarque className="size-[18px]" />
            </div>
            <p className="m-0 text-[13.5px] font-bold tracking-wide text-txt">Lambanyi Propre</p>
          </div>

          <div className="text-[10px] tracking-[2.5px] text-muted2 uppercase">Accès personnel</div>
          <h2 className="font-display m-0 mt-1 text-[27px] font-bold text-txt">Connexion</h2>
          <p className="mt-1.5 mb-7 text-[12.5px] text-muted">
            Réservé aux comptes administrateur et superviseur de la commune.
          </p>

          {erreur ? (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-3 text-[12.5px] text-txt"
            >
              {erreur}
            </div>
          ) : null}

          <label
            htmlFor="email"
            className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase"
          >
            Adresse email
          </label>
          <Champ
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={function (e) {
              setEmail(e.target.value);
            }}
            onKeyDown={surTouche}
            placeholder="vous@commune.gn"
            className="mb-4"
          />

          <label
            htmlFor="motdepasse"
            className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase"
          >
            Mot de passe
          </label>
          <Champ
            id="motdepasse"
            type="password"
            autoComplete="current-password"
            value={motDePasse}
            onChange={function (e) {
              setMotDePasse(e.target.value);
            }}
            onKeyDown={surTouche}
            placeholder="••••••••"
            className="mb-6"
          />

          <Btn
            variant="green"
            onClick={seConnecter}
            disabled={chargement || !email || !motDePasse}
            className={cn('w-full justify-center py-3')}
          >
            {chargement ? 'Connexion…' : 'Se connecter'}
          </Btn>

          <p className="mt-6 mb-0 text-center font-mono text-[10px] tracking-wide text-muted2">
            Commune de Lambanyi · Conakry
          </p>
        </div>
      </section>
    </main>
  );
}
