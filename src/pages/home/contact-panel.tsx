import { motion } from 'framer-motion';
import { Banknote, Landmark, Wallet } from 'lucide-react';
import { FaWhatsapp } from 'react-icons/fa';
import { SplitReveal } from '@/components/motion/reveal';
import { SocialLinks } from '@/components/store/social';
import { BagMark, Sparkle } from '@/components/brand/logo';
import { useSettings } from '@/hooks/queries';
import { whatsappLink } from '@/lib/format';

export function ContactPanel() {
  const { data: settings } = useSettings();
  const methods = [
    settings?.transfer_enabled && { icon: Landmark, title: 'Transferencia', text: 'SPEI a nuestra cuenta, envías tu comprobante y listo.' },
    settings?.mercadopago_enabled && { icon: Wallet, title: 'Mercado Pago', text: 'Tarjeta de crédito, débito o saldo, al instante.' },
    settings?.cash_enabled && { icon: Banknote, title: 'Efectivo', text: 'Paga al recoger tu pedido o en nuestra tienda.' },
  ].filter(Boolean) as { icon: typeof Landmark; title: string; text: string }[];

  return (
    <section className="grain relative flex h-full w-full items-center overflow-hidden bg-blush-200 py-20">
      <motion.div
        className="pointer-events-none absolute -right-10 top-4 w-[45vw] max-w-[360px] sm:right-[6%] sm:top-[6%]"
        initial={{ rotate: 25, y: -80, opacity: 0 }}
        whileInView={{ rotate: 12, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 60, damping: 12 }}
      >
        <BagMark className="h-full w-full animate-float" />
      </motion.div>
      <Sparkle className="absolute left-[8%] top-[14%] h-8 w-8 animate-twinkle" />

      <div className="page-wrap relative">
        <p className="eyebrow text-ink/70">Compra fácil</p>
        <SplitReveal text="Paga como prefieras" once={false} className="display mt-3 max-w-3xl text-[clamp(2.6rem,7vw,6rem)]" />

        <div className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {methods.map(({ icon: Icon, title, text }, i) => (
            <motion.div
              key={title}
              className="rounded-[28px] bg-white/80 p-6 backdrop-blur"
              initial={{ opacity: 0, y: 60, rotate: i % 2 ? 4 : -4 }}
              whileInView={{ opacity: 1, y: 0, rotate: 0 }}
              whileHover={{ y: -8 }}
              viewport={{ amount: 0.4 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 120, damping: 14 }}
            >
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-ink text-white"><Icon className="h-5 w-5" /></span>
              <p className="mt-4 text-lg font-semibold">{title}</p>
              <p className="mt-1 text-sm text-ink/60">{text}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-5">
          {settings?.whatsapp && (
            <a href={whatsappLink(settings.whatsapp, '¡Hola Shoppely! Quiero hacer un pedido 💕')} target="_blank" rel="noreferrer" className="btn-dark py-4 text-base">
              <FaWhatsapp className="h-5 w-5" /> Pide por WhatsApp
            </a>
          )}
          <SocialLinks />
        </div>
      </div>
    </section>
  );
}
