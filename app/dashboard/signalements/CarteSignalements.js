'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const icones = {
  nouveau: creerIcone('red'),
  en_cours: creerIcone('orange'),
  resolu: creerIcone('green'),
  rejete: creerIcone('grey'),
};

function creerIcone(couleur) {
  return L.icon({
    iconUrl:
      'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-' +
      couleur + '.png',
    shadowUrl:
      'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });
}

const libellesTypes = {
  depotoir_sauvage: 'Depotoir sauvage',
  collecte_manquee: 'Collecte manquee',
  bac_plein: 'Bac plein',
  autre: 'Autre',
};

export default function CarteSignalements(props) {
  const centreLambanyi = [9.615, -13.622];

  const avecPosition = props.signalements.filter(function (s) {
    return s.latitude !== null && s.longitude !== null;
  });

  return (
    <MapContainer
      center={centreLambanyi}
      zoom={13}
      style={{ height: '450px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {avecPosition.map(function (s) {
        return (
          <Marker
            key={s.id}
            position={[s.latitude, s.longitude]}
            icon={icones[s.statut] || icones.nouveau}
          >
            <Popup>
              <strong>{libellesTypes[s.type_signalement] || s.type_signalement}</strong>
              <br />
              {s.quartier_nom || 'Quartier inconnu'}
              <br />
              {s.description || 'Sans description'}
              <br />
              <em>Statut : {s.statut}</em>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}