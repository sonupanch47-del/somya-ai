export type SomyaState = 'IDLE' | 'LISTENING' | 'THINKING' | 'RESPONDING' | 'SPEAKING' | 'OFFLINE' | 'ERROR';

export type SomyaEmotion =
  | 'NEUTRAL'
  | 'HAPPY'
  | 'EXCITED'
  | 'FRIENDLY'
  | 'CARING'
  | 'SAD'
  | 'WORRIED'
  | 'ANGRY'
  | 'SURPRISED'
  | 'THINKING'
  | 'CONFUSED'
  | 'CALM';

export type LanguageMode = 'AUTO' | 'ENGLISH' | 'HINDI' | 'HINGLISH';

export type MicState = 'OFF' | 'ON' | 'LISTENING' | 'PROCESSING' | 'ERROR';

export type MemoryCategory =
  | 'PROFILE'
  | 'PREFERENCE'
  | 'INTEREST'
  | 'PROJECT'
  | 'GOAL'
  | 'HABIT'
  | 'CONVERSATION_FACT'
  | 'IMPORTANT_FACT'
  | 'USER_SETTING'
  | 'PERSONAL'
  | 'TASK'
  | 'OTHER';

export type MemoryImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SomyaMemory {
  id: string;
  category: MemoryCategory;
  key?: string;
  value?: string;
  importance: MemoryImportance | number;
  confidence?: number;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
  lastAccessedAt?: string;
  last_accessed_at?: string;
  accessCount?: number;
  access_count?: number;
  source?: 'EXPLICIT' | 'AUTOMATIC' | 'UI' | 'SYSTEM' | string;
  active?: boolean | number;
  content: string;
}

export interface GroundingSource {
  uri: string;
  title: string;
}

export interface GroundingPlace {
  uri: string;
  title: string;
  snippet?: string;
}

export interface GeneratedMusicTrack {
  id: string;
  title: string;
  audioUrl: string;
  mimeType: string;
  lyrics?: string;
  prompt: string;
  modelUsed: 'lyria-3-clip-preview' | 'lyria-3-pro-preview' | string;
  duration?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'somya';
  text: string;
  timestamp: string;
  emotion?: SomyaEmotion;
  language?: string;
  toolUsed?: string;
  memoryCaptured?: boolean;
  searchSources?: GroundingSource[];
  mapPlaces?: GroundingPlace[];
  musicTrack?: GeneratedMusicTrack;
}

export interface SavedVoicePreference {
  selectedVoiceId: string;
  selectedVoiceName: string;
  provider: string;
  language: string;
  saved: boolean;
}

export interface SomyaSettings {
  general: {
    startupAnimation: boolean;
    uiScale: number;
    quality: 'LOW' | 'MEDIUM' | 'HIGH';
  };
  ai: {
    model: string;
    temperature: number;
    responseStyle: 'balanced' | 'concise' | 'elaborate';
  };
  voice: {
    enabled: boolean;
    autoSpeak: boolean;
    volume: number; // 0 to 1
    speed: number;  // 0.5 to 2
    voiceURI: string;
    savedVoice?: SavedVoicePreference | null;
    interruptible: boolean;
  };
  language: {
    preferredLanguage: LanguageMode;
  };
  memory: {
    enabled: boolean;
    autoExtract: boolean;
  };
  appearance: {
    coreIntensity: number; // 0.5 to 1.5
    glowLevel: number;
    particlesEnabled: boolean;
    showAvatar3D: boolean;
  };
  privacy: {
    localDataControl: boolean;
  };
}

export interface SystemStatus {
  ai: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
  voice: 'READY' | 'LISTENING' | 'OFFLINE' | 'ERROR';
  memory: 'ACTIVE' | 'ERROR' | 'OFFLINE';
  network: 'CONNECTED' | 'DISCONNECTED';
  latency: number | null;
  model: string;
}

export interface ToolResult {
  tool: string;
  success: boolean;
  result: any;
  displayText?: string;
}
