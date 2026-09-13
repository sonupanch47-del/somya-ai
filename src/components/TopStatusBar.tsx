import React, { useState, useEffect } from 'react';
import { SystemStatus, SomyaState } from '../types';
import { Settings, ZoomIn, ZoomOut, User } from 'lucide-react';
import { FirebaseUser } from '../services/firebase';

interface TopStatusBarProps {
  status?: SystemStatus;
  coreState?: SomyaState;
  onOpenSettings?: () => void;
  onToggleZoom?: () => void;
  isZoomed?: boolean;
  user?: FirebaseUser | null;
  onOpenAccount?: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  onOpenSettings,
  onToggleZoom,
  isZoomed: controlledZoomed,
  user,
  onOpenAccount,
}) => {
  const [internalZoomed, setInternalZoomed] = useState<boolean>(false);
  const isZoomed = controlledZoomed !== undefined ? controlledZoomed : internalZoomed;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setInternalZoomed(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const handleZoomClick = () => {
    if (onToggleZoom) {
      onToggleZoom();
      return;
    }

    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        const req =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;

        if (req) {
          req.call(docEl)
            .then(() => setInternalZoomed(true))
            .catch(() => {
              setInternalZoomed((prev) => !prev);
            });
        } else {
          setInternalZoomed((prev) => !prev);
        }
      } else {
        const doc = document as any;
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;

        if (exit) {
          exit.call(doc)
            .then(() => setInternalZoomed(false))
            .catch(() => {
              setInternalZoomed((prev) => !prev);
            });
        } else {
          setInternalZoomed(false);
        }
      }
    } catch {
      setInternalZoomed((prev) => !prev);
    }
  };

  return (
    <header className="w-full px-6 py-3.5 flex items-center justify-between border-b border-cyan-500/10 bg-[#020617]/80 backdrop-blur-xl z-20 transition-all duration-300 shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      {/* Left: Refined Futuristic SOMYA AI Branding */}
      <div className="flex items-center gap-3">
        {/* Holographic Glowing Core Emblem */}
        <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-950/50 border border-cyan-500/30 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
          <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 opacity-60 pointer-events-none" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
        </div>

        <div className="flex flex-col">
          <span className="font-display font-bold text-sm tracking-[0.25em] text-slate-100 uppercase">
            SOMYA AI
          </span>
          <span className="text-[9px] font-mono-tech tracking-[0.18em] text-slate-400 uppercase -mt-0.5">
            Desktop Intelligence
          </span>
        </div>
      </div>

      {/* Right: Actions (Zoom Button & Minimal Settings) */}
      <div className="flex items-center gap-2.5">
        {/* Zoom Button */}
        <button
          id="btn-header-zoom"
          onClick={handleZoomClick}
          className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all duration-200 active:scale-95 ${
            isZoomed
              ? 'bg-cyan-950/60 border-cyan-500/50 text-cyan-200 shadow-[0_0_14px_rgba(6,182,212,0.25)]'
              : 'border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-cyan-200 hover:border-cyan-500/30 hover:bg-cyan-950/40 hover:shadow-[0_0_14px_rgba(6,182,212,0.15)]'
          }`}
          title={isZoomed ? 'Reset Zoom / Exit Fullscreen' : 'Zoom View / Fullscreen'}
          aria-label={isZoomed ? 'Reset Zoom' : 'Zoom View'}
        >
          {isZoomed ? (
            <ZoomOut className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 text-cyan-300" />
          ) : (
            <ZoomIn className="w-3.5 h-3.5 transition-transform duration-200 group-hover:scale-110 text-slate-400 group-hover:text-cyan-300" />
          )}
          <span className="text-[11px] font-mono-tech tracking-wider uppercase text-slate-400 group-hover:text-slate-200 hidden sm:inline">
            {isZoomed ? 'Zoomed' : 'Zoom'}
          </span>
        </button>

        {/* Account Button */}
        {user && onOpenAccount && (
          <button
            id="btn-header-account"
            onClick={onOpenAccount}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-cyan-500/30 bg-cyan-950/40 text-cyan-200 hover:border-cyan-500/60 hover:bg-cyan-900/40 hover:shadow-[0_0_16px_rgba(6,182,212,0.25)] transition-all duration-200 active:scale-95"
            title="Google Account & Profile"
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-4 h-4 rounded-full border border-cyan-400 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-cyan-300" />
            )}
            <span className="text-[11px] font-mono-tech tracking-wider uppercase text-cyan-200 hidden sm:inline truncate max-w-[100px]">
              {user.displayName?.split(' ')[0] || 'Account'}
            </span>
          </button>
        )}

        {/* Minimal High-End Settings Button */}
        {onOpenSettings && (
          <button
            id="btn-header-settings"
            onClick={onOpenSettings}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:text-cyan-200 hover:border-cyan-500/30 hover:bg-cyan-950/40 hover:shadow-[0_0_14px_rgba(6,182,212,0.15)] transition-all duration-200 active:scale-95"
            title="Open Settings"
          >
            <Settings className="w-3.5 h-3.5 transition-transform duration-300 group-hover:rotate-45 text-slate-400 group-hover:text-cyan-300" />
            <span className="text-[11px] font-mono-tech tracking-wider uppercase text-slate-400 group-hover:text-slate-200 hidden sm:inline">
              Settings
            </span>
          </button>
        )}
      </div>
    </header>
  );
};

