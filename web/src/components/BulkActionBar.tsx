import React from 'react';

interface BulkActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  children: React.ReactNode;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onClearSelection,
  children,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="sticky top-0 z-20 bg-brand-800 text-white px-4 py-3 rounded-lg shadow-lg mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="font-semibold">
          {selectedCount} selected
        </span>
        <button
          onClick={onClearSelection}
          className="text-brand-200 hover:text-white text-sm underline"
        >
          Clear selection
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {children}
      </div>
    </div>
  );
};

// Button specifically styled for bulk action bar
interface BulkActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'danger';
  children: React.ReactNode;
}

export const BulkActionButton: React.FC<BulkActionButtonProps> = ({
  variant = 'default',
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    default: 'bg-white text-brand-800 hover:bg-brand-50',
    danger: 'bg-red-500 text-white hover:bg-red-600',
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
