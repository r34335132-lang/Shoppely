import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CameraOff, Loader2, ScanLine } from 'lucide-react';
import { Modal } from './kit';

/**
 * Lectores USB/Bluetooth funcionan como teclado: escriben el código muy rápido y terminan con Enter.
 * Este hook los detecta en cualquier parte de la pantalla, excepto cuando se está escribiendo en un campo.
 */
export function useBarcodeWedge(onScan: (code: string) => void, enabled = true) {
  const handler = useRef(onScan);
  handler.current = onScan;

  useEffect(() => {
    if (!enabled) return;
    let buffer = '';
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (now - last > 60) buffer = '';
      last = now;
      if (e.key === 'Enter') {
        if (buffer.length >= 4) {
          e.preventDefault();
          handler.current(buffer);
        }
        buffer = '';
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [enabled]);
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'code_93', 'itf', 'qr_code'] as const;

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

async function createDetector(): Promise<Detector> {
  const { BarcodeDetector } = await import('barcode-detector/ponyfill');
  return new BarcodeDetector({ formats: [...FORMATS] });
}

export function CameraScanner({
  open, onClose, onDetect, continuous = false, title = 'Escanear código',
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
  continuous?: boolean;
  title?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      {open && <CameraView onDetect={onDetect} onClose={onClose} continuous={continuous} />}
    </Modal>
  );
}

function CameraView({ onDetect, onClose, continuous }: { onDetect: (code: string) => void; onClose: () => void; continuous: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [flash, setFlash] = useState(0);
  const detectRef = useRef(onDetect);
  detectRef.current = onDetect;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    const recent = new Map<string, number>();

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        throw new Error('La cámara solo funciona con https. Usa el lector de códigos o escribe el código.');
      }
      const [detector, media] = await Promise.all([
        createDetector(),
        navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false }),
      ]);
      stream = media;
      if (stopped) return;
      const video = videoRef.current!;
      video.srcObject = media;
      await video.play();
      setState('ready');

      const tick = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video);
            const code = codes[0]?.rawValue?.trim();
            const now = Date.now();
            if (code && now - (recent.get(code) ?? 0) > 1800) {
              recent.set(code, now);
              setFlash((n) => n + 1);
              navigator.vibrate?.(60);
              detectRef.current(code);
              if (!continuous) return closeRef.current();
            }
          }
        } catch {
          // Cuadros sin código o aún sin cargar: se reintenta en el siguiente ciclo.
        }
        timer = window.setTimeout(tick, 180);
      };
      void tick();
    })().catch((e: Error) => {
      setState('error');
      setError(e.name === 'NotAllowedError' ? 'Permite el acceso a la cámara en el navegador para escanear.' : e.message || 'No se pudo abrir la cámara');
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [continuous]);

  if (state === 'error') {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-3xl bg-red-50 text-red-600"><CameraOff className="h-7 w-7" /></span>
        <p className="mt-4 font-bold">Cámara no disponible</p>
        <p className="mt-1 max-w-sm text-sm text-ink/60">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-ink">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {state === 'loading' && <div className="absolute inset-0 grid place-items-center text-white"><Loader2 className="h-8 w-8 animate-spin" /></div>}
        <div className="pointer-events-none absolute inset-x-[12%] top-1/2 h-[38%] -translate-y-1/2 rounded-2xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(20,16,20,0.35)]">
          <motion.span
            className="absolute inset-x-3 h-0.5 rounded-full bg-blush-400 shadow-[0_0_12px_2px_rgba(215,150,157,0.9)]"
            animate={{ top: ['8%', '92%', '8%'] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>
        <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: flash ? 0.7 : 0 }} animate={{ opacity: 0 }} transition={{ duration: 0.4 }} />
      </div>
      <p className="mt-3 flex items-center justify-center gap-2 text-sm text-ink/60"><ScanLine className="h-4 w-4" /> Centra el código de barras dentro del recuadro</p>
    </div>
  );
}
