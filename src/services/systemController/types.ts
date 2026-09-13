import { SomyaState, SomyaEmotion, MicState, LanguageMode } from '../../types';

export type SystemActionIntent =
  | 'MIC_ON'
  | 'MIC_OFF'
  | 'VOICE_SELECT'
  | 'VOICE_SAVE'
  | 'VOICE_RESET'
  | 'EMOTION_SET'
  | 'AMBIENT_ON'
  | 'AMBIENT_OFF'
  | 'SETTINGS_OPEN'
  | 'SETTINGS_CLOSE'
  | 'MEMORY_OPEN'
  | 'AUDIO_SETTINGS_OPEN'
  | 'CORE_MODE_SET'
  | 'CORE_INTENSITY_SET'
  | 'CLEAR_MEMORIES_REQUEST'
  | 'CONFIRM_ACTION'
  | 'CANCEL_ACTION';

/**
 * Strict allowlist of safe internal system actions.
 * Any requested action outside this allowlist is unconditionally rejected.
 */
export const ALLOWLISTED_ACTIONS: readonly SystemActionIntent[] = [
  'MIC_ON',
  'MIC_OFF',
  'VOICE_SELECT',
  'VOICE_SAVE',
  'VOICE_RESET',
  'EMOTION_SET',
  'AMBIENT_ON',
  'AMBIENT_OFF',
  'SETTINGS_OPEN',
  'SETTINGS_CLOSE',
  'MEMORY_OPEN',
  'AUDIO_SETTINGS_OPEN',
  'CORE_MODE_SET',
  'CORE_INTENSITY_SET',
  'CLEAR_MEMORIES_REQUEST',
  'CONFIRM_ACTION',
  'CANCEL_ACTION',
] as const;

export interface DetectedSystemIntent {
  intent: SystemActionIntent;
  confidence: number;
  parameters: Record<string, any>;
  rawText: string;
}

export interface SystemActionResult {
  success: boolean;
  action?: string;
  intent: SystemActionIntent;
  message?: string;
  details: string;
  spokenConfirmation: string;
  emotion: SomyaEmotion;
  requiresConfirmation?: boolean;
  uiBadge?: {
    label: string;
    state: string;
  };
}

export interface SystemActionLog {
  id: string;
  timestamp: number;
  timeFormatted: string;
  intent: SystemActionIntent;
  rawCommand: string;
  result: 'SUCCESS' | 'FAILED' | 'REJECTED' | 'CONFIRMATION_REQUIRED';
  details: string;
}

export interface PendingConfirmation {
  intent: SystemActionIntent;
  timestamp: number;
  prompt: string;
  parameters?: Record<string, any>;
}

export interface IMicrophoneController {
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  getState: () => MicState;
}

export interface IVoiceController {
  getAvailableVoices: () => SpeechSynthesisVoice[];
  getActiveVoiceURI: () => string;
  setActiveVoiceURI: (uri: string) => void;
  getLanguageMode: () => LanguageMode;
  setLanguageMode: (mode: LanguageMode) => void;
  saveVoicePreference: () => Promise<boolean>;
  cycleNextVoice: () => { voice: SpeechSynthesisVoice | null; index: number };
  selectLanguageVoice: (lang: 'HINDI' | 'ENGLISH') => { voice: SpeechSynthesisVoice | null; language: LanguageMode };
}

export interface IEmotionController {
  getEmotion: () => SomyaEmotion;
  setEmotion: (emotion: SomyaEmotion) => void;
}

export interface IAudioController {
  isAmbientEnabled: () => boolean;
  setAmbientEnabled: (enabled: boolean) => void;
}

export interface ICoreController {
  getState: () => SomyaState;
  getIntensity: () => number;
  setIntensity: (intensity: number) => void;
  setMode: (mode: 'IDLE' | 'CALM') => void;
}

export interface ISettingsController {
  openSettings: (tab?: string) => void;
  closeSettings: () => void;
  isSettingsOpen?: () => boolean;
  openMemory: () => void;
  closeMemory: () => void;
  isMemoryOpen?: () => boolean;
  openAudioSettings: () => void;
  closeAudioSettings: () => void;
  isAudioSettingsOpen?: () => boolean;
}

export interface IMemoryController {
  clearAllMemories: () => Promise<boolean>;
}

export interface SystemSubsystems {
  microphone: IMicrophoneController;
  voice: IVoiceController;
  emotion: IEmotionController;
  audio: IAudioController;
  core: ICoreController;
  settings: ISettingsController;
  memory: IMemoryController;
}
