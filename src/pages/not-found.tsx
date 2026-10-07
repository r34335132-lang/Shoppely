import { Link } from 'wouter';
import { BagMark } from '@/components/brand/logo';

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream px-6 text-center">
      <div>
        <BagMark className="mx-auto h-24 w-24 animate-float" />
        <p className="display mt-6 text-7xl">404</p>
        <p className="mt-2 text-ink/60">Esta página se fue de compras y no ha regresado.</p>
        <Link href="/" className="btn-dark mt-6">Volver al inicio</Link>
      </div>
    </div>
  );
}
