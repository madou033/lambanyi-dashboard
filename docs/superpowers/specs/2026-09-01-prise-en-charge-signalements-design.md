# Prise en charge des signalements — flux métier

> Passer d’un simple commutateur de statut à un produit : responsabilité,
> aging, affectation PME/agent, frise complète côté admin.

**Statut :** design validé — en attente du plan d’implémentation.
**Périmètre :** `lambanyi-db` · `lambanyi-dashboard` · `lambanyi-mobile`.
**Contexte admin :** personnel communal (`admin`, `superviseur`).
**Charte UI :** `DESIGN_SYSTEM.md` (§5.2 liste, §5.3 fiche).

---

## 1. Problème

Aujourd’hui le dashboard permet de basculer un signalement entre
`nouveau` → `en_cours` → `resolu` / `rejete` via des boutons. La PME
mobile peut déjà prendre en charge et résoudre. Mais :

- aucune **responsabilité explicite** (qui doit traiter ?) ;
- aucun **signal d’attente** quand un signalement stagne ;
- l’admin **ne voit pas la frise** ni le détail d’un dossier ;
- « notifier » n’existe pas : la PME découvre au mieux via le périmètre quartier.

C’est une application de statut, pas un produit de pilotage.

## 2. Objectif

Un agent communal peut :

1. Voir les signalements **en retard** (> 24 h encore `nouveau`).
2. **Affecter** un signalement à une PME, ou à un collecteur de cette PME.
3. Suivre jusqu’à clôture : qui a pris en charge, quelle PME, quand, avec quel motif.
4. Lire la **frise complète** sur une fiche dédiée.

Une PME (ou l’agent affecté) voit clairement sa **responsabilité** et
prend ensuite en charge (`en_cours`) puis clôture (`resolu`).

Critère de ressenti : après dix secondes sur la file admin, on sait
*ce qui pourrit*, *à qui c’est confié*, et *ce qu’il reste à faire*.

## 3. Hors scope (V1)

- E-mail, SMS, push, WhatsApp.
- Réouverture d’un dossier clos.
- SLA multi-seuils (48 h / 72 h) — un seul seuil 24 h suffit.
- Affectation à un agent communal hors PME.
- File collecteur riche au-delà de « mes affectations ».
- Changement du modèle de rejet (toujours réservé à la commune).

---

## 4. Flux métier

```
Citoyen / collecteur signale
        ↓
  statut = nouveau, non affecté
        ↓
  [si > 24 h et toujours nouveau] → pastille « En retard » (admin)
        ↓
  Admin affecte → PME  OU  collecteur d’une PME
        · colonnes d’affectation renseignées
        · événement frise (statut inchangé, en général nouveau)
        · file PME / agent : « Votre responsabilité »
        ↓
  PME ou agent « Prend en charge » → en_cours
        ↓
  Clôture → resolu (motif ≥ 10 car.)
           | rejete (admin seulement, motif ≥ 10 car.)
```

### Règles

| Règle | Détail |
|---|---|
| Affecter ≠ prendre en charge | L’affectation ne change pas le statut. |
| Aging | `statut = 'nouveau'` **et** `created_at < now() - interval '24 hours'`. Indépendant de l’affectation. |
| Cibles | PME entière (`assigne_collecteur_id` null) **ou** collecteur de cette PME. |
| Périmètre PME | La PME continue de voir les signalements de ses quartiers. Les affectés (à elle / à ses agents) sont **mis en avant**. Elle peut encore prendre en charge un non affecté de son quartier. |
| Réaffectation | Écrase les colonnes d’affectation + nouvel événement frise. |
| Rejet | Réservé au personnel communal, uniquement depuis `nouveau` (comportement actuel conservé). |

---

## 5. Modèle de données

### 5.1 Colonnes sur `signalements`

| Colonne | Type | Sens |
|---|---|---|
| `assigne_pme_id` | `uuid` → `pme(id)` ON DELETE SET NULL | PME responsable |
| `assigne_collecteur_id` | `uuid` → `profils(id)` ON DELETE SET NULL | Agent précis (optionnel) |
| `assigne_le` | `timestamptz` | Instant de l’affectation |
| `assigne_par` | `uuid` → `profils(id)` ON DELETE SET NULL | Admin / superviseur |

Contraintes d’intégrité applicatives (et check SQL si simple) :

- si `assigne_collecteur_id` est non null, `assigne_pme_id` l’est aussi ;
- le collecteur appartient à cette PME (`profils.pme_id = assigne_pme_id`) ;
- si l’une des colonnes d’affectation est posée, `assigne_le` et `assigne_par` le sont.

### 5.2 Frise `signalements_evenements`

Aucun nouveau statut enum. À l’affectation :

- insert d’un événement avec le **statut courant** du signalement (presque toujours `nouveau`) ;
- `auteur_id` = admin ;
- `message` lisible, ex. :
  - `Affecté à Salubrité Lambanyi SARL`
  - `Affecté à Mamadou Bah (Salubrité Lambanyi SARL)`
  - `Réaffecté à …`

Le trigger existant `signalement_refleter_statut` ne change rien si le statut
est identique — la frise s’enrichit sans boucler.

### 5.3 Vue utile (optionnelle mais recommandée)

`signalements_pilotage` (ou enrichissement de la sélection dashboard) :

- colonnes d’affectation + noms PME / collecteur ;
- booléen `en_retard` ;
- dernier événement (statut, message, auteur, date) pour l’aperçu liste.

Aging calculable aussi côté client ; la vue évite la divergence.

### 5.4 Notifications V1

Pas de canal externe. La notification = **visibilité dans la file** :

- badge / section « Votre responsabilité » (PME) ;
- file « À prendre en charge » (collecteur affecté) ;
- pastille « En retard » (admin).

---

## 6. Autorisations (RLS)

| Acteur | Affecter | Prendre en charge / résoudre | Rejeter | Lire frise |
|---|---|---|---|---|
| Admin / superviseur | oui | oui | oui (depuis `nouveau`) | oui |
| Gérant PME | non | oui (périmètre quartier **ou** affecté à sa PME / ses agents) | non | oui (mêmes dossiers) |
| Collecteur affecté | non | oui (dossiers où `assigne_collecteur_id = moi`) | non | oui (siens + affectés) |
| Citoyen | non | non | non | ses signalements |

Évolutions RLS attendues (migration) :

1. UPDATE des colonnes d’affectation réservé à `est_personnel_communal()`.
2. INSERT `signalements_evenements` pour collecteur : autoriser `en_cours` / `resolu` **uniquement** si `assigne_collecteur_id = auth.uid()` (en plus des règles gérant PME existantes).
3. SELECT inchangé en esprit ; s’assurer que le collecteur affecté lit le dossier même s’il n’en est pas l’auteur.

---

## 7. Écrans

### 7.1 Dashboard — liste (`/dashboard/signalements`)

- Pastille / rail **En retard** (or ou rouge selon charte : vigilance = `gold`).
- Filtre chip « En retard ».
- Indication « Affecté à {PME} » ou « {agent} · {PME} ».
- Action **Affecter** (modale) : select PME → select collecteur filtré (option « Toute la PME ») → confirmer.
- Ligne cliquable → fiche détail (même pattern que collecteurs / ménages).
- Conserver les actions actuelles (prendre en charge, résoudre, rejeter) quand elles restent pertinentes.

### 7.2 Dashboard — fiche (`/dashboard/signalements/[id]`)

Pattern `BandeauFiche` + corps 2/3 + rail 1/3 :

- Bandeau : type, statut, badge retard, affectation, quartier, `ilYA`.
- Corps : description, photo, carte, **Journal / frise** (`signalements_evenements` + nom + rôle).
- Rail : identité auteur, PME affectée, actions (Affecter, Prendre en charge, Résoudre, Rejeter).

### 7.3 Mobile — PME (`pme.signalements`)

- Section ou filtre mis en avant : **Votre responsabilité**  
  (`assigne_pme_id = ma PME` et statut ouvert).
- Le reste du périmètre quartier demeure listé (comportement actuel).
- Actions inchangées après coup : Prendre en charge → Résoudre.

### 7.4 Mobile — collecteur

- Nouvelle entrée minimale : signalements où `assigne_collecteur_id = moi` et statut ouvert.
- Actions : Prendre en charge → Résoudre (mêmes règles motif).

### 7.5 Mobile — citoyen

- Inchangé fonctionnellement ; la frise affichera naturellement les messages d’affectation.

---

## 8. Modale d’affectation (admin)

Champs :

1. **PME** (obligatoire) — liste des PME actives, idéalement celles liées au quartier du signalement en premier.
2. **Collecteur** (optionnel) — collecteurs actifs de cette PME ; option « Toute la PME ».
3. Confirmation.

Effets atomiques (transaction SQL ou RPC `affecter_signalement`) :

1. UPDATE colonnes d’affectation.
2. INSERT événement frise avec message.

Réaffectation = même RPC (écrasement + nouvel événement).

---

## 9. Critères d’acceptation

1. Un signalement `nouveau` créé il y a 25 h porte la pastille « En retard » côté admin.
2. Affecter à une PME laisse le statut à `nouveau` et crée un événement frise.
3. Affecter à un collecteur exige une PME ; le collecteur apparaît dans sa file mobile.
4. La PME voit la section « Votre responsabilité » et peut prendre en charge → `en_cours`.
5. La fiche admin montre toute la frise (création, affectation, prise en charge, clôture).
6. Un gérant PME ne peut toujours pas rejeter.
7. Aucun e-mail/SMS n’est envoyé en V1.
8. Design system respecté (tokens, fiche §5.3, pas de hex hors `globals.css`).

---

## 10. Découpage d’implémentation suggéré

1. **Migration DB** — colonnes, contraintes, RLS, RPC `affecter_signalement`, vue pilotage.
2. **Dashboard liste** — aging, filtre, puce affectation, modale Affecter.
3. **Dashboard fiche** — route `[id]`, frise, actions.
4. **Mobile PME** — section responsabilité.
5. **Mobile collecteur** — file des affectations + actions traitement.

Chaque étape reste déployable sans casser le flux statut actuel.

---

## 11. Décisions tranchées

| Sujet | Décision |
|---|---|
| Affectation vs prise en charge | Distincts |
| Cible | PME ou collecteur de cette PME |
| Périmètre PME | Voit tout le quartier ; priorise les affectés |
| Notification V1 | File in-app uniquement |
| Modèle | Colonnes sur `signalements` + événement frise |
| Aging | 24 h en `nouveau` |
