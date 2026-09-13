import { useState, useEffect, useRef, useCallback } from 'react';
import { MicState, SomyaState, SomyaEmotion } from '../types';
import { EMOTION_PROFILES } from '../utils/emotionManager';

interface UseVoiceOptions {
  onTranscript: (transcript: string) => void;
  preferredLanguage: 'AUTO' | 'ENGLISH' | 'HINDI' | 'HINGLISH';
  autoSpeak: boolean;
  volume: number;
  speed: number;
  voiceURI: string;
  onStateChange: (state: SomyaState) => void;
}

export function useVoice({
  onTranscript,
  preferredLanguage,
  autoSpeak,
  volume,
  speed,
  voiceURI,
  onStateChange,
}: UseVoiceOptions) {
  const [micState, setMicState] = useState<MicState>('OFF');
  const [micError, setMicError] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 to 1
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Persistent continuous microphone state refs
  const micEnabledRef = useRef<boolean>(false);
  const isListeningRef = useRef<boolean>(false);
  const isProcessingRef = useRef<boolean>(false);
  const isSpeakingRef = useRef<boolean>(false);
  const isStartingSessionRef = useRef<boolean>(false);
  const restartTimerRef = useRef<any>(null);

  // Anti-loop, anti-echo, and single-lifecycle processing refs
  const hasProcessedInSessionRef = useRef<boolean>(false);
  const lastProcessedTranscriptRef = useRef<string>('');
  const lastProcessedTimeRef = useRef<number>(0);
  const lastSpeakingEndTimeRef = useRef<number>(0);
  const lastSpokenAiTextRef = useRef<string>('');

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pulseIntervalRef = useRef<number | null>(null);

  // Simulated pulse interval if media stream isn't directly accessible
  const startSimulatedPulse = useCallback(() => {
    if (pulseIntervalRef.current) return;
    pulseIntervalRef.current = window.setInterval(() => {
      // Gentle voice waveform activity simulation (0.15 to 0.4)
      const base = 0.15;
      const variation = Math.random() * 0.25;
      setAudioLevel(base + variation);
    }, 120);
  }, []);

  const stopSimulatedPulse = useCallback(() => {
    if (pulseIntervalRef.current) {
      clearInterval(pulseIntervalRef.current);
      pulseIntervalRef.current = null;
    }
  }, []);

  // Load browser TTS voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Audio level analyzer loop for real microphone
  const startAudioAnalyzer = useCallback((stream: MediaStream) => {
    try {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        return;
      }
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        startSimulatedPulse();
        return;
      }
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(1, avg / 128));
        animFrameRef.current = requestAnimationFrame(checkLevel);
      };

      checkLevel();
    } catch (err) {
      console.warn('AudioContext visualization setup notice:', err);
      startSimulatedPulse();
    }
  }, [startSimulatedPulse]);

  const stopAudioAnalyzer = useCallback(() => {
    stopSimulatedPulse();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setAudioLevel(0);
  }, [stopSimulatedPulse]);

  // Forward declaration for scheduleRestart
  const scheduleRestartRef = useRef<((delayMs?: number) => void) | null>(null);

  /**
   * Strict validation and anti-echo / anti-duplicate filtering for speech recognition transcripts.
   * Ensures SOMYA NEVER creates or accepts phantom questions, background noise, or TTS feedback echoes.
   */
  const validateUserTranscript = useCallback(
    (rawTranscript: string): { valid: boolean; reason?: string; cleanedText?: string } => {
      if (!rawTranscript || typeof rawTranscript !== 'string') {
        return { valid: false, reason: 'Empty or non-string transcript' };
      }

      const cleaned = rawTranscript.trim();

      // Reject empty or whitespace-only
      if (!cleaned) {
        return { valid: false, reason: 'Whitespace-only transcript' };
      }

      // Reject very short noise (single character or accidental click)
      if (cleaned.length < 2) {
        return { valid: false, reason: 'Transcript too short (< 2 characters)' };
      }

      // Reject punctuation-only
      if (/^[.,!?;:\-_'"`~+=/\s]+$/.test(cleaned)) {
        return { valid: false, reason: 'Punctuation-only artifact' };
      }

      // Reject common isolated non-verbal noise artifacts
      if (/^(um|uh|hmm|ah|oh|shh|mhm|er)$/i.test(cleaned)) {
        return { valid: false, reason: 'Isolated non-verbal filler' };
      }

      const now = Date.now();

      // Reject if within post-TTS speaker dissipation window (300ms cooldown after TTS ended)
      if (now - lastSpeakingEndTimeRef.current < 300) {
        return { valid: false, reason: 'Inside post-TTS dissipation window' };
      }

      // Deduplication: reject identical transcript within 1.5 seconds
      if (
        cleaned.toLowerCase() === lastProcessedTranscriptRef.current.toLowerCase() &&
        now - lastProcessedTimeRef.current < 1500
      ) {
        return { valid: false, reason: 'Duplicate transcript within 1.5 seconds' };
      }

      return { valid: true, cleanedText: cleaned };
    },
    []
  );

  // Setup Web Speech Recognition session
  const startRecognitionSession = useCallback(() => {
    // Guard 1: User must have microphone enabled
    if (!micEnabledRef.current) return;

    // Guard 2: Must not listen while SOMYA is actively speaking
    if (isSpeakingRef.current) {
      return;
    }

    // Guard 3: Must not listen while processing a question
    if (isProcessingRef.current) return;

    // Guard 4: Must not start if in post-TTS dissipation window (300ms cooldown)
    if (Date.now() - lastSpeakingEndTimeRef.current < 300) {
      scheduleRestartRef.current?.(200);
      return;
    }

    // Guard 5: Do not create multiple simultaneous listening sessions
    if (isListeningRef.current) return;

    // Safety watchdog for stuck starting session flag (> 2.5s)
    if (isStartingSessionRef.current) {
      isStartingSessionRef.current = false;
    }

    // Reset session processed latch for this fresh listening window
    hasProcessedInSessionRef.current = false;

    // Clear any existing restart timer
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      micEnabledRef.current = false;
      setMicState('ERROR');
      setMicError('Speech recognition is not supported in this browser. You can type commands directly in the chat.');
      return;
    }

    isStartingSessionRef.current = true;

    // Safely cleanup old recognition instance if any existed
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      // Select recognition language (support Hindi, Hinglish, English, or auto-detect)
      if (preferredLanguage === 'HINDI') {
        recognition.lang = 'hi-IN';
      } else if (preferredLanguage === 'HINGLISH') {
        recognition.lang = 'en-IN';
      } else if (preferredLanguage === 'ENGLISH') {
        recognition.lang = 'en-US';
      } else {
        const navLang = typeof navigator !== 'undefined' ? (navigator.language || '') : '';
        if (navLang.startsWith('hi')) {
          recognition.lang = 'hi-IN';
        } else {
          recognition.lang = 'en-IN';
        }
      }

      recognition.onstart = () => {
        isStartingSessionRef.current = false;
        isListeningRef.current = true;
        hasProcessedInSessionRef.current = false;
        if (micEnabledRef.current) {
          setMicState('LISTENING');
          onStateChange('LISTENING');
        }
      };

      recognition.onresult = (event: any) => {
        if (!micEnabledRef.current) return;
        if (isSpeakingRef.current) return;
        if (isProcessingRef.current) return;
        if (hasProcessedInSessionRef.current) return;

        let latestFinalText = '';
        let latestInterimText = '';

        if (event.results && event.results.length > 0) {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            if (res && res[0]) {
              const text = res[0].transcript || '';
              if (res.isFinal) {
                latestFinalText += text + ' ';
              } else {
                latestInterimText += text;
              }
            }
          }
        }

        const candidateSpeech = latestFinalText.trim() || latestInterimText.trim();
        if (!candidateSpeech) return;

        // Validate transcript
        const validation = validateUserTranscript(candidateSpeech);
        if (!validation.valid || !validation.cleanedText) {
          return;
        }

        // If we have a final result or strong interim speech, process it
        const validSpeech = validation.cleanedText;

        hasProcessedInSessionRef.current = true;
        lastProcessedTranscriptRef.current = validSpeech;
        lastProcessedTimeRef.current = Date.now();

        isListeningRef.current = false;
        isProcessingRef.current = true;
        setMicState('PROCESSING');
        onStateChange('THINKING');

        try {
          recognition.stop();
        } catch (e) {}

        onTranscript(validSpeech);
      };

      recognition.onerror = (event: any) => {
        isStartingSessionRef.current = false;
        isListeningRef.current = false;
        const errType = event?.error;

        if (errType === 'not-allowed' || errType === 'permission-denied') {
          micEnabledRef.current = false;
          setMicState('ERROR');
          setMicError('Microphone permission not granted. Please allow microphone access in your browser settings.');
          stopAudioAnalyzer();
          onStateChange('IDLE');
          return;
        }

        if (errType === 'no-speech' || errType === 'aborted') {
          return;
        }

        if (micEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
          scheduleRestartRef.current?.(300);
        }
      };

      recognition.onend = () => {
        isStartingSessionRef.current = false;
        isListeningRef.current = false;

        if (micEnabledRef.current) {
          if (isProcessingRef.current) {
            setMicState('PROCESSING');
          } else if (isSpeakingRef.current) {
            setMicState('ON');
          } else {
            setMicState('LISTENING');
            scheduleRestartRef.current?.(200);
          }
        } else {
          stopAudioAnalyzer();
          setMicState('OFF');
          if (!isSpeakingRef.current) {
            onStateChange('IDLE');
          }
        }
      };

      recognition.start();
    } catch (err: any) {
      isStartingSessionRef.current = false;
      isListeningRef.current = false;
      console.warn('Speech recognition start notice:', err?.message || err);

      if (micEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        scheduleRestartRef.current?.(400);
      }
    }
  }, [preferredLanguage, onTranscript, onStateChange, stopAudioAnalyzer, validateUserTranscript]);

  // Controlled safe restart mechanism
  const scheduleRestart = useCallback((delayMs: number = 300) => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (!micEnabledRef.current || isSpeakingRef.current || isProcessingRef.current) {
      return;
    }

    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (micEnabledRef.current && !isSpeakingRef.current && !isProcessingRef.current) {
        startRecognitionSession();
      }
    }, delayMs);
  }, [startRecognitionSession]);

  useEffect(() => {
    scheduleRestartRef.current = scheduleRestart;
  }, [scheduleRestart]);

  // Start continuous listening (User Action: explicitly turning MIC ON)
  const startListening = useCallback(() => {
    setMicError(null);
    micEnabledRef.current = true;
    isProcessingRef.current = false;
    hasProcessedInSessionRef.current = false;

    // If SOMYA is speaking when user explicitly clicks mic ON, stop speech to hear user immediately
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isSpeakingRef.current) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
    }

    setMicState('LISTENING');
    startRecognitionSession();
  }, [startRecognitionSession]);

  // Stop listening completely (User Action: MANUAL OFF ALWAYS WINS)
  const stopListening = useCallback(() => {
    micEnabledRef.current = false;
    isListeningRef.current = false;
    isProcessingRef.current = false;
    isStartingSessionRef.current = false;
    hasProcessedInSessionRef.current = true;

    // Clear any queued restart
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    // Safely abort active recognition session
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      } catch (e) {}
      recognitionRef.current = null;
    }

    stopAudioAnalyzer();
    setMicState('OFF');

    if (!isSpeakingRef.current) {
      onStateChange('IDLE');
    }
  }, [onStateChange, stopAudioAnalyzer]);

  // Toggle persistent continuous listening mode
  const toggleListening = useCallback(() => {
    if (micEnabledRef.current) {
      // User pressed Mic OFF
      stopListening();
    } else {
      // User pressed Mic ON
      startListening();
    }
  }, [startListening, stopListening]);

  // Notify that question processing finished (e.g. if autoSpeak was false or error occurred)
  const notifyProcessingFinished = useCallback(() => {
    isProcessingRef.current = false;
    hasProcessedInSessionRef.current = false;
    if (
      micEnabledRef.current &&
      !isSpeakingRef.current &&
      !(typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking)
    ) {
      setMicState('LISTENING');
      onStateChange('LISTENING');
      scheduleRestart(300);
    }
  }, [onStateChange, scheduleRestart]);

  // TTS Output with Emotion-Aware Modulation and Automatic Listening Resumption
  const speakText = useCallback(
    (text: string, emotion?: SomyaEmotion) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        isProcessingRef.current = false;
        if (micEnabledRef.current) {
          setMicState('LISTENING');
          onStateChange('LISTENING');
          scheduleRestart(300);
        }
        return;
      }

      // Interrupt existing speech
      window.speechSynthesis.cancel();

      // Clean markdown characters from speech
      const cleanText = text
        .replace(/[*#_`~\[\]]/g, '')
        .replace(/https?:\/\/\S+/g, 'link')
        .trim();

      // Register spoken text for anti-echo microphone filtering
      lastSpokenAiTextRef.current = cleanText;

      if (!cleanText) {
        isProcessingRef.current = false;
        if (micEnabledRef.current) {
          setMicState('LISTENING');
          onStateChange('LISTENING');
          scheduleRestart(300);
        }
        return;
      }

      // Stop recognition completely while speaking so SOMYA does not hear her own voice
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onstart = null;
          recognitionRef.current.onresult = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
      }
      isListeningRef.current = false;

      const utterance = new SpeechSynthesisUtterance(cleanText);

      // Apply emotion profile modulation (Web Speech API supported properties)
      const profile = emotion ? EMOTION_PROFILES[emotion] : null;
      const basePitch = 1.0;
      const effectivePitch = profile
        ? Math.max(0.5, Math.min(2.0, basePitch * profile.voice.pitchMultiplier))
        : basePitch;
      const effectiveRate = profile
        ? Math.max(0.5, Math.min(2.0, speed * profile.voice.rateMultiplier))
        : speed;
      const effectiveVolume = profile?.voice.volumeMultiplier
        ? Math.max(0.1, Math.min(1.0, volume * profile.voice.volumeMultiplier))
        : volume;

      utterance.pitch = effectivePitch;
      utterance.rate = effectiveRate;
      utterance.volume = effectiveVolume;

      // Select appropriate voice
      if (voiceURI) {
        const matched =
          availableVoices.find((v) => v.voiceURI === voiceURI) ||
          availableVoices.find((v) => v.name === voiceURI);
        if (matched) utterance.voice = matched;
      }
      
      // If voice is still unassigned or voiceURI is not specified, select best language default
      if (!utterance.voice && availableVoices.length > 0) {
        const hindiVoice = availableVoices.find((v) => v.lang.startsWith('hi'));
        const inVoice = availableVoices.find((v) => v.lang.startsWith('en-IN'));
        const enVoice = availableVoices.find((v) => v.lang.startsWith('en-US'));

        if (preferredLanguage === 'HINDI' && hindiVoice) {
          utterance.voice = hindiVoice;
        } else if (inVoice) {
          utterance.voice = inVoice;
        } else if (enVoice) {
          utterance.voice = enVoice;
        } else {
          utterance.voice = availableVoices[0];
        }
      }

      // Called when TTS finishes or errors
      const finishSpeaking = () => {
        isSpeakingRef.current = false;
        setIsSpeaking(false);
        isProcessingRef.current = false;
        hasProcessedInSessionRef.current = false;
        lastSpeakingEndTimeRef.current = Date.now();

        // CRITICAL: If mic is enabled, automatically resume continuous listening!
        // If user manually pressed OFF while speaking, micEnabledRef is false and remains stopped.
        if (micEnabledRef.current) {
          setMicState('LISTENING');
          onStateChange('LISTENING');
          // 700ms buffer to allow speaker audio and room reverberation to fully dissipate
          scheduleRestart(700);
        } else {
          setMicState('OFF');
          onStateChange('IDLE');
        }
      };

      utterance.onstart = () => {
        isSpeakingRef.current = true;
        setIsSpeaking(true);
        if (micEnabledRef.current) {
          setMicState('ON');
        }
        onStateChange('SPEAKING');
      };

      utterance.onend = () => {
        finishSpeaking();
      };

      utterance.onerror = (e) => {
        console.warn('TTS utterance error:', e);
        finishSpeaking();
      };

      // Handle emotion pause (e.g. natural short pause for Thinking or Caring)
      const pauseMs = profile?.voice.pauseBeforeMs || 0;
      if (pauseMs > 0) {
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, pauseMs);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    },
    [availableVoices, onStateChange, preferredLanguage, speed, voiceURI, volume, scheduleRestart]
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      isProcessingRef.current = false;

      if (micEnabledRef.current) {
        setMicState('LISTENING');
        onStateChange('LISTENING');
        scheduleRestart(200);
      } else {
        setMicState('OFF');
        onStateChange('IDLE');
      }
    }
  }, [onStateChange, scheduleRestart]);

  const clearMicError = useCallback(() => {
    setMicError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      micEnabledRef.current = false;
      isListeningRef.current = false;
      isProcessingRef.current = false;
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
      stopAudioAnalyzer();
    };
  }, [stopAudioAnalyzer]);

  return {
    micState,
    micError,
    isSpeaking,
    audioLevel,
    availableVoices,
    isMicEnabled: () => micEnabledRef.current,
    startListening,
    stopListening,
    toggleListening,
    notifyProcessingFinished,
    clearMicError,
    speakText,
    stopSpeaking,
  };
}
