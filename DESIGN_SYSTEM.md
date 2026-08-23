# Design System — Lambanyi Propre

> **Origine.** Ce système est le portage direct du langage visuel de la **console CRRA / SAMU Guinée**
> (`etikam/samu_apps` → `console/`), dont l'architecture de tokens, la composition et les patterns
> UX sont repris à l'identique. Seule la **famille d'accent** change : le rouge urgence devient un
> **vert propreté**, cohérent avec le métier assainissement.
>
> Ce fichier est la **source de vérité**. Toute page du dashboard doit s'y conformer.
> Portage : Vite + React/TS → **Next.js App Router + JavaScript**, Tailwind v4.

---

## 0. Les sept principes

1. **Une section = un job.** Pas de page fourre-tout. Si un écran répond à deux questions métier, c'est deux écrans.
2. **Le chiffre est roi.** Toute métrique se lit en **mono tabulaire**, gros, sans décoration. Le texte l'explique en dessous, en petit et en gris.
3. **La ligne avant l'ombre.** On sépare avec `border-line`, jamais avec `shadow`. L'ombre est réservée aux éléments flottants (menus, modales, flyouts).
4. **Le fond porte l'information.** Panneau = `bg-panel` sur `bg-bg`. Pas de dégradé, pas de carte blanche posée sur du gris.
5. **La couleur est un statut, pas une décoration.** Chaque teinte a un sens fixe (§2.2). On n'utilise jamais une couleur « parce qu'elle est jolie ».
6. **Zéro dépendance graphique.** Les graphes sont faits main en CSS/SVG (§6). Pas de Chart.js, Recharts, ni ApexCharts.
7. **Densité maîtrisée.** Textes 10–13 px, interlignes serrés, mais respirations généreuses entre blocs (`gap-9`). Dense ≠ tassé.

---

## 1. Fondations techniques

### 1.1 Stack

| Élément | Choix |
|---|---|
| Framework | Next.js 16 App Router, **JavaScript** (`.js`, pas de TS) |
| CSS | Tailwind v4 (`@import "tailwindcss"` + bloc `@theme`) |
| Thème | Attribut `data-theme="dark" \| "light"` sur `<html>`, persisté en `localStorage` |
| Icônes | **SVG inline maison**, stroke `currentColor`, `strokeWidth="1.8"`, viewBox `0 0 24 24`. Aucune librairie d'icônes. |
| Graphes | CSS/SVG maison (`components/graphes.js`) |
| Cartes | Leaflet (déjà en place) |

### 1.2 Typographie

```
DM Sans            400 500 600 700   → --font-sans     (interface)
Instrument Serif   400 + italic      → --font-display  (titres éditoriaux)
```

| Rôle | Famille | Taille | Graisse | Usage |
|---|---|---|---|---|
| Titre de page | `font-display` | `27px` | 700 | H1 d'écran, un seul par page |
| Titre de modale / carte | `font-display` | `20px` / `16px` | 700 / 600 | |
| Sur-titre (kicker) | sans | `10px` | 400 | `tracking-[2.5px] uppercase text-muted2` — au-dessus du H1 |
| Titre de bloc | sans | `11px` | 400 | `tracking-[2.4px] uppercase text-muted` + filet inférieur |
| Titre de panneau | sans | `13px` | 400 | `tracking-wide uppercase text-muted` |
| Corps | sans | `12.5–13px` | 400 | |
| Légende | sans | `10–11px` | 400 | `text-muted2` |
| **Chiffre KPI** | **mono** | `32px` | 700 | `tabular-nums leading-none` |
| Chiffre secondaire | mono | `15–22px` | 700 | `tabular-nums` |
| Code / matricule / réf. | mono | `10–11.5px` | 400–700 | `tracking-wide` |

**Règle absolue :** tout nombre, identifiant, heure, montant ou pourcentage passe en `font-mono tabular-nums`.
Le serif (`font-display`) ne sort **que** pour les titres — jamais dans un tableau, jamais dans un badge.

### 1.3 Grille, rayons, espacements

| Jeton | Valeur | Usage |
|---|---|---|
| Rayon | `rounded-lg` (8px) | boutons, sous-liens, petites tuiles |
| | `rounded-xl` (12px) | panneaux, champs, menus, tuiles d'action |
| | `rounded-2xl` (16px) | grandes cartes de liste |
| | `rounded-full` | pastilles, badges compteur, chips d'état |
| Écart intra-bloc | `gap-2` → `gap-3` | éléments d'une même ligne |
| Écart inter-blocs | `gap-9` (36px) | entre deux sections d'une page |
| Écart de grille | `gap-x-10 gap-y-9` | grille principale d'un écran |
| Padding panneau | `px-4 py-3` (en-tête) · `p-4` (corps) | |
| Padding page | `px-5 py-4 pb-8` | conteneur `<main>` |
| Hauteur topbar | `60px` | fixe |
| Sidebar | `268px` épinglée · `56px` repliée | transition 300 ms |

---

## 2. Couleur

### 2.1 Tokens — `app/globals.css`

```css
@import "tailwindcss";

@theme {
  --font-sans: "DM Sans", "Segoe UI", system-ui, sans-serif;
  --font-display: "Instrument Serif", Georgia, serif;
  --font-mono: "SFMono-Regular", Consolas, "Roboto Mono", ui-monospace, monospace;

  --color-bg: var(--lp-bg);
  --color-bg2: var(--lp-bg2);
  --color-panel: var(--lp-panel);
  --color-panel2: var(--lp-panel2);
  --color-line: var(--lp-line);
  --color-line2: var(--lp-line2);
  --color-txt: var(--lp-txt);
  --color-muted: var(--lp-muted);
  --color-muted2: var(--lp-muted2);
  --color-green: var(--lp-green);
  --color-greend: var(--lp-greend);
  --color-gold: var(--lp-gold);
  --color-teal: var(--lp-teal);
  --color-blue: var(--lp-blue);
  --color-red: var(--lp-red);
  --color-violet: var(--lp-violet);
}

/* Sombre — thème par défaut */
:root,
[data-theme="dark"] {
  --lp-bg:      #0c1a16;   /* fond d'application */
  --lp-bg2:     #0a1613;   /* fond sidebar, champs en creux */
  --lp-panel:   #12251f;   /* surface de panneau */
  --lp-panel2:  #16302a;   /* surface active / survol */
  --lp-line:    #22453a;   /* filet standard */
  --lp-line2:   #2e5a4b;   /* filet appuyé, bordure de contrôle */
  --lp-txt:     #eaf5ef;   /* texte principal */
  --lp-muted:   #8dbca8;   /* texte secondaire */
  --lp-muted2:  #5e8a76;   /* texte tertiaire, légendes */
  --lp-green:   #1fa971;   /* ACCENT PRIMAIRE — marque, actif, CTA */
  --lp-greend:  #168054;   /* accent enfoncé */
  --lp-gold:    #e0a93b;   /* alerte, en attente, retard */
  --lp-teal:    #16b39b;   /* validé, payé, en ligne */
  --lp-blue:    #3e86b5;   /* information, tournées, neutre actif */
  --lp-red:     #e0323f;   /* critique, impayé, signalement urgent */
  --lp-violet:  #8c7bd8;   /* catégorie supplémentaire (graphes) */
  color-scheme: dark;
}

/* Clair — même langage, contrastes inversés */
[data-theme="light"] {
  --lp-bg:      #eef4f0;
  --lp-bg2:     #e3ece7;
  --lp-panel:   #ffffff;
  --lp-panel2:  #f4f9f6;
  --lp-line:    #c9dbd2;
  --lp-line2:   #a9c4b7;
  --lp-txt:     #0c1a16;
  --lp-muted:   #4f7565;
  --lp-muted2:  #71947f;
  --lp-green:   #0f8f5c;
  --lp-greend:  #0a6b44;
  --lp-gold:    #b8860b;
  --lp-teal:    #0f8f7c;
  --lp-blue:    #2a6f9a;
  --lp-red:     #c62834;
  --lp-violet:  #6a58bd;
  color-scheme: light;
}
```

### 2.2 Sémantique — un token, un sens

| Token | Sens **unique** | Exemples Lambanyi |
|---|---|---|
| `green` | Marque · action primaire · élément actif | logo, CTA « Enregistrer », lien de nav actif, marqueur d'onglet |
| `teal` | Succès · à jour · en ligne | abonnement actif, paiement encaissé, API en ligne, ménage collecté |
| `gold` | Attente · retard · vigilance | paiement en retard, signalement `en_cours`, tournée en cours |
| `red` | Critique · échec · impayé | signalement `nouveau`, abonnement impayé, dépotoir sauvage, suppression |
| `blue` | Information · neutre actif | tournées planifiées, points de dépôt, focus ring |
| `violet` | 6ᵉ catégorie de graphe uniquement | segments de donut |
| `muted2` | Inactif · résolu · archivé | signalement `rejete`, ménage inactif |

**Interdits :** un vert pour dire « info », un bleu pour dire « OK », une couleur ad hoc en dur (`#22c55e`)
hors du bloc de tokens. Les couleurs Tailwind natives (`bg-green-700`, `text-gray-500`…) sont **bannies**
du code applicatif — on n'utilise que les tokens (`bg-panel`, `text-muted`, `border-line`…).

### 2.3 Teintes dérivées

Toute variante translucide se fabrique en `color-mix`, jamais avec une opacité sur l'élément :

```
bg-[color-mix(in_srgb,var(--lp-gold)_15%,transparent)]      /* fond de badge  */
border-[color-mix(in_srgb,var(--lp-gold)_40%,transparent)]  /* filet de badge */
```

Barème : **fond 12–16 %**, **filet 40–50 %**, **halo 18–22 %**.

---

## 3. Le shell applicatif

Grille racine — rail fixe à gauche, topbar + main à droite. **La colonne ne change jamais de
largeur** : aucune transition de grille, aucun reflow du contenu.

```
grid h-full grid-rows-[60px_1fr]
grid-template-columns: 56px 1fr
```

### 3.1 Deux régimes, une punaise

La barre a **deux régimes**, commandés par la **punaise** logée dans l'en-tête du panneau
(ou `Alt+B`). La préférence est persistée.

| Régime | Colonne de grille | Comportement |
|---|---|---|
| **Épinglée** | `268px` | Le panneau occupe sa propre colonne. Le contenu se décale, comme n'importe quelle barre latérale classique. |
| **Détachée** | `56px` | Un rail d'icônes. Le panneau se révèle **par-dessus** le contenu au survol ou au focus clavier, sans le décaler d'un pixel. |

**La commande vit dans le panneau qu'elle épingle**, à droite du bloc de marque — pas sur la
bordure. On épingle ce qu'on est en train de regarder : le geste est « je garde ça ouvert », pas
« je manœuvre une colonne ». Bouton `size-7 rounded-lg`, `aria-pressed` porte l'état.

La punaise est **couchée** (`rotate-45`, `text-muted2`) quand la barre n'est pas retenue, **droite**
(`bg-panel2 text-green`) quand elle l'est — la métaphore se lit sans libellé.

C'est aussi le **premier élément focusable du panneau** : un utilisateur au clavier tabule dans la
barre, ce qui la révèle, et tombe immédiatement sur la punaise pour la retenir.

L'`<aside>` est **toujours en `data-theme="dark"`**, même quand l'app est en clair : la barre foncée
tranche sur le contenu au lieu de se fondre en gris. `bg-bg2`, `z-40`.

**Le rail (56 px, `aria-hidden`)** — purement visuel, il n'est monté qu'en régime replié ; le panneau
porte la navigation réelle, et dupliquer les liens doublerait l'arbre pour un lecteur d'écran.
Pictogramme de marque dans une bande de 60 px · une icône `size-10 rounded-xl` par section, la
section active en `bg-panel2 text-green` avec une **barre verte 3 px** au bord gauche (`lp-indicator`)
et son badge en `absolute -top-1 -right-1` · avatar dans une bande de 60 px en bas.

**Le panneau (268 px)** — `absolute inset-y-0 left-0 z-30`, même `bg-bg2` que le rail. Transition
200 ms sur `opacity` + `translate-x`. Fermé il garde `pointer-events-none` mais **reste dans l'ordre
de tabulation** : c'est ce qui permet au focus clavier de le rouvrir. L'ombre portée
(`shadow-[18px_0_50px_rgba(0,0,0,.45)]`) ne s'applique **qu'en régime replié**, où le panneau
recouvre le contenu ; épinglé, il est dans sa colonne et n'en a pas besoin.

Marque, icônes de section et avatar occupent la **même position x** dans les deux couches
(`px-2`, `size-[34px]`, `size-10`, `size-9`) : le panneau se lit comme une croissance du rail, pas
comme un calque distinct.

**Ouverture / fermeture du panneau volant** (sans effet en régime épinglé) :

| Déclencheur | Effet |
|---|---|
| `onMouseEnter` / `onMouseLeave` sur l'`<aside>` | ouvre / ferme |
| `onFocus` sur l'`<aside>` | ouvre |
| `onBlur` dont la `relatedTarget` sort de l'`<aside>` | ferme |
| `Échap` | ferme **et** `blur()` l'élément actif — sinon le focus rouvre aussitôt |
| Changement de route | ferme |

### 3.2 Une navigation qui porte ses chiffres

Le parti pris interne : **le panneau n'est pas une liste de liens, c'est un instrument**. Chaque
destination affiche son chiffre du moment, à droite de son libellé — on sait ce qu'il y a derrière
avant de cliquer.

Deux registres, jamais les deux à la fois sur une même ligne :

- **Badge d'alerte** — pastille pleine `rouge` ou `or`, pour ce qui réclame une action
  (signalements à traiter, paiements à confirmer). Animée `lp-badge-pop`, plus `lp-pulse-red` si
  urgent, `99+` au-delà de 99.
- **Compteur** — sinon, la volumétrie en mono `text-[11px] tabular-nums text-muted2`, abrégée en
  `k` au-delà de 999. Neutre par nature : il informe, il n'appelle pas.

Le rail, lui, ne montre que les **alertes** : une section y hérite du badge le plus urgent de ses
enfants (rouge > or). La volumétrie n'a pas sa place sur 56 px.

**Le fil vert.** Quand une section est active, le filet vertical qui tient ses sous-liens passe de
`border-line2` à `border-green/50`. Un trait continu relie ainsi l'icône verte à ses destinations —
la position dans l'arbre se lit sans compter les indentations.

**Modèle de données.** Chaque section porte `id`, `titre`, `domaine` (sigle mono en étiquette),
`description`, `Icon`, et ses `liens` (`{ to, label, end?, disponible }`). Le shell alimente deux
dictionnaires indexés par chemin : `badges` (`{ valeur, tone, pulse }`) et `compteurs` (nombre).

Tout est déplié en permanence — il y a la place, et un accordéon ajouterait un clic pour rien. Deux
rendus selon la section :

- **Section à lien unique** : la ligne d'en-tête **est** le lien (icône `size-10`, titre 12.5 px,
  badge ou compteur, étiquette `domaine`).
- **Section à plusieurs liens** : en-tête non cliquable (icône + titre 10 px `tracking-[1.5px]
  uppercase` + étiquette), puis les sous-liens indentés `ml-[27px] pl-3` derrière le filet.

**Sous-lien** : pastille 6 px (verte si actif) + label + `kbd` de raccourci révélé au survol
(`opacity-0 → 60`) + badge **ou** compteur + pastille « bientôt » si non livré.

**Raccourcis :** `Alt+B` plie/déplie · `Alt+1…9` mènent aux neuf premiers liens disponibles.

### 3.3 Topbar (60 px)

Fond en dégradé subtil (`.lp-topbar`), `border-b border-line`, de gauche à droite :

1. **Jeton d'identité** — encadré `rounded-full border-line2`, mono, ex. `Commune de **Lambanyi**`.
2. **Barre de recherche** — c'est un **bouton**, pas un input : ouvre la palette de commandes.
   `max-w-md`, icône loupe, texte « Rechercher… », `kbd` `Ctrl K` à droite.
3. Spacer `flex-1`.
4. **Contexte territorial** — chip mono du périmètre du compte (quartier / commune).
5. **État de connexion** — pastille 8 px, teal pulsée si en ligne, rouge sinon + libellé.
6. **Horloge** — mono 19 px `tabular-nums`, rafraîchie à la seconde.
7. **Bascule de thème** — bouton carré, soleil/lune.

### 3.4 Palette de commandes (`Ctrl/Cmd+K`)

Modale de recherche floue sur **toutes les destinations de nav** + les **actions rapides** (profil,
thème, déconnexion). Recherche normalisée (sans accents, insensible à la casse), navigation clavier
↑ ↓ Entrée Échap, résultats groupés par section avec l'étiquette `domaine`.

### 3.5 Main

`min-w-0 overflow-auto px-5 py-4 pb-8`. Le `<body>` est en `overflow-hidden` : **seul le main défile**.

---

## 4. Primitives — `components/ui.js`

| Composant | Signature | Rendu |
|---|---|---|
| `cn(...)` | classes conditionnelles | `parts.filter(Boolean).join(' ')` |
| `PageHeader` | `{ kicker, titre, sousTitre, actions }` | kicker 10 px tracké + H1 serif 27 px + phrase 12.5 px `text-muted`, actions à droite |
| `Bloc` | `{ titre, extra, delai, children }` | Titre 11 px `tracking-[2.4px] uppercase` + filet inférieur, `extra` aligné à droite. **Bloc éditorial : pas de fond, pas de bordure.** Animé `lp-rise` avec `animationDelay`. |
| `Panel` | `{ titre, action, children }` | Panneau encadré : `rounded-xl border-line bg-panel`, en-tête à filet, corps `p-4`. |
| `Kpi` | `{ valeur, label, tone }` | Bloc compact : chiffre mono 22 px + label 10 px `uppercase text-muted` |
| `Compteur` | `{ label, valeur, sous, tone, to, graphe, accent }` | KPI **cliquable** du bandeau pouls : label 9.5 px tracké, chiffre mono 32 px, sous-texte 11 px, sparkline |
| `Badge` | `{ ton, children }` | `rounded-md px-2 py-0.5 text-[11px] font-semibold`, fond 15 % / texte plein |
| `Chip` | `{ actif, onClick, children }` | Filtre : `rounded-lg px-2.5 py-1 text-[11px] font-semibold` |
| `Btn` | `{ variant: 'ghost'\|'green'\|'red'\|'gold'\|'blue' }` | `rounded-lg px-3.5 py-2.5 text-[13px] font-semibold`, `hover:brightness-110` |
| `EmptyState` | `{ children }` | `py-8 text-center text-[13px] text-muted2` — **une phrase + un CTA maximum** |
| `Modal` | `{ ouvert, onFermer, titre, sousTitre, taille, pied }` | Backdrop flouté + panneau animé, en-tête / corps scrollable / pied collant |
| `ModalConfirmation` | `{ titre, message, danger, pending }` | Modale `sm` avec Annuler / Confirmer |
| `PaginationBar` | `{ page, pages, total, onChange }` | Filet supérieur, « N résultats · page X/Y » en mono à gauche, Précédent/Suivant à droite |

**Focus** : toute cible interactive porte `outline-none focus-visible:ring-2 focus-visible:ring-blue`.
**Curseur** : tout élément cliquable porte `cursor-pointer` (Tailwind v4 ne le met plus sur `<button>`).
**Désactivé** : `disabled:cursor-not-allowed disabled:opacity-40`.

### 4.1 Briques de liste — `components/liste.js`

Tous les écrans de liste sont montés sur ces briques ; on ne réécrit jamais une toolbar à la main.

| Composant | Rôle |
|---|---|
| `CarteListe` | Enveloppe `rounded-2xl border-line bg-panel` : en-tête (titre + décompte + outils), rangée de chips, corps, pied |
| `BandeauMetriques` | Rangée de compteurs propre à l'écran — plus compacte que le bandeau pouls du tableau de bord |
| `Recherche` | Input 192 px, loupe en absolu à gauche, `bg-bg2` |
| `SelectFiltre` | `select` `appearance-none` + chevron en absolu |
| `Tableau` / `Tr` / `Td` | Tableau dense : `th` 10 px `uppercase`, `td` 12.5 px, entrée `lp-rise` décalée de 30 ms par ligne. `Td` accepte `mono`, `fort`, `align` |
| `usePagination` | Découpe la liste et **ajuste la page pendant le rendu** (pas dans un effet) quand la sélection change |
| `exporterCsv` | CSV point-virgule, BOM UTF-8 pour qu'Excel lise les accents |
| `EnteteImpression` | Bloc visible à la seule impression : commune, filtre courant, date d'édition |

### 4.2 Règles d'état

Le lint React de Next (`react-hooks/*`) interdit les rendus en cascade. Trois conséquences :

- **Ne jamais appeler `setState` synchroniquement dans un effet.** Pour dériver un état d'une prop
  qui change, faire l'**ajustement pendant le rendu** (`if (vu !== prop) { setVu(prop); … }`) — le
  motif que React recommande. `usePagination`, la palette et le guichet fonctionnent ainsi.
- **Aucun appel impur pendant le rendu** : pas de `Date.now()` dans un `useMemo` ni dans le corps
  d'un composant. On fige l'horodatage dans l'état au moment du chargement des données.
- **Aucune mutation de variable externe** depuis un `map` de rendu — utiliser `reduce`.

Le chargement des données reste fait dans un `useEffect`, avec une dérogation `eslint-disable`
commentée : le correctif propre serait une couche de données (React Query, Suspense), non introduite
ici.

### 4.3 Badges de statut — mapping métier

```js
// components/ui.js
const STATUTS = {
  // Abonnements / paiements
  actif:      { ton: 'teal',   libelle: 'Actif' },
  impaye:     { ton: 'red',    libelle: 'Impayé' },
  en_retard:  { ton: 'gold',   libelle: 'En retard' },
  suspendu:   { ton: 'muted',  libelle: 'Suspendu' },
  // Signalements
  nouveau:    { ton: 'red',    libelle: 'Nouveau' },
  en_cours:   { ton: 'gold',   libelle: 'En cours' },
  resolu:     { ton: 'teal',   libelle: 'Résolu' },
  rejete:     { ton: 'muted',  libelle: 'Rejeté' },
  // Tournées
  planifiee:  { ton: 'blue',   libelle: 'Planifiée' },
  en_route:   { ton: 'gold',   libelle: 'En route' },
  terminee:   { ton: 'teal',   libelle: 'Terminée' },
}
```

Un statut inconnu retombe sur `muted` et son code affiché avec les `_` remplacés par des espaces.

---

## 5. Patterns de page

### 5.1 Écran « Vue d'ensemble » (dashboard)

Ordre imposé, de haut en bas :

1. **En-tête éditorial** — kicker + H1 serif à gauche ; filtres, bascule démo et date longue à droite.
2. **Signature graphique** — une ligne SVG animée pleine largeur, propre au métier
   (le SAMU a un tracé ECG ; ici : **une ligne d'horizon de quartier / silhouette de tournée** parcourue
   par une impulsion verte). Décorative, `aria-hidden`, 36 px de haut.
3. **Actions rapides** — 4 tuiles `grid-cols-2 md:grid-cols-4` : icône dans un carré teinté 36 px
   (`color-mix` 14 % de l'accent), titre 12 px, sous-titre 10 px. `hover:-translate-y-px`.
4. **Bandeau pouls** — 5 `Compteur` cliquables, `border-y border-line py-5`, séparés par
   `lg:divide-x lg:divide-line`, chacun avec sa sparkline.
5. **Rangée 1** — `xl:grid-cols-12` : histogramme d'activité 24 h (`col-span-8`) + donut et barre de
   répartition empilés (`col-span-4`).
6. **Rangée 2** — journal temps réel (`col-span-7`) + parcours/jauge (`col-span-5`).
7. **Périmètre plateforme** — tuiles de toutes les sections de nav avec pastille
   « Opérationnel / Bientôt ».

Chaque bloc est animé `lp-rise` avec un `animationDelay` **croissant de 40 ms** (0, 40, 60, 90, 120, 160…)
— l'écran se construit du haut vers le bas.

### 5.2 Écran de liste

```
PageHeader (kicker + H1 + phrase)          [Exporter] [+ Nouveau]
+-- rounded-2xl border-line bg-panel ---------------------------+
| En-tête : titre 16px + « N résultats »   [filtre] [q] [tri v] |
+---------------------------------------------------------------+
| Rangée de chips de filtre                                     |
+---------------------------------------------------------------+
| Lignes                                                        |
+---------------------------------------------------------------+
| PaginationBar                                                 |
+---------------------------------------------------------------+
```

- **Recherche** : `input` 176 px, icône loupe en absolu à gauche, `bg-bg2 border-line rounded-xl`.
  Sur les écrans denses, variante **dépliable** (36 px fermée → `max-w-md` ouverte, point teal si une
  requête est active en arrière-plan).
- **Tri** : `select` `appearance-none` + chevron en absolu, libellés « Trier · Code ».
- **Chips** : rangée à filet inférieur, actif = `bg-panel2 text-txt`, inactif = `text-muted`.
- **Ligne de liste éditoriale** (préférée au tableau quand la ligne a une hiérarchie) :
  rail de couleur 3 px à gauche + ligne de métadonnées (badges, réf. mono, « il y a X ») + titre serif
  17–20 px + lieu/contact + barre de progression, et à droite une colonne mono (heure + code).
  `hover:bg-[color-mix(in_srgb,var(--lp-txt)_2.5%,transparent)]`, animée `lp-rise` avec
  `delay = min(rang,10) * 45ms`.
- **Tableau** réservé aux données homogènes : `th` en 10 px `uppercase tracking-wide text-muted`,
  `td` en 12.5 px, filets `border-line`, chiffres en mono.

### 5.3 Écran de détail

**Bandeau meta + corps + rail latéral** :

- Bandeau : fil d'Ariane, titre serif, badges de statut, méta (« créé par · il y a X · priorité »), actions.
- Corps (2/3) : contenu principal, timeline de jalons verticale, formulaires.
- Rail (1/3) : `Panel` d'informations, activité récente, historique.

### 5.4 États

| État | Rendu |
|---|---|
| Chargement | Le chiffre devient `—`. **Pas de spinner plein écran**, pas de skeleton animé. |
| Vide | `EmptyState` : une phrase qui explique *pourquoi* c'est vide + un CTA. |
| Erreur | Bandeau `border-red` / fond rouge 14 % au-dessus du contenu, texte factuel + bouton Réessayer. |

---

## 6. Graphes — `components/graphes.js`

Faits main, sans dépendance. Chaque composant reçoit des **valeurs déjà agrégées** ; aucun fetch dedans.

| Composant | Forme | Usage |
|---|---|---|
| `MiniBarres` | sparkline `h-5`, dernière barre en accent, les autres en `line2` | sous chaque `Compteur` |
| `BarresActivite` | histogramme horaire multi-séries, `h-44`, 5 lignes de grille, légende + « pic · N », axe filtré 1/4 | activité 24 h |
| `Donut` | `conic-gradient` 104 px, trou central `inset-[9px] bg-bg` avec total mono + label, légende en liste (pastille · label · valeur · %) | répartitions |
| `BarresReparties` | lignes `grid-cols-[92px_1fr_auto]`, piste `bg-line` + remplissage coloré `rounded-full h-2` | parcours par statut |
| `Jauge` | même `conic-gradient` que le donut mais **une seule valeur**, % au centre, `<dl>` de détail à droite | taux de couverture, flotte |

Règles : transitions `duration-500/700` sur `height`/`width` uniquement · `role="img"` + `aria-label`
récapitulatif · message de vide en 12 px `text-muted2` · les couleurs viennent des tokens.

---

## 7. Mouvement

```css
@keyframes lp-rise      { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:none } }
@keyframes lp-pulse     { 0%,100% { opacity:1; transform:scale(1) } 50% { opacity:.55; transform:scale(.85) } }
@keyframes lp-pulse-ring{ 0%   { box-shadow:0 0 0 0 color-mix(in srgb,var(--lp-green) 55%,transparent) }
                          70%  { box-shadow:0 0 0 9px transparent }
                          100% { box-shadow:0 0 0 0 transparent } }
@keyframes lp-badge-pop { 0% { transform:scale(.4); opacity:0 } 70% { transform:scale(1.15) } 100% { transform:scale(1); opacity:1 } }
@keyframes lp-indicator { from { transform:translateY(-50%) scaleY(0) } to { transform:translateY(-50%) scaleY(1) } }
@keyframes lp-modal-pop { from { opacity:0; transform:translateY(12px) scale(.97) } to { opacity:1; transform:none } }
```

| Intention | Durée | Courbe |
|---|---|---|
| Survol, couleur | 150 ms | `ease` |
| Ouverture d'accordéon, flyout | 200–250 ms | `ease-out` |
| Pli de sidebar | 300 ms | `ease-out` |
| Entrée de bloc (`lp-rise`) | 450 ms | `ease-out`, décalé de 40 ms par bloc |
| Modale | 260 ms | `cubic-bezier(.22,1,.36,1)` |
| Barres de graphe | 500–700 ms | `ease` |

Toute animation décorative est préfixée `motion-safe:`, et le fichier se termine par le garde-fou
`@media (prefers-reduced-motion: reduce)` qui ramène toutes les durées à `0.01ms`.

---

## 8. Détails de finition

**Scrollbar** — piste transparente, pouce en pilule fine : zone 9 px, pouce visible 3 px obtenu par
`border: 3px solid transparent` + `background-clip: content-box`, épaissi à 5 px au survol. Les
propriétés Firefox (`scrollbar-width`) sont scopées dans `@supports not selector(::-webkit-scrollbar)`
pour ne pas désactiver le style webkit sur Chromium.

**Modale** — backdrop `color-mix(in srgb, var(--lp-bg2) 48%, transparent)` + `backdrop-filter: blur(8px)`,
panneau `max-height: min(88dvh, 760px)`, double ombre (portée + liseré), `body` verrouillé en
`overflow:hidden`, fermeture à l'Échap.

**Leaflet** — le conteneur remplit son pane flex (`z-index:0`, sous les modales), attribution en 9 px
sur fond translucide, contrôle de couches restylé (`rounded-10px border-line2 bg-panel/94 backdrop-blur`).
Les marqueurs suivent la palette (vert = point de dépôt actif, or = bac plein, rouge = dépotoir sauvage).

**Impression** — le bloc `@media print` existant est conservé et étendu : shell masqué, tableaux à
11 px, en-tête d'impression révélé, `@page A4 landscape`.

---

## 9. Ce qu'on n'importe pas

- Les cartes blanches à `shadow` posées sur fond gris (le pattern Bootstrap/Tailwind par défaut).
- Les couleurs Tailwind natives dans le code applicatif (`bg-green-700`, `text-gray-500`…).
- Les librairies de graphes, d'icônes ou de composants (shadcn, MUI, Chart.js…).
- Les dégradés décoratifs, les glassmorphismes, les emojis en guise d'icônes.
- Les spinners plein écran et les skeletons animés.
- Les tableaux qui affichent tout : on filtre, on trie, on pagine.
- Les tableaux de bord fourre-tout : une section = un job.

---

## 10. Checklist de revue

Avant de considérer un écran terminé :

- [ ] Un seul H1, en `font-display`, précédé de son kicker tracké.
- [ ] Tous les nombres en `font-mono tabular-nums`.
- [ ] Aucune couleur Tailwind native, aucun hex en dur hors `globals.css`.
- [ ] Chaque teinte utilisée respecte sa sémantique (§2.2).
- [ ] Séparation par `border-line`, pas par `shadow`.
- [ ] Chaque cible interactive : `cursor-pointer` + `focus-visible:ring-2 focus-visible:ring-blue`.
- [ ] État vide rédigé (une phrase + un CTA), état de chargement en `—`.
- [ ] Rendu vérifié en **thème clair** et en **thème sombre**.
- [ ] Rendu vérifié à **1280 px** et à **1440 px**, sidebar pliée **et** dépliée.
- [ ] Aucun défilement horizontal du `<body>`.
- [ ] `prefers-reduced-motion` respecté.
