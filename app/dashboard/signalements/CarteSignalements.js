'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/components/ThemeProvider';

const TUILES = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
  },
};

const CENTRE_LAMBANYI = [9.615, -13.622];

const COULEURS_STATUT = {
  nouveau: 'var(--lp-red)',
  en_cours: 'var(--lp-gold)',
  resolu: 'var(--lp-teal)',
  rejete: 'var(--lp-muted2)',
};

const LIBELLES_TYPE = {
  depotoir_sauvage: 'Dépotoir sauvage',
  collecte_manquee: 'Collecte manquée',
  bac_plein: 'Bac plein',
  autre: 'Autre',
};

/**
 * Marqueur maison — un pictogramme SVG teinté par le token du statut.
 * Évite les PNG hébergés chez un tiers et respecte la palette.
 */
function pin(statut, actif) {
  const couleur = COULEURS_STATUT[statut] ?? COULEURS_STATUT.rejete;
  return L.divIcon({
    className: 'lp-map-pin',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
    html: `
      <span style="display:block;filter:drop-shadow(0 3px 7px rgba(0,0,0,.45))">
        <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
          <path d="M13 33.2C13 33.2 24.5 21.7 24.5 13A11.5 11.5 0 1 0 1.5 13c0 8.7 11.5 20.2 11.5 20.2z"
                style="fill:${couleur}" stroke="#fff" stroke-width="${actif ? 2.4 : 1.6}"/>
          <circle cx="13" cy="13" r="4.2" fill="#fff"/>
        </svg>
      </span>`,
  });
}

/** Recadre la carte sur les marqueurs affichés. */
function Recadrage({ points }) {
  const map = useMap();
  useEffect(
    function () {
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 15);
        return;
      }
      map.fitBounds(
        points.map(function (p) {
          return [p.latitude, p.longitude];
        }),
        { padding: [32, 32], maxZoom: 16 },
      );
    },
    [points, map],
  );
  return null;
}

export default function CarteSignalements({ signalements, selectionId, onSelection }) {
  const { theme } = useTheme();
  const tuile = TUILES[theme] ?? TUILES.dark;

  const localises = useMemo(
    function () {
      return signalements.filter(function (s) {
        return s.latitude != null && s.longitude != null;
      });
    },
    [signalements],
  );

  return (
    <MapContainer
      center={CENTRE_LAMBANYI}
      zoom={13}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer key={theme} attribution={tuile.attribution} url={tuile.url} />
      <Recadrage points={localises} />
      {localises.map(function (s) {
        return (
          <Marker
            key={s.id}
            position={[s.latitude, s.longitude]}
            icon={pin(s.statut, s.id === selectionId)}
            zIndexOffset={s.id === selectionId ? 1000 : 0}
            eventHandlers={{
              click: function () {
                if (onSelection) onSelection(s.id);
              },
            }}
          >
            <Popup>
              <strong>{LIBELLES_TYPE[s.type_signalement] ?? s.type_signalement}</strong>
              <br />
              {s.quartier_nom || 'Quartier inconnu'}
              <br />
              {s.description || 'Sans description'}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
