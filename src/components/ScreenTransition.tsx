import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

/** Wraps each screen so AnimatePresence can cross-fade between them. */
export function ScreenTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0 }}
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.01 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
