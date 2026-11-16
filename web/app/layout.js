import { Anton, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const display = Anton({ weight: '400', subsets: ['latin'], variable: '--font-display' });
const mono = IBM_Plex_Mono({ weight: ['400', '600'], subsets: ['latin'], variable: '--font-mono' });

export const metadata = {
  title: 'ClutchCut — the loud moments, cut out for you',
  description:
    'A desktop app for Mac and Windows that finds the standout moments in long gameplay videos and cuts them into clips, on your own computer.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
