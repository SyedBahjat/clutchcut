import Nav from './components/Nav';
import Hero from './components/Hero';
import AppPreview from './components/AppPreview';
import { Steps, Features } from './components/Sections';
import Faq from './components/Faq';
import Download from './components/Download';
import { REPO_URL } from '../lib/site';

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <AppPreview />
        <Steps />
        <Features />
        <Faq />
        <Download />
      </main>
      <footer className="footer">
        <div className="wrap footer-row">
          <p>ClutchCut is MIT licensed. You are responsible for having the rights to the videos you clip and post.</p>
          <a href={REPO_URL}>GitHub</a>
        </div>
      </footer>
    </>
  );
}
