import { createContext, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { Header } from './header';
import { Footer } from './footer';
import { SearchOverlay } from './search-overlay';
import { WhatsAppFab } from './social';
import { Intro } from '@/components/brand/intro';
import { PageLoader } from '@/components/page-loader';
import { scrollToTop, startSmoothScroll, stopSmoothScroll } from '@/lib/smooth-scroll';

const IntroContext = createContext(true);
export const useIntroDone = () => useContext(IntroContext);

export function StoreLayout({ children, footer = true }: { children: ReactNode; footer?: boolean }) {
  const [location] = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const handleIntroDone = useCallback(() => setIntroDone(true), []);
  const openSearch = useCallback(() => setSearchOpen(true), []);
  const closeSearch = useCallback(() => setSearchOpen(false), []);

  useEffect(() => {
    startSmoothScroll();
    return () => stopSmoothScroll();
  }, []);

  useEffect(() => {
    scrollToTop();
  }, [location]);

  return (
    <IntroContext.Provider value={introDone}>
      <Intro onDone={handleIntroDone} />
      <Header onSearch={openSearch} />
      {/* Suspense aquí y no arriba: si React oculta el header mientras carga una página, las animaciones de salida de Framer se quedan congeladas. */}
      <main>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </main>
      {footer && <Footer />}
      <SearchOverlay open={searchOpen} onClose={closeSearch} />
      <WhatsAppFab />
    </IntroContext.Provider>
  );
}
