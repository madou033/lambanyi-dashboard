"use client";

import { useState, useEffect } from "react";

function formatGnf(v) {
  if (v === null || v === undefined) return "-";
  return Number(v).toLocaleString("fr-FR") + " GNF";
}

export default function PaiementsPage() {
  const [recherche, setRecherche] = useState("");
  const [resultats, setResultats] = useState([]);
  const [choisi, setChoisi] = useState(null);
  const [solde, setSolde] = useState(null);
  const [avance, setAvance] = useState(0);
  const [mois, setMois] = useState(1);
  const [fournisseur, setFournisseur] = useState("especes");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [occupe, setOccupe] = useState(false);

  const [liste, setListe] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPen, setTotalPen] = useState(0);
  const [quartiers, setQuartiers] = useState([]);
  const [fQuartier, setFQuartier] = useState("");
  const [fStatut, setFStatut] = useState("");
  const [fMode, setFMode] = useState("");
  const [fDu, setFDu] = useState("");
  const [fAu, setFAu] = useState("");

  function parametres() {
    const p = new URLSearchParams();
    if (fQuartier) p.set("quartier", fQuartier);
    if (fStatut) p.set("statut", fStatut);
    if (fMode) p.set("fournisseur", fMode);
    if (fDu) p.set("du", fDu);
    if (fAu) p.set("au", fAu);
    return p;
  }

  function chargerListe() {
    const p = parametres();
    p.set("mode", "recents");
    p.set("limite", "200");
    fetch("/api/paiements?" + p.toString())
      .then(function (r) { return r.json(); })
      .then(function (j) {
        setListe(j.data || []);
        setTotal(j.total || 0);
        setTotalPen(j.total_penalite || 0);
      });
  }

  useEffect(function () {
    fetch("/api/paiements?mode=quartiers")
      .then(function (r) { return r.json(); })
      .then(function (j) { setQuartiers(j.data || []); });
    chargerListe();
  }, []);

  function exporter() {
    const p = parametres();
    p.set("mode", "export");
    window.location.href = "/api/paiements?" + p.toString();
  }

  function reinitialiser() {
    setFQuartier(""); setFStatut(""); setFMode(""); setFDu(""); setFAu("");
    setTimeout(chargerListe, 0);
  }

  function lancerRecherche() {
    setErreur(null);
    fetch("/api/paiements?mode=recherche&q=" + encodeURIComponent(recherche))
      .then(function (r) { return r.json(); })
      .then(function (j) { setResultats(j.data || []); });
  }

  function selectionner(m) {
    setChoisi(m);
    setResultats([]);
    setMessage(null);
    setErreur(null);
    if (!m.abonnement_id) { setSolde(null); return; }
    fetch("/api/paiements?mode=solde&abonnement_id=" + m.abonnement_id)
      .then(function (r) { return r.json(); })
      .then(function (j) {
        setSolde(j.data);
        setAvance(j.avance_mois_max || 0);
        setMois(j.data && j.data.mois_dus > 0 ? j.data.mois_dus : 1);
      });
  }

  function enregistrer() {
    setOccupe(true); setMessage(null); setErreur(null);
    fetch("/api/paiements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        abonnement_id: choisi.abonnement_id,
        mois: mois,
        fournisseur: fournisseur,
        reference_externe: reference,
        note: note
      })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        setOccupe(false);
        if (!res.ok) { setErreur(res.j.error); return; }
        setMessage("Paiement enregistre : " + formatGnf(res.j.montant) +
          (res.j.penalite > 0 ? " + penalite " + formatGnf(res.j.penalite) : ""));
        setReference(""); setNote("");
        selectionner(choisi);
        chargerListe();
      })
      .catch(function () { setOccupe(false); setErreur("Erreur reseau"); });
  }

  const maxMois = solde ? solde.mois_dus + avance : 1;
  const totalAffiche = solde ? mois * solde.montant_mensuel : 0;
  const penAffiche = solde && solde.mois_dus > 0
    ? Math.round(solde.penalite_due / solde.mois_dus) * Math.min(mois, solde.mois_dus)
    : 0;

  const champ = { padding: 8, border: "1px solid #ccc", borderRadius: 6 };
  const btn = { padding: "8px 14px", border: 0, borderRadius: 6, color: "#fff", cursor: "pointer" };

  return (
    <div style={{ padding: 24 }}>
      <div className="no-print">
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Paiements</h1>
        <p style={{ color: "#666", marginBottom: 20 }}>
          Encaissement des abonnements. Un mois entier par tranche.
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={recherche}
            onChange={function (e) { setRecherche(e.target.value); }}
            onKeyDown={function (e) { if (e.key === "Enter") lancerRecherche(); }}
            placeholder="Code LP, telephone ou point de repere"
            style={{ flex: 1, padding: 10, border: "1px solid #ccc", borderRadius: 6 }} />
          <button onClick={lancerRecherche} style={Object.assign({}, btn, { background: "#16a34a", padding: "10px 18px" })}>
            Rechercher
          </button>
        </div>

        {resultats.length > 0 && (
          <div style={{ border: "1px solid #eee", borderRadius: 6, marginBottom: 16 }}>
            {resultats.map(function (m) {
              return (
                <div key={m.menage_id} onClick={function () { selectionner(m); }}
                  style={{ padding: 10, borderBottom: "1px solid #f2f2f2", cursor: "pointer" }}>
                  <b>{m.code_menage || "-"}</b> &nbsp; {m.point_repere} &nbsp;
                  <span style={{ color: "#888" }}>{m.quartier}</span> &nbsp;
                  <span style={{ color: m.est_solde ? "#16a34a" : "#dc2626" }}>
                    {m.est_solde ? "a jour" : "en retard"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {message && (
          <div style={{ padding: 12, background: "#ecfdf5", color: "#065f46", borderRadius: 6, marginBottom: 12 }}>
            {message}
          </div>
        )}
        {erreur && (
          <div style={{ padding: 12, background: "#fef2f2", color: "#991b1b", borderRadius: 6, marginBottom: 12 }}>
            {erreur}
          </div>
        )}

        {choisi && !choisi.abonnement_id && (
          <div style={{ padding: 12, background: "#fffbeb", color: "#92400e", borderRadius: 6 }}>
            Ce menage na pas encore abonnement actif. Creez-le avant tout encaissement.
          </div>
        )}

        {choisi && solde && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600 }}>
              {choisi.code_menage} - {choisi.point_repere}
            </h2>
            <div style={{ display: "flex", gap: 32, margin: "12px 0", flexWrap: "wrap" }}>
              <div><div style={{ color: "#888", fontSize: 12 }}>Echeance</div><div>{solde.date_fin || "-"}</div></div>
              <div><div style={{ color: "#888", fontSize: 12 }}>Retard</div><div>{solde.jours_retard} jours</div></div>
              <div><div style={{ color: "#888", fontSize: 12 }}>Mois dus</div><div>{solde.mois_dus}</div></div>
              <div><div style={{ color: "#888", fontSize: 12 }}>Tarif mensuel</div><div>{formatGnf(solde.montant_mensuel)}</div></div>
              <div><div style={{ color: "#888", fontSize: 12 }}>Total du</div>
                <div style={{ fontWeight: 600, color: solde.est_solde ? "#16a34a" : "#dc2626" }}>
                  {solde.est_solde ? "Solde" : formatGnf(solde.total_du)}
                </div></div>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 12, color: "#888" }}>Mois a regler (max {maxMois})</div>
                <input type="number" min="1" max={maxMois} value={mois}
                  onChange={function (e) { setMois(parseInt(e.target.value, 10) || 1); }}
                  style={Object.assign({}, champ, { width: 90 })} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888" }}>Mode</div>
                <select value={fournisseur} onChange={function (e) { setFournisseur(e.target.value); }} style={champ}>
                  <option value="especes">Especes</option>
                  <option value="orange_money">Orange Money</option>
                  <option value="orange_money_mock">Orange Money (test)</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888" }}>Reference</div>
                <input value={reference} onChange={function (e) { setReference(e.target.value); }} style={champ} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: "#888" }}>Note</div>
                <input value={note} onChange={function (e) { setNote(e.target.value); }}
                  style={Object.assign({}, champ, { width: "100%" })} />
              </div>
            </div>

            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 600 }}>
                A encaisser : {formatGnf(totalAffiche + penAffiche)}
                {penAffiche > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 400, color: "#888" }}>
                    &nbsp;(dont penalite {formatGnf(penAffiche)})
                  </span>
                )}
              </div>
              <button onClick={enregistrer} disabled={occupe || mois < 1 || mois > maxMois}
                style={Object.assign({}, btn, {
                  padding: "10px 20px",
                  background: occupe || mois > maxMois ? "#9ca3af" : "#16a34a"
                })}>
                {occupe ? "Enregistrement..." : "Enregistrer le paiement"}
              </button>
            </div>
          </div>
        )}

        <div style={{
          display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end",
          padding: 12, background: "#f9fafb", borderRadius: 8, marginBottom: 12
        }}>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Quartier</div>
            <select value={fQuartier} onChange={function (e) { setFQuartier(e.target.value); }} style={champ}>
              <option value="">Tous</option>
              {quartiers.map(function (q) { return <option key={q} value={q}>{q}</option>; })}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Statut</div>
            <select value={fStatut} onChange={function (e) { setFStatut(e.target.value); }} style={champ}>
              <option value="">Tous</option>
              <option value="confirme">Confirme</option>
              <option value="en_attente">En attente</option>
              <option value="initie">Initie</option>
              <option value="echoue">Echoue</option>
              <option value="rembourse">Rembourse</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Mode</div>
            <select value={fMode} onChange={function (e) { setFMode(e.target.value); }} style={champ}>
              <option value="">Tous</option>
              <option value="especes">Especes</option>
              <option value="orange_money">Orange Money</option>
              <option value="orange_money_mock">Orange Money (test)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Du</div>
            <input type="date" value={fDu} onChange={function (e) { setFDu(e.target.value); }} style={champ} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: "#888" }}>Au</div>
            <input type="date" value={fAu} onChange={function (e) { setFAu(e.target.value); }} style={champ} />
          </div>
          <button onClick={chargerListe} style={Object.assign({}, btn, { background: "#16a34a" })}>Filtrer</button>
          <button onClick={reinitialiser} style={Object.assign({}, btn, { background: "#6b7280" })}>Reinitialiser</button>
          <button onClick={exporter} style={Object.assign({}, btn, { background: "#0f766e" })}>Exporter CSV</button>
          <button onClick={function () { window.print(); }} style={Object.assign({}, btn, { background: "#1d4ed8" })}>Imprimer</button>
        </div>
      </div>

      <div className="zone-impression">
        <div className="entete-impression" style={{ display: "none", marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Commune de Lambanyi - Journal des paiements</h2>
          <div style={{ fontSize: 12 }}>
            Quartier : {fQuartier || "tous"} &nbsp;|&nbsp;
            Periode : {fDu || "debut"} au {fAu || "ce jour"} &nbsp;|&nbsp;
            Edite le {new Date().toLocaleDateString("fr-FR")}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600 }}>Journal des paiements ({liste.length})</h2>
          <div style={{ fontWeight: 600 }}>
            Encaisse : {formatGnf(total)}
            {totalPen > 0 && <span style={{ color: "#888", fontWeight: 400 }}> (dont penalites {formatGnf(totalPen)})</span>}
          </div>
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #e5e7eb" }}>
              <th style={{ padding: 8 }}>Date</th>
              <th style={{ padding: 8 }}>Code</th>
              <th style={{ padding: 8 }}>Quartier</th>
              <th style={{ padding: 8 }}>Montant</th>
              <th style={{ padding: 8 }}>Penalite</th>
              <th style={{ padding: 8 }}>Mois</th>
              <th style={{ padding: 8 }}>Periode</th>
              <th style={{ padding: 8 }}>Mode</th>
              <th style={{ padding: 8 }}>Statut</th>
            </tr>
          </thead>
          <tbody>
            {liste.map(function (p) {
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f2f2f2" }}>
                  <td style={{ padding: 8 }}>{new Date(p.created_at).toLocaleDateString("fr-FR")}</td>
                  <td style={{ padding: 8 }}>{p.code_menage}</td>
                  <td style={{ padding: 8 }}>{p.quartier}</td>
                  <td style={{ padding: 8 }}>{formatGnf(p.montant_gnf)}</td>
                  <td style={{ padding: 8 }}>{p.penalite_gnf > 0 ? formatGnf(p.penalite_gnf) : "-"}</td>
                  <td style={{ padding: 8 }}>{p.mois_regles || "-"}</td>
                  <td style={{ padding: 8 }}>
                    {p.periode_debut ? p.periode_debut + " au " + p.periode_fin : "-"}
                  </td>
                  <td style={{ padding: 8 }}>{p.fournisseur}</td>
                  <td style={{ padding: 8 }}>{p.statut}</td>
                </tr>
              );
            })}
            {liste.length === 0 && (
              <tr><td colSpan="9" style={{ padding: 16, color: "#888" }}>Aucun paiement pour ces criteres.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}