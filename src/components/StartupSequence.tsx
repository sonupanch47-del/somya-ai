import React, { useState, useEffect } from 'react';

interface StartupSequenceProps {
  onComplete: () => void;
}

export const StartupSequence: React.FC<StartupSequenceProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('INITIALIZING QUANTUM KERNEL...');

  useEffect(() => {
    const steps = [
      { p: 15, msg: 'INITIALIZING QUANTUM KERNEL...' },
      { p: 35, msg: 'CALIBRATING HOLOGRAPHIC EMITTERS...' },
      { p: 60, msg: 'CONNECTING GEMINI NEURAL SYNAPSE...' },
      { p: 85, msg: 'LOADING PERSISTENT MEMORY MATRICES...' },
      { p: 100, msg: 'SOMYA AI ONLINE' },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setProgress(steps[currentStep].p);
        setStatusMessage(steps[currentStep].msg);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 400);
      }
    }, 380);

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#030712] flex flex-col items-center justify-center p-6 select-none animate-in fade-in duration-500">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {/* Futuristic pulsing emblem */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-cyan-500/40 animate-ping" />
          <div className="absolute inset-2 rounded-full border border-purple-500/50 animate-spin" />
          <div className="w-8 h-8 rounded-full bg-cyan-400 shadow-[0_0_25px_rgba(6,182,212,0.9)] animate-pulse" />
        </div>

        <div className="space-y-1">
          <h1 className="text-xl font-display font-bold tracking-[0.25em] text-slate-100 uppercase">
            SOMYA AI
          </h1>
          <p className="text-xs font-mono-tech text-cyan-400 tracking-wider">
            {statusMessage}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-300 shadow-[0_0_10px_rgba(6,182,212,0.8)]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <button
          onClick={onComplete}
          className="text-[11px] font-mono-tech text-slate-500 hover:text-cyan-400 tracking-widest uppercase transition-colors pt-2"
        >
          [ Skip Telemetry Boot ]
        </button>
      </div>
    </div>
  );
};
