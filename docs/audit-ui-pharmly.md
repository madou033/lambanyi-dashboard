# Audit UI / UX — identité Pharmly

> Lecture pro des captures Playwright live (pas du spécimen HTML).  
> Objectif : garder la charte « vert = barre + décision », et remonter seulement ce qui empêche un ressenti de centre de pilotage communal.

| | |
|---|---|
| **App** | `lambanyi-dashboard` |
| **Branche** | `theme/pharmly-identity` |
| **Date** | 3 septembre 2026 |
| **Méthode** | Playwright · 1440 / 1280 · clair & sombre · barre épinglée & rail |
| **Captures** | 27 (dossier local `.audit/`, gitignoré) |
| **Script** | `scripts/audit-ui.mjs` |
| **Statut** | Validé · P0→P2 implémentés sur `theme/pharmly-identity` |

---

## Verdict global

L’identité Pharmly **tient** : barre forêt, murs neutres, vert sauge, listes en cartes. Ce n’est plus une serre verte. Le produit est déjà « pro » à ~80 %.

Les écarts restants sont surtout :

1. de **vérité d’état** (message vide sous des lignes) ;
2. de **cohérence** (pouls vue d’ensemble vs cartes des listes) ;
3. de **chrome sombre** (carte Leaflet claire).

---

## Synthèse

| Sévérité | Nombre |
|---|---|
| Critique | 1 |
| Majeur | 3 |
| Mineur | 4 |
| Solide (à conserver) | 2 |

---

## Ce qui est déjà au top

### F9 — Palette Pharmly tenue

Sidebar forêt, contenu ardoise / blanc, vert sauge (CTA + actif), KPI en cartes sur les listes, tuiles catégorie sur Signalements. Clair et sombre lisibles. Contraste AA déjà validé (`node scripts/contraste.mjs` → 0 échec).

### F10 — Nav instrument + régimes punaise

Badges / compteurs dans la barre, rail 56 px lisible, item actif sauge sur forêt, topbar sobre (recherche Ctrl+K, statut API, horloge). Pas de mur vert.

---

## Écarts à traiter

### F1 — Critique · Listes / `Tableau`

**Message « vide » toujours affiché sous les lignes**

Dans `components/liste.js`, `Tableau` rend la prop `vide` dès qu’elle est une chaîne non vide — même quand des lignes enfants existent. Sur Collecteurs (et potentiellement d’autres listes), on lit « Aucun collecteur ne correspond à ces filtres » sous 3 lignes valides.

- **Confiance** : haute (code + capture Playwright)
- **Effort** : XS — une condition

### F2 — Majeur · Vue d’ensemble

**Bandeau « pouls » encore en bande continue**

L’identité Pharmly a passé `BandeauMetriques` en cartes séparées sur les listes. La page `/dashboard` garde une grille `border-y` + `divide-x` (style ancien). C’est le premier écran vu après login : l’écart avec Signalements / Ménages casse la cohérence de la marque.

- **Effort** : S — aligner sur cartes + sparklines

### F3 — Majeur · Vue d’ensemble

**Empty state du graphe 24 h contradictoire**

Le panneau « Activité des dernières 24 heures » affiche « Aucune collecte ni signalement sur la période » alors que le donut à droite compte 6 signalements et le bandeau montre 2 à traiter. Le message mélange « aucune activité horaire aujourd’hui » et « aucun signalement en base ».

- **Effort** : S — clarifier le copy et/ou vrai empty state

### F4 — Majeur · Signalements

**Carte Leaflet hors thème en sombre**

En thème sombre, la tuile carte reste un fond OSM clair. Ça perce le chrome ardoise. Prévoir tuiles sombres (ou overlay) quand `data-theme=dark`.

- **Effort** : M

### F5 — Mineur · Signalements

**Toolbar filtres qui se déchire**

Chips + recherche + selects + « Toutes les périodes » : la dernière liste déroulante tombe seule sur une 2ᵉ ligne. Densité OK, rythme de wrap à peaufiner (une rangée de chips, une rangée d’outils).

- **Effort** : S

### F6 — Mineur · Shell / profil

**Nom et rôle identiques dans le pied de nav**

Le profil affiche « Administrateur » deux fois (nom + rôle). Soit le `nom_complet` en base est littéralement « Administrateur », soit le fallback masque l’identité.

- **Effort** : XS (données) / S (UI fallback)

### F7 — Mineur · Signalements / aging

**Badge Nouveau encore affiché après 24 h**

Une fiche « Nouveau · il y a 1 j » devrait déjà porter le registre « En retard » (SLA 24 h). La file mélange statut métier et aging — à unifier pour le pilotage.

- **Effort** : S

### F8 — Mineur · Tableaux

**Téléphones qui cassent en deux lignes**

Les numéros `+224…` passent souvent sur 2 lignes dans des colonnes étroites. `font-mono` + `whitespace-nowrap` (ou format compact) stabiliserait le rythme des rangées.

- **Effort** : XS

---

## Feuille de route recommandée

### P0 — Correctifs vérité

1. **F1** — `Tableau` : n’afficher `vide` que sans lignes.
2. **F3** — Copy empty state 24 h vs totaux.

Impact immédiat sur la confiance opérateur.

### P1 — Cohérence Pharmly

1. **F2** — Pouls vue d’ensemble → cartes.
2. **F5** — Toolbar Signalements en 2 rangées propres.

Alignement avec les listes déjà refaites.

### P2 — Finition pro

1. **F4** — Carte sombre.
2. **F7** — Aging Nouveau → En retard.
3. **F6 / F8** — Profil + téléphones.

---

## Hors scope volontaire

- Pas de refonte fiche-par-fiche
- Pas de redesign Leaflet (formes)
- Pas d’app mobile

---

## Prochaine étape

Choisir une tranche d’implémentation :

- **P0 + P1** (recommandé)
- **F1 seul** (critique)
- **Toute la feuille** P0 → P2
