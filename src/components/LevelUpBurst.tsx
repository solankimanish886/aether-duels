import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import './LevelUpBurst.css';

interface Props {
  level: number | null;
  onDone: () => void;
}

/** Full-screen celebratory flash when the player levels up. */
export function LevelUpBurst({ level, onDone }: Props) {
  useEffect(() => {
    if (level === null) return;
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [level, onDone]);

  return (
    <AnimatePresence>
      {level !== null && (
        <motion.div
          className="levelup"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <motion.div
            className="levelup-ring"
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 2.6, opacity: 0 }}
            transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
          <motion.div
            className="levelup-inner"
            initial={{ scale: 0.5, opacity: 0, filter: 'blur(12px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            transition={{ type: 'spring', stiffness: 240, damping: 16 }}
          >
            <div className="levelup-eyebrow">Level Up</div>
            <div className="levelup-num display">{level}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
