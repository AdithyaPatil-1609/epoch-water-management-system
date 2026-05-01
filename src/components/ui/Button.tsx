'use client';
import { motion, HTMLMotionProps } from 'framer-motion';
import { forwardRef } from 'react';

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, variant = 'primary', size = 'md', className = '', ...props }, ref) => {
    
    let variantStyles = '';
    switch (variant) {
      case 'primary':
        variantStyles = 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm';
        break;
      case 'secondary':
        variantStyles = 'bg-slate-800 hover:bg-slate-900 text-white shadow-sm';
        break;
      case 'outline':
        variantStyles = 'border border-slate-300 hover:bg-slate-50 text-slate-700';
        break;
      case 'danger':
        variantStyles = 'bg-red-600 hover:bg-red-700 text-white shadow-sm';
        break;
    }

    let sizeStyles = '';
    switch (size) {
      case 'sm':
        sizeStyles = 'px-3 py-1.5 text-sm';
        break;
      case 'md':
        sizeStyles = 'px-4 py-2 text-sm';
        break;
      case 'lg':
        sizeStyles = 'px-6 py-3 text-base';
        break;
    }

    return (
      <motion.button
        ref={ref}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className={`font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      >
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';
