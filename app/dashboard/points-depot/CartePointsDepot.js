'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
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

const LIBELLES_TYPE = {
  bac: 'Bac',
  point_regroupement: 'Point de regroupement',
  zone_traitement: 'Zone de traitement',
  decharge: 'Décharge',
};

/**
 * La vue `points_depot_detail` renvoie soit le nom de la PME, soit la
 * chaîne 'Commune' — pas un code. On teste donc bien cette valeur.
 */
function estCommunal(p) {
  return p.proprietaire === 'Commune';
}

function pin(couleur, taille) {
  const t = taille ?? 1;
  return L.divIcon({
    className: 'lp-map-pin',
    iconSize: [26 * t, 34 * t],
    iconAnchor: [13 * t, 34 * t],
    popupAnchor: [0, -30 * t],
    html: `
      <span style="display:block;filter:drop-shadow(0 3px 7px rgba(0,0,0,.45))">
        <svg width="${26 * t}" height="${34 * t}" viewBox="0 0 26 34" fill="none">
          <path d="M13 33.2C13 33.2 24.5 21.7 24.5 13A11.5 11.5 0 1 0 1.5 13c0 8.7 11.5 20.2 11.5 20.2z"
                style="fill:${couleur}" stroke="#fff" stroke-width="1.8"/>
          <circle cx="13" cy="13" r="4.2" fill="#fff"/>
        </svg>
      </span>`,
  });
}

const PIN_COMMUNE = pin('var(--lp-green)');
const PIN_PME = pin('var(--lp-blue)');
const PIN_INACTIF = pin('var(--lp-muted2)');
const PIN_SELECTION = pin('var(--lp-red)', 1.25);

function CapteurClic({ onChoisir }) {
  useMapEvents({
    click: function (e) {
      if (onChoisir) onChoisir(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recentrer({ lat, lon }) {
  const carte = useMap();
  useEffect(
    function () {
      if (lat != null && lon != null) carte.setView([lat, lon], carte.getZoom());
    },
    [lat, lon, carte],
  );
  return null;
}

export default function CartePointsDepot({
  points,
  latitude,
  longitude,
  idCourant,
  onChoisir,
  selectionnable = false,
}) {
  const { theme } = useTheme();
  const tuile = TUILES[theme] ?? TUILES.dark;
  const lat = latitude === '' || latitude == null ? null : Number(latitude);
  const lon = longitude === '' || longitude == null ? null : Number(longitude);
  const centre = lat != null && lon != null ? [lat, lon] : CENTRE_LAMBANYI;

  const existants = (points || []).filter(function (p) {
    return p.latitude != null && p.longitude != null && p.id !== idCourant;
  });

  return (
    <MapContainer
      center={centre}
      zoom={14}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer key={theme} attribution={tuile.attribution} url={tuile.url} />

      {selectionnable ? <CapteurClic onChoisir={onChoisir} /> : null}
      <Recentrer lat={lat} lon={lon} />

      {existants.map(function (p) {
        const icone = !p.actif ? PIN_INACTIF : estCommunal(p) ? PIN_COMMUNE : PIN_PME;
        return (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icone}>
            <Popup>
              <strong>{p.nom}</strong>
              <br />
              {LIBELLES_TYPE[p.type_point] ?? p.type_point}
              <br />
              {p.proprietaire}
              <br />
              <em>{p.nb_depots} dépôt{p.nb_depots > 1 ? 's' : ''} enregistré{p.nb_depots > 1 ? 's' : ''}</em>
            </Popup>
          </Marker>
        );
      })}

      {selectionnable && lat != null && lon != null ? (
        <Marker
          position={[lat, lon]}
          icon={PIN_SELECTION}
          draggable
          eventHandlers={{
            dragend: function (e) {
              const pos = e.target.getLatLng();
              if (onChoisir) onChoisir(pos.lat, pos.lng);
            },
          }}
        >
          <Popup>Position du point — faites glisser pour ajuster.</Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}
