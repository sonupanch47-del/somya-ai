import React, { useEffect, useRef } from 'react';
import { SomyaState, SomyaEmotion } from '../types';

interface VoiceWaveformProps {
  state: SomyaState;
  emotion: SomyaEmotion;
  audioLevel: number; // 0 to 1
  isMicActive: boolean;
  isSpeaking: boolean;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({
  state,
  emotion,
  audioLevel,
  isMicActive,
  isSpeaking,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 360);
    const height = (canvas.height = 54);

    const render = () => {
      phaseRef.current += 0.04;
      const p = phaseRef.current;

      ctx.clearRect(0, 0, width, height);

      const barCount = 36;
      const barWidth = 3;
      const gap = (width - barCount * barWidth) / (barCount - 1);
      const centerY = height / 2;

      // Color mapping
      let color = 'rgba(56, 189, 248, '; // default cyan
      if (state === 'LISTENING') color = 'rgba(14, 165, 233, ';
      else if (state === 'SPEAKING') color = 'rgba(168, 85, 247, ';
      else if (state === 'THINKING') color = 'rgba(236, 72, 153, ';
      else if (state === 'ERROR') color = 'rgba(239, 68, 68, ';
      else if (state === 'OFFLINE') color = 'rgba(100, 116, 139, ';

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        const normDist = Math.abs(i - barCount / 2) / (barCount / 2); // 0 at center, 1 at ends
        const falloff = 1 - Math.pow(normDist, 1.4); // higher at center

        let amp = 2; // base idle amplitude

        if (state === 'LISTENING') {
          // Real mic audio level reaction
          const wave = Math.sin(i * 0.4 + p * 2) * Math.cos(i * 0.2);
          amp = 4 + (audioLevel * 24 + Math.abs(wave) * 8) * falloff;
        } else if (state === 'SPEAKING') {
          // TTS speaking pulse
          const voiceWave = Math.sin(i * 0.5 + p * 3) + Math.cos(i * 0.25 - p * 2);
          amp = 3 + (Math.abs(voiceWave) * 16 + 5) * falloff;
        } else if (state === 'THINKING') {
          // Traveling data wave
          const travel = Math.sin(i * 0.6 - p * 4);
          amp = 3 + Math.max(0, travel) * 14 * falloff;
        } else if (state === 'OFFLINE') {
          amp = 1.5;
        } else {
          // Subtle idle breathing wave
          amp = 2 + (Math.sin(i * 0.3 + p) * 2 + 1) * falloff;
        }

        const barHeight = Math.max(3, Math.min(height - 4, amp * 2));
        const y = centerY - barHeight / 2;

        const grad = ctx.createLinearGradient(0, y, 0, y + barHeight);
        grad.addColorStop(0, color + '0.2)');
        grad.addColorStop(0.5, color + '0.95)');
        grad.addColorStop(1, color + '0.2)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 2);
        ctx.fill();
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [state, emotion, audioLevel, isMicActive, isSpeaking]);

  return (
    <div className="flex flex-col items-center gap-1.5 w-full max-w-sm px-4">
      <div className="w-full h-[54px] flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      <div className="flex items-center gap-2 text-[11px] tracking-wider uppercase font-mono-tech text-cyan-400/60">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
        <span>
          {state === 'LISTENING'
            ? 'AUDIO STREAM • LIVE MIC INPUT'
            : state === 'SPEAKING'
            ? 'VOICE BUS • TTS SYNTHESIZER'
            : state === 'THINKING'
            ? 'NEURAL SYNAPSE • COMPUTE ACTIVE'
            : 'AUDIO INTERFACE • STANDBY'}
        </span>
      </div>
    </div>
  );
};
