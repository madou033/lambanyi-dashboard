'use client';

/**
 * La fiche d'un encaissement, et son reçu imprimable.
 *
 * Un versement n'existait que comme une ligne du journal. Or une preuve de
 * paiement se remet : au foyer qui vient de payer au guichet, au gérant qui
 * réclame, au contrôleur qui passe. Il fallait pouvoir la sortir sur papier.
 *
 * Le reçu est une chaîne de caractères en chasse fixe, et une seule : c'est
 * exactement ce que l'écran montre, ce que l'impression pose sur le papier et
 * ce que le presse-papiers reçoit. Un reçu mis en forme deux fois diverge, et
 * le jour où il diverge c'est devant quelqu'un qui compare les deux.
 *
 * L'impression passe par une iframe cachée plutôt que par `window.print()` :
 * la feuille de style d'impression du back-office est faite pour des journaux
 * en A4 paysage, un reçu veut du portrait étroit. L'iframe porte son propre
 * document, donc ses propres règles, et n'a pas à défaire celles de la page.
 * Une fenêtre surgissante aurait fait l'affaire, mais les navigateurs les
 * bloquent.
 */

import { useState } from 'react';
import { Badge, BadgeStatut, Btn, Modal, montant, nombre } from '@/components/ui';

const MODES = {
  especes: 'Espèces',
  orange_money: 'Orange Money',
  orange_money_mock: 'Orange Money',
};

const STATUTS = {
  confirme: 'Confirmé',
  en_attente: 'En attente',
  initie: 'Initié',
  echoue: 'Échoué',
  annule: 'Annulé',
};

/** Largeur du reçu, en caractères. Au-delà, le papier étroit coupe. */
const L = 42;

function dateHeure(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.toLocaleDateString('fr-FR')} à ${d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function dateSeule(iso) {
  return iso ? new Date(iso).toLocaleDateString('fr-FR') : '—';
}

/** Un numéro de reçu lisible à voix haute, tiré de l'identifiant du paiement. */
function numeroRecu(id) {
  const h = String(id || '').replace(/-/g, '').toUpperCase();
  return `${h.slice(0, 4)}-${h.slice(4, 8)}`;
}

function centre(texte) {
  const marge = Math.max(0, Math.floor((L - texte.length) / 2));
  return ' '.repeat(marge) + texte;
}

/** Libellé à gauche, valeur à droite, repliée si elle déborde. */
function champ(libelle, valeur) {
  // 13 : « Mois réglés » fait onze caractères, il lui faut deux espaces pour
  // ne pas se coller à sa valeur.
  const colonne = 13;
  const large = L - colonne - 1;
  const mots = String(valeur ?? '—').split(' ');
  const lignes = [];
  let courante = '';
  for (const mot of mots) {
    if (courante && (courante + ' ' + mot).length > large) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = courante ? `${courante} ${mot}` : mot;
    }
  }
  lignes.push(courante);
  return lignes
    .map(function (ligne, i) {
      return ` ${(i === 0 ? libelle : '').padEnd(colonne)}${ligne}`;
    })
    .join('\n');
}

/** Libellé à gauche, montant calé à droite. */
function somme(libelle, valeur, gras = false) {
  const droite = `${nombre(valeur)} GNF`;
  const gauche = ` ${gras ? libelle.toUpperCase() : libelle}`;
  const vide = Math.max(1, L - gauche.length - droite.length);
  return gauche + ' '.repeat(vide) + droite;
}

/**
 * Le reçu, en toutes lettres. Seule source : l'écran, le papier et le
 * presse-papiers lisent cette chaîne.
 */
export function texteRecu(p, territoire, emetteur) {
  const total = Number(p.montant_gnf || 0) + Number(p.penalite_gnf || 0);
  const barre = '='.repeat(L);
  const trait = '-'.repeat(L);

  const bloc = [
    '',
    centre('S I C O D'),
    centre('Système intégré de collecte'),
    centre("et d'optimisation de déchets"),
    centre(territoire || ''),
    '',
    barre,
    centre('REÇU DE PAIEMENT'),
    centre(`N° ${numeroRecu(p.id)}`),
    barre,
    '',
    champ('Date', dateHeure(p.created_at)),
    champ('Foyer', p.code_menage || '—'),
    champ('Quartier', p.quartier || '—'),
    p.point_repere ? champ('Repère', p.point_repere) : null,
    p.telephone_contact ? champ('Téléphone', p.telephone_contact) : null,
    '',
    trait,
    champ('Formule', p.plan_code || '—'),
    p.periode_debut
      ? champ('Période', `${dateSeule(p.periode_debut)} au ${dateSeule(p.periode_fin)}`)
      : null,
    p.mois_regles ? champ('Mois réglés', nombre(p.mois_regles)) : null,
    trait,
    '',
    somme('Abonnement', p.montant_gnf || 0),
    Number(p.penalite_gnf) > 0 ? somme('Pénalité de retard', p.penalite_gnf) : null,
    ' '.repeat(L - 20) + '-'.repeat(20),
    somme('Total versé', total, true),
    '',
    trait,
    champ('Mode', MODES[p.fournisseur] || p.fournisseur || '—'),
    p.reference_externe ? champ('Référence', p.reference_externe) : null,
    champ('Statut', STATUTS[p.statut] || p.statut || '—'),
    p.note ? champ('Note', p.note) : null,
    trait,
    '',
    centre('Merci de votre règlement.'),
    '',
    champ('Émis le', dateHeure(new Date().toISOString())),
    emetteur ? champ('Par', emetteur) : null,
    '',
    barre,
    '',
  ];

  return bloc.filter(function (x) { return x !== null; }).join('\n');
}

/** Pose le reçu dans une iframe qui porte ses propres règles d'impression. */
function imprimer(texte) {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(cadre);

  const doc = cadre.contentWindow.document;
  doc.open();
  doc.write(
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Reçu</title>' +
      '<style>' +
      '@page { size: 80mm auto; margin: 6mm; }' +
      'html, body { margin: 0; padding: 0; background: #fff; }' +
      'pre { font-family: "Courier New", Consolas, monospace; font-size: 11pt;' +
      '      line-height: 1.38; color: #000; white-space: pre; margin: 0; }' +
      '</style></head><body><pre></pre></body></html>',
  );
  doc.close();
  // Le texte est pose par le DOM et non par document.write : un repere de
  // foyer peut contenir n'importe quoi, et n'a pas a etre interprete.
  doc.querySelector('pre').textContent = texte;

  function lancer() {
    cadre.contentWindow.focus();
    cadre.contentWindow.print();
    window.setTimeout(function () {
      cadre.remove();
    }, 1000);
  }

  if (doc.readyState === 'complete') lancer();
  else cadre.onload = lancer;
}

export function RecuPaiement({ paiement, territoire, emetteur, onFermer }) {
  const [copie, setCopie] = useState(false);
  if (!paiement) return null;

  const texte = texteRecu(paiement, territoire, emetteur);
  const total = Number(paiement.montant_gnf || 0) + Number(paiement.penalite_gnf || 0);

  async function copier() {
    try {
      await navigator.clipboard.writeText(texte);
      setCopie(true);
      window.setTimeout(function () { setCopie(false); }, 1500);
    } catch {
      setCopie(false);
    }
  }

  return (
    <Modal
      ouvert
      onFermer={onFermer}
      titre={`Reçu ${numeroRecu(paiement.id)}`}
      sousTitre={`${paiement.code_menage || 'Foyer inconnu'} · ${montant(total)} · ${dateHeure(paiement.created_at)}`}
      taille="lg"
      pied={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Btn variant="ghost" onClick={onFermer}>Fermer</Btn>
          <span className="flex flex-wrap items-center gap-2">
            <Btn variant="ghost" onClick={copier}>
              {copie ? 'Reçu copié' : 'Copier le texte'}
            </Btn>
            <Btn variant="green" onClick={function () { imprimer(texte); }}>
              Imprimer le reçu
            </Btn>
          </span>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <BadgeStatut statut={paiement.statut} />
        {Number(paiement.penalite_gnf) > 0 ? (
          <Badge ton="or">Pénalité {montant(paiement.penalite_gnf)}</Badge>
        ) : null}
        {paiement.mois_regles ? (
          <Badge ton="teal">
            {nombre(paiement.mois_regles)} mois réglé{paiement.mois_regles > 1 ? 's' : ''}
          </Badge>
        ) : null}
        <span className="text-[12px] text-muted">{MODES[paiement.fournisseur] || paiement.fournisseur}</span>
      </div>

      {/* Ce que l'écran montre est mot pour mot ce qui sortira sur le papier. */}
      <div className="overflow-x-auto rounded-xl border border-line bg-white p-4">
        <pre className="m-0 font-mono text-[12px] leading-[1.45] whitespace-pre text-[#111]">
          {texte}
        </pre>
      </div>

      <p className="mt-3 mb-0 text-[11.5px] text-muted2">
        Format 80 mm, celui des imprimantes à reçu. Sur une imprimante de bureau, le
        reçu sort en haut de la feuille.
      </p>
    </Modal>
  );
}
