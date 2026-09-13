import React, { useEffect, useRef } from 'react';
import { motion, type Variants } from 'motion/react';
import { SomyaState, SomyaEmotion } from '../types';
import { EMOTION_PROFILES } from '../utils/emotionManager';

// Framer Motion variants for subtle scaling and responsive illumination
const coreMotionVariants: Variants = {
  IDLE: {
    scale: 1,
    filter: 'drop-shadow(0 0 25px rgba(6, 182, 212, 0.35)) drop-shadow(0 0 55px rgba(56, 189, 248, 0.2))',
    transition: { type: 'spring', stiffness: 120, damping: 18 },
  },
  THINKING: {
    scale: 1.08,
    filter: 'drop-shadow(0 0 40px rgba(168, 85, 247, 0.6)) drop-shadow(0 0 85px rgba(99, 102, 241, 0.35))',
    transition: { type: 'spring', stiffness: 140, damping: 14 },
  },
  RESPONDING: {
    scale: 1.06,
    filter: 'drop-shadow(0 0 35px rgba(56, 189, 248, 0.55)) drop-shadow(0 0 75px rgba(168, 85, 247, 0.3))',
    transition: { type: 'spring', stiffness: 130, damping: 15 },
  },
  ERROR: {
    scale: 0.95,
    filter: 'drop-shadow(0 0 40px rgba(239, 68, 68, 0.65)) drop-shadow(0 0 75px rgba(245, 158, 11, 0.4))',
    transition: { type: 'spring', stiffness: 220, damping: 12 },
  },
  LISTENING: {
    scale: 1.04,
    filter: 'drop-shadow(0 0 32px rgba(16, 185, 129, 0.5)) drop-shadow(0 0 65px rgba(6, 182, 212, 0.25))',
    transition: { type: 'spring', stiffness: 130, damping: 16 },
  },
  SPEAKING: {
    scale: 1.05,
    filter: 'drop-shadow(0 0 35px rgba(56, 189, 248, 0.5)) drop-shadow(0 0 70px rgba(168, 85, 247, 0.25))',
    transition: { type: 'spring', stiffness: 130, damping: 16 },
  },
  OFFLINE: {
    scale: 0.9,
    filter: 'drop-shadow(0 0 10px rgba(100, 116, 139, 0.2))',
    transition: { duration: 0.5 },
  },
};

const auraMotionVariants: Variants = {
  IDLE: {
    scale: 1,
    background: 'radial-gradient(circle, rgba(6, 182, 212, 0.22) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 75%)',
    opacity: 0.7,
    transition: { duration: 0.7 },
  },
  THINKING: {
    scale: 1.15,
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, rgba(99, 102, 241, 0.18) 50%, transparent 75%)',
    opacity: 0.9,
    transition: { duration: 0.5 },
  },
  RESPONDING: {
    scale: 1.12,
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.38) 0%, rgba(168, 85, 247, 0.2) 50%, transparent 75%)',
    opacity: 0.85,
    transition: { duration: 0.4 },
  },
  ERROR: {
    scale: 0.95,
    background: 'radial-gradient(circle, rgba(239, 68, 68, 0.5) 0%, rgba(245, 158, 11, 0.2) 50%, transparent 75%)',
    opacity: 0.9,
    transition: { duration: 0.35 },
  },
  LISTENING: {
    scale: 1.07,
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.28) 0%, rgba(6, 182, 212, 0.1) 50%, transparent 75%)',
    opacity: 0.8,
    transition: { duration: 0.6 },
  },
  SPEAKING: {
    scale: 1.08,
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.32) 0%, rgba(168, 85, 247, 0.14) 50%, transparent 75%)',
    opacity: 0.82,
    transition: { duration: 0.6 },
  },
  OFFLINE: {
    scale: 0.9,
    background: 'radial-gradient(circle, rgba(71, 85, 105, 0.12) 0%, transparent 70%)',
    opacity: 0.3,
    transition: { duration: 0.6 },
  },
};

interface SomyaCoreProps {
  state: SomyaState;
  emotion: SomyaEmotion;
  audioLevel: number;
  intensity?: number;
  quality?: 'LOW' | 'MEDIUM' | 'HIGH';
  onClick?: () => void;
}

interface Particle3D {
  x: number;
  y: number;
  z: number;
  radius: number;
  color: string;
  angle: number;
  orbitRadius: number;
  speed: number;
  tilt: number;
  alpha: number;
}

export const SomyaCore: React.FC<SomyaCoreProps> = ({
  state,
  emotion,
  audioLevel,
  intensity = 1,
  quality = 'HIGH',
  onClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const stateRef = useRef<SomyaState>(state);
  const emotionRef = useRef<SomyaEmotion>(emotion);
  const audioLevelRef = useRef<number>(audioLevel);
  const intensityRef = useRef<number>(intensity);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    emotionRef.current = emotion;
  }, [emotion]);

  useEffect(() => {
    audioLevelRef.current = audioLevel;
  }, [audioLevel]);

  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Particle3D[]>([]);
  const animIdRef = useRef<number | null>(null);

  const getThemeColors = (currEmotion: SomyaEmotion, currState: SomyaState) => {
    if (currState === 'ERROR') {
      return {
        primary: '#ef4444',
        secondary: '#f59e0b',
        ambient: '#b91c1c',
        core: '#fee2e2',
      };
    }
    if (currState === 'OFFLINE') {
      return {
        primary: '#475569',
        secondary: '#334155',
        ambient: '#1e293b',
        core: '#cbd5e1',
      };
    }

    const profile = EMOTION_PROFILES[currEmotion] || EMOTION_PROFILES.NEUTRAL;
    return {
      primary: '#06b6d4',
      secondary: '#8b5cf6',
      ambient: '#0284c7',
      core: profile.visual.coreHex || '#ffffff',
    };
  };

  // Initialize 3D orbital particles with depth (Z axis)
  useEffect(() => {
    const count = quality === 'LOW' ? 24 : quality === 'MEDIUM' ? 45 : 70;
    const particles: Particle3D[] = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: 0,
        y: 0,
        z: (Math.random() - 0.5) * 120,
        radius: 0.8 + Math.random() * 2.2,
        color: Math.random() > 0.5 ? '#06b6d4' : '#8b5cf6',
        angle: Math.random() * Math.PI * 2,
        orbitRadius: 55 + Math.random() * 75,
        speed: (0.006 + Math.random() * 0.015) * (Math.random() > 0.5 ? 1 : -1),
        tilt: (Math.random() - 0.5) * 1.2,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
    particlesRef.current = particles;
  }, [quality]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = canvas.parentElement?.clientWidth || 300);
    let height = (canvas.height = canvas.parentElement?.clientHeight || 300);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      timeRef.current += 0.016;
      const t = timeRef.current;

      const currentState = stateRef.current;
      const currentEmotion = emotionRef.current;
      const currentAudio = audioLevelRef.current;
      const currentIntensity = intensityRef.current;

      const colors = getThemeColors(currentEmotion, currentState);

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;

      const profile = EMOTION_PROFILES[currentEmotion] || EMOTION_PROFILES.NEUTRAL;
      const v = profile.visual;

      let speedMultiplier = 1 * v.orbitSpeed;
      let coreScale = 1;

      if (currentState === 'LISTENING') {
        speedMultiplier = 1.3 * v.orbitSpeed;
        coreScale = 1 + currentAudio * 0.25;
      } else if (currentState === 'THINKING') {
        speedMultiplier = 2.2;
        coreScale = 0.96 + Math.sin(t * 8) * 0.05;
      } else if (currentState === 'RESPONDING') {
        speedMultiplier = 1.6 * v.orbitSpeed;
        coreScale = 1.03 + Math.sin(t * 10) * 0.04;
      } else if (currentState === 'SPEAKING') {
        speedMultiplier = 1.5 * v.orbitSpeed;
        coreScale = 1 + Math.sin(t * 12 * v.pulseSpeed) * 0.08 + Math.cos(t * 5) * 0.05;
      } else if (currentState === 'OFFLINE') {
        speedMultiplier = 0.2;
        coreScale = 0.85;
      } else {
        speedMultiplier = 0.8 * v.orbitSpeed;
        coreScale = 1 + Math.sin(t * 1.5 * v.pulseSpeed) * 0.03;
      }

      ctx.save();
      ctx.translate(cx, cy);

      // 1. Cinematic Volumetric Background Core Glow
      const bgGlow = ctx.createRadialGradient(0, 0, 5, 0, 0, 130 * coreScale);
      bgGlow.addColorStop(0, colors.primary + '35');
      bgGlow.addColorStop(0.5, colors.secondary + '15');
      bgGlow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 140 * coreScale, 0, Math.PI * 2);
      ctx.fill();

      // 2. Central Energy Nucleus (Bright glowing orb behind text)
      const nucleusGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50 * coreScale);
      nucleusGrad.addColorStop(0, '#ffffff');
      nucleusGrad.addColorStop(0.3, colors.core);
      nucleusGrad.addColorStop(0.7, colors.primary + 'cc');
      nucleusGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = nucleusGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 50 * coreScale, 0, Math.PI * 2);
      ctx.fill();

      // 3. 3D Energy Petals / Blades (Rotational Curved Blades)
      const petalCount = 5;
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < petalCount; i++) {
        const angle = t * 0.4 * speedMultiplier + (i / petalCount) * Math.PI * 2;
        ctx.save();
        ctx.rotate(angle);
        ctx.scale(1, 0.45); // Elliptical 3D perspective projection

        const petalGrad = ctx.createLinearGradient(-60, 0, 60, 0);
        petalGrad.addColorStop(0, 'rgba(0,0,0,0)');
        petalGrad.addColorStop(0.5, colors.primary + Math.floor(0.5 * currentIntensity * 255).toString(16).padStart(2, '0'));
        petalGrad.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.strokeStyle = petalGrad;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, 75 * coreScale, -Math.PI * 0.35, Math.PI * 0.35);
        ctx.stroke();
        ctx.restore();
      }

      // 4. Tilted 3D Elliptical Orbital Rings with Glow
      const drawTiltedOrbit = (radiusX: number, radiusY: number, tiltAngle: number, rotSpeed: number, color: string, alpha: number) => {
        ctx.save();
        ctx.rotate(tiltAngle);
        ctx.strokeStyle = color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX * coreScale, radiusY * coreScale, t * rotSpeed * speedMultiplier, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      };

      drawTiltedOrbit(95, 38, 0.4, 0.5, colors.primary, 0.45 * currentIntensity);
      drawTiltedOrbit(110, 42, -0.6, -0.4, colors.secondary, 0.35 * currentIntensity);
      drawTiltedOrbit(80, 28, 1.2, 0.7, colors.ambient, 0.4 * currentIntensity);

      // 5. Floating 3D Particles & Energy Trails
      ctx.globalCompositeOperation = 'source-over';
      const particles = particlesRef.current;
      for (let p of particles) {
        p.angle += p.speed * speedMultiplier;
        const cosA = Math.cos(p.angle);
        const sinA = Math.sin(p.angle);
        
        const x = cosA * p.orbitRadius;
        const y = sinA * p.orbitRadius * Math.cos(p.tilt);
        const z = sinA * p.orbitRadius * Math.sin(p.tilt);

        const scale = (z + 150) / 150;
        const alpha = Math.max(0.1, p.alpha * scale);

        ctx.fillStyle = p.color + Math.floor(alpha * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.5, p.radius * scale), 0, Math.PI * 2);
        ctx.fill();

        if (quality === 'HIGH') {
          ctx.strokeStyle = p.color + Math.floor(alpha * 80).toString(16).padStart(2, '0');
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x - Math.cos(p.angle + 0.1) * 8, y - Math.sin(p.angle + 0.1) * 8);
          ctx.stroke();
        }
      }

      ctx.restore();

      animIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
      }
    };
  }, [quality]);

  return (
    <motion.div
      onClick={onClick}
      variants={coreMotionVariants}
      animate={state}
      initial="IDLE"
      className="relative w-[280px] h-[280px] md:w-[320px] md:h-[320px] flex items-center justify-center cursor-pointer select-none group my-2"
      title={`SOMYA Core [${state}] — Click to engage voice`}
    >
      {/* Ambient Volumetric Glow Aura */}
      <motion.div
        variants={auraMotionVariants}
        animate={state}
        initial="IDLE"
        className="absolute inset-0 rounded-full pointer-events-none"
      />

      {/* Cinematic 3D Energy Core Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full rounded-full pointer-events-none"
      />

      {/* Absolute Centerpiece: 3D Floating Typography & State Badge */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center pointer-events-none">
        <div className="relative px-6 py-3 rounded-2xl bg-[#030712]/80 border border-cyan-400/40 shadow-[0_0_35px_rgba(6,182,212,0.35),inset_0_0_20px_rgba(6,182,212,0.2)] backdrop-blur-xl group-hover:border-cyan-400 group-hover:shadow-[0_0_50px_rgba(6,182,212,0.6)] transition-all duration-300">
          {/* Specular Top Rim Light */}
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300 to-transparent pointer-events-none" />

          <span className="text-2xl md:text-3xl font-black tracking-[0.3em] bg-gradient-to-r from-cyan-200 via-sky-300 to-indigo-200 bg-clip-text text-transparent font-display uppercase drop-shadow-[0_0_15px_rgba(6,182,212,0.7)]">
            SOMYA
          </span>

          <div className="flex items-center justify-center gap-2 mt-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow-[0_0_10px_#22d3ee]" />
            <span className="text-[10px] font-mono-tech tracking-widest text-cyan-300 uppercase font-semibold">
              {state}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
