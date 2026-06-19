import { AnimatePresence, motion } from 'framer-motion';
import { create } from 'zustand';
import './Toast.css';

interface ToastItem {
  id: number;
  text: string;
}

interface ToastState {
  items: ToastItem[];
  push: (text: string) => void;
  remove: (id: number) => void;
}

let nextId = 1;

export const useToasts = create<ToastState>((set) => ({
  items: [],
  push: (text) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items, { id, text }] }));
    setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), 2600);
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function ToastHost() {
  const items = useToasts((s) => s.items);
  return (
    <div className="ad-toast-host" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className="glass-strong ad-toast"
            initial={{ opacity: 0, y: 16, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 360, damping: 28 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
