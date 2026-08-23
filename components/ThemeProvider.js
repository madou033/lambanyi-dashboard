'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';

const CLE = 'lp_theme';
const EVENEMENT = 'lp:theme';
const ThemeContext = createContext(null);

/**
 * Script injecté avant la peinture : applique le thème stocké sur <html>
 * pour éviter le flash clair au chargement. Doit rester synchrone.
 */
export const SCRIPT_THEME = `(function(){try{var t=localStorage.getItem('${CLE}');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark')}catch(e){}})()`;

/* ------------------------------------------------------------------ */
/* Source de vérité : l'attribut data-theme posé sur <html>            */
/* ------------------------------------------------------------------ */

function souscrire(surChangement) {
  window.addEventListener(EVENEMENT, surChangement);
  return function () {
    window.removeEventListener(EVENEMENT, surChangement);
  };
}

function lireClient() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function lireServeur() {
  return 'dark';
}

function appliquer(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(CLE, theme);
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

export function ThemeProvider(props) {
  // Le DOM porte déjà le bon thème avant la peinture (SCRIPT_THEME) : on le
  // lit comme un store externe plutôt que de le recopier dans un état, ce qui
  // imposerait un effet de synchronisation au montage.
  const theme = useSyncExternalStore(souscrire, lireClient, lireServeur);

  const setTheme = useCallback(function (t) {
    appliquer(t === 'light' ? 'light' : 'dark');
  }, []);

  const basculer = useCallback(function () {
    appliquer(lireClient() === 'dark' ? 'light' : 'dark');
  }, []);

  const valeur = useMemo(
    function () {
      return { theme, basculer, setTheme };
    },
    [theme, basculer, setTheme],
  );

  return <ThemeContext.Provider value={valeur}>{props.children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme hors ThemeProvider');
  return ctx;
}
