'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';

export default function MenagesPage() {
  const [lignes, setLignes] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [recherche, setRecherche] = useState('');
  const [filtreQuartier, setFiltreQuartier] = useState('');
  const [filtrePaiement, setFiltrePaiement] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);
  const [cible, setCible] = useState(null);
  const [planChoisi, setPlanChoisi] = useState('');

  const [nouveauMenage, setNouveauMenage] = useState({
    quartier_id: '',
    point_repere: '',
    telephone_contact: '',
    type_menage: 'residentiel',
    nb_personnes: '',
  });

  useEffect(function () {
    chargerQuartiers();
    chargerLignes();
  }, []);

  async function chargerQuartiers() {
    const { data } = await supabase.from('quartiers').select('id, nom').order('nom');
    setQuartiers(data || []);
  }

  async function chargerLignes() {
    const { data } = await supabase
      .from('menages_solde')
      .select('*')
      .order('code_menage', { ascending: true });
    setLignes(data || []);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, nouveauMenage);
    copie[champ] = valeur;
    setNouveauMenage(copie);
  }

  async function ajouterMenage() {
    setMessage(null);
    if (!nouveauMenage.quartier_id || !nouveauMenage.point_repere || !nouveauMenage.telephone_contact) {
      setMessage({ type: 'erreur', texte: 'Quartier, point de repere et telephone sont obligatoires' });
      return;
    }
    setEnregistrement(true);

    const ligne = {
      quartier_id: nouveauMenage.quartier_id,
      point_repere: nouveauMenage.point_repere,
      telephone_contact: nouveauMenage.telephone_contact,
      type_menage: nouveauMenage.type_menage,
    };
    if (nouveauMenage.nb_personnes) {
      ligne.nb_personnes = parseInt(nouveauMenage.nb_personnes, 10);
    }

    const { error } = await supabase.from('menages').insert(ligne);
    setEnregistrement(false);

    if (error) {
      setMessage({ type: 'erreur', texte: 'Erreur : ' + error.message });
      return;
    }

    setMessage({ type: 'succes', texte: 'Menage ajoute avec succes' });
    setNouveauMenage({
      quartier_id: '', point_repere: '', telephone_contact: '',
      type_menage: 'residentiel', nb_personnes: '',
    });
    setFormVisible(false);
    chargerLignes();
  }

  function ouvrirAbonnement(m) {
    setCible(m);
    setPlanChoisi('');
    setMessage(null);
    fetch('/api/abonnements?type_menage=' + encodeURIComponent(m.type_menage))
      .then(function (r) { return r.json(); })
      .then(function (j) { setPlans(j.data || []); });
  }

  function creerAbonnement() {
    if (!planChoisi) {
      setMessage({ type: 'erreur', texte: 'Choisissez un plan' });
      return;
    }
    setEnregistrement(true);
    fetch('/api/abonnements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menage_id: cible.menage_id, plan_id: planChoisi })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        setEnregistrement(false);
        if (!res.ok) { setMessage({ type: 'erreur', texte: res.j.error }); return; }
        setMessage({ type: 'succes', texte: 'Abonnement cree. Le premier mois est du.' });
        setCible(null);
        chargerLignes();
      })
      .catch(function () {
        setEnregistrement(false);
        setMessage({ type: 'erreur', texte: 'Erreur reseau' });
      });
  }

  function formatGnf(v) {
    if (v === null || v === undefined) return '-';
    return Number(v).toLocaleString('fr-FR') + ' GNF';
  }

  const filtrees = lignes.filter(function (m) {
    const texte = ((m.code_menage || '') + ' ' + (m.point_repere || '') + ' ' + (m.telephone_contact || '')).toLowerCase();
    const okRecherche = texte.includes(recherche.toLowerCase());
    const okQuartier = !filtreQuartier || m.quartier === filtreQuartier;
    const okStatut = !filtreStatut || m.statut_menage === filtreStatut;
    let okPaiement = true;
    if (filtrePaiement === 'a_jour') okPaiement = m.est_solde === true;
    if (filtrePaiement === 'en_retard') okPaiement = m.est_solde === false;
    if (filtrePaiement === 'sans') okPaiement = !m.abonnement_id;
    return okRecherche && okQuartier && okStatut && okPaiement;
  });

  const totalDu = filtrees.reduce(function (s, m) { return s + Number(m.total_du || 0); }, 0);
  const nbRetard = filtrees.filter(function (m) { return m.est_solde === false; }).length;
  const nbSans = filtrees.filter(function (m) { return !m.abonnement_id; }).length;

  function exporter() {
    const entetes = ['Code', 'Quartier', 'Point de repere', 'Telephone', 'Type',
      'Plan', 'Echeance', 'Mois dus', 'Montant du', 'Etat', 'Statut menage'];
    const corps = filtrees.map(function (m) {
      const etat = !m.abonnement_id ? 'sans abonnement' : (m.est_solde ? 'a jour' : 'en retard');
      return [m.code_menage || '', m.quartier || '', m.point_repere || '',
        m.telephone_contact || '', m.type_menage || '', m.plan_code || '',
        m.date_fin || '', m.mois_dus === null ? '' : m.mois_dus,
        m.total_du || 0, etat, m.statut_menage || '']
        .map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; })
        .join(';');
    });
    const contenu = '\uFEFF' + entetes.join(';') + '\n' + corps.join('\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/csv;charset=utf-8' }));
    lien.download = 'menages_' + new Date().toISOString().slice(0, 10) + '.csv';
    lien.click();
  }

  const badgesStatut = {
    actif: 'bg-green-100 text-green-700',
    suspendu: 'bg-yellow-100 text-yellow-700',
    resilie: 'bg-gray-100 text-gray-600',
  };

  function badgePaiement(m) {
    if (!m.abonnement_id) {
      return <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-600">sans abonnement</span>;
    }
    if (m.est_solde) {
      return <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-700">a jour</span>;
    }
    return (
      <span className="text-xs px-3 py-1 rounded-full bg-red-100 text-red-700">
        {m.mois_dus} mois - {formatGnf(m.total_du)}
      </span>
    );
  }

  return (
    <div>
      <div className="no-print">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Menages ({filtrees.length})</h2>
          <div className="flex gap-2">
            <button onClick={exporter}
              className="bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Exporter CSV
            </button>
            <button onClick={function () { window.print(); }}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium">
              Imprimer
            </button>
            <button onClick={function () { setFormVisible(!formVisible); }}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              {formVisible ? 'Fermer' : '+ Ajouter un menage'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500">Total du</div>
            <div className="text-xl font-semibold text-red-600">{formatGnf(totalDu)}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500">Menages en retard</div>
            <div className="text-xl font-semibold text-gray-800">{nbRetard}</div>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <div className="text-xs text-gray-500">Sans abonnement</div>
            <div className="text-xl font-semibold text-gray-800">{nbSans}</div>
          </div>
        </div>

        {message && (
          <div className={'mb-4 p-3 rounded text-sm ' +
            (message.type === 'succes' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
            {message.texte}
          </div>
        )}

        {cible && (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3">
              Nouvel abonnement - {cible.code_menage} ({cible.type_menage})
            </h3>
            <div className="flex flex-col md:flex-row gap-3 items-start md:items-end">
              <div className="flex-1">
                <label className="block text-sm text-gray-600 mb-1">Plan</label>
                <select value={planChoisi}
                  onChange={function (e) { setPlanChoisi(e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">-- Choisir --</option>
                  {plans.map(function (p) {
                    return (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.passages_par_semaine} passages/semaine - {formatGnf(p.montant_gnf)}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button onClick={creerAbonnement} disabled={enregistrement}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium">
                {enregistrement ? 'Creation...' : 'Creer'}
              </button>
              <button onClick={function () { setCible(null); }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                Annuler
              </button>
            </div>
          </div>
        )}

        {formVisible && (
          <div className="bg-white rounded-xl shadow p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Nouveau menage</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Quartier *</label>
                <select value={nouveauMenage.quartier_id}
                  onChange={function (e) { majChamp('quartier_id', e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="">-- Choisir --</option>
                  {quartiers.map(function (q) {
                    return <option key={q.id} value={q.id}>{q.nom}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Type</label>
                <select value={nouveauMenage.type_menage}
                  onChange={function (e) { majChamp('type_menage', e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2">
                  <option value="residentiel">Residentiel</option>
                  <option value="commerce">Commerce</option>
                  <option value="institution">Institution</option>
                  <option value="industrie">Industrie</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Point de repere *</label>
                <input value={nouveauMenage.point_repere}
                  onChange={function (e) { majChamp('point_repere', e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Ex: Pres de la mosquee, 2e rue" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Telephone *</label>
                <input value={nouveauMenage.telephone_contact}
                  onChange={function (e) { majChamp('telephone_contact', e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="6XX XX XX XX" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Nombre de personnes</label>
                <input type="number" value={nouveauMenage.nb_personnes}
                  onChange={function (e) { majChamp('nb_personnes', e.target.value); }}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  placeholder="Optionnel" />
              </div>
            </div>
            <button onClick={ajouterMenage} disabled={enregistrement}
              className="mt-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium">
              {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <input value={recherche}
            onChange={function (e) { setRecherche(e.target.value); }}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2"
            placeholder="Code LP, repere ou telephone..." />
          <select value={filtreQuartier}
            onChange={function (e) { setFiltreQuartier(e.target.value); }}
            className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="">Tous les quartiers</option>
            {quartiers.map(function (q) {
              return <option key={q.id} value={q.nom}>{q.nom}</option>;
            })}
          </select>
          <select value={filtrePaiement}
            onChange={function (e) { setFiltrePaiement(e.target.value); }}
            className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="">Tous les paiements</option>
            <option value="a_jour">A jour</option>
            <option value="en_retard">En retard</option>
            <option value="sans">Sans abonnement</option>
          </select>
          <select value={filtreStatut}
            onChange={function (e) { setFiltreStatut(e.target.value); }}
            className="border border-gray-300 rounded-lg px-3 py-2">
            <option value="">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="suspendu">Suspendu</option>
            <option value="resilie">Resilie</option>
          </select>
        </div>
      </div>

      <div className="zone-impression">
        <div className="entete-impression" style={{ display: 'none', marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Commune de Lambanyi - Registre des menages</h2>
          <div style={{ fontSize: 12 }}>
            Quartier : {filtreQuartier || 'tous'} &nbsp;|&nbsp;
            Filtre : {filtrePaiement || 'tous'} &nbsp;|&nbsp;
            Total du : {formatGnf(totalDu)} &nbsp;|&nbsp;
            Edite le {new Date().toLocaleDateString('fr-FR')}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-left px-4 py-3">Quartier</th>
                <th className="text-left px-4 py-3">Point de repere</th>
                <th className="text-left px-4 py-3">Telephone</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Plan</th>
                <th className="text-left px-4 py-3">Echeance</th>
                <th className="text-left px-4 py-3">Paiement</th>
                <th className="text-left px-4 py-3">Statut</th>
                <th className="text-left px-4 py-3 no-print">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtrees.length === 0 && (
                <tr>
                  <td colSpan="10" className="px-4 py-6 text-gray-500 text-center">
                    Aucun menage trouve.
                  </td>
                </tr>
              )}
              {filtrees.map(function (m) {
                return (
                  <tr key={m.menage_id} className="border-t border-gray-100">
                    <td className="px-4 py-3 font-medium text-gray-800">{m.code_menage || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.quartier || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.point_repere}</td>
                    <td className="px-4 py-3 text-gray-600">{m.telephone_contact}</td>
                    <td className="px-4 py-3 text-gray-600">{m.type_menage}</td>
                    <td className="px-4 py-3 text-gray-600">{m.plan_code || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.date_fin || '-'}</td>
                    <td className="px-4 py-3">{badgePaiement(m)}</td>
                    <td className="px-4 py-3">
                      <span className={'text-xs px-3 py-1 rounded-full ' +
                        (badgesStatut[m.statut_menage] || 'bg-gray-100 text-gray-600')}>
                        {m.statut_menage}
                      </span>
                    </td>
                    <td className="px-4 py-3 no-print">
                      {!m.abonnement_id && (
                        <button onClick={function () { ouvrirAbonnement(m); }}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded">
                          Abonner
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}