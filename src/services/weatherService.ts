// Kosli Weather Service
// Coordinates: Kosli (Rewari, Haryana, India: 28.4116° N, 76.4839° E)

import { useState, useEffect, useCallback, useRef } from 'react';

export interface KosliWeather {
  available: boolean;
  location: string;
  region?: string;
  temperature?: number;
  apparentTemperature?: number;
  humidity?: number;
  windSpeed?: number;
  condition?: string;
  weatherCode?: number;
  icon?: string;
  isDay?: number;
  updatedAt?: string;
  error?: string;
  stale?: boolean;
}

// Client fallback WMO weather code mapping
function mapClientWmoCode(code: number): { condition: string; icon: string } {
  switch (code) {
    case 0:
      return { condition: 'Clear Sky', icon: 'clear' };
    case 1:
      return { condition: 'Mainly Clear', icon: 'mostly-clear' };
    case 2:
      return { condition: 'Partly Cloudy', icon: 'partly-cloudy' };
    case 3:
      return { condition: 'Overcast', icon: 'cloudy' };
    case 45:
    case 48:
      return { condition: 'Fog', icon: 'fog' };
    case 51:
    case 53:
    case 55:
      return { condition: 'Drizzle', icon: 'drizzle' };
    case 61:
    case 63:
    case 65:
      return { condition: 'Rain', icon: 'rain' };
    case 71:
    case 73:
    case 75:
      return { condition: 'Snow', icon: 'snow' };
    case 80:
    case 81:
    case 82:
      return { condition: 'Rain Showers', icon: 'showers' };
    case 95:
    case 96:
    case 99:
      return { condition: 'Thunderstorm', icon: 'thunderstorm' };
    default:
      return { condition: 'Clear', icon: 'clear' };
  }
}

/**
 * Modular function to fetch live Kosli weather data
 * Primary: /api/weather/kosli (backend cache & proxy)
 * Fallback: Open-Meteo direct API
 * Guaranteed: Never returns fake or invented data
 */
export async function fetchKosliWeather(): Promise<KosliWeather> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const res = await fetch('/api/weather/kosli', {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = (await res.json()) as KosliWeather;
      if (data.available) {
        return data;
      }
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn('[WeatherService] Backend weather proxy note, trying direct client fetch fallback...', err);
  }

  // Direct client fetch fallback to Open-Meteo
  const clientController = new AbortController();
  const clientTimeoutId = setTimeout(() => clientController.abort(), 6000);

  try {
    const directUrl =
      'https://api.open-meteo.com/v1/forecast?latitude=28.4116&longitude=76.4839&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Asia%2FKolkata';
    const directRes = await fetch(directUrl, { signal: clientController.signal });
    clearTimeout(clientTimeoutId);

    if (!directRes.ok) {
      throw new Error(`Open-Meteo HTTP ${directRes.status}`);
    }

    const json = (await directRes.json()) as any;
    const cur = json?.current;

    if (!cur || typeof cur.temperature_2m !== 'number') {
      throw new Error('Malformed direct meteorological payload');
    }

    const mapped = mapClientWmoCode(cur.weather_code);
    return {
      available: true,
      location: 'Kosli',
      region: 'Haryana, India',
      temperature: Math.round(cur.temperature_2m * 10) / 10,
      apparentTemperature: Math.round(cur.apparent_temperature * 10) / 10,
      humidity: Math.round(cur.relative_humidity_2m),
      windSpeed: Math.round(cur.wind_speed_10m * 10) / 10,
      condition: mapped.condition,
      weatherCode: cur.weather_code,
      icon: mapped.icon,
      isDay: cur.is_day,
      updatedAt: cur.time,
    };
  } catch (err: any) {
    clearTimeout(clientTimeoutId);
    console.warn('[WeatherService] Meteorological data unreachable:', err?.message || err);

    return {
      available: false,
      location: 'Kosli',
      error: 'WEATHER UNAVAILABLE',
    };
  }
}

/**
 * Reusable React Hook for Live Kosli Weather
 */
export function useKosliWeather(autoRefreshIntervalMs = 10 * 60 * 1000) {
  const [weather, setWeather] = useState<KosliWeather | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchKosliWeather();
      if (!isMountedRef.current) return;
      setWeather(result);
      if (!result.available) {
        setError(result.error || 'WEATHER UNAVAILABLE');
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setError('WEATHER UNAVAILABLE');
      setWeather({
        available: false,
        location: 'Kosli',
        error: 'WEATHER UNAVAILABLE',
      });
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    refresh();

    const interval = setInterval(() => {
      refresh();
    }, autoRefreshIntervalMs);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [refresh, autoRefreshIntervalMs]);

  return { weather, loading, error, refresh };
}
