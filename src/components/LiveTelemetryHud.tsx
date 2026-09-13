import React from 'react';
import {
  Clock,
  MapPin,
  RefreshCw,
  Sun,
  CloudSun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudFog,
  CloudDrizzle,
  Snowflake,
  Wind,
  Droplets,
  Thermometer,
  AlertTriangle,
} from 'lucide-react';
import { useKosliWeather, KosliWeather } from '../services/weatherService';
import { useLiveDateTime } from '../services/dateTimeService';

interface LiveTelemetryHudProps {
  className?: string;
}

// Weather icon selector based on weather condition/icon code
function renderWeatherIcon(weather: KosliWeather | null) {
  if (!weather || !weather.available) {
    return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  }

  const icon = weather.icon || '';
  const code = weather.weatherCode ?? 0;

  if (code === 0) return <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />;
  if (code === 1 || code === 2) return <CloudSun className="w-4 h-4 text-cyan-300" />;
  if (code === 3) return <Cloud className="w-4 h-4 text-slate-300" />;
  if (icon.includes('drizzle')) return <CloudDrizzle className="w-4 h-4 text-sky-400" />;
  if (icon.includes('rain') || icon.includes('showers')) return <CloudRain className="w-4 h-4 text-blue-400" />;
  if (icon.includes('thunderstorm')) return <CloudLightning className="w-4 h-4 text-amber-300 animate-pulse" />;
  if (icon.includes('fog')) return <CloudFog className="w-4 h-4 text-slate-400" />;
  if (icon.includes('snow')) return <Snowflake className="w-4 h-4 text-cyan-200" />;

  return <Sun className="w-4 h-4 text-amber-300" />;
}

export const LiveTelemetryHud: React.FC<LiveTelemetryHudProps> = ({ className = '' }) => {
  // 1. LIVE TIME & DATE ENGINE
  // Authoritative runtime clock synchronized with Asia/Kolkata timezone
  const liveDt = useLiveDateTime('Asia/Kolkata');

  const dayName = liveDt.dayOfWeek.toUpperCase();
  const dateFormatted = liveDt.dateFormatted.toUpperCase();
  const timeFormatted = liveDt.timeWithSeconds;

  // 2. LIVE KOSLI WEATHER TELEMETRY (weather independent from time/date)
  const { weather, loading, error, refresh } = useKosliWeather();

  return (
    <div
      className={`w-full max-w-2xl px-4 py-2.5 rounded-2xl bg-slate-950/70 border border-cyan-500/25 shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.12)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono-tech select-none transition-all duration-300 ${className}`}
    >
      {/* LEFT MODULE: LIVE DATE & TIME */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-950/50 border border-cyan-500/30 text-cyan-400 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
          <Clock className="w-4 h-4" />
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-widest text-cyan-400 uppercase font-display">
              {dayName}
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              • {dateFormatted}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-sm font-bold tracking-wider text-slate-100 font-mono">
              {timeFormatted}
            </span>
            <span className="relative flex h-1.5 w-1.5 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400" />
            </span>
          </div>
        </div>
      </div>

      {/* CENTER HOLOGRAPHIC DIVIDER */}
      <div className="hidden sm:block h-8 w-px bg-gradient-to-b from-transparent via-cyan-500/30 to-transparent" />

      {/* RIGHT MODULE: KOSLI LIVE WEATHER */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
        {loading && !weather ? (
          <div className="flex items-center gap-2 text-cyan-400/80 py-1">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span className="text-[11px] tracking-wider uppercase text-slate-400">
              CONNECTING KOSLI TELEMETRY...
            </span>
          </div>
        ) : weather && weather.available ? (
          <>
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-cyan-950/50 border border-cyan-500/30 shrink-0 shadow-[0_0_10px_rgba(6,182,212,0.15)]">
              {renderWeatherIcon(weather)}
            </div>

            <div className="flex flex-col text-right sm:text-left">
              <div className="flex items-center justify-end sm:justify-start gap-1.5">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span className="text-[10px] font-bold tracking-widest text-cyan-300 uppercase font-display">
                  {weather.location}
                </span>
                <span className="text-slate-500 text-[10px]">•</span>
                <span className="text-slate-300 font-bold text-xs">
                  {weather.temperature !== undefined ? `${weather.temperature}°C` : '—'}
                </span>
                <span className="text-cyan-400/90 text-[11px] font-medium hidden md:inline">
                  ({weather.condition})
                </span>
              </div>

              <div className="flex items-center justify-end sm:justify-start gap-2.5 text-[10px] text-slate-400 mt-0.5">
                {weather.apparentTemperature !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Thermometer className="w-2.5 h-2.5 text-slate-500" />
                    Feels {weather.apparentTemperature}°C
                  </span>
                )}
                {weather.humidity !== undefined && (
                  <span className="flex items-center gap-0.5">
                    <Droplets className="w-2.5 h-2.5 text-sky-400" />
                    {weather.humidity}%
                  </span>
                )}
                {weather.windSpeed !== undefined && (
                  <span className="flex items-center gap-0.5 hidden lg:inline-flex">
                    <Wind className="w-2.5 h-2.5 text-slate-400" />
                    {weather.windSpeed} km/h
                  </span>
                )}
                <button
                  onClick={refresh}
                  className="p-0.5 rounded text-slate-500 hover:text-cyan-300 transition-colors ml-0.5"
                  title="Refresh Kosli Weather Telemetry"
                >
                  <RefreshCw className="w-2.5 h-2.5 hover:rotate-180 transition-transform" />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Explicit Weather Unavailable State */
          <div className="flex items-center gap-2 text-amber-300/90 py-0.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[10px] tracking-wider uppercase font-bold text-amber-400">
                KOSLI WEATHER UNAVAILABLE
              </span>
              <span className="text-[9px] text-slate-500 font-mono">
                Satellite link unreachable
              </span>
            </div>
            <button
              onClick={refresh}
              className="p-1 rounded bg-amber-950/60 border border-amber-500/30 text-amber-300 hover:bg-amber-900/60 text-[10px] ml-2 transition-colors flex items-center gap-1"
              title="Retry Connection"
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>Retry</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
