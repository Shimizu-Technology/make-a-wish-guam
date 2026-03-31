import React from 'react';
import { Check, X, AlertTriangle, PartyPopper } from 'lucide-react';

interface IconProps {
  className?: string;
  size?: number;
}

// Checkmark icon for success states
export const CheckIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <Check className={`text-green-500 ${className}`} size={size} />
);

// X icon for error/closed states
export const XIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <X className={`text-red-500 ${className}`} size={size} />
);

// Warning icon for alerts
export const WarningIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <AlertTriangle className={`text-yellow-500 ${className}`} size={size} />
);

// Celebration icon
export const CelebrationIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
  <PartyPopper className={`text-yellow-500 ${className}`} size={size} />
);

// Inline checkmark for text (smaller, inline-block)
export const InlineCheck: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Check className={`inline-block w-4 h-4 text-green-500 ${className}`} />
);

// Inline warning for text
export const InlineWarning: React.FC<{ className?: string }> = ({ className = '' }) => (
  <AlertTriangle className={`inline-block w-4 h-4 text-yellow-500 ${className}`} />
);
