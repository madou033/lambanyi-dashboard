'use client';

/**
 * La position d'un foyer sur une carte, seule. Chargée à la demande depuis
 * la fiche foyer (bouton « Voir sur la carte »), jamais au premier rendu :
 * Leaflet pèse, et la plupart des consultations n'en ont pas besoin.
 */

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
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

/** Même pictogramme que les signalements, teinté selon l'abonnement. */
function pin(abonne) {
  const couleur = abonne ? 'var(--lp-teal)' : 'var(--lp-muted2)';
  return L.divIcon({
    className: 'lp-map-pin',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -30],
    html: `
      <span style="display:block;filter:drop-shadow(0 3px 7px rgba(0,0,0,.45))">
        <svg width="26" height="34" viewBox="0 0 26 34" fill="none">
          <path d="M13 33.2C13 33.2 24.5 21.7 24.5 13A11.5 11.5 0 1 0 1.5 13c0 8.7 11.5 20.2 11.5 20.2z"
                style="fill:${couleur}" stroke="#fff" stroke-width="2"/>
          <circle cx="13" cy="13" r="4.2" fill="#fff"/>
        </svg>
      </span>`,
  });
}

export default function CarteFoyer({ latitude, longitude, code, repere, abonne }) {
  const { theme } = useTheme();
  const tuile = TUILES[theme] ?? TUILES.dark;

  return (
    <MapContainer
      center={[latitude, longitude]}
      zoom={17}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer key={theme} attribution={tuile.attribution} url={tuile.url} />
      <Marker position={[latitude, longitude]} icon={pin(abonne)}>
        <Popup>
          <strong>{code}</strong>
          <br />
          {repere}
        </Popup>
      </Marker>
    </MapContainer>
  );
}
