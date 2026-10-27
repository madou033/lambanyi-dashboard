'use client';

/**
 * Planifier : une série qui fabrique des jours, ou un rattrapage posé sur une
 * série existante.
 *
 * La récurrence et la portée sont les deux décisions du formulaire. Elles
 * répondent à deux questions distinctes : « quels jours de la semaine » et
 * « jusqu'à quand ». Une série sans fin est prolongée chaque nuit ; une série
 * bornée s'arrête, et la date de fin est affichée en clair pour que personne
 * ne découvre l'arrêt sur le terrain.
 */

import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Badge, Btn, Champ, Chip, Modal, Selecteur, cn } from '@/components/ui';
import { ListeCollecteurs } from './ListeCollecteurs';
import { JOURS, PORTEES, dateLongue, finDePortee, isoLocal, jourIso, libelleJours } from './dates';

const VIDE = {
  mode: 'serie',
  quartier_id: '',
  heure_debut: '07:00',
  depart: '',
  jours: [],
  portee: 'sans_fin',
  collecteurs: [],
  serie_id: '',
};

export function ModalePlanification({ ouvert, jour, quartiers, collecteurs, series, onFermer, onFait }) {
  const [form, setForm] = useState(VIDE);
  const [amorce, setAmorce] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState(null);

  // Réarme le formulaire quand la modale s'ouvre sur un autre jour : le jour
  // cliqué devient le départ, et son jour de semaine la première récurrence.
  const cle = `${ouvert}:${jour}`;
  if (ouvert && amorce !== cle) {
    const depart = jour || isoLocal();
    setAmorce(cle);
    setForm({ ...VIDE, depart, jours: [jourIso(depart)] });
    setMessage(null);
  }

  function maj(champ, valeur) {
    setForm(function (f) {
      return { ...f, [champ]: valeur };
    });
  }

  function basculerJour(iso) {
    setForm(function (f) {
      const dedans = f.jours.includes(iso);
      return { ...f, jours: dedans ? f.jours.filter(function (x) { return x !== iso; }) : f.jours.concat(iso) };
    });
  }

  const fin = useMemo(
    function () {
      return form.depart ? finDePortee(form.portee, form.depart) : null;
    },
    [form.portee, form.depart],
  );

  const seriesDuQuartier = useMemo(
    function () {
      return (series || []).filter(function (s) {
        return s.quartier_id === form.quartier_id;
      });
    },
    [series, form.quartier_id],
  );

  /** Ce que la planification va produire, dit en une phrase avant de valider. */
  const resume = useMemo(
    function () {
      if (!form.depart) return null;
      if (form.portee === 'jour' || form.jours.length === 0) {
        return `Une seule tournée, le ${dateLongue(form.depart)}.`;
      }
      const quand = libelleJours(form.jours);
      if (!fin) return `Chaque ${quand}, à partir du ${dateLongue(form.depart)}, sans fin.`;
      return `Chaque ${quand}, du ${dateLongue(form.depart)} au ${dateLongue(fin)}.`;
    },
    [form.depart, form.portee, form.jours, fin],
  );

  async function valider() {
    setMessage(null);
    if (!form.quartier_id) {
      setMessage('Le quartier est obligatoire.');
      return;
    }
    if (!form.depart) {
      setMessage('Le jour de départ est obligatoire.');
      return;
    }
    setEnCours(true);

    let error = null;
    if (form.mode === 'rattrapage') {
      if (!form.serie_id) {
        setEnCours(false);
        setMessage('Choisissez la tournée à laquelle rattacher ce rattrapage.');
        return;
      }
      ({ error } = await supabase.rpc('ajouter_occurrence', {
        p_tournee_id: form.serie_id,
        p_jour: form.depart,
        p_heure_debut: form.heure_debut || null,
      }));
    } else {
      // Un seul jour : aucune récurrence, la série se réduit à son départ.
      const unJour = form.portee === 'jour' || form.jours.length === 0;
      ({ error } = await supabase.rpc('planifier_tournee', {
        p_quartier_id: form.quartier_id,
        p_heure_debut: form.heure_debut,
        p_jours: unJour ? [] : form.jours,
        p_date_debut: form.depart,
        p_date_fin: unJour ? form.depart : fin,
        p_collecteurs: form.collecteurs,
      }));
    }

    setEnCours(false);
    if (error) {
      setMessage(`Erreur : ${error.message}`);
      return;
    }
    onFait();
  }

  return (
    <Modal
      ouvert={ouvert}
      onFermer={onFermer}
      titre={form.mode === 'rattrapage' ? 'Ajouter un rattrapage' : 'Planifier une tournée'}
      sousTitre={
        form.mode === 'rattrapage'
          ? 'Un passage exceptionnel, hors de la récurrence : aucune modification de la série ne l’effacera.'
          : 'Un jour de départ, des jours de la semaine, une portée. Le calendrier est écrit tout de suite.'
      }
      taille="lg"
      bloquerFermeture={enCours}
      pied={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11.5px] text-muted2">{resume}</span>
          <div className="flex gap-2">
            <Btn variant="ghost" disabled={enCours} onClick={onFermer}>Annuler</Btn>
            <Btn variant="green" disabled={enCours} onClick={valider}>
              {enCours ? 'Enregistrement…' : form.mode === 'rattrapage' ? 'Ajouter' : 'Planifier'}
            </Btn>
          </div>
        </div>
      }
    >
      {message ? (
        <p className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--lp-red)_45%,transparent)] bg-[color-mix(in_srgb,var(--lp-red)_14%,transparent)] px-4 py-2.5 text-[12.5px] text-txt">
          {message}
        </p>
      ) : null}

      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Mode">
        <Chip actif={form.mode === 'serie'} onClick={function () { maj('mode', 'serie'); }}>
          Nouvelle planification
        </Chip>
        <Chip actif={form.mode === 'rattrapage'} onClick={function () { maj('mode', 'rattrapage'); }}>
          Rattrapage sur une tournée existante
        </Chip>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Quartier *</span>
          <Selecteur
            value={form.quartier_id}
            onChange={function (e) { maj('quartier_id', e.target.value); maj('serie_id', ''); }}
            className="w-full"
          >
            <option value="">— Choisir —</option>
            {quartiers.map(function (q) {
              return <option key={q.id} value={q.id}>{q.nom}</option>;
            })}
          </Selecteur>
        </label>

        {form.mode === 'rattrapage' ? (
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Tournée</span>
            <Selecteur
              value={form.serie_id}
              onChange={function (e) { maj('serie_id', e.target.value); }}
              className="w-full"
              disabled={!form.quartier_id}
            >
              <option value="">— Choisir —</option>
              {seriesDuQuartier.map(function (s) {
                return (
                  <option key={s.id} value={s.id}>
                    {String(s.heure_debut).slice(0, 5)} · {libelleJours(s.jours_semaine)}
                  </option>
                );
              })}
            </Selecteur>
            {form.quartier_id && seriesDuQuartier.length === 0 ? (
              <span className="mt-1.5 block text-[11px] text-gold">
                Ce quartier n’a aucune tournée planifiée : créez-en une plutôt qu’un rattrapage.
              </span>
            ) : null}
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
            {form.mode === 'rattrapage' ? 'Jour' : 'Jour de départ'}
          </span>
          <Champ type="date" value={form.depart} onChange={function (e) { maj('depart', e.target.value); }} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Heure de début</span>
          <Champ type="time" value={form.heure_debut} onChange={function (e) { maj('heure_debut', e.target.value); }} />
        </label>

        {form.mode === 'serie' ? (
          <>
            <div className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Jours de la semaine
              </span>
              <div className="flex flex-wrap gap-1.5">
                {JOURS.map(function (j) {
                  const actif = form.jours.includes(j.iso);
                  return (
                    <button
                      key={j.iso}
                      type="button"
                      aria-pressed={actif}
                      disabled={form.portee === 'jour'}
                      onClick={function () { basculerJour(j.iso); }}
                      className={cn(
                        'cursor-pointer rounded-lg border px-3 py-2 text-[12px] font-semibold outline-none transition-colors',
                        'focus-visible:ring-2 focus-visible:ring-blue',
                        actif ? 'border-line2 bg-panel2 text-txt' : 'border-line text-muted hover:text-txt',
                        form.portee === 'jour' && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      {j.court}
                    </button>
                  );
                })}
              </div>
              <span className="mt-1.5 block text-[11px] text-muted2">
                Plusieurs jours forment une seule tournée : la modifier ou l’arrêter vaut pour tous.
              </span>
            </div>

            <div className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">
                Jusqu’à quand
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PORTEES.map(function (p) {
                  return (
                    <Chip key={p.code} actif={form.portee === p.code} onClick={function () { maj('portee', p.code); }}>
                      {p.label}
                    </Chip>
                  );
                })}
              </div>
              <span className="mt-1.5 block text-[11px] text-muted2">
                {form.portee === 'sans_fin'
                  ? 'Sans fin : le calendrier garde trois mois d’avance, prolongés chaque nuit.'
                  : fin
                    ? `La dernière tournée tombera au plus tard le ${dateLongue(fin)}.`
                    : 'Choisissez un jour de départ.'}
              </span>
            </div>

            <div className="block sm:col-span-2">
              <span className="mb-1.5 block text-[10px] tracking-[1.6px] text-muted uppercase">Équipe</span>
              <ListeCollecteurs
                collecteurs={collecteurs}
                choisis={form.collecteurs}
                disabled={enCours}
                onChange={function (ids) { maj('collecteurs', ids); }}
                vide="Aucun collecteur actif pour ces quartiers."
              />
              {form.collecteurs.length === 0 ? (
                <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted2">
                  <Badge ton="rouge">Sans collecteur</Badge>
                  La tournée apparaîtra au calendrier mais ne partira pas.
                </span>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
