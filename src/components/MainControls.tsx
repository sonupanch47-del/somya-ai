import React from 'react';
import { Mic, MicOff, MessageSquare, Database, Settings, Sparkles, Wrench, Headphones } from 'lucide-react';
import { MicState, SomyaState } from '../types';

interface MainControlsProps {
  micState: MicState;
  coreState: SomyaState;
  onToggleMic: () => void;
  onToggleChat: () => void;
  onOpenMemory: () => void;
  onOpenSettings: () => void;
  onOpenTools: () => void;
  onToggleAvatarMode: () => void;
  isAvatarMode: boolean;
  isChatOpen: boolean;
  onOpenAmbientAudio: () => void;
  isAmbientEnabled: boolean;
  isAmbientDucked: boolean;
}

export const MainControls: React.FC<MainControlsProps> = ({
  micState,
  coreState,
  onToggleMic,
  onToggleChat,
  onOpenMemory,
  onOpenSettings,
  onOpenTools,
  onToggleAvatarMode,
  isAvatarMode,
  isChatOpen,
  onOpenAmbientAudio,
  isAmbientEnabled,
  isAmbientDucked,
}) => {
  // Determine mic button visual styling with futuristic glowing pulse
  const getMicButtonClasses = () => {
    switch (micState) {
      case 'LISTENING':
        return 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_30px_rgba(6,182,212,0.5)] ring-2 ring-cyan-400/50 animate-pulse';
      case 'PROCESSING':
        return 'bg-purple-500/25 border-purple-400 text-purple-200 shadow-[0_0_25px_rgba(168,85,247,0.45)] ring-2 ring-purple-400/40';
      case 'ERROR':
        return 'bg-rose-500/25 border-rose-400 text-rose-200 shadow-[0_0_25px_rgba(244,63,94,0.45)] ring-2 ring-rose-400/40';
      case 'ON':
        return 'bg-cyan-900/50 border-cyan-400/70 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]';
      case 'OFF':
      default:
        return 'bg-slate-900/70 border-slate-700/80 text-slate-400 hover:text-cyan-300 hover:border-cyan-500/50 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)]';
    }
  };

  return (
    <nav
      aria-label="Somya Control Deck"
      className="relative flex items-center justify-center gap-2 sm:gap-3.5 md:gap-4 px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-[#040816]/80 border border-cyan-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_25px_rgba(6,182,212,0.12)] backdrop-blur-2xl z-20 transition-all duration-300"
    >
      {/* Top Specular Hologram Hairline Accent */}
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

      {/* 1. Mic Voice Engagement Button */}
      <button
        id="btn-toggle-mic"
        onClick={onToggleMic}
        className={`relative flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 transition-all duration-300 active:scale-95 group ${getMicButtonClasses()}`}
        title={micState === 'LISTENING' ? 'Listening... Click to stop' : 'Click to toggle Voice STT'}
      >
        {micState === 'OFF' ? (
          <MicOff className="w-5 h-5 transition-transform group-hover:scale-105" />
        ) : (
          <Mic className="w-5 h-5 transition-transform group-hover:scale-105" />
        )}
        {micState === 'LISTENING' && (
          <span className="absolute -inset-1 rounded-full border border-cyan-400 animate-ping opacity-70 pointer-events-none" />
        )}
      </button>

      {/* 2. Conversation Hologram Panel Toggle */}
      <button
        id="btn-toggle-chat"
        onClick={onToggleChat}
        className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border transition-all duration-300 active:scale-95 font-mono-tech ${
          isChatOpen
            ? 'bg-cyan-950/70 border-cyan-400/70 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
            : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 hover:bg-slate-900/80'
        }`}
        title="Toggle Conversation Drawer"
      >
        <MessageSquare className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-[11px] font-semibold tracking-wider uppercase font-display hidden sm:inline">
          Chat
        </span>
      </button>

      {/* 3. Persistent Memory Manager */}
      <button
        id="btn-open-memory"
        onClick={onOpenMemory}
        className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 hover:bg-slate-900/80 transition-all duration-300 active:scale-95 font-mono-tech"
        title="View Stored Memories"
      >
        <Database className="w-4 h-4 text-sky-400 shrink-0" />
        <span className="text-[11px] font-semibold tracking-wider uppercase font-display hidden sm:inline">
          Memory
        </span>
      </button>

      {/* 4. Tools & Quick Utilities */}
      <button
        id="btn-open-tools"
        onClick={onOpenTools}
        className="flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 hover:bg-slate-900/80 transition-all duration-300 active:scale-95 font-mono-tech"
        title="Quick AI Tools & Utilities"
      >
        <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-[11px] font-semibold tracking-wider uppercase font-display hidden sm:inline">
          Tools
        </span>
      </button>

      {/* 5. Core vs 3D Avatar Toggle */}
      <button
        id="btn-toggle-avatar"
        onClick={onToggleAvatarMode}
        className={`flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border transition-all duration-300 active:scale-95 font-mono-tech ${
          isAvatarMode
            ? 'bg-purple-950/70 border-purple-400/70 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
            : 'bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-purple-500/40 hover:text-purple-200 hover:bg-slate-900/80'
        }`}
        title="Toggle Core / 3D Hologram Avatar"
      >
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
        <span className="text-[11px] font-semibold tracking-wider uppercase font-display hidden sm:inline">
          {isAvatarMode ? 'Holo 3D' : 'Core'}
        </span>
      </button>

      {/* 6. Ambient Audio Controller */}
      <button
        id="btn-toggle-ambient"
        onClick={onOpenAmbientAudio}
        className={`relative flex items-center gap-2 px-3 sm:px-3.5 py-2 rounded-xl border transition-all duration-300 active:scale-95 font-mono-tech ${
          isAmbientEnabled
            ? isAmbientDucked
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
              : 'bg-cyan-950/70 border-cyan-400/70 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
            : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-cyan-500/40 hover:text-cyan-200 hover:bg-slate-900/80'
        }`}
        title={
          isAmbientEnabled
            ? isAmbientDucked
              ? 'Ambient Synth Scape: Ducked (Mic Active)'
              : 'Ambient Synth Scape: Active (Idle)'
            : 'Open Ambient Synth Controller'
        }
      >
        <Headphones className={`w-4 h-4 shrink-0 ${isAmbientEnabled && !isAmbientDucked ? 'text-cyan-400' : ''}`} />
        <span className="text-[11px] font-semibold tracking-wider uppercase font-display hidden sm:inline">
          {isAmbientEnabled ? (isAmbientDucked ? 'Ducked' : 'Ambient') : 'Audio'}
        </span>
        {isAmbientEnabled && !isAmbientDucked && (
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping absolute top-1.5 right-1.5" />
        )}
      </button>

      {/* 7. System Settings */}
      <button
        id="btn-open-settings"
        onClick={onOpenSettings}
        className="flex items-center justify-center p-2 rounded-xl border bg-slate-900/50 border-slate-800/80 text-slate-300 hover:border-cyan-500/40 hover:text-cyan-200 hover:bg-slate-900/80 transition-all duration-300 active:scale-95"
        title="Somya AI System Settings"
      >
        <Settings className="w-4 h-4" />
      </button>
    </nav>
  );
};
