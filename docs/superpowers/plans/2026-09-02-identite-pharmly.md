# Identité Pharmly — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Appliquer l’identité Pharmly au dashboard : sidebar forêt, contenu neutre, KPI en cartes, tuiles catégorie, contraste AA.

**Architecture:** Nouveaux tokens `nav*` pour le chrome latéral (indépendants du thème contenu). Surfaces contenu recalibrées (clair blanc/gris froid, sombre charbon). `BandeauMetriques` passe en grille de cartes. Composant mince `TuileCategorie` branché sur signalements. Aucun hex hors `globals.css`.

**Tech Stack:** Next.js 16, JavaScript, Tailwind v4, tokens CSS, `scripts/contraste.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-02-identite-pharmly-design.md`

## Global Constraints

- Branche `theme/pharmly-identity` uniquement — ne pas mélanger les fichiers sales hors thème déjà présents sur `main`.
- JavaScript uniquement.
- Hex uniquement dans `app/globals.css`.
- Sémantique tokens inchangée (`green` = marque/CTA, `teal` = succès, etc.).
- `text-encre` sur tout aplat d’accent.
- `node scripts/contraste.mjs` → 0 échec après toute retouche palette.
- Ligne avant ombre — pas d’ombre décorative type SaaS.
- Commits en français (`feat:`, `fix:`, `docs:`).
- Ne pas pusher tant que l’utilisateur ne le demande pas.
- Vérifier clair **et** sombre, barre épinglée **et** repliée.

## File map

| Fichier | Rôle |
|---------|------|
| Modify: `app/globals.css` | Palette contenu + tokens nav |
| Modify: `scripts/contraste.mjs` | Valider texte sur surfaces ; optionnel nav |
| Modify: `components/Sidebar.js` | Consommer `nav*` / actif lime |
| Modify: `components/liste.js` | `BandeauMetriques` en cartes |
| Create: `components/TuileCategorie.js` | Tuile pastel label + chiffre |
| Modify: `app/dashboard/signalements/page.js` | Rangée tuiles types (pilote) |
| Modify: `DESIGN_SYSTEM.md` | §2 tokens nav + règle murs neutres |

---

### Task 1: Tokens contenu + nav + contraste

**Files:**
- Modify: `app/globals.css`
- Modify: `scripts/contraste.mjs` (si nouveaux tokens à tester)
- Modify: `DESIGN_SYSTEM.md` (§2 valeurs — peut être finalisé en Task 5 si les hex bougent encore)

**Interfaces:**
- Produces: `--lp-nav`, `--lp-nav2`, `--lp-nav-line`, `--lp-nav-txt`, `--lp-nav-muted` exposés via `@theme` (`--color-nav`, etc.) ; nouvelles valeurs `--lp-bg`… pour clair et sombre

- [ ] **Step 1: Étendre `@theme`**

```css
--color-nav: var(--lp-nav);
--color-nav2: var(--lp-nav2);
--color-nav-line: var(--lp-nav-line);
--color-nav-txt: var(--lp-nav-txt);
--color-nav-muted: var(--lp-nav-muted);
```

- [ ] **Step 2: Recaler les palettes**

Cibles (ajuster jusqu’à contraste OK) :

**Clair — contenu**
```
bg #F4F7F6 · bg2 #E8EEEC · panel #FFFFFF · panel2 #F3F6F5
line #D5DDD9 · line2 #B0BBB5
txt #0F1714 · muted #3D4A44 · muted2 #5A6861
green #0B6B42 · greend #085032
```
(gold/teal/blue/red/violet : garder lisibilité AA ; retoucher si le script échoue)

**Sombre — contenu**
```
bg #101412 · bg2 #0C0F0D · panel #171C19 · panel2 #1C2320
line #2A322E · line2 #3A4540
txt #E8EEEC · muted #9AA59F · muted2 #7A8680
green #3DDB9A · greend #2BB87C
```

**Nav (même bloc clair et sombre, ou valeurs répétées)**
```
nav #0B3D2E · nav2 #0F4C3A · nav-line #1A5C47
nav-txt #EAF5EF · nav-muted #8FBEA8
```

Les poser dans :
- `[data-theme="dark"]` et `[data-theme="light"]` pour le contenu ;
- les tokens `nav*` **identiques** dans les deux blocs (barre fixe).

- [ ] **Step 3: Contraste**

```bash
node scripts/contraste.mjs
```

Expected: 0 échec. Si échec, ajuster muted / accents, jamais baisser le seuil.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css scripts/contraste.mjs
git commit -m "feat: palette neutre et tokens nav (identité Pharmly)"
```

---

### Task 2: Sidebar sur tokens nav

**Files:**
- Modify: `components/Sidebar.js`

**Interfaces:**
- Consumes: classes `bg-nav`, `bg-nav2`, `border-nav-line`, `text-nav-txt`, `text-nav-muted`, `bg-green`, `text-encre`

- [ ] **Step 1: Remplacer les surfaces de l’aside / rail / panneau**

- Fond aside : `bg-nav` (plus `bg-bg2`).
- Filets : `border-nav-line`.
- Textes : `text-nav-txt` / `text-nav-muted` à la place de `text-txt` / `text-muted` **dans la sidebar uniquement**.
- Item actif / survol fort : `bg-green text-encre` (et icône `currentColor`).
- Item inactif : `text-nav-muted`, hover `bg-nav2 text-nav-txt`.
- Conserver `data-theme="dark"` sur l’aside si utile pour des enfants, mais les couleurs viennent des tokens nav.

- [ ] **Step 2: Vérifier épinglée / repliée**

Rail 56 px + panneau volant : mêmes tokens, pas de flash `bg-bg2`.

- [ ] **Step 3: Commit**

```bash
git add components/Sidebar.js
git commit -m "feat: sidebar en barre de marque (tokens nav)"
```

---

### Task 3: BandeauMetriques en cartes

**Files:**
- Modify: `components/liste.js` (`BandeauMetriques`)

**Interfaces:**
- Consumes: API existante `{ label, valeur, sous?, ton?, onClick?, actif? }`
- Produces: même API, rendu cartes

- [ ] **Step 1: Remplacer le conteneur**

De :
```js
className="… border-y border-line py-4 … lg:divide-x …"
```
À une grille de cartes, par ex. :
```js
className="lp-rise mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
```

Chaque cellule :
```js
className={cn(
  'flex flex-col gap-1 rounded-xl border border-line bg-panel p-4',
  m.onClick && 'cursor-pointer outline-none transition-colors hover:bg-panel2 focus-visible:ring-2 focus-visible:ring-blue',
  m.actif && 'border-green ring-1 ring-green/30',
)}
```

Conserver `TONS`, `delai`, `aria-pressed`.

- [ ] **Step 2: Smoke visuel**

Ouvrir `/dashboard/menages` et `/dashboard/collecteurs` — cartes séparées, pas de bande continue.

- [ ] **Step 3: Commit**

```bash
git add components/liste.js
git commit -m "feat: bandeau métriques en cartes séparées"
```

---

### Task 4: TuileCategorie + pilote signalements

**Files:**
- Create: `components/TuileCategorie.js`
- Modify: `app/dashboard/signalements/page.js`

**Interfaces:**
- Produces: `<TuileCategorie label chiffre ton sous? onClick? actif? />`
- Tons: `green | teal | gold | red | blue | muted` via `color-mix` 12–15 % fond + filet 40 %

- [ ] **Step 1: Créer le composant**

```js
'use client';
import { cn, couleurTon } from '@/components/ui'; // ou token Tailwind text-*

export function TuileCategorie({ label, chiffre, ton = 'green', sous, onClick, actif }) {
  // fond color-mix(ton, 12%), border color-mix(ton, 40%)
  // chiffre mono, label 11px muted/uppercase
}
```

Pas de hex. Utiliser `var(--lp-*)` via classes ou `style` + `couleurTon` si déjà exporté.

- [ ] **Step 2: Brancher sur signalements**

Sous le header (ou au-dessus de la file) : une rangée de tuiles par type (`depotoir_sauvage`, `collecte_manquee`, `bac_plein`, `autre`) avec comptes dérivés de la liste chargée. Clic → applique `filtreType` (ou équivalent existant). Ne pas dupliquer une seconde source de vérité.

- [ ] **Step 3: Commit**

```bash
git add components/TuileCategorie.js app/dashboard/signalements/page.js
git commit -m "feat: tuiles catégorie sur la file des signalements"
```

---

### Task 5: Docs + vérif transversale

**Files:**
- Modify: `DESIGN_SYSTEM.md` (§2)
- Modify: `docs/superpowers/specs/2026-09-02-identite-pharmly-design.md` (statut → implémenté localement)

- [ ] **Step 1: Mettre à jour DESIGN_SYSTEM §2**

- Hex finaux (copiés de `globals.css`)
- Table tokens `nav*`
- Phrase : **vert = barre + décision, jamais les murs**
- Les gris ne sont pas verts — **aussi en sombre**

- [ ] **Step 2: Contraste + eslint ciblé**

```bash
node scripts/contraste.mjs
npx eslint components/Sidebar.js components/liste.js components/TuileCategorie.js app/dashboard/signalements/page.js
```

- [ ] **Step 3: Parcours navigateur**

Clair et sombre : vue d’ensemble, ménages, collecteurs, signalements (tuiles), sidebar épinglée/repliée. Pas de mur vert ; CTA et nav active verts.

- [ ] **Step 4: Commit**

```bash
git add DESIGN_SYSTEM.md docs/superpowers/specs/2026-09-02-identite-pharmly-design.md
git commit -m "docs: figer l'identité Pharmly dans le design system"
```

---

## Spec coverage

| Exigence | Task |
|---|---|
| Surfaces contenu neutres | 1 |
| Tokens nav | 1–2 |
| Contraste 0 échec | 1, 5 |
| Sidebar barre marque | 2 |
| KPI cartes | 3 |
| Tuiles catégorie pilote | 4 |
| DESIGN_SYSTEM | 5 |
| Vérif clair/sombre | 5 |

## Self-review

- Pas de refonte fiche par fiche (propagation tokens + bandeau).
- Fichiers sales hors thème sur `main` : **ne pas les staged** sur cette branche.
- Si `couleurTon` n’existe pas pour les tuiles, utiliser les classes Tailwind token (`bg-green` en mix via style `color-mix`).
