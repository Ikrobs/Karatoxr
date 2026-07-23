import type { ButtonHTMLAttributes } from 'react';

export function BigButton({
  className = '',
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' }) {
  const base =
    'w-full rounded-lg py-3.5 font-semibold active:scale-[0.98] transition disabled:opacity-30 disabled:cursor-not-allowed';
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-fuchsia-500 to-cyan-500'
      : 'bg-white/10 border border-white/10';
  return <button className={`${base} ${styles} ${className}`} {...props} />;
}
