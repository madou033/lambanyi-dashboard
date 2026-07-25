'use client';

import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

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

const icones = {
  selection: creerIcone('red'),
  communal: creerIcone('blue'),
  prive: creerIcone('orange'),
  inactif: creerIcone('grey'),
};

const libellesTypes = {
  bac: 'Bac',
  point_regroupement: 'Point de regroupement',
  zone_traitement: 'Zone de traitement',
  decharge: 'Decharge',
};

function CapteurClic(props) {
  useMapEvents({
    click: function (e) {
      props.onChoisir(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Recentrer(props) {
  const carte = useMap();
  useEffect(function () {
    if (props.lat !== null && props.lon !== null) {
      carte.setView([props.lat, props.lon], carte.getZoom());
    }
  }, [props.lat, props.lon]);
  return null;
}

export default function CartePointsDepot(props) {
  const centreLambanyi = [9.615, -13.622];

  const lat = props.latitude === '' || props.latitude === null || props.latitude === undefined
    ? null : Number(props.latitude);
  const lon = props.longitude === '' || props.longitude === null || props.longitude === undefined
    ? null : Number(props.longitude);

  const centre = lat !== null && lon !== null ? [lat, lon] : centreLambanyi;

  const existants = (props.points || []).filter(function (p) {
    return p.latitude !== null && p.longitude !== null && p.id !== props.idCourant;
  });

  return (
    <MapContainer
      center={centre}
      zoom={14}
      style={{ height: '380px', width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CapteurClic onChoisir={props.onChoisir} />
      <Recentrer lat={lat} lon={lon} />

      {existants.map(function (p) {
        const icone = !p.actif
          ? icones.inactif
          : (p.proprietaire === 'communal' ? icones.communal : icones.prive);
        return (
          <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icone}>
            <Popup>
              <strong>{p.nom}</strong>
              <br />
              {libellesTypes[p.type_point] || p.type_point}
              <br />
              {p.proprietaire === 'communal' ? 'Mairie' : p.pme_nom}
              <br />
              <em>{p.nb_depots} depots enregistres</em>
            </Popup>
          </Marker>
        );
      })}

      {lat !== null && lon !== null && (
        <Marker
          position={[lat, lon]}
          icon={icones.selection}
          draggable={true}
          eventHandlers={{
            dragend: function (e) {
              const pos = e.target.getLatLng();
              props.onChoisir(pos.lat, pos.lng);
            },
          }}
        >
          <Popup>Position du point. Faites glisser pour ajuster.</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}