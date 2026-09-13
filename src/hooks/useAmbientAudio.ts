import { useState, useEffect, useRef, useCallback } from 'react';
import { SomyaState, MicState } from '../types';

export type AmbientSoundscape = 'CYBER_VOID' | 'NEBULA_DRIFT' | 'SOLAR_MATRIX';

export interface AmbientAudioControllerState {
  isEnabled: boolean;
  setEnabled: (val: boolean) => void;
  toggleEnabled: () => void;
  volume: number;
  setVolume: (vol: number) => void;
  soundscape: AmbientSoundscape;
  setSoundscape: (scape: AmbientSoundscape) => void;
  currentGain: number;
  isDucked: boolean;
  duckingReason: 'MIC_ACTIVE' | 'SPEAKING' | 'THINKING' | 'ERROR' | null;
  analyserNode: AnalyserNode | null;
}

interface UseAmbientAudioProps {
  coreState: SomyaState;
  micState: MicState;
  isSpeaking: boolean;
}

export function useAmbientAudio({
  coreState,
  micState,
  isSpeaking,
}: UseAmbientAudioProps): AmbientAudioControllerState {
  // Enabled state - strictly false by default so APP START is completely silent
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  // Clear legacy persistent auto-start flags on mount to guarantee silent startup
  useEffect(() => {
    try {
      localStorage.removeItem('somya_ambient_audio_enabled');
    } catch {}
  }, []);

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('somya_ambient_audio_volume');
      return saved ? parseFloat(saved) : 0.35;
    } catch {
      return 0.35;
    }
  });

  const [soundscape, setSoundscapeState] = useState<AmbientSoundscape>(() => {
    try {
      const saved = localStorage.getItem('somya_ambient_soundscape') as AmbientSoundscape;
      return saved || 'CYBER_VOID';
    } catch {
      return 'CYBER_VOID';
    }
  });

  const [currentGain, setCurrentGain] = useState<number>(0);
  const [isDucked, setIsDucked] = useState<boolean>(false);
  const [duckingReason, setDuckingReason] = useState<
    'MIC_ACTIVE' | 'SPEAKING' | 'THINKING' | 'ERROR' | null
  >(null);

  // Web Audio Context & Nodes refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const duckGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Active synthesizer nodes refs
  const droneOscsRef = useRef<OscillatorNode[]>([]);
  const padOscsRef = useRef<OscillatorNode[]>([]);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const lfoRef = useRef<OscillatorNode | null>(null);
  const noiseNodeRef = useRef<AudioNode | null>(null);
  const chimeIntervalRef = useRef<number | null>(null);

  // Update volume
  const setVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolumeState(clamped);
    try {
      localStorage.setItem('somya_ambient_audio_volume', clamped.toString());
    } catch {
      // ignore storage errors
    }
    if (masterGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.linearRampToValueAtTime(clamped, now + 0.1);
    }
  }, []);

  // Update soundscape
  const setSoundscape = useCallback((scape: AmbientSoundscape) => {
    setSoundscapeState(scape);
    try {
      localStorage.setItem('somya_ambient_soundscape', scape);
    } catch {
      // ignore
    }
  }, []);

  // Initialize or resume AudioContext
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return null;
      const ctx = new AudioContextClass();
      audioCtxRef.current = ctx;

      // Master output gain
      const master = ctx.createGain();
      master.gain.setValueAtTime(volume, ctx.currentTime);
      masterGainRef.current = master;

      // Ducking gain node (fades down when mic is active)
      const duck = ctx.createGain();
      duck.gain.setValueAtTime(1.0, ctx.currentTime);
      duckGainRef.current = duck;

      // Analyser for real-time visualization
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      // Chain: synth sources -> duckGain -> masterGain -> analyser -> destination
      duck.connect(master);
      master.connect(analyser);
      analyser.connect(ctx.destination);
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    return audioCtxRef.current;
  }, [volume]);

  // Procedural Noise Generator (Pink / Brownian noise for cosmic vacuum breath)
  const createCosmicWind = (ctx: AudioContext, destination: AudioNode) => {
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2) * 0.04;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Resonant bandpass filter sweeping slowly
    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(800, ctx.currentTime);
    bandpass.Q.setValueAtTime(2.5, ctx.currentTime);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.08, ctx.currentTime);

    whiteNoise.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(destination);

    whiteNoise.start();
    return whiteNoise;
  };

  // Sparkle chime generator (celestial high harmonic pings)
  const triggerCelestialChime = (ctx: AudioContext, destination: AudioNode) => {
    if (!ctx || ctx.state === 'suspended') return;
    const notes = [440, 554.37, 659.25, 830.61, 987.77, 1108.73]; // Pentatonic A Major / F# Minor
    const freq = notes[Math.floor(Math.random() * notes.length)];

    const osc = ctx.createOscillator();
    const chimeGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const now = ctx.currentTime;
    chimeGain.gain.setValueAtTime(0.0001, now);
    chimeGain.gain.linearRampToValueAtTime(0.06, now + 0.12);
    chimeGain.gain.exponentialRampToValueAtTime(0.00001, now + 3.2);

    osc.connect(chimeGain);
    chimeGain.connect(destination);

    osc.start(now);
    osc.stop(now + 3.5);
  };

  // Build Synth Graph based on selected soundscape
  const startSynth = useCallback(() => {
    const ctx = getAudioContext();
    if (!ctx || !duckGainRef.current) return;

    // Stop existing oscillators first
    stopSynth();

    const duckBus = duckGainRef.current;
    const now = ctx.currentTime;

    // Main Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.Q.setValueAtTime(3.2, now);

    if (soundscape === 'CYBER_VOID') {
      filter.frequency.setValueAtTime(280, now);
    } else if (soundscape === 'NEBULA_DRIFT') {
      filter.frequency.setValueAtTime(450, now);
    } else {
      filter.frequency.setValueAtTime(360, now);
    }
    filter.connect(duckBus);
    filterRef.current = filter;

    // Slow LFO Filter modulation
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.06, now); // ~16s full cycle
    lfoGain.gain.setValueAtTime(soundscape === 'NEBULA_DRIFT' ? 140 : 80, now);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    lfoRef.current = lfo;

    // 1. Deep Sub-Bass Drone Layer (A1 / D2 roots with subtle detuning)
    const droneFreqs =
      soundscape === 'CYBER_VOID'
        ? [55.0, 55.4, 110.2] // Deep A1 void
        : soundscape === 'NEBULA_DRIFT'
        ? [65.41, 65.8, 130.81] // Warm C2 nebula
        : [73.42, 73.9, 146.83]; // Solar D2 matrix

    const newDroneOscs: OscillatorNode[] = [];
    droneFreqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      // Low gain for warm non-fatiguing baseline
      oscGain.gain.setValueAtTime(0.12 / (idx + 1), now);

      osc.connect(oscGain);
      oscGain.connect(filter);
      osc.start();
      newDroneOscs.push(osc);
    });
    droneOscsRef.current = newDroneOscs;

    // 2. Harmonic Ambient Pad Layer (Ethereal chords)
    const padFreqs =
      soundscape === 'CYBER_VOID'
        ? [220.0, 277.18, 329.63] // A minor / major 9th suspended
        : soundscape === 'NEBULA_DRIFT'
        ? [261.63, 329.63, 392.0, 493.88] // C Major 7th celestial
        : [293.66, 369.99, 440.0, 554.37]; // D Major 7th radiant

    const newPadOscs: OscillatorNode[] = [];
    padFreqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const padGain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      padGain.gain.setValueAtTime(0.045, now);

      osc.connect(padGain);
      padGain.connect(filter);
      osc.start();
      newPadOscs.push(osc);
    });
    padOscsRef.current = newPadOscs;

    // 3. Cosmic Wind / Vacuum Breath (Pink noise layer)
    try {
      const noise = createCosmicWind(ctx, duckBus);
      noiseNodeRef.current = noise;
    } catch {
      // Safe fallback if buffer noise creation fails in some browsers
    }

    // 4. Periodic Celestial Sparkle Chimes
    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
    }
    chimeIntervalRef.current = window.setInterval(() => {
      if (audioCtxRef.current && isEnabled) {
        triggerCelestialChime(audioCtxRef.current, duckBus);
      }
    }, soundscape === 'NEBULA_DRIFT' ? 4200 : 7000);
  }, [getAudioContext, soundscape, isEnabled]);

  // Clean up all synth audio nodes
  const stopSynth = () => {
    droneOscsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    droneOscsRef.current = [];

    padOscsRef.current.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {}
    });
    padOscsRef.current = [];

    if (lfoRef.current) {
      try {
        lfoRef.current.stop();
        lfoRef.current.disconnect();
      } catch {}
      lfoRef.current = null;
    }

    if (filterRef.current) {
      try {
        filterRef.current.disconnect();
      } catch {}
      filterRef.current = null;
    }

    if (noiseNodeRef.current) {
      try {
        (noiseNodeRef.current as any).stop?.();
        noiseNodeRef.current.disconnect();
      } catch {}
      noiseNodeRef.current = null;
    }

    if (chimeIntervalRef.current) {
      clearInterval(chimeIntervalRef.current);
      chimeIntervalRef.current = null;
    }
  };

  // Toggle ambient audio enabled/disabled
  const toggleEnabled = useCallback(() => {
    setIsEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('somya_ambient_audio_enabled', next ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const setEnabled = useCallback((val: boolean) => {
    setIsEnabled(val);
    try {
      localStorage.setItem('somya_ambient_audio_enabled', val ? 'true' : 'false');
    } catch {}
  }, []);

  // Handle Enable / Disable Lifecycle
  useEffect(() => {
    if (isEnabled) {
      startSynth();
    } else {
      stopSynth();
    }
    return () => {
      stopSynth();
    };
  }, [isEnabled, soundscape, startSynth]);

  // --- VOLUME FADING & DUCKING LOGIC ---
  // When SOMYA is IDLE -> Full Ambient Intensity (1.0)
  // When MIC is ACTIVE -> Rapidly fade down to ducked intensity (0.12) so voice is crystal-clear
  // When SOMYA is SPEAKING -> Duck to 0.15
  // When SOMYA is THINKING -> Settle to 0.65 with neural focus
  useEffect(() => {
    if (!audioCtxRef.current || !duckGainRef.current || !isEnabled) {
      setCurrentGain(0);
      setIsDucked(false);
      setDuckingReason(null);
      return;
    }

    const ctx = audioCtxRef.current;
    const duckNode = duckGainRef.current;
    const now = ctx.currentTime;

    duckNode.gain.cancelScheduledValues(now);

    const isMicActive = micState === 'LISTENING' || micState === 'PROCESSING' || coreState === 'LISTENING';

    if (isMicActive) {
      // 1. Microphone is active -> Quick, smooth ducking fade (280ms) to 12% intensity
      duckNode.gain.linearRampToValueAtTime(0.12, now + 0.28);
      setIsDucked(true);
      setDuckingReason('MIC_ACTIVE');
      setCurrentGain(0.12);
    } else if (isSpeaking || coreState === 'SPEAKING') {
      // 2. Somya voice TTS is active -> Duck to 15% intensity (350ms)
      duckNode.gain.linearRampToValueAtTime(0.15, now + 0.35);
      setIsDucked(true);
      setDuckingReason('SPEAKING');
      setCurrentGain(0.15);
    } else if (coreState === 'THINKING') {
      // 3. AI is processing -> Settle to 65% with anticipatory ambient hum
      duckNode.gain.linearRampToValueAtTime(0.65, now + 0.5);
      setIsDucked(false);
      setDuckingReason('THINKING');
      setCurrentGain(0.65);
    } else if (coreState === 'ERROR') {
      // 4. System error -> Low subtle warning level
      duckNode.gain.linearRampToValueAtTime(0.2, now + 0.4);
      setIsDucked(true);
      setDuckingReason('ERROR');
      setCurrentGain(0.2);
    } else {
      // 5. SOMYA IS IDLE -> Smooth, luxurious fade back up to 100% full intensity (1.4s curve)
      duckNode.gain.linearRampToValueAtTime(1.0, now + 1.4);
      setIsDucked(false);
      setDuckingReason(null);
      setCurrentGain(1.0);
    }
  }, [coreState, micState, isSpeaking, isEnabled]);

  return {
    isEnabled,
    setEnabled,
    toggleEnabled,
    volume,
    setVolume,
    soundscape,
    setSoundscape,
    currentGain,
    isDucked,
    duckingReason,
    analyserNode: analyserRef.current,
  };
}
