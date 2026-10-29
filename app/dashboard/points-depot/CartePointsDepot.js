'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTheme } from '@/components/ThemeProvider';
import { lirePosition } from '@/lib/coordonnees';

const TUILES = {
  light: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
  },
  dark: {
    url: 'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; Stadia Maps',
  },
};

const CENTRE_CONAKRY = [9.509, -13.712];

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

/**
 * Recentre sur la saisie, et seulement quand elle est entière.
 *
 * `position` vient de `lirePosition` : c'est un couple de nombres finis, ou
 * `null`. Leaflet refuse tout le reste en jetant — un `NaN` glissé ici cassait
 * l'écran de création dès la frappe d'une coordonnée mal formée.
 */
function Recentrer({ position }) {
  const carte = useMap();
  const lat = position ? position[0] : null;
  const lon = position ? position[1] : null;
  useEffect(
    function () {
      if (lat != null && lon != null) carte.setView([lat, lon], carte.getZoom());
    },
    [lat, lon, carte],
  );
  return null;
}

/** Un couple sûr, ou rien : on ne donne jamais à Leaflet de quoi jeter. */
function positionSure(lat, lon) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
    ? [Number(lat), Number(lon)]
    : null;
}

export default function CartePointsDepot({
  points,
  latitude,
  longitude,
  idCourant,
  onChoisir,
  selectionnable = false,
  centre,
}) {
  const { theme } = useTheme();
  const tuile = TUILES[theme] ?? TUILES.dark;
  // La saisie est lue une fois, proprement : jamais de NaN au-delà de cette ligne.
  const saisie = lirePosition(latitude, longitude);
  const centreCarte = saisie.position || positionSure(centre?.[0], centre?.[1]) || CENTRE_CONAKRY;

  // Un point venu de la base peut porter une position partielle ou aberrante ;
  // on le laisse hors carte plutôt que de faire tomber l'écran avec lui.
  const existants = (points || [])
    .map(function (p) {
      return { ...p, position: positionSure(p.latitude, p.longitude) };
    })
    .filter(function (p) {
      return p.position && p.id !== idCourant;
    });

  return (
    <MapContainer
      center={centreCarte}
      zoom={14}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer key={theme} attribution={tuile.attribution} url={tuile.url} />

      {selectionnable ? <CapteurClic onChoisir={onChoisir} /> : null}
      <Recentrer position={saisie.position} />

      {existants.map(function (p) {
        const icone = !p.actif ? PIN_INACTIF : estCommunal(p) ? PIN_COMMUNE : PIN_PME;
        return (
          <Marker key={p.id} position={p.position} icon={icone}>
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

      {selectionnable && saisie.position ? (
        <Marker
          position={saisie.position}
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
