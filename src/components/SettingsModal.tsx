import React, { useState } from 'react';
import { SomyaSettings, LanguageMode } from '../types';
import {
  Settings,
  X,
  Sliders,
  Brain,
  Volume2,
  Languages,
  Database,
  Palette,
  Shield,
  Info,
  Check,
  Save,
  Play,
  Square,
  BookmarkCheck,
  Sparkles,
} from 'lucide-react';
import { persistVoicePreference } from '../services/voicePersistence';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: SomyaSettings;
  onUpdateSettings: (newSettings: SomyaSettings) => void;
  availableVoices: SpeechSynthesisVoice[];
  memoryCount: number;
  onOpenMemoryPanel: () => void;
  isAiOnline: boolean;
  initialTab?: 'GENERAL' | 'AI' | 'VOICE' | 'LANGUAGE' | 'MEMORY' | 'APPEARANCE' | 'PRIVACY' | 'ABOUT';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  availableVoices,
  memoryCount,
  onOpenMemoryPanel,
  isAiOnline,
  initialTab = 'GENERAL',
}) => {
  const [activeTab, setActiveTab] = useState<
    'GENERAL' | 'AI' | 'VOICE' | 'LANGUAGE' | 'MEMORY' | 'APPEARANCE' | 'PRIVACY' | 'ABOUT'
  >(initialTab);

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [isPreviewing, setIsPreviewing] = useState(false);

  React.useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Cleanup any active speech preview if modal closes or tab changes
  React.useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const update = (updater: (prev: SomyaSettings) => SomyaSettings) => {
    const next = updater(settings);
    onUpdateSettings(next);
  };

  const handleSaveVoice = async () => {
    setSaveStatus('saving');
    try {
      const selectedVoice = availableVoices.find((v) => v.voiceURI === settings.voice.voiceURI);
      const voiceToSave = selectedVoice || {
        voiceURI: settings.voice.voiceURI || (availableVoices[0]?.voiceURI || 'default'),
        name: selectedVoice?.name || 'Default System Voice',
        lang:
          selectedVoice?.lang ||
          (settings.language.preferredLanguage === 'HINDI' ? 'hi-IN' : 'en-US'),
      };

      const result = await persistVoicePreference(voiceToSave);
      if (result.success && result.preference) {
        update((s) => ({
          ...s,
          voice: {
            ...s.voice,
            voiceURI: result.preference!.selectedVoiceId,
            savedVoice: result.preference,
          },
        }));
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 4000);
      }
    } catch (e) {
      console.error('[SETTINGS] Voice save error:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 4000);
    }
  };

  const handlePreviewVoice = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isPreviewing) {
      window.speechSynthesis.cancel();
      setIsPreviewing(false);
      return;
    }

    window.speechSynthesis.cancel();
    const phrase =
      settings.language.preferredLanguage === 'HINDI'
        ? 'नमस्ते, मैं सौम्या हूँ। यह मेरी आवाज़ है।'
        : 'Namaste! I am Somya. This is my voice.';

    const utterance = new SpeechSynthesisUtterance(phrase);
    utterance.rate = settings.voice.speed;
    utterance.volume = settings.voice.volume;

    const matched =
      availableVoices.find((v) => v.voiceURI === settings.voice.voiceURI) ||
      availableVoices.find((v) => v.name === settings.voice.voiceURI);
    if (matched) {
      utterance.voice = matched;
    }

    utterance.onstart = () => setIsPreviewing(true);
    utterance.onend = () => setIsPreviewing(false);
    utterance.onerror = () => setIsPreviewing(false);

    window.speechSynthesis.speak(utterance);
  };

  const selectedVoiceObj = availableVoices.find((v) => v.voiceURI === settings.voice.voiceURI);
  const isCurrentVoiceSaved = Boolean(
    settings.voice.savedVoice &&
      (settings.voice.savedVoice.selectedVoiceId === settings.voice.voiceURI ||
        (!settings.voice.voiceURI && settings.voice.savedVoice.selectedVoiceId === 'default'))
  );

  const tabs = [
    { id: 'GENERAL', label: 'General', icon: Sliders },
    { id: 'AI', label: 'AI Brain', icon: Brain },
    { id: 'VOICE', label: 'Voice & Speech', icon: Volume2 },
    { id: 'LANGUAGE', label: 'Language', icon: Languages },
    { id: 'MEMORY', label: 'Memory', icon: Database },
    { id: 'APPEARANCE', label: 'Appearance', icon: Palette },
    { id: 'PRIVACY', label: 'Privacy', icon: Shield },
    { id: 'ABOUT', label: 'About', icon: Info },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] glass-panel border border-cyan-500/30 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100 uppercase tracking-wider">
                SOMYA AI — Configuration Console
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech">
                System parameters, neural weights & interaction matrix
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

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Navigation Sidebar */}
          <div className="w-full md:w-56 border-b md:border-b-0 md:border-r border-slate-800 bg-slate-950/40 p-2 md:p-3 flex md:flex-col gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium font-mono-tech transition-all text-left whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content Pane */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* GENERAL */}
            {activeTab === 'GENERAL' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    System Execution
                  </h3>
                  <p className="text-slate-400 mb-4">Core runtime and diagnostic preferences.</p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">Startup Telemetry Sequence</div>
                    <div className="text-slate-400 text-[11px]">Display futuristic initialization animation on launch</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.general.startupAnimation}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        general: { ...s.general, startupAnimation: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Graphics & Particle Fidelity</span>
                    <span className="text-cyan-400 font-mono-tech uppercase">{settings.general.quality}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(['LOW', 'MEDIUM', 'HIGH'] as const).map((q) => (
                      <button
                        key={q}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            general: { ...s.general, quality: q },
                          }))
                        }
                        className={`py-1.5 rounded-lg border text-xs font-mono-tech transition-all ${
                          settings.general.quality === q
                            ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI BRAIN */}
            {activeTab === 'AI' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Gemini AI Neural Engine
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Somya AI uses Gemini 3.8 Flash server-side via @google/genai SDK.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Active Architecture</div>
                    <div className="text-slate-400 text-[11px]">Server-side full-stack proxy (Port 3000)</div>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-mono-tech">
                    {settings.ai.model}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Conversational Style</span>
                    <span className="text-purple-300 font-mono-tech uppercase">{settings.ai.responseStyle}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {(['concise', 'balanced', 'elaborate'] as const).map((style) => (
                      <button
                        key={style}
                        onClick={() =>
                          update((s) => ({
                            ...s,
                            ai: { ...s.ai, responseStyle: style },
                          }))
                        }
                        className={`py-1.5 rounded-lg border text-xs font-mono-tech transition-all capitalize ${
                          settings.ai.responseStyle === style
                            ? 'bg-purple-950/80 border-purple-500 text-purple-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Connection Status</div>
                    <div className="text-slate-400 text-[11px]">
                      {isAiOnline
                        ? 'Connected to Gemini API Cloud Brain'
                        : 'Operating in High-Fidelity Local Synapse fallback mode'}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded font-mono-tech text-xs ${
                      isAiOnline
                        ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
                        : 'bg-amber-950/60 border border-amber-500/30 text-amber-300'
                    }`}
                  >
                    {isAiOnline ? 'ONLINE' : 'LOCAL SYNAPSE'}
                  </span>
                </div>
              </div>
            )}

            {/* VOICE & SPEECH */}
            {activeTab === 'VOICE' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Voice & Speech Matrix
                  </h3>
                  <p className="text-slate-400 mb-4">Web Speech API & Text-to-Speech synthesizer options.</p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">Auto-Speak Responses</div>
                    <div className="text-slate-400 text-[11px]">Automatically voice Somya's messages out loud</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.voice.autoSpeak}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        voice: { ...s.voice, autoSpeak: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                {/* Voice Selection Dropdown & Persistence */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-200">Speech Synthesizer Voice</div>
                    {isCurrentVoiceSaved ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono-tech bg-emerald-950/60 border border-emerald-500/30 text-emerald-400">
                        <BookmarkCheck className="w-3 h-3" /> SAVED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono-tech bg-slate-800/80 text-slate-400 border border-slate-700">
                        ACTIVE SESSION
                      </span>
                    )}
                  </div>

                  <select
                    id="somya-voice-select"
                    value={settings.voice.voiceURI}
                    onChange={(e) => {
                      const newUri = e.target.value;
                      update((s) => ({
                        ...s,
                        voice: { ...s.voice, voiceURI: newUri },
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-sans focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Default System Voice (Auto-detect Hindi / English)</option>
                    {availableVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>

                  {/* Active Voice Metadata Details */}
                  <div className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/60 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Selected Voice:</span>
                      <span className="font-semibold text-cyan-300 truncate max-w-[200px]">
                        {selectedVoiceObj?.name || 'System Default Voice'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Locale / Language:</span>
                      <span className="font-mono-tech text-slate-300">
                        {selectedVoiceObj?.lang ||
                          (settings.language.preferredLanguage === 'HINDI'
                            ? 'hi-IN (auto)'
                            : 'en-US (auto)')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">TTS Engine Provider:</span>
                      <span className="font-mono-tech text-slate-400">WebSpeechAPI (Native)</span>
                    </div>
                  </div>

                  {/* Action Buttons: Save Voice & Test Voice */}
                  <div className="pt-1 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {/* Save Voice Button */}
                      <button
                        type="button"
                        id="somya-save-voice-btn"
                        onClick={handleSaveVoice}
                        disabled={saveStatus === 'saving'}
                        className={`px-3.5 py-1.5 rounded-lg font-medium text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          saveStatus === 'saved'
                            ? 'bg-emerald-600 text-white font-semibold shadow-sm'
                            : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-sm hover:shadow-cyan-500/20 active:scale-95'
                        }`}
                        title="Permanently save current voice preference across restarts"
                      >
                        {saveStatus === 'saved' ? (
                          <>
                            <Check className="w-3.5 h-3.5" /> Voice saved
                          </>
                        ) : saveStatus === 'saving' ? (
                          <>Saving...</>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" /> Save Voice
                          </>
                        )}
                      </button>

                      {/* Test / Preview Voice Button */}
                      <button
                        type="button"
                        id="somya-test-voice-btn"
                        onClick={handlePreviewVoice}
                        className={`px-3 py-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                          isPreviewing
                            ? 'bg-rose-950/60 border-rose-500/40 text-rose-300'
                            : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-cyan-300 active:scale-95'
                        }`}
                        title="Listen to a voice sample without saving"
                      >
                        {isPreviewing ? (
                          <>
                            <Square className="w-3 h-3 fill-current" /> Stop Preview
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-3.5 h-3.5" /> Test Voice
                          </>
                        )}
                      </button>
                    </div>

                    {/* Status feedback message */}
                    {saveStatus === 'saved' && (
                      <span className="text-emerald-400 text-[11px] font-mono-tech flex items-center gap-1 animate-fade-in">
                        <Check className="w-3 h-3" /> Voice saved
                      </span>
                    )}
                    {saveStatus === 'error' && (
                      <span className="text-rose-400 text-[11px] font-mono-tech flex items-center gap-1">
                        Voice could not be saved
                      </span>
                    )}
                  </div>
                </div>

                {/* Speed Slider */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Speech Rate / Speed</span>
                    <span className="text-cyan-400 font-mono-tech">{settings.voice.speed}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.75"
                    max="1.5"
                    step="0.05"
                    value={settings.voice.speed}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        voice: { ...s.voice, speed: parseFloat(e.target.value) },
                      }))
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>
              </div>
            )}

            {/* LANGUAGE */}
            {activeTab === 'LANGUAGE' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Bilingual & Multilingual Intelligence
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Somya naturally switches between English, Hindi, and conversational Hinglish.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {(['AUTO', 'ENGLISH', 'HINDI', 'HINGLISH'] as LanguageMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() =>
                        update((s) => ({
                          ...s,
                          language: { ...s.language, preferredLanguage: mode },
                        }))
                      }
                      className={`p-4 rounded-xl border flex flex-col items-start gap-1 transition-all ${
                        settings.language.preferredLanguage === mode
                          ? 'bg-cyan-950/60 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                          : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="font-bold font-display uppercase tracking-wider text-sm flex items-center justify-between w-full">
                        <span>{mode}</span>
                        {settings.language.preferredLanguage === mode && <Check className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <div className="text-[11px] text-slate-500 font-sans">
                        {mode === 'AUTO' && 'Detects user language naturally on every query'}
                        {mode === 'ENGLISH' && 'Answers in fluent, natural English'}
                        {mode === 'HINDI' && 'Answers in natural Hindi language'}
                        {mode === 'HINGLISH' && 'Casual conversational Hindi phrasing with English terms'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* MEMORY */}
            {activeTab === 'MEMORY' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Synaptic Persistent Memory
                  </h3>
                  <p className="text-slate-400 mb-4">Control short-term and long-term recalled memory facts.</p>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">Enable Persistent Memory</div>
                    <div className="text-slate-400 text-[11px]">Allow Somya to store and recall personal facts</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.memory.enabled}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        memory: { ...s.memory, enabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-200">Active Records</div>
                    <div className="text-slate-400 text-[11px]">{memoryCount} memories currently stored</div>
                  </div>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenMemoryPanel();
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold"
                  >
                    Open Memory Manager
                  </button>
                </div>
              </div>
            )}

            {/* APPEARANCE */}
            {activeTab === 'APPEARANCE' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Visual Hologram Parameters
                  </h3>
                  <p className="text-slate-400 mb-4">Core energy intensity, glow, and 3D visual controls.</p>
                </div>

                {/* Core Intensity Slider */}
                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Core Energy Intensity</span>
                    <span className="text-cyan-400 font-mono-tech">{Math.round(settings.appearance.coreIntensity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.05"
                    value={settings.appearance.coreIntensity}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        appearance: { ...s.appearance, coreIntensity: parseFloat(e.target.value) },
                      }))
                    }
                    className="w-full accent-cyan-500"
                  />
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div>
                    <div className="font-semibold text-slate-200">3D Hologram Avatar Mode</div>
                    <div className="text-slate-400 text-[11px]">Display 3D cyber mesh persona alongside Core</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.appearance.showAvatar3D}
                    onChange={(e) =>
                      update((s) => ({
                        ...s,
                        appearance: { ...s.appearance, showAvatar3D: e.target.checked },
                      }))
                    }
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* PRIVACY */}
            {activeTab === 'PRIVACY' && (
              <div className="space-y-5 text-xs">
                <div>
                  <h3 className="text-sm font-semibold font-display text-slate-100 uppercase tracking-wider mb-1">
                    Privacy & Sandboxing
                  </h3>
                  <p className="text-slate-400 mb-4">
                    Strict privacy boundaries: secrets remain hidden, mic is user-controlled.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-200">Microphone Integrity</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Somya AI NEVER silently records or streams audio in the background. The microphone is only active
                    when you tap the Mic button, and turns OFF automatically after speaking.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
                  <div className="font-semibold text-slate-200">API Key Security</div>
                  <p className="text-slate-400 text-[11px] leading-relaxed">
                    Gemini API credentials reside strictly in server-side memory (`process.env.GEMINI_API_KEY`) and are
                    never transmitted to or inspectable within the client browser.
                  </p>
                </div>
              </div>
            )}

            {/* ABOUT */}
            {activeTab === 'ABOUT' && (
              <div className="space-y-5 text-xs">
                <div className="p-6 rounded-2xl bg-gradient-to-b from-cyan-950/30 to-slate-950 border border-cyan-500/20 text-center space-y-2">
                  <h3 className="text-xl font-display font-bold text-slate-100 uppercase tracking-widest">
                    SOMYA AI
                  </h3>
                  <div className="text-xs font-mono-tech text-cyan-400">VERSION 2.4.0-PROD</div>
                  <p className="text-slate-400 text-xs max-w-md mx-auto leading-relaxed pt-2">
                    Futuristic personal AI assistant engineered with an interactive multi-layer dynamic Core, natural
                    voice speech synthesizer, bilingual Hinglish comprehension, and Gemini intelligence.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono-tech text-[11px]">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <span className="text-slate-500">AI Core:</span>
                    <div className="text-slate-200 font-semibold mt-0.5">Gemini 3.8 Flash</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <span className="text-slate-500">Framework:</span>
                    <div className="text-slate-200 font-semibold mt-0.5">React 19 + Express + Vite</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
