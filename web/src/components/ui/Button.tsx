import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 
    font-semibold font-display
    rounded-xl
    transition-all duration-200 ease-out
    disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
  `;

  const variantStyles = {
    primary: `
      bg-brand-600 text-white 
      hover:bg-brand-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand-500/25
      active:translate-y-0 active:shadow-md
      focus-visible:ring-brand-500
    `,
    secondary: `
      bg-accent-500 text-white 
      hover:bg-accent-400 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/25
      active:translate-y-0 active:shadow-md
      focus-visible:ring-accent-500
    `,
    outline: `
      border-2 border-brand-600 text-brand-600 bg-transparent
      hover:bg-brand-50 hover:-translate-y-0.5
      active:translate-y-0 active:bg-brand-100
      focus-visible:ring-brand-500
    `,
    danger: `
      bg-red-600 text-white 
      hover:bg-red-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-red-500/25
      active:translate-y-0 active:shadow-md
      focus-visible:ring-red-500
    `,
    ghost: `
      text-neutral-600 bg-transparent
      hover:bg-neutral-100 hover:text-neutral-900
      active:bg-neutral-200
      focus-visible:ring-neutral-500
    `,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-5 py-2.5 text-base',
    lg: 'px-7 py-3.5 text-lg',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
