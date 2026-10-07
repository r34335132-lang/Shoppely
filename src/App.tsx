import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import { Toaster } from 'sonner';
import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/providers/auth';
import { CurrencyProvider } from '@/providers/currency';
import { CartProvider } from '@/providers/cart';
import { StoreLayout } from '@/components/store/store-layout';
import { CartDrawer } from '@/components/store/cart-drawer';
import { RequireRole } from '@/components/guards';
import { PageLoader } from '@/components/page-loader';
import HomePage from '@/pages/home';
import NotFound from '@/pages/not-found';

const CatalogPage = lazy(() => import('@/pages/catalog'));
const ProductPage = lazy(() => import('@/pages/product'));
const CheckoutPage = lazy(() => import('@/pages/checkout'));
const OrderPage = lazy(() => import('@/pages/order'));
const AccountPage = lazy(() => import('@/pages/account'));
const LoginPage = lazy(() => import('@/pages/login'));
const PanelHome = lazy(() => import('@/pages/panel'));
const PosPage = lazy(() => import('@/pages/pos'));

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
});

function Routes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login"><LoginPage mode="in" /></Route>
        <Route path="/registro"><LoginPage mode="up" /></Route>
        <Route path="/panel/pos">
          <RequireRole roles={['admin', 'seller']}><PosPage /></RequireRole>
        </Route>
        <Route path="/panel" nest>
          <RequireRole roles={['admin', 'inventory', 'seller']}><PanelHome /></RequireRole>
        </Route>

        <Route path="/"><StoreLayout><HomePage /></StoreLayout></Route>
        <Route path="/tienda"><StoreLayout><CatalogPage /></StoreLayout></Route>
        <Route path="/producto/:slug"><StoreLayout><ProductPage /></StoreLayout></Route>
        <Route path="/checkout"><StoreLayout footer={false}><CheckoutPage /></StoreLayout></Route>
        <Route path="/pedido/:token"><StoreLayout><OrderPage /></StoreLayout></Route>
        <Route path="/cuenta">
          <RequireRole><StoreLayout><AccountPage /></StoreLayout></RequireRole>
        </Route>
        <Route><StoreLayout><NotFound /></StoreLayout></Route>
      </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <CurrencyProvider>
            <CartProvider>
              <Routes />
              <CartDrawer />
              <Toaster
                position="top-center"
                toastOptions={{
                  className: '!rounded-2xl !border-0 !bg-ink !text-white !shadow-xl',
                  actionButtonStyle: { background: '#e4b4b8', color: '#1f1519', borderRadius: 999 },
                }}
              />
            </CartProvider>
          </CurrencyProvider>
        </AuthProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
