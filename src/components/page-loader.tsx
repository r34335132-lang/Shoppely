import { BagMark } from '@/components/brand/logo';

export function PageLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream">
      <BagMark className="h-14 w-14 animate-bounce" />
    </div>
  );
}
