import { motion } from 'framer-motion';
import { FaFacebookF, FaInstagram, FaWhatsapp } from 'react-icons/fa';
import { useSettings } from '@/hooks/queries';
import { whatsappLink } from '@/lib/format';
import { cn } from '@/lib/utils';

export function WhatsAppFab() {
  const { data: settings } = useSettings();
  if (!settings?.whatsapp) return null;
  return (
    <motion.a
      href={whatsappLink(settings.whatsapp, '¡Hola Shoppely! Quiero información 💕')}
      target="_blank"
      rel="noreferrer"
      className="fixed bottom-5 right-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgba(37,211,102,0.7)]"
      initial={{ scale: 0, rotate: -90 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      aria-label="Escríbenos por WhatsApp"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-30" />
      <FaWhatsapp className="relative h-7 w-7" />
    </motion.a>
  );
}

export function SocialLinks({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const { data: settings } = useSettings();
  const links = [
    { href: settings?.whatsapp ? whatsappLink(settings.whatsapp) : null, label: 'WhatsApp', icon: FaWhatsapp },
    { href: settings?.instagram_url, label: 'Instagram', icon: FaInstagram },
    { href: settings?.facebook_url, label: 'Facebook', icon: FaFacebookF },
  ].filter((l) => l.href);

  return (
    <div className={cn('flex gap-3', className)}>
      {links.map(({ href, label, icon: Icon }) => (
        <motion.a
          key={label}
          href={href!}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          whileHover={{ y: -4, rotate: -6 }}
          whileTap={{ scale: 0.9 }}
          className={cn(
            'grid place-items-center rounded-full bg-white text-ink shadow-sm transition-colors hover:bg-blush-400',
            size === 'lg' ? 'h-16 w-16' : 'h-11 w-11',
          )}
        >
          <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]'} />
        </motion.a>
      ))}
    </div>
  );
}
