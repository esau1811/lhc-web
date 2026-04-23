'use client';

import { motion } from 'framer-motion';

export default function GlassCard({ children, className = "" }) {
  return (
    <motion.div 
      whileHover={{ y: -5, boxShadow: '0 0 30px rgba(255, 179, 0, 0.15)' }}
      className={`glass-card ${className}`}
    >
      <div className="glass-card-border-top"></div>
      {children}
    </motion.div>
  );
}
