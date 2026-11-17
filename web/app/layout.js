import { Bricolage_Grotesque, Instrument_Sans } from 'next/font/google';
import './globals.css';
import './site.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', weight: ['600', '800'] });
const body = Instrument_Sans({ subsets: ['latin'], variable: '--font-body' });

export const metadata = {
  title: 'ClutchCut — turn long videos into clips',
  description:
    'Free, open-source desktop app for Mac and Windows. Paste a link or drop a file and ClutchCut finds the loud moments and cuts them into clips, on your own computer.',
};

export const viewport = { themeColor: '#0b0a09' };

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
