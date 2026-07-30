"use client";

import { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../../lib/supabase";

export default function QrMenagesPage() {
  const [quartiers, setQuartiers] = useState([]);
  const [quartierId, setQuartierId] = useState("");
  const [menages, setMenages] = useState([]);
  const [chargement, setChargement] = useState(false);

  useEffect(function () {
    async function chargerQuartiers() {
      const { data, error } = await supabase
        .from("quartiers")
        .select("id, nom, code")
        .eq("actif", true)
        .order("nom", { ascending: true });
      if (!error) {
        setQuartiers(data || []);
      }
    }
    chargerQuartiers();
  }, []);
  useEffect(function () {
    async function chargerMenages() {
      if (!quartierId) {
        setMenages([]);
        return;
      }
      setChargement(true);
      const { data, error } = await supabase
        .from("menages")
        .select("id, code_menage, point_repere, telephone_contact, quartiers(nom, code)")
        .eq("quartier_id", quartierId)
        .not("code_menage", "is", null)
        .order("code_menage", { ascending: true });
      if (!error) {
        setMenages(data || []);
      }
      setChargement(false);
    }
    chargerMenages();
  }, [quartierId]);

  function imprimer() {
    window.print();
  }
  return (
    <div className="p-6">
      <div className="no-print mb-6">
        <h1 className="text-2xl font-bold text-green-800 mb-4">
          Codes QR des menages
        </h1>
        <div className="flex items-center gap-4">
          <select
            className="border border-green-300 rounded px-3 py-2"
            value={quartierId}
            onChange={function (e) { setQuartierId(e.target.value); }}
          >
            <option value="">Choisir un quartier</option>
            {quartiers.map(function (q) {
              return (
                <option key={q.id} value={q.id}>
                  {q.nom} ({q.code})
                </option>
              );
            })}
          </select>
          <button
            className="bg-green-700 text-white rounded px-4 py-2 disabled:opacity-50"
            onClick={imprimer}
            disabled={menages.length === 0}
          >
            Imprimer la planche
          </button>
          <span className="text-green-800">
            {menages.length} menage(s)
          </span>
        </div>
      </div>

      {chargement ? (
        <p className="text-green-800">Chargement...</p>
      ) : (
        <div className="planche grid grid-cols-3 gap-4">
          {menages.map(function (m) {
            return (
              <div
                key={m.id}
                className="carte border border-gray-300 rounded p-3 flex flex-col items-center text-center break-inside-avoid"
              >
                <QRCodeSVG value={m.code_menage} size={140} level="M" />
                <div className="mt-2 font-bold text-sm">{m.code_menage}</div>
                <div className="text-xs text-gray-600 mt-1">{m.point_repere}</div>
                <div className="text-xs text-gray-500 mt-1">Lambanyi Propre</div>
              </div>
            );
          })}
        </div>
      )}

      <style jsx global>{`
        @media print {
          .no-print { display: none; }
          .planche { grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .carte { page-break-inside: avoid; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}