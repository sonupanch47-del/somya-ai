import { SomyaEmotion } from '../types';

export interface EmotionProfile {
  id: SomyaEmotion;
  label: string;
  description: string;
  // Core visual parameters
  visual: {
    primary: string;    // e.g. 'rgba(16, 185, 129, '
    secondary: string;  // e.g. 'rgba(56, 189, 248, '
    ambient: string;    // e.g. 'rgba(6, 95, 70, '
    coreHex: string;    // e.g. '#d1fae5'
    glowMultiplier: number; // multiplier on glowAlpha
    pulseSpeed: number; // multiplier on speed of core pulsation
    orbitSpeed: number; // multiplier on ring rotation & particles
    particleActivity: number; // 0 to 1 activity scaling
    wobble: number;     // 0 = stable, >0 = subtle irregular wobble
    burst: boolean;     // short energetic bloom flag
  };
  // Voice TTS parameters (Web Speech API supported properties)
  voice: {
    pitchMultiplier: number; // scales base pitch (1.0 default)
    rateMultiplier: number;  // scales base rate/speed (1.0 default)
    pauseBeforeMs: number;   // pause in ms before uttering
    volumeMultiplier?: number;
  };
  // Hologram 3D avatar color
  avatarColorHex: number;
}

export const EMOTION_PROFILES: Record<SomyaEmotion, EmotionProfile> = {
  NEUTRAL: {
    id: 'NEUTRAL',
    label: 'Neutral',
    description: 'Calm, stable, objective, and poised baseline core state',
    visual: {
      primary: 'rgba(56, 189, 248, ', // Sky
      secondary: 'rgba(148, 163, 184, ', // Slate
      ambient: 'rgba(30, 41, 59, ',
      coreHex: '#e0f2fe',
      glowMultiplier: 1.0,
      pulseSpeed: 1.0,
      orbitSpeed: 0.9,
      particleActivity: 0.5,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.0,
      rateMultiplier: 1.0,
      pauseBeforeMs: 0,
    },
    avatarColorHex: 0x38bdf8,
  },

  CALM: {
    id: 'CALM',
    label: 'Calm',
    description: 'Very smooth, meditative, low-frequency rhythmic breath',
    visual: {
      primary: 'rgba(6, 182, 212, ', // Cyan
      secondary: 'rgba(59, 130, 246, ', // Blue
      ambient: 'rgba(23, 37, 84, ',
      coreHex: '#cffafe',
      glowMultiplier: 0.95,
      pulseSpeed: 0.75,
      orbitSpeed: 0.7,
      particleActivity: 0.4,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 0.96,
      rateMultiplier: 0.92,
      pauseBeforeMs: 50,
      volumeMultiplier: 0.98,
    },
    avatarColorHex: 0x06b6d4,
  },

  HAPPY: {
    id: 'HAPPY',
    label: 'Happy',
    description: 'Bright, cheerful radiant warmth with gentle energetic pulses',
    visual: {
      primary: 'rgba(16, 185, 129, ', // Emerald
      secondary: 'rgba(56, 189, 248, ', // Cyan
      ambient: 'rgba(6, 95, 70, ',
      coreHex: '#d1fae5',
      glowMultiplier: 1.25,
      pulseSpeed: 1.2,
      orbitSpeed: 1.15,
      particleActivity: 0.8,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.08,
      rateMultiplier: 1.06,
      pauseBeforeMs: 0,
    },
    avatarColorHex: 0x10b981,
  },

  EXCITED: {
    id: 'EXCITED',
    label: 'Excited',
    description: 'High kinetic energy, rapid pulsation, and vibrant magenta-cyan flares',
    visual: {
      primary: 'rgba(236, 72, 153, ', // Fuchsia Pink
      secondary: 'rgba(6, 182, 212, ', // Electric Cyan
      ambient: 'rgba(131, 24, 67, ',
      coreHex: '#fce7f3',
      glowMultiplier: 1.45,
      pulseSpeed: 1.55,
      orbitSpeed: 1.4,
      particleActivity: 1.0,
      wobble: 0,
      burst: true,
    },
    voice: {
      pitchMultiplier: 1.16,
      rateMultiplier: 1.14,
      pauseBeforeMs: 0,
    },
    avatarColorHex: 0xec4899,
  },

  FRIENDLY: {
    id: 'FRIENDLY',
    label: 'Friendly',
    description: 'Inviting, open teal-sky aura with rhythmic welcoming orbits',
    visual: {
      primary: 'rgba(20, 184, 166, ', // Teal
      secondary: 'rgba(56, 189, 248, ', // Sky
      ambient: 'rgba(19, 78, 74, ',
      coreHex: '#ccfbf1',
      glowMultiplier: 1.15,
      pulseSpeed: 1.05,
      orbitSpeed: 1.0,
      particleActivity: 0.65,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.04,
      rateMultiplier: 1.02,
      pauseBeforeMs: 0,
    },
    avatarColorHex: 0x14b8a6,
  },

  CARING: {
    id: 'CARING',
    label: 'Caring',
    description: 'Soft, empathetic rose-lavender glow with gentle comforting rhythms',
    visual: {
      primary: 'rgba(244, 114, 182, ', // Soft Rose
      secondary: 'rgba(167, 139, 250, ', // Lavender
      ambient: 'rgba(112, 26, 117, ',
      coreHex: '#fdf2f8',
      glowMultiplier: 1.05,
      pulseSpeed: 0.82,
      orbitSpeed: 0.75,
      particleActivity: 0.45,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 0.95,
      rateMultiplier: 0.9,
      pauseBeforeMs: 80,
      volumeMultiplier: 0.94,
    },
    avatarColorHex: 0xf472b6,
  },

  SAD: {
    id: 'SAD',
    label: 'Sad',
    description: 'Subdued, deeper indigo atmosphere with slow, softer animations',
    visual: {
      primary: 'rgba(99, 102, 241, ', // Indigo
      secondary: 'rgba(148, 163, 184, ', // Slate
      ambient: 'rgba(30, 27, 75, ',
      coreHex: '#e0e7ff',
      glowMultiplier: 0.7,
      pulseSpeed: 0.6,
      orbitSpeed: 0.55,
      particleActivity: 0.3,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 0.88,
      rateMultiplier: 0.84,
      pauseBeforeMs: 120,
    },
    avatarColorHex: 0x6366f1,
  },

  WORRIED: {
    id: 'WORRIED',
    label: 'Worried',
    description: 'Subtle unstable amber pulse reflecting vigilant attention',
    visual: {
      primary: 'rgba(245, 158, 11, ', // Amber
      secondary: 'rgba(217, 119, 6, ', // Ochre
      ambient: 'rgba(120, 53, 15, ',
      coreHex: '#fef3c7',
      glowMultiplier: 1.1,
      pulseSpeed: 0.95,
      orbitSpeed: 1.0,
      particleActivity: 0.6,
      wobble: 0.06, // subtle irregular fluctuation
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.06,
      rateMultiplier: 0.94,
      pauseBeforeMs: 60,
    },
    avatarColorHex: 0xf59e0b,
  },

  ANGRY: {
    id: 'ANGRY',
    label: 'Angry',
    description: 'Crisp, controlled crimson pulse with swift orbital ticks',
    visual: {
      primary: 'rgba(239, 68, 68, ', // Red
      secondary: 'rgba(249, 115, 22, ', // Orange
      ambient: 'rgba(127, 29, 29, ',
      coreHex: '#fee2e2',
      glowMultiplier: 1.3,
      pulseSpeed: 1.45,
      orbitSpeed: 1.35,
      particleActivity: 0.9,
      wobble: 0.04,
      burst: false,
    },
    voice: {
      pitchMultiplier: 0.94,
      rateMultiplier: 1.06,
      pauseBeforeMs: 0,
    },
    avatarColorHex: 0xef4444,
  },

  SURPRISED: {
    id: 'SURPRISED',
    label: 'Surprised',
    description: 'Dynamic brief expansion burst in electric violet & cyan',
    visual: {
      primary: 'rgba(168, 85, 247, ', // Electric Violet
      secondary: 'rgba(34, 211, 238, ', // Bright Cyan
      ambient: 'rgba(88, 28, 135, ',
      coreHex: '#f3e8ff',
      glowMultiplier: 1.4,
      pulseSpeed: 1.4,
      orbitSpeed: 1.3,
      particleActivity: 0.85,
      wobble: 0,
      burst: true,
    },
    voice: {
      pitchMultiplier: 1.18,
      rateMultiplier: 1.1,
      pauseBeforeMs: 40,
    },
    avatarColorHex: 0xa855f7,
  },

  THINKING: {
    id: 'THINKING',
    label: 'Thinking',
    description: 'Analytical violet-indigo scanner beam with steady orbital drift',
    visual: {
      primary: 'rgba(147, 51, 234, ', // Deep Violet
      secondary: 'rgba(99, 102, 241, ', // Indigo
      ambient: 'rgba(88, 28, 135, ',
      coreHex: '#f3e8ff',
      glowMultiplier: 1.2,
      pulseSpeed: 1.15,
      orbitSpeed: 1.25,
      particleActivity: 0.75,
      wobble: 0,
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.0,
      rateMultiplier: 0.95,
      pauseBeforeMs: 220, // thoughtful brief pause
    },
    avatarColorHex: 0x9333ea,
  },

  CONFUSED: {
    id: 'CONFUSED',
    label: 'Confused',
    description: 'Harmonically shifting alternating velocity with curious dual-tone',
    visual: {
      primary: 'rgba(168, 85, 247, ', // Violet
      secondary: 'rgba(45, 212, 191, ', // Teal
      ambient: 'rgba(59, 7, 100, ',
      coreHex: '#f5d0fe',
      glowMultiplier: 1.1,
      pulseSpeed: 1.05,
      orbitSpeed: 0.95,
      particleActivity: 0.65,
      wobble: 0.08, // irregular motion
      burst: false,
    },
    voice: {
      pitchMultiplier: 1.07,
      rateMultiplier: 0.92,
      pauseBeforeMs: 140,
    },
    avatarColorHex: 0xa855f7,
  },
};

/**
 * Normalizes any emotion string (e.g. from Gemini API or legacy codes) to a valid SomyaEmotion.
 */
export function normalizeEmotion(raw?: string): SomyaEmotion {
  if (!raw) return 'NEUTRAL';
  const clean = raw.toUpperCase().trim();

  // Direct match
  if (clean in EMOTION_PROFILES) {
    return clean as SomyaEmotion;
  }

  // Legacy mappings
  if (clean === 'CURIOUS') return 'CONFUSED';
  if (clean === 'THOUGHTFUL') return 'THINKING';
  if (clean === 'CONCERNED') return 'WORRIED';

  // Keyword match
  if (clean.includes('HAPP') || clean.includes('JOY')) return 'HAPPY';
  if (clean.includes('EXCIT') || clean.includes('THRIL')) return 'EXCITED';
  if (clean.includes('FRIEND')) return 'FRIENDLY';
  if (clean.includes('CAR') || clean.includes('EMPATH') || clean.includes('LOVE')) return 'CARING';
  if (clean.includes('SAD') || clean.includes('DEPRESS') || clean.includes('SORROW')) return 'SAD';
  if (clean.includes('WORR') || clean.includes('ANXIOUS') || clean.includes('STRESS')) return 'WORRIED';
  if (clean.includes('ANGR') || clean.includes('MAD') || clean.includes('FRUSTRAT')) return 'ANGRY';
  if (clean.includes('SURPRIS') || clean.includes('SHOCK') || clean.includes('WOW')) return 'SURPRISED';
  if (clean.includes('THINK') || clean.includes('ANALY')) return 'THINKING';
  if (clean.includes('CONFUS') || clean.includes('PUZZL')) return 'CONFUSED';
  if (clean.includes('CALM') || clean.includes('RELAX') || clean.includes('PEACE')) return 'CALM';

  return 'NEUTRAL';
}

/**
 * Analyzes the user's message context and returns the appropriate emotional response state.
 * Adheres strictly to the guideline:
 * "Do not overreact. Do not force an emotion into every message. Normal messages should remain Neutral/Friendly."
 */
export function detectEmotionFromContext(text: string, currentEmotion: SomyaEmotion = 'NEUTRAL'): SomyaEmotion {
  const query = text.toLowerCase().trim();

  // 1. Sad / distress cues -> respond with Caring or Calm support
  if (
    query.includes('sad') ||
    query.includes('depressed') ||
    query.includes('heartbroken') ||
    query.includes('crying') ||
    query.includes('feeling down') ||
    query.includes('upset') ||
    query.includes('unhappy') ||
    query.includes('lost my') ||
    query.includes('hurts') ||
    query.includes('dukh') ||
    query.includes('udaas') ||
    query.includes('dard') ||
    query.includes('pareshan') ||
    query.includes('bura lag raha')
  ) {
    return 'CARING';
  }

  // 2. Angry / frustration cues -> respond with Calm / Patient stance
  if (
    query.includes('angry') ||
    query.includes('furious') ||
    query.includes('hate this') ||
    query.includes('hate you') ||
    query.includes('so annoying') ||
    query.includes('frustrated') ||
    query.includes('terrible') ||
    query.includes('worst') ||
    query.includes('stupid') ||
    query.includes('gussa') ||
    query.includes('bekaar') ||
    query.includes('pagal ho kya')
  ) {
    return 'CALM';
  }

  // 3. Worried / anxiety cues -> respond with Caring & Calm
  if (
    query.includes('worried') ||
    query.includes('nervous') ||
    query.includes('anxious') ||
    query.includes('scared') ||
    query.includes('stress') ||
    query.includes('panic') ||
    query.includes('chinta') ||
    query.includes('dar lag') ||
    query.includes('tension')
  ) {
    return 'WORRIED';
  }

  // 4. Excited / thrill cues -> respond with Excited
  if (
    query.includes('excited') ||
    query.includes("can't wait") ||
    query.includes('cant wait') ||
    query.includes('amazing!') ||
    query.includes('incredible') ||
    query.includes('thrilled') ||
    query.includes('hyped') ||
    query.includes('lets go') ||
    query.includes("let's go") ||
    query.includes('zabardast') ||
    query.includes('shandar')
  ) {
    return 'EXCITED';
  }

  // 5. Happy / joyful cues -> respond with Happy
  if (
    query.includes('happy') ||
    query.includes('great!') ||
    query.includes('awesome') ||
    query.includes('wonderful') ||
    query.includes('so glad') ||
    query.includes('yay') ||
    query.includes('haha') ||
    query.includes('love it') ||
    query.includes('khush') ||
    query.includes('mazza aa gaya') ||
    query.includes('badhiya') ||
    query.includes('congratulations')
  ) {
    return 'HAPPY';
  }

  // 6. Surprised cues -> respond with Surprised
  if (
    query.includes('really?') ||
    query.includes('no way') ||
    query.includes('omg') ||
    query.includes('unbelievable') ||
    query.includes('whoa') ||
    query.includes('are you serious') ||
    query.includes('kya sach mein') ||
    query.includes('shocked')
  ) {
    return 'SURPRISED';
  }

  // 7. Confused / unclear cues -> respond with Confused / Friendly clarity
  if (
    query.includes('confused') ||
    query.includes("don't understand") ||
    query.includes('dont understand') ||
    query.includes('what do you mean') ||
    query.includes('samajh nahi') ||
    query.includes('puzzled') ||
    query.includes('makes no sense')
  ) {
    return 'CONFUSED';
  }

  // 8. Thinking / deep analysis queries -> Thinking
  if (
    query.includes('what if') ||
    query.includes('analyze') ||
    query.includes('explain the logic') ||
    query.includes('calculate') ||
    query.includes('pros and cons') ||
    query.includes('deep thought') ||
    query.includes('socho')
  ) {
    return 'THINKING';
  }

  // 9. Friendly greetings & social check-ins -> Friendly
  if (
    query.includes('hello') ||
    query.includes('hi somya') ||
    query.includes('hey somya') ||
    query.includes('good morning') ||
    query.includes('good afternoon') ||
    query.includes('good evening') ||
    query.includes('namaste') ||
    query.includes('kaise ho') ||
    query.includes('kya hal hai') ||
    query.includes('friend') ||
    query.includes('dost')
  ) {
    return 'FRIENDLY';
  }

  // 10. Calm / peace queries -> Calm
  if (
    query.includes('relax') ||
    query.includes('peace') ||
    query.includes('calm down') ||
    query.includes('chill') ||
    query.includes('shanti') ||
    query.includes('sukoon')
  ) {
    return 'CALM';
  }

  // Standard/factual/technical queries remain NEUTRAL
  return 'NEUTRAL';
}
