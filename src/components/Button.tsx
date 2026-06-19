import { motion, type HTMLMotionProps } from 'framer-motion';
import './Button.css';

type Variant = 'glass' | 'primary' | 'accent' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = 'glass',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <motion.button
      className={`ad-btn ad-btn--${variant} ad-btn--${size} ${className}`}
      whileHover={{ y: -2, scale: 1.015 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 420, damping: 26 }}
      {...rest}
    >
      {children}
    </motion.button>
  );
}
