import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SomyaState } from '../types';
import { Send, Trash2, Copy, Check, Volume2, X, Sparkles, Brain, Search, MapPin, Music, ExternalLink, Download, Heart } from 'lucide-react';
import { EMOTION_PROFILES } from '../utils/emotionManager';

interface ConversationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onClearChat: () => void;
  onReplayVoice: (text: string) => void;
  coreState: SomyaState;
}

export const ConversationDrawer: React.FC<ConversationDrawerProps> = ({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onClearChat,
  onReplayVoice,
  coreState,
}) => {
  const [inputText, setInputText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <aside
      id="conversation-panel"
      className="fixed top-14 right-4 bottom-22 w-full sm:w-[420px] max-w-[calc(100vw-2rem)] glass-panel border border-cyan-500/20 rounded-2xl flex flex-col z-30 shadow-2xl backdrop-blur-2xl transition-all duration-300 animate-in fade-in slide-in-from-right-4"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-cyan-500/15 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-display font-bold uppercase tracking-wider text-slate-100">
            Holographic Log
          </h2>
          <span className="text-[10px] font-mono-tech px-1.5 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
            {messages.length} MSGS
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            id="btn-clear-chat"
            onClick={onClearChat}
            className="p-1.5 text-slate-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-close-chat"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 rounded-lg transition-colors"
            title="Close Panel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <Sparkles className="w-8 h-8 text-cyan-400/40 mb-3 animate-pulse" />
            <p className="text-sm font-display text-slate-300 font-semibold mb-1">
              Somya AI is Standing By
            </p>
            <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed mb-4">
              Tap the microphone or type below. Somya understands English, Hindi & Hinglish naturally.
            </p>
            {/* Quick action chips */}
            <div className="flex flex-col gap-1.5 w-full text-left">
              {[
                'Hey Somya, kya chal raha hai?',
                'Remember that my favorite game is GTA',
                'What is my favorite game?',
                'Can you explain this in simple Hinglish?',
              ].map((suggestion, idx) => (
                <button
                  key={idx}
                  onClick={() => onSendMessage(suggestion)}
                  className="px-3 py-1.5 text-xs text-slate-300 bg-slate-900/60 hover:bg-cyan-950/50 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/30 rounded-lg transition-all text-left truncate"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-r from-cyan-900/70 to-blue-900/70 text-cyan-50 border border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.15)] rounded-br-none'
                    : 'bg-slate-900/85 text-slate-200 border border-purple-500/25 shadow-lg rounded-bl-none'
                }`}
              >
                {/* Header info for Somya messages */}
                {msg.sender === 'somya' && (
                  <div className="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-slate-800 text-[10px] text-cyan-400 font-mono-tech">
                    <span className="font-bold tracking-wider uppercase flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      SOMYA
                    </span>
                    {msg.emotion && (() => {
                      const profile = EMOTION_PROFILES[msg.emotion] || EMOTION_PROFILES.NEUTRAL;
                      return (
                        <span
                          className="uppercase text-[9px] px-1.5 py-0.5 rounded font-mono-tech flex items-center gap-1 border border-slate-700/60 bg-slate-900/80"
                          style={{ color: profile.visual.coreHex }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ backgroundColor: profile.visual.coreHex }}
                          />
                          {profile.label}
                        </span>
                      );
                    })()}
                  </div>
                )}

                <p className="whitespace-pre-wrap">{msg.text}</p>

                {/* Google Search Grounding Sources */}
                {msg.searchSources && msg.searchSources.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-cyan-500/20 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-cyan-400 font-mono-tech uppercase tracking-wider font-semibold">
                      <Search className="w-3 h-3" />
                      <span>Google Search Verified Sources</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.searchSources.map((source, idx) => (
                        <a
                          key={idx}
                          href={source.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-500/30 text-[10px] text-cyan-200 hover:text-cyan-100 transition-colors truncate max-w-[280px]"
                        >
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{source.title || source.uri}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Google Maps Grounding Places */}
                {msg.mapPlaces && msg.mapPlaces.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-emerald-500/20 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono-tech uppercase tracking-wider font-semibold">
                      <MapPin className="w-3 h-3" />
                      <span>Google Maps Locations</span>
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {msg.mapPlaces.map((place, idx) => (
                        <a
                          key={idx}
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/30 text-[11px] text-emerald-100 hover:border-emerald-400/60 transition-all block"
                        >
                          <div className="flex items-center justify-between gap-1 font-semibold text-emerald-200">
                            <span className="truncate">{place.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0 text-emerald-400" />
                          </div>
                          {place.snippet && (
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">
                              {place.snippet}
                            </p>
                          )}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lyria Music Player Card */}
                {msg.musicTrack && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-purple-500/40 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-purple-300">
                          <Music className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-100 font-display">
                            {msg.musicTrack.title}
                          </div>
                          <div className="text-[10px] text-purple-300 font-mono-tech">
                            {msg.musicTrack.modelUsed} • {msg.musicTrack.duration || 'Audio'}
                          </div>
                        </div>
                      </div>
                      <a
                        href={msg.musicTrack.audioUrl}
                        download={`somya-${msg.musicTrack.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.wav`}
                        className="p-1.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 text-purple-300 border border-purple-500/30 transition-colors"
                        title="Download audio"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <audio
                      controls
                      src={msg.musicTrack.audioUrl}
                      className="w-full h-8 rounded-lg accent-purple-400 text-xs"
                    />
                    {msg.musicTrack.lyrics && (
                      <p className="text-[10px] text-slate-400 italic">
                        "{msg.musicTrack.lyrics}"
                      </p>
                    )}
                  </div>
                )}

                {/* Memory saved alert badge */}
                {msg.memoryCaptured && (
                  <div className="mt-2 pt-1.5 border-t border-emerald-500/30 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono-tech">
                    <span>💾</span>
                    <span>Saved to persistent memory</span>
                  </div>
                )}
              </div>

              {/* Action row */}
              <div className="flex items-center gap-2 px-1 mt-1 text-[10px] text-slate-500 font-mono-tech">
                <span>{msg.timestamp}</span>
                {msg.sender === 'somya' && (
                  <>
                    <button
                      onClick={() => onReplayVoice(msg.text)}
                      className="hover:text-cyan-400 transition-colors"
                      title="Speak response again"
                    >
                      <Volume2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleCopy(msg.id, msg.text)}
                      className="hover:text-cyan-400 transition-colors"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}

        {/* Thinking Indicator */}
        {coreState === 'THINKING' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/60 border border-purple-500/30 text-xs text-purple-300 font-mono-tech w-max">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
            <span>Somya is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Bar */}
      <form
        onSubmit={handleSubmit}
        className="p-3 border-t border-cyan-500/15 flex items-center gap-2 bg-slate-950/60"
      >
        <input
          id="chat-input"
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Speak or type (English, Hindi, Hinglish)..."
          className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 font-sans"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || coreState === 'THINKING'}
          className="p-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 text-white hover:from-cyan-500 hover:to-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
          title="Send message"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </aside>
  );
};
