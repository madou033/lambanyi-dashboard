# Identité visuelle « Pharmly » — dashboard Lambanyi

> Refonte de l’identité : le vert devient **barre + décision**, plus les
> murs. Référence visuelle fournie par l’utilisateur (dashboard pharmacie
> blanc / sidebar forêt).

**Statut :** design validé — en attente du plan d’implémentation.
**App :** `lambanyi-dashboard` uniquement.
**Référence :** image Pharmly (admin pharmacy) — identité, pas layout.
**Branche :** `theme/pharmly-identity`.

---

## 1. Problème

Le thème actuel teinte **toute** l’interface en vert (fonds forêt, textes
mint, CTA mint, teal voisin). On lit une serre, pas un centre de
pilotage. La charte exige déjà « les gris ne sont pas verts » en clair ;
le sombre viole cet esprit.

## 2. Objectif

Un agent communal ouvre le dashboard et ressent :

1. Une **barre de marque** verte (sidebar) — identité Lambanyi Propre.
2. Un **espace de travail neutre** (blanc / charbon froid) où le chiffre
   et le tableau dominent.
3. Le vert **uniquement** pour : logo, nav active, CTA primaire, pastilles
   métier choisies.
4. Les deux thèmes (clair / sombre) restent cohérents et passent
   `node scripts/contraste.mjs` à **0 échec**.

Critère de ressenti : en dix secondes, « outil communal propre », pas
« application entièrement verte ».

## 3. Hors scope

- Refonte des fiches une par une (collecteur, ménage…) au-delà de ce que
  les tokens + `BandeauMetriques` / badges propagent automatiquement.
- Refonte Leaflet / graphes SVG (ils suivent les tokens ; pas de redesign
  de forme).
- App mobile.
- Copie pixel-perfect de Pharmly (structure Products / Upgrade Pro, etc.).

---

## 4. Principes repris de la référence

| Pharmly | Lambanyi |
|---|---|
| Sidebar forêt saturée | Tokens **nav** dédiés, sidebar toujours « marque » |
| Contenu blanc / gris froid | Surfaces `bg` / `panel` **neutres** |
| KPI en cartes séparées | `BandeauMetriques` → grille de cartes, plus une bande `border-y` |
| Tuiles catégorie pastel | Composant `TuileCategorie` (opt-in sur listes qui en ont besoin) |
| Badges statut pastel | `Badge` / `BadgeStatut` déjà en `color-mix` — ajuster densités si besoin |
| Ligne avant ombre lourde | **Conservé** — pas d’ombre SaaS générique |

## 5. Architecture des tokens

### 5.1 Séparation chrome / contenu

Aujourd’hui la sidebar force `data-theme="dark"` et consomme `bg-bg2`.
Après : elle consomme des tokens **nav** indépendants du thème contenu.

| Token | Rôle |
|---|---|
| `--lp-nav` | Fond sidebar / rail |
| `--lp-nav2` | Panneau actif / survol dans la nav |
| `--lp-nav-line` | Filets dans la nav |
| `--lp-nav-txt` | Texte principal nav |
| `--lp-nav-muted` | Texte secondaire nav |
| `--lp-green` | Accent (CTA, actif) — punch lime sur nav sombre |

Les tokens contenu (`bg`, `bg2`, `panel`, `panel2`, `line`, `txt`,
`muted`…) deviennent **neutres** (ardoise / charbon froid), sans teinte
forêt.

### 5.2 Valeurs cibles (à peaufiner via `contraste.mjs`)

**Contenu — clair** (proche Pharmly) :

- `bg` ≈ `#F4F7F6` · `bg2` ≈ `#E8EEEC` · `panel` `#FFFFFF` · `panel2` ≈ `#F3F6F5`
- `line` / `line2` gris froid
- `txt` charbon · `muted` / `muted2` ardoise (pas mint)
- `green` foncé lisible (CTA sur blanc)

**Contenu — sombre** :

- `bg` / `panel` charbon froid (légère teinte possible ≤ 5 %, pas forêt)
- `muted` gris, pas mint
- `green` clair lisible (lime)

**Nav** (identique clair/sombre — la barre ne change pas avec le thème) :

- `nav` ≈ `#0B3D2E` · `nav2` ≈ `#0F4C3A`
- `nav-txt` clair · `nav-muted` vert désaturé clair
- Item actif : fond lime / `green` + `text-encre`

Les hex exacts sont figés dans `globals.css` après passage du script de
contraste (ajuster jusqu’à 0 échec).

### 5.3 Sémantique inchangée

`green` / `teal` / `gold` / `red` / `blue` / `violet` gardent leur sens
(§2.2 DESIGN_SYSTEM). Seules les **valeurs** et les **surfaces** bougent.

---

## 6. Changements UI

### 6.1 Shell (`Sidebar`, layout)

- Sidebar : `bg-nav`, textes `nav-txt` / `nav-muted`, filets `nav-line`.
- Item actif : aplat `green` + `text-encre` (comme la pastille lime Pharmly).
- Contenu `<main>` : fond `bg` neutre.
- Topbar : plus aérée si besoin, sans nouvelle teinte.

### 6.2 `BandeauMetriques`

Remplacer la bande unique `border-y` + `divide-x` par une **grille de
cartes** :

- chaque métrique = `rounded-xl border border-line bg-panel p-4`
- label uppercase muted · chiffre mono · sous-ligne optionnelle
- pastille / ton conservés (`ton`, `onClick`, `actif`)
- gap entre cartes (`gap-3`), plus de `divide-x`

Toutes les listes qui utilisent `BandeauMetriques` héritent du look.

### 6.3 `TuileCategorie` (nouveau, mince)

Carte compacte optionnelle : label + chiffre + ton d’accent en fond
pastel (`color-mix` 12–15 %). Première intégration : page **signalements**
(types) et/ou **vue d’ensemble** si un rang de catégories existe déjà —
sinon exposer le composant et brancher **un** écran pilote seulement
(signalements).

### 6.4 Badges / chips / densités

- Badges : garder le modèle pastel ; vérifier lisibilité après palette.
- Chips filtres : un peu plus d’air (`gap`, padding) sans grossir la typo.
- Tableaux : inchangés structurellement ; filets plus légers via tokens.

### 6.5 Design system

Mettre à jour `DESIGN_SYSTEM.md` §2 :

- règle : **vert = barre + décision, jamais les murs** ;
- documenter les tokens `nav*` ;
- recopier les hex finaux ;
- rappeler le script contraste (+ nav si tests ajoutés).

---

## 7. Vérifications

1. `node scripts/contraste.mjs` → 0 échec (étendre si tokens nav testés).
2. Parcours manuel clair **et** sombre, 1280 / 1440, barre épinglée /
   repliée : listes ménages, collecteurs, signalements, vue d’ensemble.
3. Aucun hex hors `globals.css`.
4. Aucune couleur Tailwind native.

## 8. Découpage suggéré

1. Tokens + contraste (+ tokens nav).
2. Sidebar / shell sur tokens nav.
3. `BandeauMetriques` en cartes.
4. `TuileCategorie` + branchement pilote signalements.
5. Docs DESIGN_SYSTEM + vérif visuelle.

## 9. Décisions tranchées

| Sujet | Choix |
|---|---|
| Portée | Refonte large (tokens + shell + KPI + tuiles + densités) |
| Branche | `theme/pharmly-identity` |
| Vert | Accent + nav, pas surfaces contenu |
| Nav vs thème | Nav fixe « marque » ; contenu suit clair/sombre |
| Ombre | Toujours ligne avant ombre |
| Mobile app | Hors scope |
