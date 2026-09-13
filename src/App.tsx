import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  SomyaState,
  SomyaEmotion,
  ChatMessage,
  SomyaMemory,
  SomyaSettings,
  SystemStatus,
  MemoryCategory,
} from './types';
import { TopStatusBar } from './components/TopStatusBar';
import { SomyaCore } from './components/SomyaCore';
import { VoiceWaveform } from './components/VoiceWaveform';
import { HologramAvatar } from './components/HologramAvatar';
import { LiveTelemetryHud } from './components/LiveTelemetryHud';
import { MainControls } from './components/MainControls';
import { ConversationDrawer } from './components/ConversationDrawer';
import { MemoryPanel } from './components/MemoryPanel';
import { ToolLauncher } from './components/ToolLauncher';
import { SettingsModal } from './components/SettingsModal';
import { StartupSequence } from './components/StartupSequence';
import { AmbientAudioController } from './components/AmbientAudioController';
import { useVoice } from './hooks/useVoice';
import { useAmbientAudio } from './hooks/useAmbientAudio';
import { detectEmotionFromContext, normalizeEmotion } from './utils/emotionManager';
import {
  getLiveDateTime,
  detectDateTimeQuery,
  generateDateTimeReply,
} from './services/dateTimeService';
import { systemController } from './services/systemController';
import { SystemActionBadge, SystemActionBadgeData } from './components/SystemActionBadge';
import { LanguageMode } from './types';
import {
  getStoredVoicePreference,
  fetchServerVoicePreference,
  persistVoicePreference,
  validateAndResolveVoice,
} from './services/voicePersistence';
import { motion } from 'motion/react';
import { AlertCircle, Send, X } from 'lucide-react';
import { auth, onAuthStateChanged, FirebaseUser } from './services/firebase';
import { LoginScreen } from './components/LoginScreen';
import { AccountModal } from './components/AccountModal';

export const App: React.FC = () => {
  // Authentication states
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);
  const [isAccountOpen, setIsAccountOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  // System states
  const [coreState, setCoreState] = useState<SomyaState>('IDLE');
  const [emotion, setEmotion] = useState<SomyaEmotion>('CALM');
  const [isAvatarMode, setIsAvatarMode] = useState<boolean>(false);
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [quickInput, setQuickInput] = useState<string>('');

  // Modals & Drawers
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isMemoryOpen, setIsMemoryOpen] = useState<boolean>(false);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'GENERAL' | 'AI' | 'VOICE' | 'LANGUAGE' | 'MEMORY' | 'APPEARANCE' | 'PRIVACY' | 'ABOUT'
  >('GENERAL');
  const [isAmbientAudioOpen, setIsAmbientAudioOpen] = useState<boolean>(false);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);

  // System Action UI feedback badge
  const [actionBadge, setActionBadge] = useState<SystemActionBadgeData | null>(null);

  useEffect(() => {
    const handleFsChange = () => {
      setIsZoomed(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleZoom = () => {
    try {
      if (!document.fullscreenElement) {
        const docEl = document.documentElement as any;
        const req =
          docEl.requestFullscreen ||
          docEl.webkitRequestFullscreen ||
          docEl.mozRequestFullScreen ||
          docEl.msRequestFullscreen;
        if (req) {
          req.call(docEl).catch(() => {});
        }
      } else {
        const doc = document as any;
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        if (exit) {
          exit.call(doc).catch(() => {});
        }
      }
    } catch {
      // Safe fallback
    }
    setIsZoomed((prev) => !prev);
  };

  // Chat & Memory state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [memories, setMemories] = useState<SomyaMemory[]>([]);

  // Telemetry status
  const [status, setStatus] = useState<SystemStatus>({
    ai: 'ONLINE',
    voice: 'READY',
    memory: 'ACTIVE',
    network: 'CONNECTED',
    latency: 24,
    model: 'gemini-3.8-flash',
  });

  // Master Settings - synchronously restored from persistent storage on initial mount
  const [settings, setSettings] = useState<SomyaSettings>(() => {
    const initialSaved = getStoredVoicePreference();
    const savedLang =
      typeof window !== 'undefined'
        ? (localStorage.getItem('somya_saved_language') as LanguageMode | null)
        : null;
    return {
      general: {
        startupAnimation: true,
        uiScale: 1,
        quality: 'HIGH',
      },
      ai: {
        model: 'gemini-3.8-flash',
        temperature: 0.7,
        responseStyle: 'balanced',
      },
      voice: {
        enabled: true,
        autoSpeak: true,
        volume: 1,
        speed: 1,
        voiceURI: initialSaved?.selectedVoiceId || '',
        savedVoice: initialSaved,
        interruptible: true,
      },
      language: {
        preferredLanguage: savedLang || 'AUTO',
      },
      memory: {
        enabled: true,
        autoExtract: true,
      },
      appearance: {
        coreIntensity: 1,
        glowLevel: 1,
        particlesEnabled: true,
        showAvatar3D: true,
      },
      privacy: {
        localDataControl: true,
      },
    };
  });

  // Health and Latency checking
  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      const latency = Math.round(performance.now() - start);
      setStatus((prev) => ({
        ...prev,
        ai: data.aiOnline ? 'ONLINE' : 'DEGRADED',
        latency,
        network: 'CONNECTED',
      }));
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        ai: 'OFFLINE',
        network: 'DISCONNECTED',
        latency: null,
      }));
    }
  }, []);

  // Fetch initial memories
  const loadMemories = useCallback(async () => {
    try {
      const res = await fetch('/api/memories');
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.warn('Failed to load memories:', err);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    loadMemories();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth, loadMemories]);

  // Prevent overlapping concurrent submissions
  const isSubmittingRef = useRef<boolean>(false);

  // Voice Hook Integration
  const handleTranscript = useCallback(
    (transcript: string) => {
      if (!transcript || typeof transcript !== 'string') return;
      const cleanText = transcript.trim();
      if (!cleanText || cleanText.length < 2) return;
      if (isSubmittingRef.current) return;
      handleSendMessage(cleanText);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings]
  );

  const {
    micState,
    micError,
    isSpeaking,
    audioLevel,
    availableVoices,
    isMicEnabled,
    startListening,
    stopListening,
    toggleListening,
    notifyProcessingFinished,
    clearMicError,
    speakText,
    stopSpeaking,
  } = useVoice({
    onTranscript: handleTranscript,
    preferredLanguage: settings.language.preferredLanguage,
    autoSpeak: settings.voice.autoSpeak,
    volume: settings.voice.volume,
    speed: settings.voice.speed,
    voiceURI: settings.voice.voiceURI,
    onStateChange: (newState) => {
      setCoreState(newState);
      setStatus((prev) => ({
        ...prev,
        voice:
          newState === 'LISTENING'
            ? 'LISTENING'
            : newState === 'ERROR'
            ? 'ERROR'
            : 'READY',
      }));
    },
  });

  // Ambient Synth-Scape Audio Engine with Auto-Ducking
  const ambientAudio = useAmbientAudio({
    coreState,
    micState,
    isSpeaking,
  });

  // Validate and reconcile saved voice once browser availableVoices are loaded
  useEffect(() => {
    if (!availableVoices || availableVoices.length === 0) return;

    const saved = settings.voice.savedVoice || getStoredVoicePreference();
    if (saved && saved.selectedVoiceId) {
      const res = validateAndResolveVoice(saved, availableVoices);
      if (res.isValid && res.voice) {
        if (settings.voice.voiceURI !== res.voice.voiceURI) {
          setSettings((prev) => ({
            ...prev,
            voice: {
              ...prev.voice,
              voiceURI: res.voice!.voiceURI,
              savedVoice: {
                ...saved,
                selectedVoiceId: res.voice!.voiceURI,
                selectedVoiceName: res.voice!.name,
              },
            },
          }));
        }
      } else if (res.isFallback) {
        console.warn('[VOICE] ' + res.warning);
        setSettings((prev) => ({
          ...prev,
          voice: {
            ...prev.voice,
            voiceURI: res.voice ? res.voice.voiceURI : '',
          },
        }));
      }
    }
  }, [availableVoices]);

  // Load persistent system settings from SQLite server endpoint on mount
  useEffect(() => {
    const loadSavedSettings = async () => {
      try {
        const serverPref = await fetchServerVoicePreference();
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          const serverSettings = data.settings || {};
          const activePref = serverPref || getStoredVoicePreference();
          const resolvedVoiceURI =
            activePref?.selectedVoiceId ||
            serverSettings.voice_uri ||
            localStorage.getItem('somya_saved_voice_uri');
          const savedLang = (serverSettings.preferred_language ||
            localStorage.getItem('somya_saved_language')) as LanguageMode | null;
          const savedIntensity = serverSettings.core_intensity
            ? parseFloat(serverSettings.core_intensity)
            : null;

          setSettings((prev) => ({
            ...prev,
            voice: {
              ...prev.voice,
              voiceURI: resolvedVoiceURI || prev.voice.voiceURI,
              savedVoice: activePref || prev.voice.savedVoice,
            },
            language: {
              ...prev.language,
              preferredLanguage: savedLang || prev.language.preferredLanguage,
            },
            appearance: {
              ...prev.appearance,
              coreIntensity:
                savedIntensity !== null && !isNaN(savedIntensity)
                  ? savedIntensity
                  : prev.appearance.coreIntensity,
            },
          }));
        }
      } catch (e) {
        const localPref = getStoredVoicePreference();
        const localLang = localStorage.getItem('somya_saved_language') as LanguageMode | null;
        if (localPref || localLang) {
          setSettings((prev) => ({
            ...prev,
            voice: {
              ...prev.voice,
              voiceURI: localPref?.selectedVoiceId || prev.voice.voiceURI,
              savedVoice: localPref || prev.voice.savedVoice,
            },
            language: {
              ...prev.language,
              preferredLanguage: localLang || prev.language.preferredLanguage,
            },
          }));
        }
      }
    };

    loadSavedSettings();
  }, []);

  // Synchronization refs for instant synchronous subsystem verification in SomyaSystemController
  const emotionRef = useRef<SomyaEmotion>(emotion);
  emotionRef.current = emotion;

  const isSettingsOpenRef = useRef<boolean>(isSettingsOpen);
  isSettingsOpenRef.current = isSettingsOpen;

  const isMemoryOpenRef = useRef<boolean>(isMemoryOpen);
  isMemoryOpenRef.current = isMemoryOpen;

  const isAmbientAudioOpenRef = useRef<boolean>(isAmbientAudioOpen);
  isAmbientAudioOpenRef.current = isAmbientAudioOpen;

  const settingsRef = useRef<SomyaSettings>(settings);
  settingsRef.current = settings;

  const availableVoicesRef = useRef<SpeechSynthesisVoice[]>(availableVoices);
  availableVoicesRef.current = availableVoices;

  const ambientEnabledRef = useRef<boolean>(ambientAudio.isEnabled);
  ambientEnabledRef.current = ambientAudio.isEnabled;

  // Register subsystems with the central SomyaSystemController
  useEffect(() => {
    systemController.registerSubsystems({
      microphone: {
        enable: startListening,
        disable: stopListening,
        isEnabled: () => (typeof isMicEnabled === 'function' ? isMicEnabled() : micState !== 'OFF'),
        getState: () => (isMicEnabled() ? (micState === 'OFF' ? 'LISTENING' : micState) : 'OFF'),
      },
      voice: {
        getAvailableVoices: () => availableVoicesRef.current,
        getActiveVoiceURI: () => settingsRef.current.voice.voiceURI,
        setActiveVoiceURI: (uri: string) => {
          settingsRef.current = {
            ...settingsRef.current,
            voice: { ...settingsRef.current.voice, voiceURI: uri },
          };
          setSettings((prev) => ({
            ...prev,
            voice: { ...prev.voice, voiceURI: uri },
          }));
        },
        getLanguageMode: () => settingsRef.current.language.preferredLanguage,
        setLanguageMode: (mode: LanguageMode) => {
          settingsRef.current = {
            ...settingsRef.current,
            language: { ...settingsRef.current.language, preferredLanguage: mode },
          };
          setSettings((prev) => ({
            ...prev,
            language: { ...prev.language, preferredLanguage: mode },
          }));
        },
        saveVoicePreference: async () => {
          try {
            const curVoices = availableVoicesRef.current;
            const curSettings = settingsRef.current;
            const activeVoice =
              curVoices.find((v) => v.voiceURI === curSettings.voice.voiceURI) ||
              curVoices.find((v) => v.name === curSettings.voice.voiceURI) ||
              (curVoices.length > 0 ? curVoices[0] : null);

            const voiceToSave = activeVoice || {
              voiceURI: curSettings.voice.voiceURI || 'default',
              name: activeVoice?.name || 'Default System Voice',
              lang:
                activeVoice?.lang ||
                (curSettings.language.preferredLanguage === 'HINDI' ? 'hi-IN' : 'en-US'),
            };

            const result = await persistVoicePreference(voiceToSave);
            if (result.success && result.preference) {
              settingsRef.current = {
                ...curSettings,
                voice: {
                  ...curSettings.voice,
                  voiceURI: result.preference.selectedVoiceId,
                  savedVoice: result.preference,
                },
              };
              setSettings((prev) => ({
                ...prev,
                voice: {
                  ...prev.voice,
                  voiceURI: result.preference!.selectedVoiceId,
                  savedVoice: result.preference,
                },
              }));
              return true;
            }
            return false;
          } catch (e) {
            console.error('Failed to save voice preference:', e);
            return false;
          }
        },
        cycleNextVoice: () => {
          const curVoices = availableVoicesRef.current;
          if (!curVoices || curVoices.length === 0) {
            return { voice: null, index: -1 };
          }
          const curSettings = settingsRef.current;
          const currentIndex = curVoices.findIndex((v) => v.voiceURI === curSettings.voice.voiceURI);
          const nextIndex = (currentIndex + 1) % curVoices.length;
          const nextVoice = curVoices[nextIndex];
          settingsRef.current = {
            ...curSettings,
            voice: { ...curSettings.voice, voiceURI: nextVoice.voiceURI },
          };
          setSettings((prev) => ({
            ...prev,
            voice: { ...prev.voice, voiceURI: nextVoice.voiceURI },
          }));
          return { voice: nextVoice, index: nextIndex };
        },
        selectLanguageVoice: (lang: 'HINDI' | 'ENGLISH') => {
          const curVoices = availableVoicesRef.current;
          let chosenVoice: SpeechSynthesisVoice | null = null;
          let newLang: LanguageMode = 'AUTO';

          if (lang === 'HINDI') {
            newLang = 'HINDI';
            chosenVoice = curVoices.find((v) => v.lang.startsWith('hi')) || null;
          } else {
            newLang = 'ENGLISH';
            chosenVoice =
              curVoices.find((v) => v.lang.startsWith('en-IN')) ||
              curVoices.find((v) => v.lang.startsWith('en-US')) ||
              curVoices.find((v) => v.lang.startsWith('en')) ||
              null;
          }

          if (chosenVoice) {
            persistVoicePreference(chosenVoice).then((res) => {
              if (res.success && res.preference) {
                settingsRef.current = {
                  ...settingsRef.current,
                  voice: {
                    ...settingsRef.current.voice,
                    voiceURI: res.preference.selectedVoiceId,
                    savedVoice: res.preference,
                  },
                  language: { ...settingsRef.current.language, preferredLanguage: newLang },
                };
                setSettings((prev) => ({
                  ...prev,
                  voice: {
                    ...prev.voice,
                    voiceURI: res.preference!.selectedVoiceId,
                    savedVoice: res.preference,
                  },
                  language: { ...prev.language, preferredLanguage: newLang },
                }));
              }
            });
          }

          return { voice: chosenVoice, language: newLang };
        },
      },
      emotion: {
        getEmotion: () => emotionRef.current,
        setEmotion: (nextEmotion) => {
          emotionRef.current = nextEmotion;
          setEmotion(nextEmotion);
        },
      },
      audio: {
        isAmbientEnabled: () => ambientEnabledRef.current,
        setAmbientEnabled: (enabled) => {
          ambientEnabledRef.current = enabled;
          ambientAudio.setEnabled(enabled);
        },
      },
      core: {
        getState: () => coreState,
        getIntensity: () => settingsRef.current.appearance.coreIntensity,
        setIntensity: (intensity) => {
          settingsRef.current = {
            ...settingsRef.current,
            appearance: { ...settingsRef.current.appearance, coreIntensity: intensity },
          };
          setSettings((prev) => ({
            ...prev,
            appearance: { ...prev.appearance, coreIntensity: intensity },
          }));
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              settings: {
                core_intensity: intensity.toString(),
              },
            }),
          }).catch(() => {});
        },
        setMode: (mode) => {
          if (mode === 'CALM') {
            emotionRef.current = 'CALM';
            setEmotion('CALM');
          } else {
            setCoreState('IDLE');
          }
        },
      },
      settings: {
        openSettings: (tab) => {
          isSettingsOpenRef.current = true;
          if (tab) setSettingsInitialTab(tab as any);
          setIsSettingsOpen(true);
        },
        closeSettings: () => {
          isSettingsOpenRef.current = false;
          setIsSettingsOpen(false);
        },
        isSettingsOpen: () => isSettingsOpenRef.current,
        openMemory: () => {
          isMemoryOpenRef.current = true;
          setIsMemoryOpen(true);
        },
        closeMemory: () => {
          isMemoryOpenRef.current = false;
          setIsMemoryOpen(false);
        },
        isMemoryOpen: () => isMemoryOpenRef.current,
        openAudioSettings: () => {
          isAmbientAudioOpenRef.current = true;
          setIsAmbientAudioOpen(true);
        },
        closeAudioSettings: () => {
          isAmbientAudioOpenRef.current = false;
          setIsAmbientAudioOpen(false);
        },
        isAudioSettingsOpen: () => isAmbientAudioOpenRef.current,
      },
      memory: {
        clearAllMemories: async () => {
          try {
            await fetch('/api/memories', { method: 'DELETE' });
            setMemories([]);
            return true;
          } catch (e) {
            return false;
          }
        },
      },
    });
  }, [
    startListening,
    stopListening,
    isMicEnabled,
    micState,
    ambientAudio,
    coreState,
  ]);

  // System ONLINE status flag
  const isSystemOnline = coreState !== 'OFFLINE' && status.ai === 'ONLINE';

  // Handle startup completion - strictly silent startup with no automatic greeting
  const handleStartupComplete = useCallback(() => {
    setIsBooting(false);
  }, []);

  // Core chat pipeline
  const handleSendMessage = async (text: string) => {
    if (!text || typeof text !== 'string') return;
    const cleanText = text.trim();
    if (!cleanText || cleanText.length < 2) return;

    // Reject punctuation only
    if (/^[.,!?;:\-_'"`~+=/\s]+$/.test(cleanText)) return;

    if (isSubmittingRef.current) {
      console.warn('[App] Dropped concurrent message submission:', cleanText);
      return;
    }

    isSubmittingRef.current = true;

    const liveClientDateTime = getLiveDateTime('Asia/Kolkata');

    // 1. Add user message to UI immediately
    const userMsg: ChatMessage = {
      id: 'msg-' + Date.now(),
      sender: 'user',
      text: cleanText,
      timestamp: liveClientDateTime.time12,
    };

    setMessages((prev) => [...prev, userMsg]);
    setCoreState('THINKING');

    let speechInitiated = false;

    try {
      // 2. Intercept authoritative internal system control commands via SomyaSystemController
      const systemResult = await systemController.processCommand(cleanText);
      if (systemResult) {
        if (systemResult.uiBadge) {
          setActionBadge({
            label: systemResult.uiBadge.label,
            state: systemResult.uiBadge.state,
            isError: !systemResult.success,
          });
        }

        setEmotion(systemResult.emotion);
        setCoreState('RESPONDING');

        const somyaMsg: ChatMessage = {
          id: 'msg-' + Date.now() + '-sys',
          sender: 'somya',
          text: systemResult.spokenConfirmation,
          timestamp: liveClientDateTime.time12,
          emotion: systemResult.emotion,
          toolUsed: 'SystemController',
        };

        setMessages((prev) => [...prev, somyaMsg]);

        // If action was CLEAR_MEMORIES, refresh memory list
        if (
          systemResult.intent === 'CLEAR_MEMORIES_REQUEST' &&
          systemResult.success &&
          !systemResult.requiresConfirmation
        ) {
          loadMemories();
        }

        // Voice response with emotion modulation
        if (settings.voice.autoSpeak && systemResult.spokenConfirmation) {
          speechInitiated = true;
          speakText(systemResult.spokenConfirmation, systemResult.emotion);
        } else {
          if (systemResult.intent === 'MIC_ON' && systemResult.success) {
            setCoreState('LISTENING');
          } else {
            setCoreState('IDLE');
          }
        }

        return;
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: cleanText,
          history: messages.slice(-6).map((m) => ({ sender: m.sender, text: m.text })),
          languageMode: settings.language.preferredLanguage,
          memoryEnabled: settings.memory.enabled,
          clientDateTime: liveClientDateTime,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // State flow: Detect emotion from response context or user input
      const detectedEmotion = normalizeEmotion(data.emotion || detectEmotionFromContext(text));
      setEmotion(detectedEmotion);
      setCoreState('RESPONDING');

      const somyaMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-reply',
        sender: 'somya',
        text: data.reply || 'Main yahan hoon. How can I assist you?',
        timestamp: liveClientDateTime.time12,
        emotion: detectedEmotion,
        memoryCaptured: !!data.memorySaved,
        toolUsed: data.toolUsed,
        searchSources: data.searchSources,
        mapPlaces: data.mapPlaces,
        musicTrack: data.musicTrack,
      };

      setMessages((prev) => [...prev, somyaMsg]);

      // Refresh memories if memory was saved or cleared
      if (data.memorySaved || text.toLowerCase().includes('memory')) {
        loadMemories();
      }

      // Voice response with emotion modulation
      if (settings.voice.autoSpeak && data.reply) {
        speechInitiated = true;
        speakText(data.reply, detectedEmotion);
      } else {
        setCoreState('IDLE');
      }
    } catch (err) {
      console.warn('Chat request notice:', err);

      // Resilient DateTime fallback if network is interrupted
      const dtQuery = detectDateTimeQuery(text);
      if (dtQuery) {
        const localReply = generateDateTimeReply(
          dtQuery,
          liveClientDateTime,
          settings.language.preferredLanguage,
          text
        );
        const somyaMsg: ChatMessage = {
          id: 'msg-' + Date.now() + '-reply',
          sender: 'somya',
          text: localReply.reply,
          timestamp: liveClientDateTime.time12,
          emotion: 'CALM',
          toolUsed: 'DateTimeTool',
        };
        setMessages((prev) => [...prev, somyaMsg]);
        setEmotion('CALM');
        setCoreState('RESPONDING');
        if (settings.voice.autoSpeak) {
          speechInitiated = true;
          speakText(localReply.reply, 'CALM');
        } else {
          setCoreState('IDLE');
        }
        return;
      }

      setCoreState('ERROR');
      setEmotion('WORRIED');
      const errorMsg: ChatMessage = {
        id: 'msg-' + Date.now() + '-err',
        sender: 'somya',
        text: 'Network communication glitch. Re-attempting connection to local neural synapse.',
        timestamp: liveClientDateTime.time12,
        emotion: 'WORRIED',
      };
      setMessages((prev) => [...prev, errorMsg]);
      setTimeout(() => {
        setCoreState((current) => (current === 'ERROR' ? 'IDLE' : current));
        setEmotion('NEUTRAL');
      }, 3000);
    } finally {
      isSubmittingRef.current = false;
      // Regardless of whether Gemini succeeds or throws an unexpected error:
      // If speech was not initiated (e.g. error occurred, autoSpeak disabled, or empty reply),
      // notify processing finished so continuous listening can safely resume if mic is enabled.
      // (If mic was manually turned OFF, useVoice's micEnabledRef will ensure it remains OFF).
      if (!speechInitiated) {
        notifyProcessingFinished();
      }
    }
  };

  // Memory CRUD operations
  const handleAddMemory = async (content: string, category: MemoryCategory, importance: number) => {
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, category, importance }),
      });
      const data = await res.json();
      if (data.memory) {
        setMemories((prev) => [data.memory, ...prev]);
      }
    } catch (e) {
      console.warn('Notice: Failed to add memory:', e);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      await fetch(`/api/memories/${id}`, { method: 'DELETE' });
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch (e) {
      console.warn('Notice: Failed to delete memory:', e);
    }
  };

  const handleClearMemories = async () => {
    try {
      await fetch('/api/memories', { method: 'DELETE' });
      setMemories([]);
    } catch (e) {
      console.warn('Notice: Failed to clear memories:', e);
    }
  };

  return (
    <>
      {isAuthChecking ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030712] text-slate-100">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-cyan-950/60 border-2 border-cyan-400 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
              <span className="w-4 h-4 bg-cyan-300 rounded-full animate-ping" />
            </div>
            <p className="text-sm font-mono-tech text-cyan-300 tracking-widest uppercase">
              Initializing SOMYA Secure Session...
            </p>
          </div>
        </div>
      ) : !user ? (
        <LoginScreen onLoginSuccess={(u) => setUser(u)} />
      ) : (
        <div className="relative w-screen h-screen overflow-hidden bg-[#030712] text-slate-100 flex flex-col font-sans select-none">
          {/* Startup Sequence */}
          {isBooting && settings.general.startupAnimation && (
            <StartupSequence onComplete={handleStartupComplete} />
          )}

          {/* Internal System Control Notification HUD */}
          <SystemActionBadge badge={actionBadge} onDismiss={() => setActionBadge(null)} />

          {/* Background Holographic Grid & Radial Energy Field with synchronized subtle breath */}
          <div
            className={`absolute inset-0 pointer-events-none bg-radial from-cyan-950/25 via-transparent to-[#030712] z-0 transition-all duration-1000 ${
              isSystemOnline ? 'animate-breathing-glow' : 'opacity-35'
            }`}
          />
          <div
            className={`absolute inset-0 pointer-events-none z-0 transition-all duration-1000 ${
              isSystemOnline ? 'animate-breathing-grid' : 'opacity-[0.02]'
            }`}
            style={{
              backgroundImage: `linear-gradient(rgba(56, 189, 248, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(56, 189, 248, 0.4) 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
            }}
          />

          {/* Top Status Bar - Clean Minimalist Header */}
          <TopStatusBar
            status={status}
            coreState={coreState}
            isZoomed={isZoomed}
            onToggleZoom={handleToggleZoom}
            onOpenSettings={() => setIsSettingsOpen(true)}
            user={user}
            onOpenAccount={() => setIsAccountOpen(true)}
          />

          {/* Account Modal */}
          <AccountModal
            isOpen={isAccountOpen}
            onClose={() => setIsAccountOpen(false)}
            user={user}
            onSignOut={() => setUser(null)}
          />

      {/* Main Visual Core Stage with subtle breathing animation when ONLINE */}
      <motion.main
        animate={
          isSystemOnline
            ? {
                scale: isZoomed ? [1.07, 1.085, 1.07] : [1, 1.012, 1],
                filter: [
                  'drop-shadow(0 0 0px rgba(6, 182, 212, 0))',
                  'drop-shadow(0 0 35px rgba(6, 182, 212, 0.08))',
                  'drop-shadow(0 0 0px rgba(6, 182, 212, 0))',
                ],
              }
            : { scale: isZoomed ? 1.07 : 1, filter: 'drop-shadow(0 0 0px rgba(0, 0, 0, 0))' }
        }
        transition={
          isSystemOnline
            ? {
                duration: 6.0,
                repeat: Infinity,
                ease: 'easeInOut',
              }
            : { duration: 0.5 }
        }
        className="relative flex-1 flex flex-col items-center justify-center px-4 z-10 will-change-transform"
      >
        {/* Core or 3D Avatar */}
        <div className="flex flex-col items-center justify-center transition-all duration-700">
          {isAvatarMode ? (
            <HologramAvatar
              state={coreState}
              emotion={emotion}
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
            />
          ) : (
            <SomyaCore
              state={coreState}
              emotion={emotion}
              audioLevel={audioLevel}
              intensity={settings.appearance.coreIntensity}
              quality={settings.general.quality}
              onClick={toggleListening}
            />
          )}

          {/* Voice Waveform Visualizer */}
          <div className="mt-1 w-full max-w-sm flex justify-center">
            <VoiceWaveform
              state={coreState}
              emotion={emotion}
              audioLevel={audioLevel}
              isMicActive={micState === 'LISTENING'}
              isSpeaking={isSpeaking}
            />
          </div>
        </div>

        {/* Mic Status & Guidance Notice */}
        {micError && (
          <div className="mt-2 px-3.5 py-2 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-3 backdrop-blur-md shadow-lg max-w-md animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span className="flex-1 leading-snug">{micError}</span>
            <button
              onClick={() => {
                clearMicError();
                setIsChatOpen(true);
              }}
              className="px-2.5 py-1 rounded-md bg-rose-900/60 hover:bg-rose-800 text-rose-100 font-medium text-[11px] whitespace-nowrap transition-colors"
            >
              Open Chat
            </button>
            <button
              onClick={clearMicError}
              className="p-1 rounded hover:bg-rose-900/40 text-rose-400 hover:text-rose-200 transition-colors"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Live Date/Time & Kosli Weather Telemetry HUD */}
        <LiveTelemetryHud className="mt-3.5" />

        {/* Quick Holographic Text Input Bar (seamless keyboard interaction) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (quickInput.trim()) {
              handleSendMessage(quickInput.trim());
              setQuickInput('');
              setIsChatOpen(true);
            }
          }}
          className="mt-2.5 w-full max-w-xl flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-950/70 border border-cyan-500/25 shadow-[0_4px_20px_rgba(0,0,0,0.5),0_0_15px_rgba(6,182,212,0.1)] focus-within:border-cyan-400/70 focus-within:shadow-[0_0_20px_rgba(6,182,212,0.2)] transition-all duration-300 backdrop-blur-xl"
        >
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            placeholder="Type a command, query, or question for SOMYA..."
            className="flex-1 bg-transparent px-2 py-0.5 text-xs text-slate-100 placeholder-slate-500 font-mono-tech focus:outline-none"
          />
          <button
            type="submit"
            disabled={!quickInput.trim()}
            className="p-1.5 rounded-full bg-cyan-600/30 hover:bg-cyan-500 text-cyan-300 hover:text-white disabled:opacity-25 disabled:pointer-events-none transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)]"
            title="Send"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

      </motion.main>

      {/* Floating Main Controls Bar */}
      <footer className="w-full pb-6 pt-2 flex justify-center z-20">
        <MainControls
          micState={micState}
          coreState={coreState}
          onToggleMic={toggleListening}
          onToggleChat={() => setIsChatOpen(!isChatOpen)}
          onOpenMemory={() => setIsMemoryOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenTools={() => setIsToolsOpen(true)}
          onToggleAvatarMode={() => setIsAvatarMode(!isAvatarMode)}
          isAvatarMode={isAvatarMode}
          isChatOpen={isChatOpen}
          onOpenAmbientAudio={() => setIsAmbientAudioOpen(true)}
          isAmbientEnabled={ambientAudio.isEnabled}
          isAmbientDucked={ambientAudio.isDucked}
        />
      </footer>

      {/* Conversation Hologram Drawer */}
      <ConversationDrawer
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
        onClearChat={() => setMessages([])}
        onReplayVoice={(text) => speakText(text)}
        coreState={coreState}
      />

      {/* Persistent Memory Manager Modal */}
      <MemoryPanel
        isOpen={isMemoryOpen}
        onClose={() => setIsMemoryOpen(false)}
        memories={memories}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        onClearAll={handleClearMemories}
        memoryEnabled={settings.memory.enabled}
        onToggleMemoryEnabled={() =>
          setSettings((s) => ({
            ...s,
            memory: { ...s.memory, enabled: !s.memory.enabled },
          }))
        }
      />

      {/* Auxiliary Tools Modal */}
      <ToolLauncher
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        onExecutePrompt={(prompt) => {
          handleSendMessage(prompt);
          setIsChatOpen(true);
        }}
      />

      {/* Master Settings Console */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        initialTab={settingsInitialTab}
        onUpdateSettings={(s) => {
          setSettings(s);
          if (s.voice.voiceURI) {
            const matched =
              availableVoices.find((v) => v.voiceURI === s.voice.voiceURI) ||
              availableVoices.find((v) => v.name === s.voice.voiceURI);
            if (matched) {
              persistVoicePreference(matched);
            }
          }
          fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              settings: {
                voice_uri: s.voice.voiceURI,
                preferred_language: s.language.preferredLanguage,
                core_intensity: s.appearance.coreIntensity.toString(),
              },
            }),
          }).catch(() => {});
        }}
        availableVoices={availableVoices}
        memoryCount={memories.length}
        onOpenMemoryPanel={() => setIsMemoryOpen(true)}
        isAiOnline={status.ai === 'ONLINE'}
      />

      {/* Ambient Audio Controller Modal / Console */}
      <AmbientAudioController
        ambientAudio={ambientAudio}
        isOpen={isAmbientAudioOpen}
        onClose={() => setIsAmbientAudioOpen(false)}
      />
        </div>
      )}
    </>
  );
};

export default App;
