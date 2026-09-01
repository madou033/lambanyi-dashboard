# Prise en charge des signalements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le traitement des signalements en flux métier : aging 24 h, affectation PME/agent, frise admin, files « responsabilité » mobile.

**Architecture:** Colonnes d’affectation sur `signalements` + RPC `affecter_signalement` (UPDATE + événement frise, statut inchangé). Dashboard : liste enrichie + fiche `[id]`. Mobile : priorisation PME + file collecteur affecté. Pas de notification externe en V1.

**Tech Stack:** PostgreSQL / Supabase (migrations + RLS + RPC), Next.js 16 (JS) dashboard, React Native / Expo mobile, `@supabase/supabase-js`. Tests dashboard : `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-01-prise-en-charge-signalements-design.md`

## Global Constraints

- Suivre la spec à la lettre : affecter ≠ prendre en charge ; aging = `nouveau` + `created_at < now() - 24h`.
- JavaScript uniquement dans dashboard et mobile (pas de TypeScript).
- Tokens design system dashboard uniquement — aucun hex hors `globals.css`.
- Commits en français, style du dépôt (`feat:`, `fix:`, docs).
- Trois dépôts : `lambanyi-db`, `lambanyi-dashboard`, `lambanyi-mobile` — committer dans le bon repo.
- Ne pas pusher tant que l’utilisateur ne le demande pas.
- Travailler sur `main` (ou branche dédiée si l’utilisateur le demande).
- Fetch dashboard : `useEffect` + commentaire eslint existant.
- Motif clôture ≥ 10 caractères (contrainte SQL existante).
- Rejet réservé au personnel communal.

## File map

| Fichier | Rôle |
|---------|------|
| Create: `lambanyi-db/supabase/migrations/<ts>_affectation_signalements.sql` | Colonnes, contraintes, vue, RLS, RPC |
| Create: `lambanyi-dashboard/lib/signalements.js` | Helpers `estEnRetard`, libellés affectation |
| Create: `lambanyi-dashboard/lib/signalements.test.js` | Tests helpers |
| Create: `lambanyi-dashboard/components/ModaleAffectationSignalement.js` | Modale PME → collecteur |
| Create: `lambanyi-dashboard/app/dashboard/signalements/[id]/page.js` | Fiche + frise |
| Modify: `lambanyi-dashboard/app/dashboard/signalements/page.js` | Aging, filtre, affecter, lien fiche |
| Modify: `lambanyi-dashboard/lib/navigation.js` | Rien si route déjà listée |
| Modify: `lambanyi-mobile/src/ecrans/pme/Signalements.js` | Section « Votre responsabilité » |
| Create: `lambanyi-mobile/src/ecrans/collecteur/SignalementsAffectes.js` | File collecteur |
| Modify: `lambanyi-mobile/src/navigation/onglets.js` | Onglet / écran collecteur |
| Modify: `lambanyi-db` RLS lecture/création événements | Collecteur affecté |

---

### Task 1: Migration — colonnes, vue, RPC, RLS

**Repo:** `lambanyi-db`

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_affectation_signalements.sql`

**Interfaces:**
- Consumes: tables `signalements`, `signalements_evenements`, `pme`, `profils` ; helpers `prive.est_personnel_communal`, `prive.auth_role`, `prive.auth_actif`, `prive.quartier_de_ma_pme`, `prive.auth_pme`
- Produces: colonnes d’affectation ; vue `signalements_pilotage` ; RPC `public.affecter_signalement(p_signalement_id uuid, p_pme_id uuid, p_collecteur_id uuid)` ; policies lecture/écriture pour collecteur affecté

- [ ] **Step 1: Créer le fichier de migration**

```bash
cd lambanyi-db
supabase migration new affectation_signalements
```

- [ ] **Step 2: Écrire le SQL (contenu intégral du fichier)**

```sql
-- Affectation des signalements (responsabilité PME / agent)
--
-- Affecter n'est pas prendre en charge : le statut reste inchangé.
-- Un evenement de frise trace l'affectation. L'aging (> 24 h en
-- 'nouveau') se calcule ; il n'a pas de colonne dediee.

alter table signalements
  add column assigne_pme_id         uuid references pme (id) on delete set null,
  add column assigne_collecteur_id  uuid references profils (id) on delete set null,
  add column assigne_le             timestamptz,
  add column assigne_par            uuid references profils (id) on delete set null;

comment on column signalements.assigne_pme_id is
  'PME responsable. Null = non affecte.';
comment on column signalements.assigne_collecteur_id is
  'Agent precis optionnel. Null = toute la PME.';

alter table signalements
  add constraint signalements_affectation_coherence check (
    (
      assigne_pme_id is null
      and assigne_collecteur_id is null
      and assigne_le is null
      and assigne_par is null
    )
    or (
      assigne_pme_id is not null
      and assigne_le is not null
      and assigne_par is not null
    )
  );

create index signalements_assigne_pme_id_idx
  on signalements (assigne_pme_id)
  where assigne_pme_id is not null;

create index signalements_assigne_collecteur_id_idx
  on signalements (assigne_collecteur_id)
  where assigne_collecteur_id is not null;

-- ------------------------------------------------------------------
-- Vue de pilotage (dashboard)
-- ------------------------------------------------------------------
create or replace view signalements_pilotage
with (security_invoker = true)
as
select
  s.id,
  s.auteur_id,
  s.type_signalement,
  s.description,
  s.photo_url,
  s.quartier_id,
  q.nom                              as quartier_nom,
  s.point_depot_id,
  s.statut,
  s.created_at,
  s.assigne_pme_id,
  s.assigne_collecteur_id,
  s.assigne_le,
  s.assigne_par,
  pme.nom                            as assigne_pme_nom,
  col.nom_complet                    as assigne_collecteur_nom,
  (s.statut = 'nouveau'
    and s.created_at < now() - interval '24 hours') as en_retard,
  st_y(s.position::geometry)         as latitude,
  st_x(s.position::geometry)         as longitude
from signalements s
left join quartiers q on q.id = s.quartier_id
left join pme on pme.id = s.assigne_pme_id
left join profils col on col.id = s.assigne_collecteur_id;

comment on view signalements_pilotage is
  'File admin : aging, affectation, coords. security_invoker.';

-- ------------------------------------------------------------------
-- Lecture : le collecteur affecte lit le dossier
-- ------------------------------------------------------------------
create policy signalements_lecture_assigne on signalements
  for select to authenticated
  using (
    prive.auth_actif()
    and assigne_collecteur_id = (select auth.uid())
  );

-- ------------------------------------------------------------------
-- Evenements : le collecteur affecte peut en_cours / resolu
-- ------------------------------------------------------------------
create policy signalements_evenements_creation_collecteur on signalements_evenements
  for insert to authenticated
  with check (
    auteur_id = (select auth.uid())
    and prive.auth_role() = 'collecteur'
    and prive.auth_actif()
    and statut in ('en_cours', 'resolu')
    and exists (
      select 1 from signalements s
      where s.id = signalement_id
        and s.assigne_collecteur_id = (select auth.uid())
    )
  );

-- ------------------------------------------------------------------
-- RPC d'affectation (personnel communal)
-- ------------------------------------------------------------------
create or replace function public.affecter_signalement (
  p_signalement_id uuid,
  p_pme_id         uuid,
  p_collecteur_id  uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_statut   statut_signalement;
  v_deja_pme uuid;
  v_nom_pme  text;
  v_nom_col  text;
  v_msg      text;
  v_prefixe  text;
begin
  if not prive.est_personnel_communal() then
    raise exception 'Seul le personnel communal peut affecter un signalement';
  end if;

  if p_pme_id is null then
    raise exception 'Une PME est obligatoire';
  end if;

  select statut, assigne_pme_id into v_statut, v_deja_pme
  from signalements
  where id = p_signalement_id
  for update;

  if not found then
    raise exception 'Signalement introuvable';
  end if;

  if v_statut in ('resolu', 'rejete') then
    raise exception 'Impossible d''affecter un signalement clos';
  end if;

  if not exists (select 1 from pme where id = p_pme_id and actif) then
    raise exception 'PME introuvable ou inactive';
  end if;

  if p_collecteur_id is not null then
    if not exists (
      select 1 from profils
      where id = p_collecteur_id
        and role = 'collecteur'
        and actif
        and pme_id = p_pme_id
    ) then
      raise exception 'Le collecteur doit etre actif et appartenir a cette PME';
    end if;
  end if;

  update signalements set
    assigne_pme_id        = p_pme_id,
    assigne_collecteur_id = p_collecteur_id,
    assigne_le            = now(),
    assigne_par           = auth.uid()
  where id = p_signalement_id;

  select nom into v_nom_pme from pme where id = p_pme_id;

  if p_collecteur_id is not null then
    select nom_complet into v_nom_col from profils where id = p_collecteur_id;
    v_msg := format('Affecté à %s (%s)', v_nom_col, v_nom_pme);
  else
    v_msg := format('Affecté à %s', v_nom_pme);
  end if;

  if v_deja_pme is not null then
    v_msg := replace(v_msg, 'Affecté', 'Réaffecté');
  end if;

  insert into signalements_evenements (signalement_id, statut, auteur_id, message)
  values (p_signalement_id, v_statut, auth.uid(), v_msg);
end;
$$;

revoke all on function public.affecter_signalement (uuid, uuid, uuid) from public;
grant execute on function public.affecter_signalement (uuid, uuid, uuid) to authenticated;

comment on function public.affecter_signalement is
  'Affecte (ou reaffecte) un signalement a une PME / un collecteur. Statut inchange.';
```

- [ ] **Step 3: Appliquer sur la base distante**

```bash
cd lambanyi-db
supabase db push
# Si le CLI n'a pas accès au projet Lambanyi : coller le SQL dans Studio → SQL Editor
```

Vérifier :

```sql
select column_name from information_schema.columns
where table_name = 'signalements' and column_name like 'assigne%';

select affecter_signalement is not null
from pg_proc where proname = 'affecter_signalement';
```

- [ ] **Step 4: Commit (repo lambanyi-db)**

```bash
git add supabase/migrations/*affectation_signalements.sql
git commit -m "feat: affectation PME/agent des signalements"
```

---

### Task 2: Helpers dashboard + tests

**Repo:** `lambanyi-dashboard`

**Files:**
- Create: `lib/signalements.js`
- Create: `lib/signalements.test.js`

**Interfaces:**
- Consumes: rien
- Produces: `SEUIL_RETARD_MS`, `estEnRetard({ statut, created_at }, instant?)`, `libelleAffectation({ assigne_pme_nom, assigne_collecteur_nom })`, `messageEvenementAffectation(...)` (optionnel côté client — le message est surtout produit par la RPC)

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { estEnRetard, libelleAffectation, SEUIL_RETARD_MS } from './signalements.js';

test('estEnRetard : nouveau de plus de 24 h', function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - SEUIL_RETARD_MS - 60_000).toISOString();
  assert.equal(estEnRetard({ statut: 'nouveau', created_at: created }, instant), true);
});

test('estEnRetard : nouveau de moins de 24 h', function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - 3_600_000).toISOString();
  assert.equal(estEnRetard({ statut: 'nouveau', created_at: created }, instant), false);
});

test('estEnRetard : en_cours vieux n’est pas en retard', function () {
  const instant = Date.parse('2026-09-02T12:00:00Z');
  const created = new Date(instant - SEUIL_RETARD_MS * 3).toISOString();
  assert.equal(estEnRetard({ statut: 'en_cours', created_at: created }, instant), false);
});

test('libelleAffectation', function () {
  assert.equal(libelleAffectation({}), null);
  assert.equal(
    libelleAffectation({ assigne_pme_nom: 'Salubrité' }),
    'Salubrité',
  );
  assert.equal(
    libelleAffectation({
      assigne_pme_nom: 'Salubrité',
      assigne_collecteur_nom: 'Mamadou Bah',
    }),
    'Mamadou Bah · Salubrité',
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd lambanyi-dashboard
node --experimental-default-type=module --test lib/signalements.test.js
```

Expected: FAIL (module introuvable)

- [ ] **Step 3: Implement**

```js
/** Seuil d’aging produit : 24 h en statut nouveau. */
export const SEUIL_RETARD_MS = 24 * 60 * 60 * 1000;

export function estEnRetard(signalement, instant = Date.now()) {
  if (!signalement || signalement.statut !== 'nouveau' || !signalement.created_at) {
    return false;
  }
  return instant - new Date(signalement.created_at).getTime() > SEUIL_RETARD_MS;
}

/** Libellé court pour liste / bandeau. Null si non affecté. */
export function libelleAffectation(s) {
  if (!s?.assigne_pme_nom) return null;
  if (s.assigne_collecteur_nom) {
    return `${s.assigne_collecteur_nom} · ${s.assigne_pme_nom}`;
  }
  return s.assigne_pme_nom;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
node --experimental-default-type=module --test lib/signalements.test.js
```

- [ ] **Step 5: Commit**

```bash
git add lib/signalements.js lib/signalements.test.js
git commit -m "feat: helpers aging et libellé d’affectation des signalements"
```

---

### Task 3: Modale d’affectation

**Repo:** `lambanyi-dashboard`

**Files:**
- Create: `components/ModaleAffectationSignalement.js`

**Interfaces:**
- Consumes: `supabase.rpc('affecter_signalement', { p_signalement_id, p_pme_id, p_collecteur_id })` ; tables `pme`, `profils`, `pme_quartiers`
- Produces: `<ModaleAffectationSignalement signalement ouvert onFermer onAffecte />`

- [ ] **Step 1: Implémenter la modale**

Comportement :
- Props : `signalement` (au moins `id`, `quartier_id`), `ouvert`, `onFermer`, `onAffecte`.
- Au montage / ouverture : charger PME actives + `pme_quartiers` + collecteurs (`role=collecteur`, `actif`, avec `pme_id`).
- Select PME : d’abord celles liées au `quartier_id` du signalement, puis les autres.
- Select collecteur : filtré par PME choisie ; première option value="" = « Toute la PME ».
- Bouton vert « Affecter » appelle :

```js
const { error } = await supabase.rpc('affecter_signalement', {
  p_signalement_id: signalement.id,
  p_pme_id: pmeId,
  p_collecteur_id: collecteurId || null,
});
```

- Afficher l’erreur RPC sous le formulaire ; succès → `onAffecte()` puis `onFermer()`.
- UI : `Modal` + `Selecteur` + `Btn` (tokens design system). Titre « Affecter le signalement ».

- [ ] **Step 2: Vérifier manuellement** (après Task 1 poussée) depuis une page qui monte la modale avec un faux bouton temporaire, ou attendre Task 4.

- [ ] **Step 3: Commit**

```bash
git add components/ModaleAffectationSignalement.js
git commit -m "feat: modale d’affectation d’un signalement à une PME"
```

---

### Task 4: Liste signalements — aging, filtre, affecter, navigation fiche

**Repo:** `lambanyi-dashboard`

**Files:**
- Modify: `app/dashboard/signalements/page.js`

**Interfaces:**
- Consumes: vue `signalements_pilotage` (fallback `signalements` + jointures si la vue manque) ; `estEnRetard`, `libelleAffectation` ; `ModaleAffectationSignalement`
- Produces: liste produit

- [ ] **Step 1: Charger depuis `signalements_pilotage`**

Remplacer le `select` actuel par :

```js
supabase
  .from('signalements_pilotage')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(500)
```

Si erreur « relation does not exist », fallback temporaire documenté — mais Task 1 doit être appliquée avant.

- [ ] **Step 2: Filtre chip « En retard »**

Ajouter dans les chips de statut (ou chips séparés) :

```js
{ code: 'en_retard', label: 'En retard' }
```

Filtrage :

```js
if (filtreStatut === 'en_retard') return s.en_retard === true || estEnRetard(s);
```

Métrique optionnelle : compter les `en_retard` dans `BandeauMetriques` (ton `or`).

- [ ] **Step 3: UI ligne**

Sur `LigneSignalement` :
- Si `en_retard` : rail `var(--lp-gold)` (prioritaire sur le ton statut pour les nouveaux en retard) + `<Badge ton="or">En retard</Badge>`.
- Afficher sous la description : `Affecté à {libelleAffectation(s)}` si présent (`text-[11px] text-muted`).
- Bouton ghost **Affecter** si statut ouvert (`nouveau` ou `en_cours`) → ouvre la modale.
- Rendre le corps de la ligne cliquable (`Link` ou `router.push`) vers `/dashboard/signalements/${s.id}` — garder les boutons d’action sans navigation (stopPropagation).

- [ ] **Step 4: Brancher `ModaleAffectationSignalement`**

État `affectationCible` ; `onAffecte={charger}`.

- [ ] **Step 5: Vérifier dans le navigateur**

- Créer / trouver un `nouveau` vieux de >24 h → pastille or.
- Affecter à une PME → statut reste `nouveau`, puce « Affecté à … ».
- Filtre « En retard » ne montre que les stagnants.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/signalements/page.js
git commit -m "feat: aging et affectation sur la file des signalements"
```

---

### Task 5: Fiche détail signalement

**Repo:** `lambanyi-dashboard`

**Files:**
- Create: `app/dashboard/signalements/[id]/page.js`

**Interfaces:**
- Consumes: `signalements_pilotage` ou `signalements` ; `signalements_evenements` + `profils(nom_complet, role)` ; briques `BandeauFiche`, `Journal`, `LigneJournal`, `LigneMeta` ; `ModaleAffectationSignalement` ; mêmes actions statut que la liste (`poserEvenement`)

- [ ] **Step 1: Créer la page fiche**

Structure (miroirs collecteur/ménage) :

```
BandeauFiche (type, badges statut + retard, affectation, quartier, ilYA)
BandeauErreur
grid 8 / 4
  Corps:
    Bloc description + photo
    Bloc localisation (lien maps si lat/lng)
    Journal « Frise de suivi » (événements chronologiques)
  Rail:
    Panel Identité (auteur si jointure possible, quartier, type)
    Panel Affectation (PME, agent, date, bouton Affecter / Réaffecter)
    Panel Actions (Prendre en charge / Résoudre / Rejeter selon statut)
```

Chargement événements :

```js
supabase
  .from('signalements_evenements')
  .select('id, statut, message, created_at, auteur_id, profils(nom_complet, role)')
  .eq('signalement_id', id)
  .order('created_at', { ascending: true })
```

Chaque `LigneJournal` : titre = libellé statut + badge ; sous = message ; droite = `ilYA` ; éventuellement nom auteur.

- [ ] **Step 2: Actions**

Réutiliser la logique motif / `signalements_evenements.insert` de la liste (extraire une fonction partagée dans `lib/signalements.js` si duplication > 15 lignes : `async function deposerEvenement(supabase, { signalementId, statut, message, userId })`).

- [ ] **Step 3: Vérifier**

Ouvrir une fiche après affectation + prise en charge PME : frise = nouveau → Affecté à… → en_cours → resolu.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/signalements/[id]/page.js lib/signalements.js
git commit -m "feat: fiche signalement avec frise et affectation"
```

---

### Task 6: Mobile PME — « Votre responsabilité »

**Repo:** `lambanyi-mobile`

**Files:**
- Modify: `src/ecrans/pme/Signalements.js`
- Modify: `src/contexte/Auth.js` seulement si `pme_id` du profil n’est pas déjà exposé (il l’est via `profil.pme_id`)

**Interfaces:**
- Consumes: `profil.pme_id` ; colonnes `assigne_pme_id` sur `signalements`
- Produces: section / filtre prioritaire

- [ ] **Step 1: Étendre le select**

Inclure `assigne_pme_id, assigne_collecteur_id` dans le `.select(...)` existant.

- [ ] **Step 2: Partitionner la liste**

```js
const responsabilite = lignes.filter(
  (s) => s.assigne_pme_id === profil.pme_id && ['nouveau', 'en_cours'].includes(s.statut),
);
const autres = lignes.filter((s) => !responsabilite.includes(s));
```

Afficher d’abord un en-tête « Votre responsabilité » + les cartes `responsabilite` (badge ton `gold` si `nouveau`), puis « Périmètre quartier » pour le reste.

Ajouter chip filtre `{ code: 'responsabilite', libelle: 'À moi' }` qui ne montre que `responsabilite`.

- [ ] **Step 3: Vérifier sur appareil / Expo**

Avec un compte gérant : après affectation admin, le dossier apparaît en tête ; « Prendre en charge » → `en_cours`.

- [ ] **Step 4: Commit**

```bash
git add src/ecrans/pme/Signalements.js
git commit -m "feat: file PME — signalements sous responsabilité"
```

---

### Task 7: Mobile collecteur — file des affectations

**Repo:** `lambanyi-mobile`

**Files:**
- Create: `src/ecrans/collecteur/SignalementsAffectes.js`
- Modify: `src/navigation/onglets.js`

**Interfaces:**
- Consumes: RLS `signalements_lecture_assigne` + policy événements collecteur ; réutiliser `DetailSignalement` + feuille de traitement (extraire ou dupliquer minimalement depuis PME)
- Produces: écran onglet ou pile « Affectés »

- [ ] **Step 1: Écran liste**

```js
supabase
  .from('signalements')
  .select('id, type_signalement, description, statut, created_at, quartier_id, quartiers(nom), assigne_pme_id')
  .eq('assigne_collecteur_id', session.user.id)
  .in('statut', ['nouveau', 'en_cours'])
  .order('created_at', { ascending: false });
```

Actions : insert `signalements_evenements` `en_cours` / `resolu` (motif ≥ 10) — même UX que PME (copier `FeuilleTraitement` dans un module partagé `src/ecrans/commun/FeuilleTraitementSignalement.js` si la duplication dépasse ~80 lignes).

- [ ] **Step 2: Navigation**

Dans les onglets collecteur, ajouter un écran accessible (onglet ou entrée depuis Accueil) :

```js
name="collecteur.signalements"
options={{ title: 'Affectés', tabBarIcon: icone('megaphone') }}
component={SignalementsAffectes}
```

(Éviter de casser la limite d’onglets : si déjà 5 onglets, exposer via encart Accueil + pile plutôt qu’un 6ᵉ tab.)

- [ ] **Step 3: Vérifier**

Affecter un signalement à un collecteur précis → visible dans sa file → prendre en charge → résolu. Un autre collecteur ne le voit pas.

- [ ] **Step 4: Commit**

```bash
git add src/ecrans/collecteur/SignalementsAffectes.js src/ecrans/commun/FeuilleTraitementSignalement.js src/navigation/onglets.js
git commit -m "feat: file collecteur des signalements affectés"
```

---

### Task 8: Vérification transversale (acceptance)

**Repos:** les trois

- [ ] **Step 1: Parcourir la checklist spec §9**

| # | Critère | OK ? |
|---|---------|------|
| 1 | Nouveau > 24 h → pastille En retard admin | |
| 2 | Affecter PME → statut reste nouveau + frise | |
| 3 | Affecter collecteur → visible file mobile collecteur | |
| 4 | PME « Votre responsabilité » → en_cours | |
| 5 | Fiche admin frise complète | |
| 6 | PME ne peut pas rejeter | |
| 7 | Pas d’e-mail/SMS | |
| 8 | Design system | |

- [ ] **Step 2: Régression**

- Citoyen signale toujours OK.
- Collecteur crée un signalement (bac plein) toujours OK.
- Rejet admin depuis `nouveau` toujours OK.

- [ ] **Step 3: Mettre à jour le statut de la spec**

Dans `docs/superpowers/specs/2026-09-01-prise-en-charge-signalements-design.md` : `**Statut :** livré V1.` après validation humaine.

---

## Spec coverage (self-review)

| Exigence spec | Task |
|---|---|
| Colonnes affectation + contraintes | T1 |
| Événement frise à l’affectation | T1 (RPC) |
| Aging 24 h | T1 vue + T2 + T4 |
| RPC affecter | T1 |
| RLS collecteur affecté | T1 |
| Liste admin aging / filtre / affecter | T4 |
| Fiche + frise | T5 |
| Modale PME → collecteur | T3 |
| Mobile PME responsabilité | T6 |
| Mobile collecteur file | T7 |
| Pas d’e-mail V1 | explicite (aucune task notif) |
| Acceptance | T8 |
