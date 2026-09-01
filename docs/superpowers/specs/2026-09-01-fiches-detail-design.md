# Fiches d'entité — centre de pilotage

> Vague 1 du passage « annuaire → centre de décision ».
> Collecteur et ménage servent de pilotes. Le pattern se décline ensuite
> sur signalement, PME, tournée, paiement, point de dépôt.

**Statut :** livré Vague 1.
**App :** `lambanyi-dashboard` (Next.js 16 App Router, JavaScript, Supabase).
**Charte :** `DESIGN_SYSTEM.md` — notamment §5.2 (liste) et §5.3 (détail).

---

## 1. Problème

Le dashboard est visuellement abouti mais s'arrête à la couche listing.
Une ligne de collecteur ou de ménage n'ouvre rien. Les actions vivent
dans des modales déconnectées du dossier. On ne sent pas le produit :
on consulte un annuaire, on ne pilote pas.

Le design system décrit déjà l'écran de détail (bandeau meta + corps 2/3
+ rail 1/3). Il n'a jamais été monté.

## 2. Objectif Vague 1

Un agent de la commune peut :

1. Filtrer, paginer et parcourir l'annuaire des collecteurs / le registre
   des ménages **sans rien perdre** de ce qui existe déjà.
2. Ouvrir la **fiche** d'un collecteur ou d'un ménage en cliquant la ligne.
3. Lire identité, activité, historique — et **décider** (désactiver,
   réaffecter, souscrire, encaisser, imprimer QR).
4. Revenir à la liste **dans le même état** (filtres, recherche, page).

Critère de ressenti : après dix secondes sur une fiche, on sait *qui*
c'est, *où ça en est*, et *ce qu'on peut faire maintenant*.

## 3. Hors scope (vagues 2 et 3)

- Fiches signalement, PME, tournée, paiement, point de dépôt.
- Pages Administration (Quartiers, Paramètres) et Profil.
- Couche de données type React Query / Suspense.
- Nouvelle migration SQL — on consomme les tables et vues existantes
  (`collecteurs_activite`, `menages_solde`, `passages`, `depots`,
  `tournees`, `paiements`, `abonnements`, `profils`, `pme`).

---

## 4. Architecture de navigation

```
/dashboard/collecteurs              liste (état dans l'URL)
/dashboard/collecteurs/[id]         fiche

/dashboard/menages                  liste (état dans l'URL)
/dashboard/menages/[id]             fiche
```

### 4.1 L'état de liste vit dans l'URL

Recherche, chips, selects et page courante sont des **query params**.
Pas de `useState` orphelin qui se réinitialise au retour.

| Liste        | Params |
|--------------|--------|
| Collecteurs  | `q`, `filtre`, `page` |
| Ménages      | `q`, `quartier`, `statut`, `paiement`, `page` |

Règles :

- Toute mutation de filtre remet `page` à `1`.
- Valeurs par défaut omises de l'URL (`filtre=tous`, `page=1` n'apparaissent pas).
- Le lien « retour » de la fiche reprend la query string d'origine
  (`document.referrer` est trop fragile : on passe `from` en search param
  optionnel, sinon on reconstruit `/dashboard/collecteurs` nu).
- Le plus simple et robuste : **le bouton retour pointe vers le pathname
  de liste + `window.history`**. Concrètement, chaque lien de ligne est
  un `<Link href={/dashboard/collecteurs/${id}}>`. Le bouton « Retour »
  de la fiche appelle `router.back()` s'il existe un historique interne,
  sinon tombe sur la liste sans query. Pour que `back()` restaure filtres
  et page, **les filtres doivent être dans l'URL avant le clic**.

### 4.2 Identifiants

- Collecteur : `profils.id` (uuid), déjà exposé par `collecteurs_activite.id`.
- Ménage : `menages.id`, exposé par `menages_solde.menage_id`.
  La route utilise ce uuid, pas le `code_menage` (le code peut être
  affiché, il n'est pas la clé de routage).

---

## 5. Pattern Liste — ce qu'on ne casse pas

Les listes actuelles sont le bon outil de **découverte**. On les
enrichit, on ne les remplace pas par une galerie de cartes.

### 5.1 Conservé tel quel

- `PageHeader` + `BandeauMetriques` + `CarteListe`.
- Recherche, chips, `SelectFiltre`.
- `usePagination` (25 lignes / page) + `PaginationBar`.
- Export CSV (et impression ménages).
- Modales de création (nouveau collecteur, nouveau ménage).
- Colonne d'action courte (Désactiver, Abonner) — geste d'un clic,
  sans ouvrir la fiche.

### 5.2 Ligne cliquable

Toute la ligne ouvre la fiche, **sauf** les contrôles interactifs
(bouton d'action).

Implémentation :

- `Tr` accepte `href`. Le rendu pose un `<Link>` en overlay sur la
  première cellule (stretched link) **ou** un `onClick` + `router.push`
  sur la `<tr>` avec `role="link"` et `tabIndex={0}` + Entrée.
- Recommandation : **`<tr>` avec `onClick` / clavier**, le bouton d'action
  fait `stopPropagation`. Un `<a>` wrapping un `<tr>` est invalide HTML.
  Un `<Link>` dans chaque cellule est bruyant. La ligne-lien est le
  pattern déjà décrit au §5.2 du design system (« hover:bg mix 2.5 % »).
- Curseur `cursor-pointer` sur la ligne. Focus-visible ring sur la `<tr>`.
- Le nom (collecteur) / le code (ménage) reste le signal visuel primaire
  (fort, mono pour le code). Pas d'icône « œil » ni de bouton « Voir ».

### 5.3 Filtres — règles d'ergonomie

- Les **chips** portent le filtre métier principal (statut de service,
  situation de recouvrement). Un seul chip actif à la fois.
- Les **selects** portent les dimensions secondaires (quartier, statut
  foyer). Ils restent dans la toolbar, à droite de la recherche.
- Les **KPI du bandeau** de la liste ne naviguent pas ailleurs : un
  clic sur « Sans pointage 7 j » **applique le chip correspondant**.
  (Aujourd'hui les KPI collecteurs ne sont pas cliquables — on les
  rend filtres. Les KPI ménages qui recoupent un chip existent déjà
  en spirit ; on les branche de la même façon.)
- Un filtre actif se lit sans compter : chip en `bg-panel2`, et le
  sous-titre de `CarteListe` rappelle `N résultats · M au total`.
- Changer un filtre ne fait pas disparaître la pagination : si une
  seule page reste, `PaginationBar` se masque déjà (`pages <= 1` et
  `total === 0` seulement — **corriger** : masquer aussi quand
  `pages <= 1` et `total > 0` ? Non. Le design actuel affiche
  « N résultats · page 1/1 » même pour une page. On **garde** ce
  comportement : l'opérateur voit le décompte.)

### 5.4 Pagination — règles d'ergonomie

- 25 lignes sur les listes principales (inchangé).
- 10 lignes sur les journaux **à l'intérieur d'une fiche** (passages,
  dépôts, paiements) : le rail + le bandeau mangent de la hauteur,
  25 lignes forceraient un défilement de fiche interminable.
- `usePagination` déjà remet la page à 1 quand la liste filtrée change
  de taille. Conserver ce motif (ajustement pendant le rendu, pas
  d'effet).
- Avec l'URL : `page` est la source de vérité. `usePagination` devra
  accepter une page contrôlée (`page` / `onChange`) **ou** on lit
  `page` depuis `useSearchParams` et on ne garde de `usePagination`
  que le découpage `tranche`. Ne pas dupliquer deux états de page.

### 5.5 Tableaux denses

- En-tête de tableau **sticky** sous le chrome de `CarteListe` quand
  on scrolle le `<main>` : `th` en `sticky top-0 bg-panel z-10`.
  Le `<body>` ne scrolle pas (déjà vrai) ; seul `<main>` scrolle.
- Pas de scroll horizontal du body. Si une colonne déborde à 1280 px
  barre épinglée, `truncate` + `title` natif, jamais un `overflow-x`
  sur la page.
- Vérifier 1280 / 1440, sidebar épinglée et repliée, thèmes clair et
  sombre — checklist §10 du design system.

---

## 6. Pattern Fiche — disposition

Reprend `DESIGN_SYSTEM.md` §5.3. Une fiche n'est **pas** un listing
déguisé.

```
[← Retour]  Collecteurs  /  Amadou Diallo          ← fil d'Ariane, pas un second H1

┌─ Bandeau meta (pleine largeur) ─────────────────────────────────┐
│  Avatar · H1 serif (le seul) · badges · méta compacte           │
│  actions primaires à droite (1 à 3 boutons, pas plus)           │
└─────────────────────────────────────────────────────────────────┘

┌─ Corps  xl:col-span-8 ─────────────┐  ┌─ Rail  xl:col-span-4 ──┐
│  KPIs d'activité (BandeauMetriques │  │  Panel identité         │
│  plus compact que le pouls dash)   │  │  Panel actions secondaires│
│  Graphique 7 j                     │  │  Panel « lié »           │
│  Liste des tournées / abonnement   │  │                          │
│  Journal paginé + filtré           │  └──────────────────────────┘
└────────────────────────────────────┘
```

### 6.1 Breakpoints

| Largeur | Disposition |
|---------|-------------|
| `< xl` (typ. 1280 avec barre épinglée, contenu ~950 px) | Bandeau → KPIs → journal → rail empilé dessous. Le rail n'est pas du « footer perdu » : identité d'abord, puis actions, puis liés. |
| `≥ xl` | Grille 12 col, `gap-x-10 gap-y-9`. Corps 8, rail 4. |
| Mobile / étroit | Même empilement. Actions du bandeau passent sous le titre (`flex-wrap`), jamais hors écran. |

Le `<main>` existant (`px-5 py-4 pb-8`, seul à scroller) ne change pas.
Pas de second scroll interne sur la fiche, **sauf** le tableau d'un
journal s'il dépasse ~12 lignes visuelles — et dans ce cas on pagine
à 10, donc ça ne dépasse pas.

### 6.2 Bandeau meta

- Fil d'Ariane au-dessus : lien liste (avec query conservée via `back`)
  + séparateur `/` + libellé courant en `text-txt`.
- Un seul H1, `font-display` 27 px : le nom du collecteur ou le
  `code_menage` du foyer (le code est l'identité métier du foyer).
- Badges de statut à droite du titre, jamais dans le H1.
- Ligne de méta en 12 px `text-muted` : téléphone · quartier(s) ·
  dernier événement · « il y a X ».
- Actions : maximum **trois** boutons dans le bandeau. Le reste va
  dans le rail. Ordre : primaire (`green` ou `gold` selon le job) →
  secondaire ghost → destructif `red` en dernier.

### 6.3 Corps

Ordre imposé, haut → bas, `gap-9`, `lp-rise` décalé de 40 ms :

1. KPIs de **cette** entité (4 max). Chargement = `—`.
2. Un graphe d'activité (passages 7 j / 30 j, ou historique de solde).
3. Le bloc métier structurant (tournées affectées, ou abonnement + solde).
4. Le journal (passages, dépôts, paiements) — **filtré et paginé**.

### 6.4 Rail

Trois `Panel` empilés, rien de plus :

1. **Identité** — champs stables (email, PME, date d'inscription,
   type de foyer, nb personnes). Définition / valeur en grille
   `grid-cols-[92px_1fr]`, labels 10 px uppercase muted.
2. **Actions** — ce qu'on ne met pas dans le bandeau (réaffecter,
   imprimer QR, copier le code, ouvrir le registre des paiements
   préfiltré). Liens et boutons ghost, un par ligne.
3. **Lié** — raccourcis vers d'autres dossiers (PME, quartier une
   fois la page quartier livrée). Tant que la cible n'a pas de
   fiche, le libellé s'affiche en texte, pas en lien mort.

### 6.5 Journaux dans la fiche

Un journal sans filtre ni pagination recréerait le problème du listing.

Chaque journal :

- Chips de statut (Tous / Effectué / Absent / Inaccessible — passages).
- Select de période (7 j / 30 j / tout) **uniquement** s'il y a plus
  de 30 événements ; sinon le select disparaît (pas de contrôle vide).
- `PaginationBar` à 10 lignes.
- Ligne : rail de couleur 3 px + libellé + méta + horodatage mono à
  droite. Clic : **pas** de sous-fiche en Vague 1. On n'empile pas
  les niveaux. Exception : un paiement peut pointer vers
  `/dashboard/paiements` (liste existante), un ménage depuis le
  journal collecteur pointe vers `/dashboard/menages/[id]`.
- État vide rédigé (une phrase, pas de CTA concurrent du bandeau).

---

## 7. Fiche Collecteur

**Job de l'écran :** « Cet agent est-il en service, que fait-il, dois-je
intervenir ? »

### 7.1 Données

| Bloc | Source |
|------|--------|
| Identité, actif, téléphone, PME | `profils` + `pme.nom` |
| Quartiers, passages 7 j, dépôts 7 j, dernier pointage | `collecteurs_activite` |
| Tournées | `tournees` + `quartiers.nom`, `collecteur_id = id` |
| Passages | `passages` des 30 derniers jours, `collecteur_id`, jointure ménage (code, quartier) |
| Dépôts | `depots_detail` filtré `collecteur` / id |

Limites : `passages` `.limit(500)` + pagination client sur le sous-ensemble
filtré. On n'affiche pas l'historique intégral d'un agent de 2 ans.

### 7.2 Bandeau

- Titre : `nom_complet`.
- Badges : En service / Désactivé / Inactif 7 j (or) — même sémantique
  que la liste.
- Méta : téléphone · quartiers · dernier pointage (`ilYA`).
- Actions (3) : **Désactiver / Réactiver** · **Appeler** (`tel:`) si
  téléphone · tertiaire néant. « Réaffecter les tournées » vit dans
  le rail (ouvre la liste des tournées de l'agent, chacune avec un
  select collecteur — réutiliser le motif déjà présent sur
  `/dashboard/tournees`).

### 7.3 Corps

- KPIs : passages 7 j, dépôts 7 j, passages total, tournées actives.
- Spark / `MiniBarres` ou histogramme 7 jours si on agrège les
  passages par jour (7 barres). Pas de Chart.js.
- Bloc Tournées : tableau compact (jour, heure, quartier, actif).
  Ligne non cliquable en Vague 1.
- Journal Passages (chips statut + page 10) puis Journal Dépôts
  (page 10). Deux `Bloc` successifs, pas d'onglets : les onglets
  cachent de l'information de pilotage.

### 7.4 Actions métier

- Désactiver / réactiver : même confirmation qu'aujourd'hui
  (`profils.actif`). Copy inchangée (les tournées restent affectées).
- Réaffecter une tournée : `tournees.collecteur_id = autre`. Liste
  des collecteurs en service, hors l'agent courant.
- Pas de reset mot de passe en Vague 1 (pas d'API pour ça aujourd'hui).

### 7.5 Liste collecteurs — delta

- Ligne cliquable → fiche.
- KPI « Sans pointage 7 j » applique `filtre=inactifs_7j`.
- Query params `q`, `filtre`, `page`.
- Colonne action Désactiver **conservée** (stopPropagation).

---

## 8. Fiche Ménage

**Job de l'écran :** « Ce foyer est-il couvert, que doit-il, que
s'est-il passé à sa porte ? »

### 8.1 Données

| Bloc | Source |
|------|--------|
| Identité, solde, plan, échéance | `menages_solde` (filtre `menage_id`) |
| Position, propriétaire | `menages` |
| Historique abonnements | `abonnements` + `plans_tarifaires` |
| Paiements | `paiements_detail` filtré `code_menage` (ou via `abonnement_id`) |
| Passages | `passages` 30 j, `menage_id`, jointure collecteur |

### 8.2 Bandeau

- Titre : `code_menage` (mono interdit dans le H1 d'après la charte
  « le serif ne sort que pour les titres » — le code **est** le titre
  d'identité. On déroge explicitement : H1 en `font-display`, et le
  code est répété en mono dans le rail. Le H1 affiche le **point de
  repère** s'il est plus parlant, le code en kicker mono au-dessus.
  Décision : **kicker = code ménage en mono tracké**, H1 = point de
  repère (ou « Foyer » + quartier si repère vide).)
- Badges : statut foyer (`actif` / `suspendu`) + recouvrement
  (À jour / En dette N mois / Sans abonnement).
- Méta : quartier · type · téléphone · échéance.
- Actions (3) : **Encaisser** (si abonnement) **ou Souscrire** (si
  aucun) · **QR** (lien `/dashboard/qr-menages` ancré, ou modale QR
  déjà possible via `qrcode.react`) · **Suspendre** en dernier si
  actif.

### 8.3 Corps

- KPIs : solde dû, mois dus, passages 30 j, dernier passage.
- Bloc Abonnement : plan, dates, jauge « à jour / en dette » si
  applicable. Historique des abonnements en liste courte.
- Journal Paiements (chips statut, page 10).
- Journal Passages (chips statut, page 10).

### 8.4 Encaisser depuis la fiche

Ne pas recoder le guichet. Deux options évaluées :

1. Lien vers `/dashboard/paiements` en préremplissant la recherche
   avec le `code_menage` — le guichet actuel cherche déjà.
2. Extraire le formulaire d'encaissement en composant partagé.

Vague 1 retient **(1)** : `href=/dashboard/paiements?q={code_menage}`.
Le guichet paiements devra lire `q` à l'arrivée (petit delta, une
page déjà responsable de la recherche). Si `q` a ≥ 2 caractères, lancer
la recherche au montage. Pas d'extraction de composant tant que ce
n'est pas nécessaire.

Souscrire : **conserver la modale existante**, ouverte depuis la fiche
(et depuis la liste). Un seul flux de création d'abonnement.

### 8.5 Liste ménages — delta

- Ligne cliquable → fiche.
- KPI « Foyers en dette » / « Sans abonnement » / « À jour » appliquent
  le chip `paiement` correspondant.
- Query params `q`, `quartier`, `statut`, `paiement`, `page`.
- Bouton Abonner en colonne action **conservé** (stopPropagation).

---

## 9. Composants à extraire

Fichiers nouveaux, volontairement minces. On n'introduit pas de
librairie.

| Module | Contenu |
|--------|---------|
| `components/fiche.js` | `FilAriane`, `BandeauFiche`, `LigneMeta` (dt/dd du rail), `Journal` (enveloppe chips + liste + pagination) |
| `components/liste.js` | `Tr` gagne `href` / `onOuvrir` ; éventuellement `useEtatListe` (lecture/écriture searchParams) |

`FilAriane` : liens 12 px muted, courant en `text-txt`, séparateur `/`.
Pas de composant breadcrumb d'une lib.

`BandeauFiche` : `{ kicker, titre, badges, meta, actions, onRetour }`.
Le retour est un bouton ghost « ← » + libellé, pas seulement le fil.

`Journal` : `{ titre, chips, extra, pied, vide, children }`. C'est
`CarteListe` allégé (pas d'outils de recherche 192 px : trop lourd
dans une fiche). Recherche dans un journal = non, Vague 1. Les chips
suffisent.

Pas de `FicheCollecteur.js` générique fourre-tout : les pages
`app/dashboard/collecteurs/[id]/page.js` et
`app/dashboard/menages/[id]/page.js` assemblent les briques.

---

## 10. États, erreurs, a11y

- Fiche introuvable (uuid inconnu ou RLS) : phrase + lien retour liste.
  Pas de 404 Next brutale sans chrome.
- Chargement : chiffres `—`, journaux « Chargement… ». Pas de spinner
  plein écran.
- Erreur fetch : `BandeauErreur` + Réessayer.
- Focus : toute la ligne de liste et tout bouton de fiche portent
  `cursor-pointer` + `focus-visible:ring-2 focus-visible:ring-blue`.
- `prefers-reduced-motion` déjà global.
- Titre de document : `Collecteur · {nom}` / `Ménage · {code}` via
  `document.title` côté client (pas de metadata API, pages `'use client'`).

---

## 11. Design system — ajouts à `DESIGN_SYSTEM.md`

Après livraison, étendre §5.3 avec :

- état de liste dans l'URL ;
- ligne de liste cliquable (sauf action) ;
- journaux de fiche : 10 lignes, chips, pas d'onglets ;
- bandeau fiche : 3 actions max.

Aucune nouvelle couleur, aucune lib de graphe, aucun hex hors tokens.

---

## 12. Ordre de construction

1. Briques `fiche.js` + `Tr` cliquable + état de liste en URL (collecteurs).
2. Page `collecteurs/[id]` + delta liste collecteurs (KPI-filtres).
3. État de liste en URL (ménages) + `Tr` cliquable + KPI-filtres.
4. Page `menages/[id]` + lecture de `q` sur le guichet paiements.
5. Relecture charte (clair/sombre, 1280/1440, barre épinglée/repliée).

Chaque palier est utilisable sans le suivant.

## 13. Critères d'acceptation Vague 1

- [ ] Depuis l'annuaire collecteurs, un clic sur une ligne ouvre la fiche.
- [ ] Filtres + recherche + page survivent à l'aller-retour fiche.
- [ ] On peut désactiver un collecteur depuis la liste **et** depuis la fiche.
- [ ] La fiche collecteur montre tournées, passages paginés, dépôts paginés.
- [ ] Depuis le registre ménages, un clic ouvre le dossier foyer.
- [ ] Filtres quartier / statut / recouvrement + page survivent au retour.
- [ ] Depuis la fiche foyer on souscrit, on encaissera via le guichet
      prérempli, on voit paiements et passages paginés.
- [ ] Aucune liste (écran ou journal) n'affiche plus de 25 lignes d'un coup
      (10 dans une fiche).
- [ ] Aucun scroll horizontal du body. Checklist §10 du design system.
- [ ] Aucune couleur hors tokens.

---

## 14. Décisions tranchées (ne plus relitiger)

| Sujet | Choix |
|-------|--------|
| Pilotes | Collecteur **et** ménage, pas l'un sans l'autre |
| Navigation fiche | Routes `[id]`, pas un tiroir / pas une modale géante |
| État de liste | Query params |
| Ligne | Cliquable entière, actions en stopPropagation |
| Journaux de fiche | Chips + pagination 10, **pas d'onglets** |
| Encaissement | Lien vers le guichet existant avec `?q=` |
| Souscription | Modale existante réouverte depuis la fiche |
| SQL | Pas de nouvelle vue / migration en Vague 1 |
| Mot de passe collecteur | Pas en Vague 1 |
