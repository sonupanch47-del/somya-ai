import React, { useState, useRef } from 'react';
import {
  Wrench,
  Calculator,
  Clock,
  CloudSun,
  Cpu,
  Search,
  MapPin,
  Music,
  X,
  ArrowRight,
  ExternalLink,
  Download,
  Sparkles,
  Loader2,
  Volume2,
  Radio,
  Compass,
} from 'lucide-react';
import { useLiveDateTime } from '../services/dateTimeService';

interface ToolLauncherProps {
  isOpen: boolean;
  onClose: () => void;
  onExecutePrompt: (prompt: string) => void;
}

export const ToolLauncher: React.FC<ToolLauncherProps> = ({
  isOpen,
  onClose,
  onExecutePrompt,
}) => {
  const [activeTab, setActiveTab] = useState<
    'SEARCH' | 'MAPS' | 'MUSIC' | 'CALC' | 'TIME' | 'WEATHER' | 'SYSTEM'
  >('SEARCH');

  const liveDt = useLiveDateTime('Asia/Kolkata');

  // --- Search Grounding State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResult, setSearchResult] = useState<{
    text: string;
    sources: Array<{ uri: string; title: string }>;
  } | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // --- Maps Grounding State ---
  const [mapsQuery, setMapsQuery] = useState('');
  const [mapsLoading, setMapsLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>('Not acquired');
  const [mapsResult, setMapsResult] = useState<{
    text: string;
    places: Array<{ uri: string; title: string; snippet?: string }>;
  } | null>(null);
  const [mapsError, setMapsError] = useState<string | null>(null);

  // --- Music Generation (Lyria) State ---
  const [musicPrompt, setMusicPrompt] = useState('Chill futuristic cyberpunk lofi synthwave');
  const [musicModel, setMusicModel] = useState<'clip' | 'pro'>('clip');
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicResult, setMusicResult] = useState<{
    audioUrl: string;
    lyrics?: string;
    title: string;
    modelUsed: string;
    duration: string;
  } | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Calculator State ---
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState<string | null>(null);

  // --- Weather State ---
  const [city, setCity] = useState('Kosli');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<{
    city: string;
    temp: number | null;
    cond: string;
    humidity: number | null;
    wind: string;
    available: boolean;
  }>({
    city: 'Kosli',
    temp: null,
    cond: 'Enter a city and scan for live meteorological data',
    humidity: null,
    wind: '—',
    available: false,
  });

  if (!isOpen) return null;

  // Search Grounding Handler
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);
    setSearchError(null);
    setSearchResult(null);

    try {
      const res = await fetch('/api/grounding/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setSearchError(data.error || 'Failed to retrieve search grounded data.');
      } else {
        setSearchResult({
          text: data.text,
          sources: data.sources || [],
        });
      }
    } catch (err: any) {
      setSearchError(err?.message || 'Network error during search grounding.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Maps Grounding Handler
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoStatus('Geolocation not supported by browser');
      return;
    }
    setGeoStatus('Acquiring coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setGeoStatus(`Lat: ${pos.coords.latitude.toFixed(3)}, Lng: ${pos.coords.longitude.toFixed(3)}`);
      },
      (err) => {
        setGeoStatus('Location permission denied or unavailable');
      },
      { timeout: 8000 }
    );
  };

  const handleMaps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim() || mapsLoading) return;
    setMapsLoading(true);
    setMapsError(null);
    setMapsResult(null);

    try {
      const res = await fetch('/api/grounding/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mapsQuery.trim(),
          latitude: userCoords?.lat,
          longitude: userCoords?.lng,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMapsError(data.error || 'Failed to retrieve Google Maps data.');
      } else {
        setMapsResult({
          text: data.text,
          places: data.places || [],
        });
      }
    } catch (err: any) {
      setMapsError(err?.message || 'Network error during maps grounding.');
    } finally {
      setMapsLoading(false);
    }
  };

  // Music Generation (Lyria) Handler
  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musicPrompt.trim() || musicLoading) return;
    setMusicLoading(true);
    setMusicError(null);

    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musicPrompt.trim(),
          modelType: musicModel,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setMusicError(data.error || 'Failed to generate music track with Lyria.');
      } else {
        setMusicResult({
          audioUrl: `data:${data.mimeType};base64,${data.audioBase64}`,
          lyrics: data.lyrics,
          title: musicPrompt.slice(0, 40),
          modelUsed: data.modelUsed,
          duration: data.duration || (musicModel === 'pro' ? 'Full Track' : '30s Clip'),
        });
      }
    } catch (err: any) {
      setMusicError(err?.message || 'Network error during Lyria music generation.');
    } finally {
      setMusicLoading(false);
    }
  };

  // Calculator
  const handleCalc = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sanitized = calcInput.replace(/[^0-9\+\-\*\/\.\(\)\s]/g, '');
      const res = Function(`'use strict'; return (${sanitized})`)();
      setCalcResult(String(res));
    } catch (err) {
      setCalcResult('Syntax Error');
    }
  };

  // Weather - Live Meteorological Lookup
  const handleWeatherLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = city.trim();
    if (!query || weatherLoading) return;

    setWeatherLoading(true);
    setWeatherError(null);

    try {
      if (query.toLowerCase() === 'kosli') {
        const res = await fetch('/api/weather/kosli');
        const data = await res.json();
        if (!res.ok || data.error || !data.available) {
          setWeatherError(data.error || 'Weather telemetry currently unavailable for Kosli.');
        } else {
          setWeatherData({
            city: 'Kosli, Haryana',
            temp: data.temperature,
            cond: data.condition,
            humidity: data.humidity,
            wind: `${data.windSpeed} km/h`,
            available: true,
          });
        }
      } else {
        // Geocode city using Open-Meteo geocoding API
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
        const geoData = await geoRes.json();
        if (!geoData.results || geoData.results.length === 0) {
          setWeatherError(`Could not find coordinates for "${query}".`);
          return;
        }
        const top = geoData.results[0];
        const forecastRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${top.latitude}&longitude=${top.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=auto`
        );
        const forecastData = await forecastRes.json();
        if (!forecastData.current) {
          setWeatherError(`Weather telemetry unavailable for ${top.name}.`);
          return;
        }
        setWeatherData({
          city: `${top.name}, ${top.country || ''}`,
          temp: Math.round(forecastData.current.temperature_2m),
          cond: `WMO Code ${forecastData.current.weather_code}`,
          humidity: forecastData.current.relative_humidity_2m,
          wind: `${forecastData.current.wind_speed_10m} km/h`,
          available: true,
        });
      }
    } catch (err: any) {
      setWeatherError(err?.message || 'Failed to connect to meteorological network.');
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="relative w-full max-w-2xl glass-panel border border-cyan-500/30 rounded-2xl flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-cyan-500/20 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <Wrench className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-base font-display font-bold text-slate-100 uppercase tracking-wider">
                Somya Neural & Auxiliary Matrix
              </h2>
              <p className="text-xs text-slate-400 font-mono-tech">
                Live Google Search, Maps Grounding & Lyria Music Generation
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

        {/* Navigation Tabs */}
        <div className="flex items-center border-b border-slate-800 bg-slate-900/50 text-xs font-mono-tech overflow-x-auto">
          {[
            { id: 'SEARCH', label: 'Search Grounding', icon: Search, badge: 'gemini-3.5-flash' },
            { id: 'MAPS', label: 'Maps Grounding', icon: MapPin, badge: 'gemini-3.5-flash' },
            { id: 'MUSIC', label: 'Lyria Music', icon: Music, badge: 'lyria-3' },
            { id: 'CALC', label: 'Calculator', icon: Calculator },
            { id: 'TIME', label: 'Chrono', icon: Clock },
            { id: 'WEATHER', label: 'Atmosphere', icon: CloudSun },
            { id: 'SYSTEM', label: 'Diagnostics', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-3.5 flex items-center justify-center gap-1.5 border-b-2 whitespace-nowrap transition-all ${
                  activeTab === tab.id
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: GOOGLE SEARCH GROUNDING */}
          {activeTab === 'SEARCH' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/20 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <Sparkles className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-cyan-300">Live Google Search Grounding: </span>
                  Powered by <code className="text-cyan-400 font-mono">gemini-3.5-flash</code> with real-time web retrieval. Returns up-to-date facts and verified citation links.
                </div>
              </div>

              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ask any current event, news, or fact (e.g. Latest AI developments 2026)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={searchLoading || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold font-display uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                >
                  {searchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Search</span>
                </button>
              </form>

              {/* Suggestions */}
              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400 font-mono-tech">
                <span className="text-slate-500 py-1">Try:</span>
                {[
                  'Latest breakthroughs in quantum computing',
                  'Upcoming space missions in 2026',
                  'Current world news headlines',
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchQuery(sample)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-cyan-950/40 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/30 transition-all text-left"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              {searchError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                  {searchError}
                </div>
              )}

              {searchResult && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-cyan-400 font-mono-tech">
                    <span className="flex items-center gap-1.5 font-semibold uppercase">
                      <Search className="w-3.5 h-3.5" />
                      Grounded Answer
                    </span>
                    <button
                      onClick={() => {
                        onExecutePrompt(`Explain this Google search topic further: ${searchQuery}`);
                        onClose();
                      }}
                      className="hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Discuss with Somya <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {searchResult.text}
                  </p>

                  {searchResult.sources.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-800 space-y-1.5">
                      <div className="text-[10px] text-slate-400 font-mono-tech uppercase tracking-wider">
                        Verified Web Sources ({searchResult.sources.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {searchResult.sources.map((src, i) => (
                          <a
                            key={i}
                            href={src.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-500/30 text-[11px] text-cyan-200 hover:text-cyan-100 transition-colors truncate max-w-xs"
                          >
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{src.title || src.uri}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GOOGLE MAPS GROUNDING */}
          {activeTab === 'MAPS' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/20 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <Compass className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-emerald-300">Live Google Maps Grounding: </span>
                  Powered by <code className="text-emerald-400 font-mono">gemini-3.5-flash</code> with Google Maps Places data. Returns rich place details and direct Google Maps links.
                </div>
              </div>

              {/* Geolocation Helper */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-slate-400 font-mono-tech text-[11px]">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Your Coordinates: {geoStatus}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDetectLocation}
                  className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-500/30 text-[11px] font-mono-tech transition-colors"
                >
                  Detect Location
                </button>
              </div>

              <form onSubmit={handleMaps} className="flex gap-2">
                <input
                  type="text"
                  value={mapsQuery}
                  onChange={(e) => setMapsQuery(e.target.value)}
                  placeholder="Find places (e.g. Best cafes with outdoor seating in South Delhi)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
                />
                <button
                  type="submit"
                  disabled={mapsLoading || !mapsQuery.trim()}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold font-display uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                >
                  {mapsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  <span>Find</span>
                </button>
              </form>

              {/* Maps Suggestions */}
              <div className="flex flex-wrap gap-1.5 text-[11px] text-slate-400 font-mono-tech">
                <span className="text-slate-500 py-1">Try:</span>
                {[
                  'Top rated heritage monuments in Delhi',
                  'Cozy cafes near Connaught Place',
                  'Best sushi restaurants in Tokyo',
                ].map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => setMapsQuery(sample)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-emerald-950/40 text-slate-300 hover:text-emerald-300 border border-slate-800 hover:border-emerald-500/30 transition-all text-left"
                  >
                    "{sample}"
                  </button>
                ))}
              </div>

              {mapsError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300">
                  {mapsError}
                </div>
              )}

              {mapsResult && (
                <div className="p-4 rounded-xl bg-slate-950/70 border border-emerald-500/30 space-y-3">
                  <div className="flex items-center justify-between text-xs text-emerald-400 font-mono-tech">
                    <span className="flex items-center gap-1.5 font-semibold uppercase">
                      <MapPin className="w-3.5 h-3.5" />
                      Maps Grounded Results
                    </span>
                    <button
                      onClick={() => {
                        onExecutePrompt(`Help me plan a route or visit based on: ${mapsQuery}`);
                        onClose();
                      }}
                      className="hover:underline flex items-center gap-1 text-[11px]"
                    >
                      Plan with Somya <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {mapsResult.text}
                  </p>

                  {mapsResult.places.length > 0 && (
                    <div className="pt-2.5 border-t border-slate-800 space-y-2">
                      <div className="text-[10px] text-slate-400 font-mono-tech uppercase tracking-wider">
                        Google Maps Locations ({mapsResult.places.length}):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {mapsResult.places.map((place, i) => (
                          <a
                            key={i}
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-lg bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/25 hover:border-emerald-400/60 transition-all block"
                          >
                            <div className="flex items-center justify-between gap-1 font-semibold text-emerald-300 text-xs">
                              <span className="truncate">{place.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0 text-emerald-400" />
                            </div>
                            {place.snippet && (
                              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                                {place.snippet}
                              </p>
                            )}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: LYRIA MUSIC GENERATION */}
          {activeTab === 'MUSIC' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/20 flex items-start gap-2.5 text-xs text-slate-300 leading-relaxed">
                <Radio className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-purple-300">Lyria AI Music Generator: </span>
                  Synthesize real audio tracks using Google's <code className="text-purple-400 font-mono">lyria-3-clip-preview</code> (up to 30-sec clips) and <code className="text-purple-400 font-mono">lyria-3-pro-preview</code> (full-length tracks).
                </div>
              </div>

              {/* Model Choice Selector */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800 font-mono-tech text-xs">
                <button
                  type="button"
                  onClick={() => setMusicModel('clip')}
                  className={`py-2 px-3 rounded-lg text-center transition-all ${
                    musicModel === 'clip'
                      ? 'bg-purple-600 text-white font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Lyria Clip (up to 30s)
                </button>
                <button
                  type="button"
                  onClick={() => setMusicModel('pro')}
                  className={`py-2 px-3 rounded-lg text-center transition-all ${
                    musicModel === 'pro'
                      ? 'bg-purple-600 text-white font-bold shadow-[0_0_15px_rgba(147,51,234,0.3)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Lyria Pro (Full Track)
                </button>
              </div>

              {/* Style Presets */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-mono-tech uppercase">Style Presets:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Cyberpunk Synthwave neon bass',
                    'Calm Lo-fi study beat with soft piano',
                    'Epic Cinematic orchestral crescendo',
                    'Deep Space ambient drone with choir',
                    'Upbeat Indian classical electronic fusion',
                  ].map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setMusicPrompt(preset)}
                      className="px-2.5 py-1 rounded-lg bg-slate-900/80 hover:bg-purple-950/40 text-[11px] text-slate-300 hover:text-purple-300 border border-slate-800 hover:border-purple-500/30 transition-all"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleGenerateMusic} className="space-y-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-mono-tech uppercase">Music Composition Prompt:</label>
                  <textarea
                    rows={2}
                    value={musicPrompt}
                    onChange={(e) => setMusicPrompt(e.target.value)}
                    placeholder="Describe the mood, instruments, rhythm, tempo, and genre..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-sans resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={musicLoading || !musicPrompt.trim()}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-40 text-white text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(147,51,234,0.3)]"
                >
                  {musicLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Synthesizing Track with Lyria...</span>
                    </>
                  ) : (
                    <>
                      <Music className="w-4 h-4" />
                      <span>Generate {musicModel === 'pro' ? 'Full Track' : 'Clip'}</span>
                    </>
                  )}
                </button>
              </form>

              {musicError && (
                <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/30 text-xs text-rose-300 space-y-1">
                  <div className="font-semibold">Music Generation Notice:</div>
                  <div className="text-[11px] leading-relaxed">{musicError}</div>
                </div>
              )}

              {musicResult && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-purple-500/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-900/60 border border-purple-500/40 flex items-center justify-center text-purple-300">
                        <Volume2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-100 font-display">
                          {musicResult.title}
                        </div>
                        <div className="text-[10px] text-purple-300 font-mono-tech">
                          {musicResult.modelUsed} • {musicResult.duration}
                        </div>
                      </div>
                    </div>

                    <a
                      href={musicResult.audioUrl}
                      download={`somya-${musicResult.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.wav`}
                      className="p-2 rounded-lg bg-purple-900/50 hover:bg-purple-800/70 text-purple-200 border border-purple-500/30 flex items-center gap-1.5 text-xs font-mono-tech transition-colors"
                      title="Download audio file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Download WAV</span>
                    </a>
                  </div>

                  <audio
                    ref={audioRef}
                    controls
                    autoPlay
                    src={musicResult.audioUrl}
                    className="w-full h-9 rounded-lg accent-purple-400"
                  />

                  {musicResult.lyrics && (
                    <div className="text-[11px] text-slate-400 p-2.5 rounded-lg bg-slate-900/50 border border-slate-800 italic">
                      "{musicResult.lyrics}"
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CALCULATOR */}
          {activeTab === 'CALC' && (
            <div className="space-y-4">
              <form onSubmit={handleCalc} className="flex gap-2">
                <input
                  type="text"
                  value={calcInput}
                  onChange={(e) => setCalcInput(e.target.value)}
                  placeholder="Enter calculation (e.g. 1420 * 1.18 - 250)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 font-mono-tech"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold font-display uppercase tracking-wider"
                >
                  Solve
                </button>
              </form>

              {calcResult !== null && (
                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/30 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono-tech">Computed Result:</span>
                  <span className="text-lg font-bold font-mono-tech text-cyan-300">{calcResult}</span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Ask Somya in conversation:</span>
                <button
                  onClick={() => {
                    onExecutePrompt('Calculate: ' + (calcInput || '25 * 400 + 1500'));
                    onClose();
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Send to Somya <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 5: TIME & CHRONO */}
          {activeTab === 'TIME' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono-tech">
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase">India Standard Time (IST)</div>
                  <div className="text-base font-bold text-slate-100 mt-1">
                    {liveDt.time12}
                  </div>
                  <div className="text-[10px] text-cyan-300/80 mt-0.5">
                    {liveDt.dayOfWeek}, {liveDt.dateFormatted}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">UTC Universal</div>
                  <div className="text-base font-bold text-cyan-300 mt-1">
                    {new Date().toUTCString().slice(17, 25)} UTC
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Epoch: {Date.now()}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span>Need a timer or alarm?</span>
                <button
                  onClick={() => {
                    onExecutePrompt('Somya, what is the current date and time?');
                    onClose();
                  }}
                  className="text-cyan-400 hover:underline flex items-center gap-1"
                >
                  Ask Somya <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: ATMOSPHERE / WEATHER */}
          {activeTab === 'WEATHER' && (
            <div className="space-y-4">
              <form onSubmit={handleWeatherLookup} className="flex gap-2">
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Enter location (e.g. Mumbai, Tokyo, London)..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={weatherLoading || !city.trim()}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-semibold font-display uppercase tracking-wider flex items-center gap-1.5"
                >
                  {weatherLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{weatherLoading ? 'Scanning...' : 'Scan'}</span>
                </button>
              </form>

              {weatherError && (
                <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/30 text-xs text-amber-300">
                  {weatherError}
                </div>
              )}

              <div className="p-4 rounded-xl bg-slate-900/70 border border-cyan-500/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-slate-200 uppercase font-display tracking-wider">
                    {weatherData.city}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{weatherData.cond}</div>
                  {weatherData.available && (
                    <div className="text-[11px] text-slate-500 mt-1 font-mono-tech">
                      {weatherData.humidity !== null && `Humidity: ${weatherData.humidity}% • `}
                      Wind: {weatherData.wind}
                    </div>
                  )}
                </div>
                <div className="text-3xl font-display font-bold text-cyan-300">
                  {weatherData.temp !== null ? `${weatherData.temp}°C` : '—'}
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: DIAGNOSTICS & SYSTEM */}
          {activeTab === 'SYSTEM' && (
            <div className="space-y-3 font-mono-tech text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Core Neural Engine:</span>
                <span className="text-cyan-400 font-semibold">Gemini 3.8 Flash (Multimodal)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Search Grounding Engine:</span>
                <span className="text-sky-400 font-semibold">Gemini 3.5 Flash (Google Search)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Maps Grounding Engine:</span>
                <span className="text-emerald-400 font-semibold">Gemini 3.5 Flash (Google Maps)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Music Synthesis Engine:</span>
                <span className="text-purple-400 font-semibold">Lyria 3 (Clip & Pro Preview)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                <span className="text-slate-400">Language Pipeline:</span>
                <span className="text-amber-400 font-semibold">Hindi / Hinglish / English</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
