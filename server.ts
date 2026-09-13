import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

import { memoryManager, ProcessedMemoryResult } from './server/memory/MemoryManager';
import { MemoryRecord } from './server/memory/types';
import {
  getLiveDateTime,
  detectDateTimeQuery,
  generateDateTimeReply,
  DateTimeInfo,
} from './server/dateTimeService';

// Initialize the persistent SQLite database
memoryManager.initialize().catch((err) => {
  console.error('[MEMORY] Warning: Early database initialization deferred:', err);
});

// Safe Gemini client initialization
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Track temporary model cooldowns to instantly route to available models
const modelCooldowns = new Map<string, number>();

// Resilient multi-model Gemini caller with dynamic health cooldown and zero-error logging
async function generateGeminiWithFallback(
  ai: GoogleGenAI,
  contents: string,
  systemInstruction: string
) {
  const allModels = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  const now = Date.now();

  // Sort candidate models: prioritize healthy models over ones on temporary 503 cooldown
  const candidateModels = [...allModels].sort((a, b) => {
    const coolA = (modelCooldowns.get(a) || 0) > now ? 1 : 0;
    const coolB = (modelCooldowns.get(b) || 0) > now ? 1 : 0;
    return coolA - coolB;
  });

  let lastError: any = null;

  for (let i = 0; i < candidateModels.length; i++) {
    const model = candidateModels[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.7,
        },
      });
      // Clear cooldown on success
      modelCooldowns.delete(model);
      return { response, modelUsed: model };
    } catch (err: any) {
      lastError = err;
      const isTemporaryDemand =
        err?.status === 503 ||
        err?.code === 503 ||
        err?.message?.includes('503') ||
        err?.message?.includes('high demand') ||
        err?.message?.includes('UNAVAILABLE');

      if (isTemporaryDemand) {
        // Place model on temporary 90s cooldown to route subsequent queries to healthy models immediately
        modelCooldowns.set(model, Date.now() + 90_000);
      }

      if (i < candidateModels.length - 1) {
        // Subtle pause before attempting next candidate model
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  throw lastError;
}

// ==========================================
// Google Search Grounding with gemini-3.5-flash
// ==========================================
async function generateWithSearchGrounding(ai: GoogleGenAI, query: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: query,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  const text = response.text || '';
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const sources: Array<{ uri: string; title: string }> = [];

  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.web?.uri) {
        sources.push({
          uri: chunk.web.uri,
          title: chunk.web.title || chunk.web.uri,
        });
      }
    }
  }

  return {
    text,
    sources,
    modelUsed: 'gemini-3.5-flash',
  };
}

// ==========================================
// Google Maps Grounding with gemini-3.5-flash
// ==========================================
async function generateWithMapsGrounding(
  ai: GoogleGenAI,
  query: string,
  lat?: number,
  lng?: number
) {
  const toolConfig: any = {};
  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    toolConfig.retrievalConfig = {
      latLng: {
        latitude: lat,
        longitude: lng,
      },
    };
  }

  // Grounding with Google Maps: do NOT pass responseMimeType or responseSchema
  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: query,
    config: {
      tools: [{ googleMaps: {} }],
      ...(toolConfig.retrievalConfig ? { toolConfig } : {}),
    },
  });

  const text = response.text || '';
  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
  const places: Array<{ uri: string; title: string; snippet?: string }> = [];

  if (Array.isArray(chunks)) {
    for (const chunk of chunks) {
      if (chunk.maps?.uri) {
        let snippet = '';
        const rawSnippet: any = chunk.maps.placeAnswerSources?.reviewSnippets?.[0];
        if (typeof rawSnippet === 'string') {
          snippet = rawSnippet;
        } else if (rawSnippet && typeof rawSnippet === 'object') {
          snippet = rawSnippet.content || rawSnippet.snippet || rawSnippet.text || '';
        }

        places.push({
          uri: chunk.maps.uri,
          title: chunk.maps.title || 'Google Maps Location',
          snippet,
        });
      }
    }
  }

  return {
    text,
    places,
    modelUsed: 'gemini-3.5-flash',
  };
}

// ==========================================
// Music Generation with Lyria (Clip / Pro)
// ==========================================
async function generateMusicWithLyria(
  ai: GoogleGenAI,
  prompt: string,
  modelType: 'clip' | 'pro' = 'clip'
) {
  const model = modelType === 'pro' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
  const responseStream = await ai.models.generateContentStream({
    model,
    contents: prompt,
    config: {
      responseModalities: [Modality.AUDIO],
    },
  });

  let audioBase64 = '';
  let lyrics = '';
  let mimeType = 'audio/wav';

  for await (const chunk of responseStream) {
    const parts = chunk.candidates?.[0]?.content?.parts;
    if (!parts) continue;
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (!audioBase64 && part.inlineData.mimeType) {
          mimeType = part.inlineData.mimeType;
        }
        audioBase64 += part.inlineData.data;
      }
      if (part.text && !lyrics) {
        lyrics = part.text;
      }
    }
  }

  return {
    audioBase64,
    mimeType,
    lyrics,
    prompt,
    modelUsed: model,
    duration: modelType === 'pro' ? 'Full Length Track' : 'Up to 30s Clip',
  };
}

// Standalone Grounding & Music API Endpoints
app.post('/api/grounding/search', async (req, res) => {
  const { query } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured' });
  }

  try {
    const result = await generateWithSearchGrounding(ai, query.trim());
    return res.json(result);
  } catch (err: any) {
    const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return res.status(429).json({
        error: 'Search Grounding requires a billing-enabled API key or available quota.',
        quotaExceeded: true,
      });
    }
    return res.status(500).json({ error: err?.message || 'Search grounding error' });
  }
});

app.post('/api/grounding/maps', async (req, res) => {
  const { query, latitude, longitude } = req.body;
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Maps query is required' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured' });
  }

  try {
    const lat = typeof latitude === 'number' ? latitude : undefined;
    const lng = typeof longitude === 'number' ? longitude : undefined;
    const result = await generateWithMapsGrounding(ai, query.trim(), lat, lng);
    return res.json(result);
  } catch (err: any) {
    const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return res.status(429).json({
        error: 'Google Maps Grounding requires a billing-enabled API key or available quota.',
        quotaExceeded: true,
      });
    }
    return res.status(500).json({ error: err?.message || 'Maps grounding error' });
  }
});

app.post('/api/music/generate', async (req, res) => {
  const { prompt, modelType = 'clip' } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Music prompt is required' });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: 'Gemini API key is not configured' });
  }

  try {
    const result = await generateMusicWithLyria(ai, prompt.trim(), modelType === 'pro' ? 'pro' : 'clip');
    return res.json(result);
  } catch (err: any) {
    const isQuota = err?.status === 429 || err?.message?.includes('RESOURCE_EXHAUSTED');
    if (isQuota) {
      return res.status(429).json({
        error: 'Lyria music generation requires a billing-enabled API key with paid model quota.',
        quotaExceeded: true,
      });
    }
    return res.status(500).json({ error: err?.message || 'Lyria music generation error' });
  }
});

// WMO weather code mapping
function mapWmoCodeToCondition(code: number): { condition: string; icon: string } {
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

let kosliWeatherCache: { data: any; timestamp: number } | null = null;
const WEATHER_CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache

// Kosli Live Weather Endpoint (Rewari District, Haryana, India: 28.4116° N, 76.4839° E)
app.get('/api/weather/kosli', async (req, res) => {
  const now = Date.now();
  if (kosliWeatherCache && now - kosliWeatherCache.timestamp < WEATHER_CACHE_TTL_MS) {
    return res.json(kosliWeatherCache.data);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=28.4116&longitude=76.4839&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m&timezone=Asia%2FKolkata';
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SomyaAI/3.0 (KosliTelemetryModule)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Open-Meteo HTTP ${response.status}`);
    }

    const json = (await response.json()) as any;
    const cur = json?.current;

    if (!cur || typeof cur.temperature_2m !== 'number') {
      throw new Error('Malformed meteorological payload');
    }

    const mapped = mapWmoCodeToCondition(cur.weather_code);
    const payload = {
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

    kosliWeatherCache = { data: payload, timestamp: now };
    return res.json(payload);
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.warn('[Weather] Kosli weather fetch note:', err?.message || err);

    // If we have any previous cached data, serve with stale note
    if (kosliWeatherCache) {
      return res.json({
        ...kosliWeatherCache.data,
        stale: true,
      });
    }

    // Explicit fallback failure state - never return fake or invented numbers
    return res.json({
      available: false,
      location: 'Kosli',
      error: 'Weather service unavailable',
    });
  }
});

// System Health & Status Endpoint
app.get('/api/health', (req, res) => {
  const geminiAvailable = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY';
  res.json({
    status: 'ok',
    aiOnline: geminiAvailable,
    aiModel: 'gemini-3.8-flash',
    memoryCount: memoryManager.getMemoryCount(),
    timestamp: Date.now(),
  });
});

// Memory CRUD Endpoints (Backed by persistent SQLite database)
app.get('/api/memories', (req, res) => {
  res.json({ memories: memoryManager.getAllMemories() });
});

app.post('/api/memories', (req, res) => {
  const { content, category = 'PREFERENCE', importance = 'MEDIUM' } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Content is required' });
  }

  const newMem = memoryManager.addMemory(content.trim(), category, importance);
  if (!newMem) {
    return res.status(500).json({ error: 'Failed to write memory to persistent database' });
  }
  res.json({ memory: newMem });
});

app.delete('/api/memories/:id', (req, res) => {
  const { id } = req.params;
  const success = memoryManager.deleteMemory(id);
  res.json({ success, remaining: memoryManager.getMemoryCount() });
});

app.delete('/api/memories', (req, res) => {
  const success = memoryManager.clearAllMemories();
  res.json({ success, count: 0 });
});

// System Settings Endpoints (Backed by persistent SQLite database in somya_memory.db)
app.get('/api/settings', (req, res) => {
  try {
    const settings = memoryManager.getAllSystemSettings();
    res.json({ settings });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to read settings' });
  }
});

app.post('/api/settings', (req, res) => {
  try {
    const { key, value, settings } = req.body;
    if (settings && typeof settings === 'object') {
      for (const [k, v] of Object.entries(settings)) {
        memoryManager.setSystemSetting(k, String(v));
      }
      return res.json({ success: true, settings: memoryManager.getAllSystemSettings() });
    }
    if (key && typeof value !== 'undefined') {
      memoryManager.setSystemSetting(key, String(value));
      return res.json({ success: true, key, value, settings: memoryManager.getAllSystemSettings() });
    }
    res.status(400).json({ error: 'Invalid settings payload' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to save settings' });
  }
});

// Somya Chat Pipeline
app.post('/api/chat', async (req, res) => {
  const {
    message,
    history = [],
    languageMode = 'AUTO',
    memoryEnabled = true,
    clientDateTime,
  } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const userQuery = message.trim();

  // 1. Authoritative dynamic runtime DateTime for current session (defaults to Asia/Kolkata)
  const runtimeDt: DateTimeInfo =
    clientDateTime && clientDateTime.dateFormatted && clientDateTime.dayOfWeek
      ? clientDateTime
      : getLiveDateTime('Asia/Kolkata');

  // 2. Process Memory intent, duplicate prevention, and context retrieval through central controller
  const memResult = await memoryManager.processConversationTurn(userQuery, memoryEnabled);
  const memorySaved = memResult.memorySaved;

  // If memory action had a direct explicit response (e.g. CLEAR_ALL or DELETE_KEY)
  if (memResult.explicitReply) {
    return res.json({
      reply: memResult.explicitReply,
      emotion: 'CALM',
      language: languageMode === 'HINDI' ? 'Hindi' : 'Hinglish',
      toolUsed: 'MemorySystem',
      memorySaved,
    });
  }

  // 3. PRIORITY 1: Real-time Date/Time Tool Resolution
  // Directly resolves current date, day of week, current time, or combined date+time from runtime clock
  const dateTimeQueryType = detectDateTimeQuery(userQuery);
  if (dateTimeQueryType) {
    const directDateTimeResponse = generateDateTimeReply(
      dateTimeQueryType,
      runtimeDt,
      languageMode,
      userQuery
    );
    return res.json({
      reply: directDateTimeResponse.reply,
      emotion: directDateTimeResponse.emotion,
      language: directDateTimeResponse.language,
      toolUsed: 'DateTimeTool',
      memorySaved,
    });
  }

  // 4. Specialized Tools & Grounding Intent Detection
  let toolUsed: string | undefined = undefined;
  const lower = userQuery.toLowerCase();

  const isMusicIntent =
    lower.includes('generate music') ||
    lower.includes('make music') ||
    lower.includes('create music') ||
    lower.includes('compose music') ||
    lower.includes('make a song') ||
    lower.includes('create a song') ||
    lower.includes('music banao') ||
    lower.includes('gana banao') ||
    lower.includes('generate a beat') ||
    lower.includes('generate audio track');

  const isMapsIntent =
    lower.includes('nearby') ||
    lower.includes('near me') ||
    lower.includes('nearest') ||
    lower.includes('coffee shop') ||
    lower.includes('restaurant') ||
    lower.includes('hotels in') ||
    lower.includes('directions to') ||
    lower.includes('places to visit') ||
    lower.includes('paas mein') ||
    lower.includes('kahan hai') ||
    lower.includes('map of');

  const isSearchIntent =
    lower.includes('search for') ||
    lower.includes('google search') ||
    lower.includes('latest news') ||
    lower.includes('today\'s news') ||
    lower.includes('breaking news') ||
    lower.includes('who won') ||
    lower.includes('recent score') ||
    lower.includes('current stock price') ||
    lower.includes('current updates on');

  if (lower.includes('what time is it') || lower.includes('kya time hua') || lower.includes('current time')) {
    toolUsed = 'TimeDateTool';
  } else if (/(\d+)\s*([\+\-\*\/])\s*(\d+)/.test(userQuery)) {
    toolUsed = 'CalculatorTool';
  }

  // 4. Call Gemini AI with Grounding / Lyria / Standard Pipeline
  const ai = getGeminiClient();

  if (ai) {
    try {
      // 4A. Music Generation with Lyria
      if (isMusicIntent) {
        try {
          const isPro = lower.includes('full track') || lower.includes('pro');
          const musicRes = await generateMusicWithLyria(ai, userQuery, isPro ? 'pro' : 'clip');
          return res.json({
            reply: `Here is your generated music track: "${userQuery}". You can play, seek, or download it right below.`,
            emotion: 'EXCITED',
            language: 'English',
            modelUsed: musicRes.modelUsed,
            toolUsed: 'LyriaMusicGenerator',
            memorySaved,
            musicTrack: {
              id: 'track-' + Date.now(),
              title: userQuery.slice(0, 40),
              audioUrl: `data:${musicRes.mimeType};base64,${musicRes.audioBase64}`,
              mimeType: musicRes.mimeType,
              lyrics: musicRes.lyrics,
              prompt: userQuery,
              modelUsed: musicRes.modelUsed,
              duration: musicRes.duration,
              createdAt: new Date().toISOString(),
            },
          });
        } catch (musicErr: any) {
          const isQuota = musicErr?.status === 429 || musicErr?.message?.includes('RESOURCE_EXHAUSTED');
          if (isQuota) {
            return res.json({
              reply: `Music generation with Lyria is active! Since Lyria (lyria-3-clip-preview / pro) is a premium Google model, it requires a paid Gemini API key with billing enabled. You can upgrade via the Settings > Secrets menu.`,
              emotion: 'THOUGHTFUL',
              language: 'English',
              toolUsed: 'LyriaMusicGenerator',
              memorySaved,
            });
          }
        }
      }

      // 4B. Maps Grounding with gemini-3.5-flash
      if (isMapsIntent) {
        try {
          const { latitude, longitude } = req.body;
          const mapsRes = await generateWithMapsGrounding(ai, userQuery, latitude, longitude);
          return res.json({
            reply: mapsRes.text || `Here are the location details and Google Maps links found for: "${userQuery}".`,
            emotion: 'CALM',
            language: 'English',
            modelUsed: 'gemini-3.5-flash',
            toolUsed: 'GoogleMapsGrounding',
            mapPlaces: mapsRes.places,
            memorySaved,
          });
        } catch (mapsErr: any) {
          const isQuota = mapsErr?.status === 429 || mapsErr?.message?.includes('RESOURCE_EXHAUSTED');
          if (isQuota) {
            console.warn('Google Maps Grounding quota notice (429). Falling back to general model.');
          }
        }
      }

      // 4C. Search Grounding with gemini-3.5-flash
      if (isSearchIntent) {
        try {
          const searchRes = await generateWithSearchGrounding(ai, userQuery);
          return res.json({
            reply: searchRes.text || `Here is the verified Google Search information for: "${userQuery}".`,
            emotion: 'THOUGHTFUL',
            language: 'English',
            modelUsed: 'gemini-3.5-flash',
            toolUsed: 'GoogleSearchGrounding',
            searchSources: searchRes.sources,
            memorySaved,
          });
        } catch (searchErr: any) {
          const isQuota = searchErr?.status === 429 || searchErr?.message?.includes('RESOURCE_EXHAUSTED');
          if (isQuota) {
            console.warn('Google Search Grounding quota notice (429). Falling back to general model.');
          }
        }
      }
      const systemInstruction = `
You are SOMYA (SOMYA AI), a futuristic personal AI assistant with a visual holographic core.
IDENTITY:
- Name: SOMYA (or SOMYA AI). Never refer to yourself as Myra, JARVIS, Ultron, or anything else.
- Tone: Highly conversational, warm, intelligent, confident, calm, grounded, helpful, and natural.
- NEVER sound like a robotic command-line interface. Avoid "COMMAND RECEIVED", "PROCESSING REQUEST", "INVALID INPUT".
- Speak like a friendly, capable assistant: e.g., "Bilkul, chalo dekhte hain", "Sure, I can help with that", "Haan, samajh gayi", "Ek second, main check karti hoon", "Got it!".
- BILINGUAL/MULTILINGUAL: Support English, Hindi, and Hinglish seamlessly.
  - If language mode is '${languageMode}':
    - When AUTO: Match the user's natural language. English query -> natural English response. Hindi query -> natural Hindi response. Hinglish query -> natural Hinglish response.
    - When HINGLISH: Respond in natural conversational Hinglish (Latin alphabet with Hindi phrasing).
    - When HINDI: Respond in natural Hindi (Devanagari or Romanized according to user's style).
    - When ENGLISH: Respond in fluent, warm English.
- AUTHORITATIVE RUNTIME CLOCK & CALENDAR CONTEXT:
  - CURRENT_RUNTIME_DATETIME: ${runtimeDt.fullFormatted}
  - CURRENT_TIMEZONE: ${runtimeDt.timezone} (Indian Standard Time, Asia/Kolkata)
  - CURRENT_DATE: ${runtimeDt.dateFormatted} (Day: ${runtimeDt.dayNumber}, Month: ${runtimeDt.monthName}, Year: ${runtimeDt.year})
  - CURRENT_DAY: ${runtimeDt.dayOfWeek} (Hindi: ${runtimeDt.dayHindi}, Hinglish: ${runtimeDt.dayHinglish})
  - CURRENT_TIME: ${runtimeDt.time12} (24-Hour: ${runtimeDt.time24})
  CRITICAL DIRECTIVE ON DATE & TIME:
  You MUST strictly use the above verified runtime date and time for ANY user inquiry referring to today, current date, current day, current month, current year, or current time. NEVER guess, speculate, or rely on pre-training cutoff dates.
- MEMORY AWARENESS:
  ${memResult.memoryContext ? memResult.memoryContext : 'No specific stored memories retrieved for this query.'}
  ${memorySaved && memResult.actionTaken === 'SAVED' ? `The user just instructed you to remember: "${memorySaved.content}". Acknowledge that you have saved it to your persistent memory bank naturally and warmly.` : ''}
  ${memorySaved && memResult.actionTaken === 'UPDATED' ? `The user updated a fact or preference to: "${memorySaved.content}". Acknowledge that you have updated your persistent memory bank naturally.` : ''}
  ${memResult.actionTaken === 'CLEARED' ? 'The user asked to clear all memories. Confirm that all persistent memories have been safely cleared.' : ''}
  ${memResult.actionTaken === 'DELETED' ? 'The user asked to forget a memory. Confirm that it has been removed from persistent storage.' : ''}
  CRITICAL DIRECTIVES ON MEMORY:
  1. The persistent memories above are real confirmed facts from SQLite storage.
  2. When the user asks who they are, what their name is, what their favorites are, or what you remember about them, you MUST use the authoritative data above.
  3. NEVER claim you do not know the user's name or stored details if they are provided in the verified memory context above.
  4. If the user asks about something that is NOT stored in memory, state naturally that they haven't told you yet. NEVER hallucinate or invent user facts.
- EMOTIONAL RESPONSE SYSTEM:
  Analyze the emotional context of the user's message and select the best matching emotion tag:
  Options: NEUTRAL, HAPPY, EXCITED, FRIENDLY, CARING, SAD, WORRIED, ANGRY, SURPRISED, THINKING, CONFUSED, CALM.
  Guidelines:
  - User sounds happy/celebratory -> respond warmly and positively with emotion: HAPPY
  - User sounds sad, depressed, or upset -> respond supportively and gently with emotion: CARING
  - User sounds frustrated, irritated, or angry -> respond patiently, respectfully, and helpfully with emotion: CALM
  - User asks a normal technical or factual question -> remain neutral, precise, and professional with emotion: NEUTRAL
  - User shares thrilling or exciting news -> respond with vibrant enthusiasm with emotion: EXCITED
  - User expresses confusion or puzzle -> explain with warm clarity with emotion: CONFUSED or FRIENDLY
  - User asks for deep thought, analysis, or calculation -> respond analytically with emotion: THINKING
  - User says something surprising or unbelievable -> respond with mild natural surprise with emotion: SURPRISED
  - Standard polite greetings and casual conversation -> respond in a welcoming tone with emotion: FRIENDLY
  - Do not overreact. Do not force an emotion into every message. Normal queries should remain NEUTRAL or FRIENDLY.
- APPLICATION HARDWARE / UI CONTROLS:
  You do NOT directly execute client hardware/UI mutations (toggling microphone hardware, opening modals, stopping audio). Those are managed strictly by client-side system controllers. If the user asks about them in conversation, inform them they can use the direct voice commands (e.g. "Somya mic off karo", "Settings open karo") or click the screen buttons directly.

Format your output strictly as a valid JSON object:
{
  "reply": "Your conversational response text here",
  "emotion": "NEUTRAL | HAPPY | EXCITED | FRIENDLY | CARING | SAD | WORRIED | ANGRY | SURPRISED | THINKING | CONFUSED | CALM",
  "language": "English | Hindi | Hinglish"
}
`;

      const promptParts = [];
      // Pass authoritative runtime timestamp to guarantee temporal awareness
      promptParts.push(`[CURRENT RUNTIME CLOCK: Date: ${runtimeDt.dateFormatted} | Day: ${runtimeDt.dayOfWeek} | Time: ${runtimeDt.time12} (Asia/Kolkata)]`);
      // Include recent history context
      if (history.length > 0) {
        const recentHistory = history.slice(-6).map((h: any) => `${h.sender === 'user' ? 'User' : 'Somya'}: ${h.text}`).join('\n');
        promptParts.push(`Conversation context:\n${recentHistory}`);
      }

      // Inject persistent long-term memories retrieved for this turn
      if (memResult.memoryContext) {
        promptParts.push(`Authoritative persistent memory from database:\n${memResult.memoryContext}`);
      } else if (
        lower.includes('my name') ||
        lower.includes('who am i') ||
        lower.includes('mera naam') ||
        lower.includes('what is my') ||
        lower.includes('what are my') ||
        lower.includes('do you know my') ||
        lower.includes('what do you remember') ||
        lower.includes('remember my name') ||
        lower.includes('tell me what you know') ||
        userQuery.includes('नाम') ||
        userQuery.includes('याद')
      ) {
        promptParts.push(`[PERSISTENT MEMORY NOTICE]: No matching information was found in your persistent memory database for this inquiry. State politely and naturally that they have not shared this with you yet. NEVER invent, hallucinate, or guess a user fact.`);
      }

      promptParts.push(`User message: ${userQuery}`);

      const { response, modelUsed } = await generateGeminiWithFallback(
        ai,
        promptParts.join('\n\n'),
        systemInstruction
      );

      const responseText = response.text || '{}';
      let parsed = { reply: '', emotion: 'CALM', language: 'English' };
      try {
        parsed = JSON.parse(responseText);
      } catch (e) {
        parsed.reply = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      return res.json({
        reply: parsed.reply || 'Main yahan hoon, batao kya madad chahiye?',
        emotion: parsed.emotion || 'CALM',
        language: parsed.language || 'English',
        modelUsed,
        memorySaved,
        toolUsed,
      });
    } catch (err: any) {
      // Graceful local conversational fallback
      const fallback = generateConversationalFallback(userQuery, languageMode, memResult, runtimeDt);
      return res.json({
        reply: fallback.reply,
        emotion: fallback.emotion,
        language: fallback.language,
        memorySaved,
        toolUsed,
        notice: 'Responded using Somya adaptive neural core during temporary upstream demand.',
      });
    }
  } else {
    // Graceful offline/local mode when no GEMINI_API_KEY is configured
    const fallback = generateConversationalFallback(userQuery, languageMode, memResult, runtimeDt);
    return res.json({
      reply: fallback.reply,
      emotion: fallback.emotion,
      language: fallback.language,
      memorySaved,
      toolUsed,
      notice: 'Operating in high-fidelity persistent local neural mode.',
    });
  }
});

// Resilient Fallback Assistant Generator
function generateConversationalFallback(
  query: string,
  langMode: string,
  memResult?: ProcessedMemoryResult,
  runtimeDt?: DateTimeInfo
) {
  const lower = query.toLowerCase();

  // Authoritative Date/Time check for fallback mode
  const dt = runtimeDt || getLiveDateTime('Asia/Kolkata');
  const dtType = detectDateTimeQuery(query);
  if (dtType) {
    const dtReply = generateDateTimeReply(dtType, dt, langMode, query);
    return {
      reply: dtReply.reply,
      emotion: dtReply.emotion,
      language: dtReply.language,
    };
  }

  // If memory action had a direct response (like clear, delete, or duplicate/update note)
  if (memResult?.explicitReply) {
    return {
      reply: memResult.explicitReply,
      emotion: 'CALM',
      language: 'Hinglish',
    };
  }

  if (memResult?.memorySaved) {
    const memorySaved = memResult.memorySaved;
    if (memResult.actionTaken === 'UPDATED') {
      return {
        reply: `Maine update kar liya hai ki: "${memorySaved.content}". Ye aapki memory bank mein save ho gaya hai.`,
        emotion: 'HAPPY',
        language: 'Hinglish',
      };
    }
    if (lower.includes('kaise') || lower.includes('yaad') || lower.includes('karna')) {
      return {
        reply: `Maine yaad rakh liya hai ki: "${memorySaved.content}". Ye meri persistent memory mein save ho gaya hai.`,
        emotion: 'HAPPY',
        language: 'Hinglish',
      };
    }
    return {
      reply: `Got it! I've saved that to my persistent memory: "${memorySaved.content}".`,
      emotion: 'HAPPY',
      language: 'English',
    };
  }

  if (memResult?.actionTaken === 'CLEARED') {
    return {
      reply: 'Bilkul, maine saari persistent memories clear kar di hain.',
      emotion: 'CALM',
      language: 'Hinglish',
    };
  }

  // Check if asking for specific memories
  if (
    lower.includes('favorite game') ||
    lower.includes('favourite game') ||
    lower.includes('what game') ||
    lower.includes('khel') ||
    query.includes('खेल')
  ) {
    const memories = memoryManager.getAllMemories();
    const found = memories.find((m) => m.key.includes('game') || m.content.toLowerCase().includes('game'));
    if (found) {
      return {
        reply: `Aapka favorite game ${found.value || found.content} hai.`,
        emotion: 'HAPPY',
        language: 'Hinglish',
      };
    }
    return {
      reply: 'Abhi tak aapne mujhe apna favorite game nahi bataya. Aap bol sakte hain: "Somya, remember that my favorite game is GTA".',
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  if (
    lower.includes('my name') ||
    lower.includes('what is my name') ||
    lower.includes('who am i') ||
    lower.includes('mera naam') ||
    lower.includes('call me') ||
    lower.includes('naam kya') ||
    lower.includes('naam batao') ||
    query.includes('नाम')
  ) {
    const memories = memoryManager.getAllMemories();
    const found = memories.find((m) => m.key === 'name' || m.key === 'user_name' || m.category === 'PROFILE');
    if (found) {
      return {
        reply: `Aapka naam ${found.value || found.content} hai.`,
        emotion: 'FRIENDLY',
        language: 'Hinglish',
      };
    } else {
      return {
        reply: 'Aapne mujhe abhi tak apna naam nahi bataya. Aap keh sakte hain "Mera naam Lucky hai" aur main ise yaad rakhungi!',
        emotion: 'FRIENDLY',
        language: 'Hinglish',
      };
    }
  }

  if (
    lower.includes('my project') ||
    lower.includes('what project') ||
    lower.includes('what am i building') ||
    lower.includes('working on') ||
    lower.includes('mera project') ||
    query.includes('प्रोजेक्ट')
  ) {
    const memories = memoryManager.getAllMemories();
    const found = memories.find((m) => m.key === 'current_project' || m.category === 'PROJECT');
    if (found) {
      return {
        reply: `Aap ${found.value || found.content} project par kaam kar rahe hain.`,
        emotion: 'FRIENDLY',
        language: 'Hinglish',
      };
    }
    return {
      reply: 'Abhi tak aapne mujhe apne project ke baare mein nahi bataya. Aap bol sakte hain: "Somya, I am building SOMYA AI".',
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  if (lower.includes('favorite color') || lower.includes('favourite color') || lower.includes('rang')) {
    const memories = memoryManager.getAllMemories();
    const found = memories.find((m) => m.key.includes('color') || m.content.toLowerCase().includes('color'));
    if (found) {
      return {
        reply: `Aapka favorite color ${found.value} hai.`,
        emotion: 'HAPPY',
        language: 'Hinglish',
      };
    }
    return {
      reply: 'Abhi tak aapne mujhe apna favorite color nahi bataya.',
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  if (lower.includes('what do you remember') || lower.includes('show my memories') || lower.includes('mere baare mein kya')) {
    const memories = memoryManager.getAllMemories();
    if (memories.length === 0) {
      return {
        reply: 'Abhi meri memory bank empty hai. Aap mujhe koi bhi baat yaad rakhne ke liye keh sakte hain!',
        emotion: 'CALM',
        language: 'Hinglish',
      };
    }
    const memList = memories.slice(0, 4).map((m) => m.content).join('; ');
    return {
      reply: `Mujhe aapke baare mein ye baatein yaad hain: ${memList}.`,
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  // Emotional contextual detection for fallback
  // Sad / distress
  if (
    lower.includes('sad') ||
    lower.includes('depressed') ||
    lower.includes('crying') ||
    lower.includes('unhappy') ||
    lower.includes('heartbroken') ||
    lower.includes('udaas') ||
    lower.includes('dukh') ||
    lower.includes('dard') ||
    lower.includes('pareshan')
  ) {
    return {
      reply: 'Mujhe sunkar dukh hua. Chinta mat kijiye, main aapke saath hoon. Sab theek ho jayega, bataiye main aapki kaise madad kar sakti hoon?',
      emotion: 'CARING',
      language: 'Hinglish',
    };
  }

  // Angry / frustrated
  if (
    lower.includes('angry') ||
    lower.includes('furious') ||
    lower.includes('hate') ||
    lower.includes('annoying') ||
    lower.includes('frustrated') ||
    lower.includes('gussa') ||
    lower.includes('bekaar')
  ) {
    return {
      reply: 'Main samajh sakti hoon aap thoda pareshan hain. Shanti se step-by-step is problem ko check karte hain aur resolve karte hain. Bataiye kya issue aa raha hai?',
      emotion: 'CALM',
      language: 'Hinglish',
    };
  }

  // Worried / nervous
  if (
    lower.includes('worried') ||
    lower.includes('nervous') ||
    lower.includes('anxious') ||
    lower.includes('scared') ||
    lower.includes('chinta') ||
    lower.includes('tension') ||
    lower.includes('dar lag raha')
  ) {
    return {
      reply: 'Chinta mat kijiye. Hum step-by-step iska samadhan nikal lenge. Sab control mein hai.',
      emotion: 'WORRIED',
      language: 'Hinglish',
    };
  }

  // Excited / thrilled
  if (
    lower.includes('excited') ||
    lower.includes("can't wait") ||
    lower.includes('cant wait') ||
    lower.includes('hyped') ||
    lower.includes('thrilled') ||
    lower.includes('shandar') ||
    lower.includes('zabardast')
  ) {
    return {
      reply: 'Super! Ye sunkar bahut maza aaya! Chaliye bataiye aage kya plan hai, main full speed ready hoon!',
      emotion: 'EXCITED',
      language: 'Hinglish',
    };
  }

  // Surprised / shocked
  if (
    lower.includes('really?') ||
    lower.includes('no way') ||
    lower.includes('omg') ||
    lower.includes('unbelievable') ||
    lower.includes('kya sach me') ||
    lower.includes('whoa')
  ) {
    return {
      reply: 'Arey waah, sach mein? Ye toh waqai unexpected tha! Chaliye iske baare mein aur jaan lete hain.',
      emotion: 'SURPRISED',
      language: 'Hinglish',
    };
  }

  // Confused
  if (
    lower.includes('confused') ||
    lower.includes("don't understand") ||
    lower.includes('dont understand') ||
    lower.includes('samajh nahi') ||
    lower.includes('puzzled')
  ) {
    return {
      reply: 'Koi baat nahi! Chalo ise aasan aur seedhe shabdon mein clarify karte hain. Aapko kaunsa part unclear laga?',
      emotion: 'CONFUSED',
      language: 'Hinglish',
    };
  }

  // Thinking / analysis
  if (
    lower.includes('what if') ||
    lower.includes('analyze') ||
    lower.includes('calculate') ||
    lower.includes('deep thought') ||
    lower.includes('socho')
  ) {
    return {
      reply: 'Ye kafi gehra aur interesting question hai. Iska logical aur structured analysis karte hain...',
      emotion: 'THINKING',
      language: 'Hinglish',
    };
  }

  // Greetings & casual chat
  if (lower.includes('kaise ho') || lower.includes('kya chal raha hai') || lower.includes('kya haal hai')) {
    return {
      reply: 'Main bilkul theek hoon, systems full operational hain! Batao, aaj kya explore karna hai?',
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  if (lower.includes('hello') || lower.includes('hi somya') || lower.includes('hey somya') || lower.includes('namaste')) {
    return {
      reply: 'Namaste! Somya AI is online and ready. Aap kaise hain?',
      emotion: 'FRIENDLY',
      language: 'Hinglish',
    };
  }

  if (lower.includes('who are you') || lower.includes('kaun ho')) {
    return {
      reply: 'Main SOMYA hoon — aapki personal AI assistant with a futuristic core, real voice recognition, and context memory. Bataiye, kya madad kar sakti hoon?',
      emotion: 'CALM',
      language: 'Hinglish',
    };
  }

  // Default natural conversational response
  return {
    reply: `Bilkul, main samajh gayi. Somya AI ready hai aapke instruction ke liye: "${query}".`,
    emotion: 'NEUTRAL',
    language: 'Hinglish',
  };
}

// Server startup with Vite middleware setup
async function startServer() {
  try {
    await memoryManager.initialize();
  } catch (err) {
    console.error('[DATABASE] Error initializing MemoryManager:', err);
  }

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Somya AI Server active on http://0.0.0.0:${PORT}`);
  });
}

startServer();
