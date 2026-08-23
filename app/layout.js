import { DM_Sans, Instrument_Serif } from 'next/font/google';
import './globals.css';
import { SCRIPT_THEME, ThemeProvider } from '@/components/ThemeProvider';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
});

const instrumentSerif = Instrument_Serif({
  variable: '--font-instrument-serif',
  subsets: ['latin'],
  weight: ['400'],
  style: ['normal', 'italic'],
});

export const metadata = {
  title: 'Lambanyi Propre · Dashboard communal',
  description: "Pilotage de l'assainissement et de la collecte des déchets de la commune de Lambanyi.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      data-theme="dark"
      className={`${dmSans.variable} ${instrumentSerif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applique le thème stocké avant la peinture — évite le flash clair. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body className="h-full">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
