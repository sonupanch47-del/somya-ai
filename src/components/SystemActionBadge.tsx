import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface SystemActionBadgeData {
  label: string;
  state: string;
  isError?: boolean;
}

interface SystemActionBadgeProps {
  badge: SystemActionBadgeData | null;
  onDismiss: () => void;
}

export const SystemActionBadge: React.FC<SystemActionBadgeProps> = ({ badge, onDismiss }) => {
  useEffect(() => {
    if (!badge) return;
    const timer = setTimeout(() => {
      onDismiss();
    }, 3500);
    return () => clearTimeout(timer);
  }, [badge, onDismiss]);

  return (
    <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <AnimatePresence>
        {badge && (
          <motion.div
            id="system-action-hud-badge"
            initial={{ opacity: 0, y: -16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className={`flex items-center gap-2.5 px-3.5 py-1.5 rounded-full border shadow-lg backdrop-blur-md ${
              badge.isError
                ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
                : 'bg-neutral-900/90 border-cyan-500/30 text-neutral-200'
            }`}
          >
            {badge.isError ? (
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            )}
            <span className="text-xs font-mono tracking-wider font-semibold uppercase text-cyan-300">
              {badge.label}
            </span>
            <span className="text-xs text-neutral-400">•</span>
            <span className="text-xs font-mono font-medium text-white tracking-wide uppercase">
              {badge.state}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
