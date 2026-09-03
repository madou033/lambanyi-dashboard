/**
 * Capture visuelle du dashboard pour audit UX/UI.
 * Usage :
 *   AUDIT_EMAIL=… AUDIT_PASSWORD=… node scripts/audit-ui.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(racine, '.audit');
const base = process.env.AUDIT_URL || 'http://localhost:3000';
const email = process.env.AUDIT_EMAIL;
const motDePasse = process.env.AUDIT_PASSWORD;

if (!email || !motDePasse) {
  console.error('AUDIT_EMAIL et AUDIT_PASSWORD sont requis.');
  process.exit(1);
}

mkdirSync(out, { recursive: true });

const PAGES = [
  ['login', '/login', { connecte: false }],
  ['vue', '/dashboard', { connecte: true }],
  ['menages', '/dashboard/menages', { connecte: true }],
  ['collecteurs', '/dashboard/collecteurs', { connecte: true }],
  ['signalements', '/dashboard/signalements', { connecte: true }],
  ['paiements', '/dashboard/paiements', { connecte: true }],
  ['pme', '/dashboard/pme', { connecte: true }],
];

async function pret(page) {
  await page.waitForLoadState('networkidle').catch(function () {});
  await page.waitForTimeout(700);
}

async function themeEtBarre(page, theme, epingle) {
  await page.evaluate(
    function ([t, e]) {
      localStorage.setItem('lp_theme', t);
      localStorage.setItem('lp_sidebar_epinglee', e ? '1' : '0');
      document.documentElement.setAttribute('data-theme', t);
    },
    [theme, epingle],
  );
}

async function capture(page, nom) {
  const fichier = join(out, `${nom}.png`);
  await page.screenshot({ path: fichier, fullPage: false });
  console.log('ok', nom);
}

const navigateur = await chromium.launch({ headless: true });
const contexte = await navigateur.newContext({
  viewport: { width: 1440, height: 900 },
  locale: 'fr-FR',
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' });
await pret(page);
await capture(page, '00-login-1440');

await page.locator('#email').fill(email);
await page.locator('input[type="password"]').fill(motDePasse);
await page.getByRole('button', { name: /se connecter/i }).click();
await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
await pret(page);

const combos = [
  ['sombre', 'dark', true],
  ['clair', 'light', true],
  ['sombre-rail', 'dark', false],
  ['clair-rail', 'light', false],
];

for (const [suffixe, theme, epingle] of combos) {
  for (const [slug, chemin, opts] of PAGES) {
    if (!opts.connecte) continue;
    await page.goto(`${base}${chemin}`, { waitUntil: 'domcontentloaded' });
    await themeEtBarre(page, theme, epingle);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await pret(page);
    await capture(page, `${slug}-${suffixe}-1440`);
  }
}

const premierLien = page.locator('a[href^="/dashboard/menages/"]').first();
if (await premierLien.count()) {
  await themeEtBarre(page, 'light', true);
  await premierLien.click();
  await pret(page);
  await capture(page, 'fiche-menage-clair-1440');
  await themeEtBarre(page, 'dark', true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pret(page);
  await capture(page, 'fiche-menage-sombre-1440');
}

await page.setViewportSize({ width: 1280, height: 800 });
for (const [suffixe, theme, epingle] of [
  ['sombre', 'dark', true],
  ['clair', 'light', true],
]) {
  await page.goto(`${base}/dashboard`, { waitUntil: 'domcontentloaded' });
  await themeEtBarre(page, theme, epingle);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await pret(page);
  await capture(page, `vue-${suffixe}-1280`);
}

await navigateur.close();
console.log('captures →', out);
