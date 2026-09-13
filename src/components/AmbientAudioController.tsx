import React, { useEffect, useRef } from 'react';
import {
  Volume2,
  VolumeX,
  Radio,
  Sparkles,
  Waves,
  Mic,
  Activity,
  Sliders,
  X,
  Headphones,
} from 'lucide-react';
import {
  AmbientAudioControllerState,
  AmbientSoundscape,
} from '../hooks/useAmbientAudio';

interface AmbientAudioControllerProps {
  ambientAudio: AmbientAudioControllerState;
  isOpen: boolean;
  onClose: () => void;
}

export const AmbientAudioController: React.FC<AmbientAudioControllerProps> = ({
  ambientAudio,
  isOpen,
  onClose,
}) => {
  const {
    isEnabled,
    toggleEnabled,
    volume,
    setVolume,
    soundscape,
    setSoundscape,
    currentGain,
    isDucked,
    duckingReason,
    analyserNode,
  } = ambientAudio;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Real-time Canvas Waveform / Equalizer Visualizer
  useEffect(() => {
    if (!canvasRef.current || !isEnabled || !analyserNode) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      animationId = requestAnimationFrame(render);
      analyserNode.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / (bufferLength / 2)) * 1.8;
      let x = 0;

      for (let i = 0; i < bufferLength / 2; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height * 0.85;

        // Dynamic color based on ducking state
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        if (isDucked) {
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)');
          gradient.addColorStop(1, 'rgba(52, 211, 153, 0.85)');
        } else {
          gradient.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
          gradient.addColorStop(1, 'rgba(168, 85, 247, 0.9)');
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isEnabled, analyserNode, isDucked]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-lg glass-panel border border-cyan-500/30 rounded-2xl flex flex-col shadow-2xl overflow-hidden bg-slate-950/90 text-slate-100 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-950/70 border border-cyan-500/30 text-cyan-400">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-display font-bold uppercase tracking-wider text-slate-100 flex items-center gap-2">
                <span>Futuristic Ambient Synth-Scape</span>
              </h2>
              <p className="text-[11px] text-slate-400 font-mono-tech">
                Procedural background audio with active microphone ducking
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Master Toggle & State Banner */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    isEnabled
                      ? isDucked
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.8)]'
                      : 'bg-slate-600'
                  }`}
                />
                <span className="text-xs font-bold uppercase tracking-wide font-mono-tech">
                  {isEnabled ? (
                    isDucked ? (
                      <span className="text-emerald-300">
                        Auto-Ducked [
                        {duckingReason === 'MIC_ACTIVE'
                          ? 'Microphone Active'
                          : duckingReason === 'SPEAKING'
                          ? 'Somya Speaking'
                          : 'Reduced Level'}
                        ]
                      </span>
                    ) : (
                      <span className="text-cyan-300">Ambient Active [SOMYA IDLE]</span>
                    )
                  ) : (
                    <span className="text-slate-400">Ambient Synth Muted</span>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono-tech">
                {isEnabled
                  ? isDucked
                    ? 'Volume attenuated to 12% so voice input remains crystal-clear'
                    : 'Playing atmospheric drone & pads at 100% idle intensity'
                  : 'Enable to stream continuous futuristic atmospheric synth-scapes'}
              </p>
            </div>

            <button
              onClick={toggleEnabled}
              className={`px-4 py-2.5 rounded-xl font-display text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all shadow-md ${
                isEnabled
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
              }`}
            >
              {isEnabled ? (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>ON</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4" />
                  <span>OFF</span>
                </>
              )}
            </button>
          </div>

          {/* Real-time Visualizer Canvas */}
          <div className="relative h-18 w-full bg-slate-950 rounded-xl border border-slate-800/80 p-2 flex flex-col justify-end overflow-hidden">
            <div className="absolute top-2 left-3 flex items-center gap-1.5 text-[10px] font-mono-tech text-slate-400">
              <Activity className="w-3 h-3 text-cyan-400" />
              <span>SYNTH SPECTRUM TELEMETRY</span>
            </div>
            <div className="absolute top-2 right-3 text-[10px] font-mono-tech text-cyan-400">
              {isEnabled ? `${Math.round(currentGain * 100)}% GAIN` : 'MUTED'}
            </div>
            <canvas
              ref={canvasRef}
              width={460}
              height={50}
              className="w-full h-12"
            />
          </div>

          {/* Soundscape Mode Selector */}
          <div className="space-y-2">
            <label className="text-[11px] font-mono-tech uppercase text-slate-400 flex items-center justify-between">
              <span>Soundscape Architecture</span>
              <span className="text-cyan-400 font-bold">{soundscape}</span>
            </label>
            <div className="grid grid-cols-3 gap-2 font-mono-tech text-xs">
              {[
                {
                  id: 'CYBER_VOID',
                  label: 'Quantum Void',
                  desc: 'Sub-bass drone & space vacuum',
                },
                {
                  id: 'NEBULA_DRIFT',
                  label: 'Nebula Drift',
                  desc: 'Analog pads & celestial chimes',
                },
                {
                  id: 'SOLAR_MATRIX',
                  label: 'Solar Matrix',
                  desc: 'Binaural pulse & stellar wind',
                },
              ].map((scape) => (
                <button
                  key={scape.id}
                  onClick={() => setSoundscape(scape.id as AmbientSoundscape)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    soundscape === scape.id
                      ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                      : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <span className="font-bold font-display uppercase tracking-wider text-[11px]">
                    {scape.label}
                  </span>
                  <span className="text-[9px] text-slate-400 mt-1 leading-tight">
                    {scape.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Master Volume Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono-tech">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Ambient Master Volume</span>
              </span>
              <span className="text-cyan-300 font-bold">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <VolumeX className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
              <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
            </div>
          </div>

          {/* Ducking Attenuation Logic Explanation */}
          <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start gap-2.5 text-[11px] text-slate-300 leading-relaxed font-mono-tech">
            <Mic className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-emerald-300">
                Intelligent Microphone Auto-Ducking:
              </span>{' '}
              When you click the microphone or speak, the synthesizer fades to -88% intensity in 280ms. Once you return to IDLE, the ambient synth-scape seamlessly swells back up in 1.4s.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs font-mono-tech text-slate-400">
          <span>Engine: Web Audio API (Procedural 48kHz)</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
