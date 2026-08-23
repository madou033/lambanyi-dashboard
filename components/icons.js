/**
 * Icônes SVG stroke — jeu maison, cf. DESIGN_SYSTEM.md §1.1.
 * Aucune librairie : viewBox 0 0 24 24, stroke currentColor, strokeWidth 1.8.
 */

function Svg(props) {
  return (
    <svg
      className={props.className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {props.children}
    </svg>
  );
}

/* -- Marque -------------------------------------------------------- */

/** Logo — feuille inscrite dans un cycle de collecte. */
export function IconMarque(props) {
  return (
    <svg className={props.className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 4.5A9 9 0 0 1 20 9"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M20 4.5V9h-4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M18 19.5A9 9 0 0 1 4 15"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M4 19.5V15h4.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M12 15.5c-2.5 0-4-1.6-4-3.8 0-2.4 2-4 4-5.2 2 1.2 4 2.8 4 5.2 0 2.2-1.5 3.8-4 3.8z"
        fill="#fff"
      />
    </svg>
  );
}

/* -- Navigation ---------------------------------------------------- */

export function IconDash(props) {
  return (
    <Svg className={props.className}>
      <path d="M4 4h16v12H5.2L4 18z" />
      <path d="M8 9h8M8 12h5" />
    </Svg>
  );
}

export function IconMaison(props) {
  return (
    <Svg className={props.className}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V20h12V9.8" />
      <path d="M10 20v-5h4v5" />
    </Svg>
  );
}

export function IconEquipe(props) {
  return (
    <Svg className={props.className}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16.5 5.6a3.2 3.2 0 0 1 0 5.8" />
      <path d="M17.5 14.4A6 6 0 0 1 21 20" />
    </Svg>
  );
}

export function IconImmeuble(props) {
  return (
    <Svg className={props.className}>
      <path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14" />
      <path d="M14 10h4a2 2 0 0 1 2 2v8" />
      <path d="M7 8h4M7 12h4M7 16h4M17 14h1M17 17h1" />
      <path d="M3 20h18" />
    </Svg>
  );
}

export function IconEtiquette(props) {
  return (
    <Svg className={props.className}>
      <path d="M3.5 11.6V5a1.5 1.5 0 0 1 1.5-1.5h6.6a2 2 0 0 1 1.4.6l7 7a2 2 0 0 1 0 2.8l-5.6 5.6a2 2 0 0 1-2.8 0l-7-7a2 2 0 0 1-.6-1.4z" />
      <circle cx="8" cy="8" r="1.4" />
    </Svg>
  );
}

export function IconPortefeuille(props) {
  return (
    <Svg className={props.className}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18v3" />
      <path d="M3 7.5V17a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5.5A2.5 2.5 0 0 1 3 7.5z" />
      <circle cx="17" cy="14" r="1.2" />
    </Svg>
  );
}

export function IconCamion(props) {
  return (
    <Svg className={props.className}>
      <path d="M3 13V7a1 1 0 0 1 1-1h9v11" />
      <path d="M13 9h4l3 3.5V17h-2" />
      <path d="M3 17h2M9 17h4" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </Svg>
  );
}

export function IconPoubelle(props) {
  return (
    <Svg className={props.className}>
      <path d="M4 7h16" />
      <path d="M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7" />
      <path d="M6 7l.9 12.1A1.9 1.9 0 0 0 8.8 21h6.4a1.9 1.9 0 0 0 1.9-1.9L18 7" />
      <path d="M10 11v6M14 11v6" />
    </Svg>
  );
}

export function IconAlerte(props) {
  return (
    <Svg className={props.className}>
      <path d="M10.3 4.3 2.6 17.4A2 2 0 0 0 4.3 20.4h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
      <path d="M12 9.5v4M12 17h.01" />
    </Svg>
  );
}

export function IconQr(props) {
  return (
    <Svg className={props.className}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <path d="M13.5 13.5h3v3h-3zM20.5 13.5v3M17.5 20.5h3M13.5 20.5h.01" />
    </Svg>
  );
}

export function IconCarte(props) {
  return (
    <Svg className={props.className}>
      <path d="M9 4 3.5 6.2v13.3L9 17.3l6 2.2 5.5-2.2V4L15 6.2z" />
      <path d="M9 4v13.3M15 6.2v13.3" />
    </Svg>
  );
}

export function IconRouages(props) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6" />
    </Svg>
  );
}

/* -- Shell --------------------------------------------------------- */

export function IconRecherche(props) {
  return (
    <Svg className={props.className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </Svg>
  );
}

export function IconSoleil(props) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.4 5.6l-1.4 1.4M7 17l-1.4 1.4M18.4 18.4 17 17M7 7 5.6 5.6" />
    </Svg>
  );
}

export function IconLune(props) {
  return (
    <Svg className={props.className}>
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" />
    </Svg>
  );
}

export function IconUtilisateur(props) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Svg>
  );
}

export function IconDeconnexion(props) {
  return (
    <Svg className={props.className}>
      <path d="M14 5H6a1.5 1.5 0 0 0-1.5 1.5v11A1.5 1.5 0 0 0 6 19h8" />
      <path d="M17 15.5 20.5 12 17 8.5M20 12h-9" />
    </Svg>
  );
}

export function IconChevronBas(props) {
  return (
    <Svg className={props.className}>
      <path d="M6 9.5l6 6 6-6" />
    </Svg>
  );
}

/** Punaise — épinglage de la barre de navigation. */
export function IconPunaise(props) {
  return (
    <Svg className={props.className}>
      <path d="M12 16.6V21" />
      <path d="M8.5 3h7a1 1 0 0 1 0 2 .9.9 0 0 0-.9.9v4.2a2 2 0 0 0 1 1.7l1.3.8a2 2 0 0 1 1 1.7v.7a.5.5 0 0 1-.5.5H6.6a.5.5 0 0 1-.5-.5v-.7a2 2 0 0 1 1-1.7l1.3-.8a2 2 0 0 0 1-1.7V5.9A.9.9 0 0 0 8.5 5a1 1 0 0 1 0-2z" />
    </Svg>
  );
}

export function IconChevrons(props) {
  return (
    <Svg className={props.className}>
      <path d="M13 6.5 7.5 12l5.5 5.5M18.5 6.5 13 12l5.5 5.5" />
    </Svg>
  );
}

export function IconPlus(props) {
  return (
    <Svg className={props.className}>
      <path d="M12 5.5v13M5.5 12h13" />
    </Svg>
  );
}

export function IconHorloge(props) {
  return (
    <Svg className={props.className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l4 2.2" />
    </Svg>
  );
}

export function IconEclair(props) {
  return (
    <Svg className={props.className}>
      <path d="M13.5 3 5 13.5h6L10.5 21 19 10.5h-6z" />
    </Svg>
  );
}
