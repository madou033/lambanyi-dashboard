'use client';

/**
 * Une tournée, un jour donné.
 *
 * Tout ce qui se règle ici a deux portées possibles, et le formulaire force à
 * choisir : « ce jour seulement » (un remplaçant aujourd'hui, un départ
 * décalé une fois) ou « ce jour et les suivants » (une équipe qui change, une
 * heure qui change pour de bon). Confondre les deux, c'est soit perdre un
 * réglage permanent, soit propager un accident.
 *
 * La note, elle, ne vaut jamais que pour ce jour : c'est sa raison d'être.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Btn, Champ, Modal, nombre } from '@/components/ui';
import { ListeCollecteurs } from './ListeCollecteurs';
import { dateLongue, libelleJours } from './dates';

const OCCURRENCE = {
  planifiee: { ton: 'muted', libelle: 'Planifiée' },
  en_cours: { ton: 'vert', libelle: 'En cours' },
  terminee: { ton: 'teal', libelle: 'Terminée' },
  non_faite: { ton: 'rouge', libelle: 'Non faite' },
  suspendue: { ton: 'or', libelle: 'Suspendue' },
};

/** Les deux tableaux portent-ils les mêmes identifiants ? */
function memeEquipe(a, b) {
  return a.length === b.length && a.every(function (x) { return b.includes(x); });
}

export function ModaleOccurrence({ occurrence, serie, collecteurs, passee, onFermer, onFait }) {
  const equipeInitiale = occurrence.collecteurs_ids || [];
  const [heure, setHeure] = useState(occurrence.heure_du_jour ? String(occurrence.heure_debut).slice(0, 5) : '');
  const [note, setNote] = useState(occurrence.note || '');
  const [equipe, setEquipe] = useState(equipeInitiale);
  const [portee, setPortee] = useState('jour');
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  const def = OCCURRENCE[occurrence.statut] || OCCURRENCE.planifiee;
  const suspendue = occurrence.statut === 'suspendue';
  const pointee = (occurrence.collectes || 0) + (occurrence.absents || 0) + (occurrence.inaccessibles || 0) > 0;

  async function agir(action) {
    setMessage(null);
    setEnCours(true);
    try {
      const error = await action();
      if (error) {
        setMessage(error.message);
        return;
      }
      onFait();
    } finally {
      setEnCours(false);
    }
  }

  /** Ce jour seulement : on écrit sur l'occurrence, sans toucher à la série. */
  async function enregistrerJour() {
    const ligne = {
      tournee_id: occurrence.tournee_id,
      jour: occurrence.jour,
      heure_debut: heure || null,
      note: note.trim() || null,
    };
    const occ = await supabase
      .from('tournees_occurrences')
      .upsert(ligne, { onConflict: 'tournee_id,jour' })
      .select('id')
      .single();
    if (occ.error) return occ.error;

    // L'équipe du jour n'est écrite que si elle diffère du planning : sinon
    // la tournée suit la série, et une réaffectation s'y reflète d'elle-même.
    const planifiee = (serie?.tournees_collecteurs || []).map(function (x) { return x.collecteur_id; });
    const vider = await supabase
      .from('tournees_occurrences_collecteurs')
      .delete()
      .eq('occurrence_id', occ.data.id);
    if (vider.error) return vider.error;

    if (!memeEquipe(equipe, planifiee) && equipe.length) {
      const remplir = await supabase
        .from('tournees_occurrences_collecteurs')
        .insert(equipe.map(function (c) { return { occurrence_id: occ.data.id, collecteur_id: c }; }));
      if (remplir.error) return remplir.error;
    }
    return null;
  }

  /** Ce jour et les suivants : la série change, son avenir intact se refait. */
  async function enregistrerSerie() {
    const { error } = await supabase.rpc('modifier_serie', {
      p_tournee_id: occurrence.tournee_id,
      p_heure_debut: heure || null,
      p_collecteurs: equipe,
      p_depuis: occurrence.jour,
    });
    if (error) return error;
    // La note reste du jour : elle ne se propage pas.
    if ((note.trim() || null) !== (occurrence.note || null)) {
      const r = await supabase
        .from('tournees_occurrences')
        .update({ note: note.trim() || null })
        .eq('id', occurrence.occurrence_id);
      if (r.error) return r.error;
    }
    return null;
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={`${occurrence.quartier} · ${dateLongue(occurrence.jour)}`}
      sousTitre={
        serie
          ? `Tournée de ${String(serie.heure_debut).slice(0, 5)}, ${libelleJours(serie.jours_semaine)}${serie.date_fin ? ` jusqu’au ${dateLongue(serie.date_fin)}` : ' — sans fin'}.`
          : null
      }
      taille="lg"
      bloquerFermeture={enCours}
      pied={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Btn variant="ghost" disabled={enCours} onClick={onFermer}>Fermer</Btn>
          <Btn
            variant="green"
            disabled={enCours}
            onClick={function () { agir(portee === 'jour' ? enregistrerJour : enregistrerSerie); }}
          >
            {enCours ? 'Enregistrement…' : portee === 'jour' ? 'Enregistrer ce jour' : 'Enregistrer ce jour et les suivants'}
          </Btn>
        </div>
      }
    >
      {message ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {message}
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge ton={def.ton}>{def.libelle}</Badge>
        {occurrence.hors_serie ? <Badge ton="bleu">Rattrapage</Badge> : null}
        {occurrence.equipe_modifiee ? <Badge ton="bleu">Équipe du jour</Badge> : null}
        {occurrence.heure_du_jour ? <Badge ton="bleu">Heure du jour</Badge> : null}
        {pointee ? (
          <span className="text-[12px] text-muted">
            {nombre(occurrence.collectes)} / {nombre(occurrence.a_desservir)} collectés ·{' '}
            {nombre((occurrence.absents || 0) + (occurrence.inaccessibles || 0))} non collectés
          </span>
        ) : null}
      </div>

      {/* La portée : ce que l'enregistrement va toucher. */}
      <fieldset className="mb-5 rounded-xl border border-line p-3">
        <legend className="px-1 text-[10px] tracking-[1.6px] text-muted uppercase">Portée</legend>
        <div className="flex flex-col gap-2">
          {[
            { code: 'jour', titre: 'Ce jour seulement', sous: 'Un remplaçant, un départ décalé, une suspension d’un jour.' },
            { code: 'suivants', titre: 'Ce jour et les suivants', sous: 'L’heure et l’équipe deviennent celles de la tournée. Les jours déjà réglés à la main ne bougent pas.' },
          ].map(function (p) {
            return (
              <label key={p.code} className="flex cursor-pointer items-start gap-2.5 text-[12.5px]">
                <input
                  type="radio"
                  name="portee"
                  checked={portee === p.code}
                  disabled={enCours || passee}
                  onChange={function () { setPortee(p.code); }}
                  className="mt-0.5 size-4 cursor-pointer accent-[var(--lp-green)]"
                />
                <span>
                  <span className="font-semibold text-txt">{p.titre}</span>
                  <span className="block text-[11px] text-muted2">{p.sous}</span>
                </span>
              </label>
            );
          })}
        </div>
        {passee ? (
          <p className="mt-2 mb-0 text-[11px] text-muted2">
            Cette tournée est passée : seul ce jour peut encore être corrigé.
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Heure de début</span>
          <Champ type="time" value={heure} onChange={function (e) { setHeure(e.target.value); }} />
          <span className="mt-1.5 block text-[11px] text-muted2">
            {portee === 'jour'
              ? `Vide = l’heure de la tournée (${serie ? String(serie.heure_debut).slice(0, 5) : '—'}).`
              : 'Devient l’heure de la tournée.'}
          </span>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
            Note (visible par le collecteur)
          </span>
          <Champ
            value={note}
            placeholder="Jour férié, panne de charrette, rue barrée…"
            onChange={function (e) { setNote(e.target.value); }}
          />
          <span className="mt-1.5 block text-[11px] text-muted2">Ne vaut que pour ce jour.</span>
        </label>

        <div className="block sm:col-span-2">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
            {portee === 'jour' ? 'Équipe ce jour' : 'Équipe de la tournée'}
          </span>
          <ListeCollecteurs
            collecteurs={collecteurs || []}
            choisis={equipe}
            disabled={enCours}
            onChange={setEquipe}
            vide="Aucun collecteur disponible."
          />
        </div>
      </div>

      {/* Les gestes qui retirent, séparés de l'enregistrement. */}
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        <Btn
          variant={suspendue ? 'green' : 'ghost'}
          disabled={enCours}
          onClick={function () {
            agir(async function () {
              const { error } = await supabase
                .from('tournees_occurrences')
                .upsert(
                  {
                    tournee_id: occurrence.tournee_id,
                    jour: occurrence.jour,
                    statut: suspendue ? 'planifiee' : 'suspendue',
                    note: note.trim() || null,
                  },
                  { onConflict: 'tournee_id,jour' },
                );
              return error;
            });
          }}
        >
          {suspendue ? 'Rétablir ce jour' : 'Suspendre ce jour'}
        </Btn>

        <Btn
          variant="ghost"
          disabled={enCours || pointee}
          onClick={function () {
            agir(async function () {
              const { error } = await supabase.rpc('retirer_occurrence', {
                p_occurrence_id: occurrence.occurrence_id,
              });
              return error;
            });
          }}
        >
          Retirer du calendrier
        </Btn>

        <div className="flex-1" />

        <Btn
          variant="red"
          disabled={enCours || passee}
          onClick={function () {
            agir(async function () {
              const { error } = await supabase.rpc('arreter_serie', {
                p_tournee_id: occurrence.tournee_id,
                p_depuis: occurrence.jour,
              });
              return error;
            });
          }}
        >
          Arrêter la tournée à partir de ce jour
        </Btn>
      </div>
      <p className="mt-2 mb-0 text-[11px] text-muted2">
        « Retirer » efface ce seul jour. « Arrêter » supprime toutes les tournées à venir de cette
        série ; les jours déjà pointés et l’historique restent.
      </p>
    </Modal>
  );
}
