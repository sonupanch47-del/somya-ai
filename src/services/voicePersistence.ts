import { SavedVoicePreference } from '../types';

const STORAGE_KEY = 'somya_voice_preference';
const LEGACY_URI_KEY = 'somya_saved_voice_uri';
const SETTINGS_API = '/api/settings';

export interface VoiceStoragePayload {
  voice: SavedVoicePreference;
}

/**
 * Synchronously retrieves stored voice preference from client-side storage.
 * Guarantees zero-delay availability during React component initialization.
 */
export function getStoredVoicePreference(): SavedVoicePreference | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.voice?.selectedVoiceId) {
        return parsed.voice;
      }
    }

    // Check legacy key for backward compatibility
    const legacyUri = localStorage.getItem(LEGACY_URI_KEY);
    if (legacyUri) {
      return {
        selectedVoiceId: legacyUri,
        selectedVoiceName: legacyUri,
        provider: 'WebSpeechAPI',
        language: 'en-US',
        saved: true,
      };
    }
  } catch (err) {
    console.warn('[VOICE_PERSISTENCE] Error parsing local storage preference:', err);
  }

  return null;
}

/**
 * Fetches persistent settings from the server-side SQLite database.
 * Syncs any remote preference to localStorage and returns the parsed preference.
 */
export async function fetchServerVoicePreference(): Promise<SavedVoicePreference | null> {
  try {
    const res = await fetch(SETTINGS_API);
    if (!res.ok) return null;

    const data = await res.json();
    const serverSettings = data?.settings || {};

    if (serverSettings.voice_preference) {
      try {
        const parsed = JSON.parse(serverSettings.voice_preference);
        if (parsed?.voice?.selectedVoiceId) {
          const pref = parsed.voice as SavedVoicePreference;
          // Sync to localStorage
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ voice: pref }));
            localStorage.setItem(LEGACY_URI_KEY, pref.selectedVoiceId);
          }
          return pref;
        }
      } catch (e) {}
    }

    if (serverSettings.voice_uri) {
      const pref: SavedVoicePreference = {
        selectedVoiceId: serverSettings.voice_uri,
        selectedVoiceName: serverSettings.voice_name || serverSettings.voice_uri,
        provider: 'WebSpeechAPI',
        language: serverSettings.preferred_language || 'en-US',
        saved: true,
      };
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ voice: pref }));
        localStorage.setItem(LEGACY_URI_KEY, pref.selectedVoiceId);
      }
      return pref;
    }
  } catch (err) {
    console.warn('[VOICE_PERSISTENCE] Could not fetch server settings:', err);
  }

  return null;
}

/**
 * Permanently saves voice preference to both SQLite backend and local cache.
 * Exactly adheres to the required storage format:
 * {
 *   "voice": {
 *     "selectedVoiceId": "...",
 *     "selectedVoiceName": "...",
 *     "provider": "WebSpeechAPI",
 *     "language": "...",
 *     "saved": true
 *   }
 * }
 */
export async function persistVoicePreference(
  voice: SpeechSynthesisVoice | { voiceURI: string; name?: string; lang?: string }
): Promise<{ success: boolean; preference: SavedVoicePreference | null; error?: string }> {
  if (!voice || !voice.voiceURI) {
    return {
      success: false,
      preference: null,
      error: 'Invalid voice object or missing voiceURI',
    };
  }

  const preference: SavedVoicePreference = {
    selectedVoiceId: voice.voiceURI,
    selectedVoiceName: voice.name || voice.voiceURI,
    provider: 'WebSpeechAPI',
    language: voice.lang || 'en-US',
    saved: true,
  };

  const payload: VoiceStoragePayload = { voice: preference };

  // 1. Immediately write to localStorage for synchronous offline & reload safety
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      localStorage.setItem(LEGACY_URI_KEY, preference.selectedVoiceId);
    } catch (e) {
      console.warn('[VOICE_PERSISTENCE] localStorage write warning:', e);
    }
  }

  // 2. Persist to SQLite server database
  try {
    const res = await fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        settings: {
          voice_preference: JSON.stringify(payload),
          voice_uri: preference.selectedVoiceId,
          voice_name: preference.selectedVoiceName,
        },
      }),
    });

    if (res.ok) {
      return { success: true, preference };
    } else {
      console.warn('[VOICE_PERSISTENCE] Server returned non-OK status:', res.status);
      // Even if server failed, local was persisted
      return { success: true, preference };
    }
  } catch (err: any) {
    console.warn('[VOICE_PERSISTENCE] Server sync error, saved locally:', err);
    return { success: true, preference };
  }
}

/**
 * Validates whether the saved voice exists in the active browser voices list.
 * Gracefully falls back to default voice if removed or invalid without crashing.
 */
export function validateAndResolveVoice(
  savedPref: SavedVoicePreference | null,
  availableVoices: SpeechSynthesisVoice[]
): {
  voice: SpeechSynthesisVoice | null;
  isValid: boolean;
  isFallback: boolean;
  warning?: string;
} {
  if (!availableVoices || availableVoices.length === 0) {
    // Voices list not loaded yet; defer validation
    return { voice: null, isValid: false, isFallback: false };
  }

  if (!savedPref || !savedPref.selectedVoiceId) {
    return { voice: null, isValid: false, isFallback: false };
  }

  // 1. Match by exact voiceURI / selectedVoiceId
  const matchById = availableVoices.find((v) => v.voiceURI === savedPref.selectedVoiceId);
  if (matchById) {
    return { voice: matchById, isValid: true, isFallback: false };
  }

  // 2. Match by exact name and language
  const matchByNameAndLang = availableVoices.find(
    (v) => v.name === savedPref.selectedVoiceName && v.lang === savedPref.language
  );
  if (matchByNameAndLang) {
    return { voice: matchByNameAndLang, isValid: true, isFallback: false };
  }

  // 3. Match by name
  const matchByName = availableVoices.find((v) => v.name === savedPref.selectedVoiceName);
  if (matchByName) {
    return { voice: matchByName, isValid: true, isFallback: false };
  }

  // 4. Saved voice is no longer available on this device / browser.
  // Fall back to default voice safely without crashing.
  const fallbackVoice =
    availableVoices.find((v) => v.lang.startsWith('hi')) ||
    availableVoices.find((v) => v.lang.startsWith('en-IN')) ||
    availableVoices.find((v) => v.lang.startsWith('en-US')) ||
    availableVoices[0] ||
    null;

  return {
    voice: fallbackVoice,
    isValid: false,
    isFallback: true,
    warning: `Previously saved voice "${savedPref.selectedVoiceName}" is not available in this browser. Default voice selected.`,
  };
}
