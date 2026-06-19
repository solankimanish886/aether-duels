import type { ReactNode } from 'react';
import './Card.css';

interface CardProps {
  strong?: boolean;
  className?: string;
  children: ReactNode;
}

export function Card({ strong = false, className = '', children }: CardProps) {
  return (
    <div className={`${strong ? 'glass-strong' : 'glass'} ad-card ${className}`}>{children}</div>
  );
}
