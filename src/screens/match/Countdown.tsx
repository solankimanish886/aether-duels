import { AnimatePresence, motion } from 'framer-motion';
import type { CountdownValue } from '@/state/match';
import './Countdown.css';

export function Countdown({ value, prompt }: { value: CountdownValue | null; prompt: string }) {
  return (
    <AnimatePresence>
      {value !== null && (
        <motion.div
          className="countdown-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={String(value)}
              className={`countdown-num display ${value === 'GO' ? 'is-go' : ''}`}
              initial={{ scale: 2, opacity: 0, filter: 'blur(12px)' }}
              animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
              exit={{ scale: 0.6, opacity: 0, filter: 'blur(8px)' }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              {value}
            </motion.div>
          </AnimatePresence>
          <motion.p
            className="countdown-prompt"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            Draw <span className="countdown-prompt-word display">{prompt}</span>
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
