import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outline';
  hover?: boolean;
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  variant = 'default',
  hover = false,
  ...props 
}) => {
  const baseStyles = 'bg-white rounded-2xl';
  
  const variantStyles = {
    default: 'shadow-soft border border-neutral-100',
    elevated: 'shadow-elevated',
    outline: 'border-2 border-neutral-200',
  };

  const hoverStyles = hover 
    ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-elevated cursor-pointer' 
    : '';

  return (
    <div 
      className={`${baseStyles} ${variantStyles[variant]} ${hoverStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
