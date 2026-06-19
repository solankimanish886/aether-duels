import { motion } from 'framer-motion';
import { useEffect } from 'react';
import { useUI } from '@/state/ui';
import { useProfile } from '@/state/profile';
import './Splash.css';

export function Splash() {
  const go = useUI((s) => s.go);
  const onboarded = useProfile((s) => s.onboarded);

  useEffect(() => {
    const t = setTimeout(() => go(onboarded ? 'menu' : 'onboarding'), 2200);
    return () => clearTimeout(t);
  }, [go, onboarded]);

  return (
    <div className="splash" onClick={() => go(onboarded ? 'menu' : 'onboarding')}>
      <div className="splash-orb" aria-hidden />
      <motion.h1
        className="display splash-logo"
        initial={{ opacity: 0, y: 24, filter: 'blur(12px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      >
        Aether <span className="splash-logo-accent">Duels</span>
      </motion.h1>
      <motion.p
        className="splash-tagline"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.8 }}
      >
        Real-time drawing battles
      </motion.p>
    </div>
  );
}
