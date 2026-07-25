'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CartePointsDepot = dynamic(
  function () { return import('./CartePointsDepot'); },
  { ssr: false, loading: function () { return <div className="h-[380px] bg-gray-100 rounded-xl" />; } }
);

const TYPES = [
  { valeur: 'bac', label: 'Bac' },
  { valeur: 'point_regroupement', label: 'Point de regroupement' },
  { valeur: 'zone_traitement', label: 'Zone de traitement' },
  { valeur: 'decharge', label: 'Decharge' },
];

export default function PointsDepotPage() {
  const [points, setPoints] = useState([]);
  const [quartiers, setQuartiers] = useState([]);
  const [pmes, setPmes] = useState([]);
  const [formVisible, setFormVisible] = useState(false);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState(null);
  const [fType, setFType] = useState('');
  const [fProprio, setFProprio] = useState('');
  const [fQuartier, setFQuartier] = useState('');

  const vide = {
    id: null, nom: '', type_point: 'bac', quartier_id: '', pme_id: '',
    capacite_m3: '', adresse_repere: '', latitude: '', longitude: '',
  };
  const [form, setForm] = useState(vide);

  useEffect(function () {
    fetch('/api/points-depot?mode=referentiel')
      .then(function (r) { return r.json(); })
      .then(function (j) { setQuartiers(j.quartiers || []); setPmes(j.pme || []); });
    charger();
  }, []);

  function charger() {
    const p = new URLSearchParams();
    if (fType) p.set('type_point', fType);
    if (fProprio) p.set('proprietaire', fProprio);
    if (fQuartier) p.set('quartier_id', fQuartier);
    fetch('/api/points-depot?' + p.toString())
      .then(function (r) { return r.json(); })
      .then(function (j) { setPoints(j.data || []); });
  }

  function choisirPosition(lat, lon) {
    const copie = Object.assign({}, form);
    copie.latitude = lat.toFixed(6);
    copie.longitude = lon.toFixed(6);
    setForm(copie);
  }

  function majChamp(champ, valeur) {
    const copie = Object.assign({}, form);
    copie[champ] = valeur;
    setForm(copie);
  }

  function editer(p) {
    setForm({
      id: p.id, nom: p.nom, type_point: p.type_point,
      quartier_id: p.quartier_id || '', pme_id: p.pme_id || '',
      capacite_m3: p.capacite_m3 || '', adresse_repere: p.adresse_repere || '',
      latitude: p.latitude || '', longitude: p.longitude || '',
    });
    setFormVisible(true);
    setMessage(null);
    window.scrollTo(0, 0);
  }

  function maPosition() {
    if (!navigator.geolocation) {
      setMessage({ type: 'erreur', texte: 'Geolocalisation non disponible' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        const copie = Object.assign({}, form);
        copie.latitude = pos.coords.latitude.toFixed(6);
        copie.longitude = pos.coords.longitude.toFixed(6);
        setForm(copie);
      },
      function () { setMessage({ type: 'erreur', texte: 'Position refusee ou indisponible' }); }
    );
  }

  function enregistrer() {
    setMessage(null);
    if (!form.nom) {
      setMessage({ type: 'erreur', texte: 'Le nom est obligatoire' });
      return;
    }
    setEnregistrement(true);
    fetch('/api/points-depot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        setEnregistrement(false);
        if (!res.ok) { setMessage({ type: 'erreur', texte: res.j.error }); return; }
        setMessage({ type: 'succes', texte: form.id ? 'Point mis a jour' : 'Point cree' });
        setForm(vide);
        setFormVisible(false);
        charger();
      })
      .catch(function () {
        setEnregistrement(false);
        setMessage({ type: 'erreur', texte: 'Erreur reseau' });
      });
  }

  function basculer(p) {
    fetch('/api/points-depot', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, actif: !p.actif })
    }).then(function () { charger(); });
  }

  function labelType(v) {
    const t = TYPES.find(function (x) { return x.valeur === v; });
    return t ? t.label : v;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Points de depot ({points.length})
        </h2>
        <button
          onClick={function () { setForm(vide); setFormVisible(!formVisible); }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          {formVisible ? 'Fermer' : '+ Ajouter un point'}
        </button>
      </div>

      {message && (
        <div className={'mb-4 p-3 rounded text-sm ' +
          (message.type === 'succes' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
          {message.texte}
        </div>
      )}

      {formVisible && (
        <div className="bg-white rounded-xl shadow p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-4">
            {form.id ? 'Modifier le point' : 'Nouveau point de depot'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Nom *</label>
              <input value={form.nom}
                onChange={function (e) { majChamp('nom', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: Bac marche Kinifi" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Type</label>
              <select value={form.type_point}
                onChange={function (e) { majChamp('type_point', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                {TYPES.map(function (t) {
                  return <option key={t.valeur} value={t.valeur}>{t.label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Quartier</label>
              <select value={form.quartier_id}
                onChange={function (e) { majChamp('quartier_id', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">-- Aucun --</option>
                {quartiers.map(function (q) {
                  return <option key={q.id} value={q.id}>{q.nom}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Proprietaire</label>
              <select value={form.pme_id}
                onChange={function (e) { majChamp('pme_id', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2">
                <option value="">Communal (mairie)</option>
                {pmes.map(function (p) {
                  return <option key={p.id} value={p.id}>{p.nom}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Capacite (m3)</label>
              <input type="number" step="0.1" value={form.capacite_m3}
                onChange={function (e) { majChamp('capacite_m3', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Optionnel" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Point de repere</label>
              <input value={form.adresse_repere}
                onChange={function (e) { majChamp('adresse_repere', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="Ex: face a la pharmacie" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Latitude</label>
              <input value={form.latitude}
                onChange={function (e) { majChamp('latitude', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="9.6412" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Longitude</label>
              <input value={form.longitude}
                onChange={function (e) { majChamp('longitude', e.target.value); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                placeholder="-13.5784" />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm text-gray-600 mb-2">
              Cliquez sur la carte pour poser le point, ou faites glisser le marqueur rouge.
            </div>
            <CartePointsDepot
              points={points}
              idCourant={form.id}
              latitude={form.latitude}
              longitude={form.longitude}
              onChoisir={choisirPosition}
            />
            <div className="text-xs text-gray-500 mt-2">
              Bleu : bac communal &nbsp;|&nbsp; Orange : bac PME &nbsp;|&nbsp;
              Gris : inactif &nbsp;|&nbsp; Rouge : point en cours de saisie
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button onClick={enregistrer} disabled={enregistrement}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg text-sm font-medium">
              {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={maPosition}
              className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm">
              Utiliser ma position
            </button>
            {form.id && (
              <button onClick={function () { setForm(vide); }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm">
                Annuler la modification
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-3 mb-4">
        <select value={fType} onChange={function (e) { setFType(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2">
          <option value="">Tous les types</option>
          {TYPES.map(function (t) {
            return <option key={t.valeur} value={t.valeur}>{t.label}</option>;
          })}
        </select>
        <select value={fProprio} onChange={function (e) { setFProprio(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2">
          <option value="">Tous proprietaires</option>
          <option value="communal">Communal</option>
          <option value="prive">Prive (PME)</option>
        </select>
        <select value={fQuartier} onChange={function (e) { setFQuartier(e.target.value); }}
          className="border border-gray-300 rounded-lg px-3 py-2">
          <option value="">Tous les quartiers</option>
          {quartiers.map(function (q) {
            return <option key={q.id} value={q.id}>{q.nom}</option>;
          })}
        </select>
        <button onClick={charger}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm">
          Filtrer
        </button>
      </div>

      <div className="bg-white rounded-xl shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-4 py-3">Nom</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Quartier</th>
              <th className="text-left px-4 py-3">Proprietaire</th>
              <th className="text-left px-4 py-3">Position</th>
              <th className="text-left px-4 py-3">Depots</th>
              <th className="text-left px-4 py-3">Statut</th>
              <th className="text-left px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {points.length === 0 && (
              <tr>
                <td colSpan="8" className="px-4 py-6 text-gray-500 text-center">
                  Aucun point de depot enregistre.
                </td>
              </tr>
            )}
            {points.map(function (p) {
              return (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {p.nom}
                    {p.adresse_repere && (
                      <div className="text-xs text-gray-500">{p.adresse_repere}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{labelType(p.type_point)}</td>
                  <td className="px-4 py-3 text-gray-600">{p.quartier || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.proprietaire === 'communal' ? 'Mairie' : p.pme_nom}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.latitude
                      ? Number(p.latitude).toFixed(5) + ', ' + Number(p.longitude).toFixed(5)
                      : <span className="text-orange-600">non geolocalise</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.nb_depots}</td>
                  <td className="px-4 py-3">
                    <span className={'text-xs px-3 py-1 rounded-full ' +
                      (p.actif ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600')}>
                      {p.actif ? 'actif' : 'inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={function () { editer(p); }}
                      className="text-sm text-green-700 hover:underline mr-3">
                      Modifier
                    </button>
                    <button onClick={function () { basculer(p); }}
                      className="text-sm text-gray-600 hover:underline">
                      {p.actif ? 'Desactiver' : 'Reactiver'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}