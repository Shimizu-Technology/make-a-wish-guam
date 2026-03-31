import React from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: React.ReactNode;
  className?: string;
}

// Smooth fade + slide up animation
const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: -8,
  },
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeOut' as const,
  duration: 0.25,
};

export const PageTransition: React.FC<PageTransitionProps> = ({ 
  children, 
  className = '' 
}) => {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// For staggered list animations
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'tween',
      ease: 'easeOut',
      duration: 0.2,
    },
  },
};

// For cards that fade in on scroll
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-50px' },
  transition: { duration: 0.4, ease: 'easeOut' },
};
