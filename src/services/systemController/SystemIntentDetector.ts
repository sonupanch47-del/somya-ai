import { DetectedSystemIntent, SystemActionIntent } from './types';

export class SystemIntentDetector {
  /**
   * Evaluates user input for an authoritative internal system control intent.
   * Supports English, Hindi, and natural Hinglish phrasing.
   * Cleans wake words, normalizes speech-to-text acoustic artifacts, and strictly separates
   * application control from conversational queries (which return null to go to Gemini).
   */
  public detect(rawInput: string, hasPendingConfirmation: boolean = false): DetectedSystemIntent | null {
    if (!rawInput || typeof rawInput !== 'string') return null;

    const trimmed = rawInput.trim();
    if (trimmed.length < 2) return null;

    const lower = trimmed.toLowerCase();

    // 0. Handle Confirmation / Cancellation if a high-risk operation is pending
    if (hasPendingConfirmation) {
      if (
        /^(haan|yes|confirm|proceed|ok|sure|haan delete kar do|yes confirm|haan karo|bilkul|kar do)\b/i.test(lower)
      ) {
        return {
          intent: 'CONFIRM_ACTION',
          confidence: 0.99,
          parameters: {},
          rawText: trimmed,
        };
      }
      if (
        /^(nahi|no|cancel|abort|stop|mat karo|nahi mat karo|cancel karo|dont|don't)\b/i.test(lower)
      ) {
        return {
          intent: 'CANCEL_ACTION',
          confidence: 0.99,
          parameters: {},
          rawText: trimmed,
        };
      }
    }

    // Normalize input for intent detection:
    // Strip leading / trailing punctuation, wake words ("somya", "saumya", "hey somya", "suno somya", etc.)
    let cleaned = lower
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Remove leading conversational interjections & wake words
    cleaned = cleaned
      .replace(/^(hey|hi|hello|suno|arre|arey|please|kripya|zara)\s+/i, '')
      .replace(/^(somya|saumya|soumya|somiya|somi|somia|ai|assistant)\s+/i, '')
      .replace(/^(please|kripya|zara)\s+/i, '')
      .trim();

    // Also strip trailing wake word if present (e.g., "mic off karo somya")
    cleaned = cleaned.replace(/\s+(somya|saumya|soumya|somiya|somi|ai|assistant)$/i, '').trim();

    // Normalize common speech-to-text misspellings and phonetics:
    // 1. "mike", "maik", "mic" -> "mic"
    cleaned = cleaned.replace(/\b(mike|maik|myke)\b/g, 'mic');
    // 2. "of" -> "off" when adjacent to mic/ambient/audio
    cleaned = cleaned.replace(/\bmic\s+of\b/g, 'mic off');
    cleaned = cleaned.replace(/\bambient\s+of\b/g, 'ambient off');
    cleaned = cleaned.replace(/\baudio\s+of\b/g, 'audio off');
    // 3. "kro" -> "karo"
    cleaned = cleaned.replace(/\bkro\b/g, 'karo');
    // 4. "khola", "kholna", "khol" -> "kholo"
    cleaned = cleaned.replace(/\b(khol|khola|kholna|kholiye)\b/g, 'kholo');
    // 5. "bandh", "bnd" -> "band"
    cleaned = cleaned.replace(/\b(bandh|bnd|bndh)\b/g, 'band');
    // 6. "aawaj", "awaaz", "awaz" -> "aawaz"
    cleaned = cleaned.replace(/\b(aawaj|awaaz|awaz|aawaaz)\b/g, 'aawaz');

    // Section 17 Guard: Do NOT break normal chat queries
    // If the input has clear question words (e.g. "kya hai", "kaise", "kyun", "batao", "what is", "who is", "why", "how", "tell me about")
    // AND does not contain explicit application control verbs ("mic", "voice", "settings", "emotion", "ambient", "core", "memory"),
    // return null immediately so it flows to Gemini.
    const isObviousQuestion = /\b(kya|kyun|kyu|kaise|kab|kisko|kahan|where|who|what|why|how|when|tell me|weather|capital|poem|kahani|joke)\b/i.test(cleaned);
    const hasAppKeyword = /\b(mic|microphone|voice|aawaz|settings|memory|memories|ambient|background audio|background music|emotion|core|intensity)\b/i.test(cleaned);
    if (isObviousQuestion && !hasAppKeyword) {
      return null;
    }

    // -------------------------------------------------------------
    // 1. MICROPHONE CONTROL
    // -------------------------------------------------------------
    // MIC OFF: "mic off karo", "somya mic off karo", "mic band karo", "turn off mic", "stop listening", "stop mic", etc.
    if (
      /\bmic(rophone)?\s+(off|band|close|mute|disable|stop)\b/i.test(cleaned) ||
      /\b(stop|off|band|close|mute|disable|turn off)\s+.*?\bmic(rophone)?\b/i.test(cleaned) ||
      /\b(stop|band karo|rok do)\s+listening\b/i.test(cleaned) ||
      /\blistening\s+(stop|band|rok do)\b/i.test(cleaned) ||
      /\bsunna\s+band\b/i.test(cleaned)
    ) {
      return {
        intent: 'MIC_OFF',
        confidence: 0.99,
        parameters: {},
        rawText: trimmed,
      };
    }

    // MIC ON: "mic open karo", "somya mic open karo", "mic on karo", "mic chalu karo", "turn on mic", "start listening", etc.
    if (
      /\bmic(rophone)?\s+(open|on|chalu|start|enable|unmute)\b/i.test(cleaned) ||
      /\b(open|turn on|chalu karo|start|enable|unmute)\s+.*?\bmic(rophone)?\b/i.test(cleaned) ||
      /\b(start|chalu karo|shuru karo)\s+listening\b/i.test(cleaned) ||
      /\blistening\s+(start|chalu|shuru|on)\b/i.test(cleaned) ||
      /\bsunna\s+(shuru|start|chalu)\b/i.test(cleaned)
    ) {
      return {
        intent: 'MIC_ON',
        confidence: 0.99,
        parameters: {},
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 2. VOICE PREFERENCES & SELECTION
    // -------------------------------------------------------------
    // VOICE SAVE: "ye voice save kar lo", "voice save karo", "save this voice", "default bana do", etc.
    if (
      /\b(save|default)\b/i.test(cleaned) &&
      (/\b(voice|aawaz|awaz|sound)\b/i.test(cleaned) || /\b(is|ye|this|current)\b/i.test(cleaned)) &&
      !isObviousQuestion
    ) {
      if (
        /\b(voice\s+save|save\s+voice|save\s+kar|save\s+this|save\s+current|default\s+bana|set\s+as\s+default|make\s+default|default\s+voice)\b/i.test(cleaned)
      ) {
        return {
          intent: 'VOICE_SAVE',
          confidence: 0.98,
          parameters: {},
          rawText: trimmed,
        };
      }
    }

    // VOICE RESET: "reset voice", "voice reset karo", "default voice use karo"
    if (
      /\b(reset\s+voice|voice\s+reset|reset\s+to\s+default\s+voice)\b/i.test(cleaned) ||
      (/\breset\b/i.test(cleaned) && /\b(voice|aawaz)\b/i.test(cleaned))
    ) {
      return {
        intent: 'VOICE_RESET',
        confidence: 0.96,
        parameters: {},
        rawText: trimmed,
      };
    }

    // SELECT HINDI VOICE
    if (
      (/\bhindi\b/i.test(cleaned) && /\b(voice|aawaz|bolo|speak|switch|select|kar|karo)\b/i.test(cleaned)) &&
      !isObviousQuestion
    ) {
      return {
        intent: 'VOICE_SELECT',
        confidence: 0.96,
        parameters: { language: 'HINDI' },
        rawText: trimmed,
      };
    }

    // SELECT ENGLISH VOICE
    if (
      (/\benglish\b/i.test(cleaned) && /\b(voice|aawaz|bolo|speak|switch|select|kar|karo)\b/i.test(cleaned)) &&
      !isObviousQuestion
    ) {
      return {
        intent: 'VOICE_SELECT',
        confidence: 0.96,
        parameters: { language: 'ENGLISH' },
        rawText: trimmed,
      };
    }

    // CYCLE / CHANGE VOICE: "change voice", "voice change karo", "dusri voice", "different voice"
    if (
      (/\b(change\s+voice|voice\s+change|next\s+voice|dusri\s+voice|doosri\s+voice|different\s+voice|voice\s+badlo)\b/i.test(cleaned))
    ) {
      return {
        intent: 'VOICE_SELECT',
        confidence: 0.96,
        parameters: { action: 'CYCLE' },
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 3. EMOTION SUBSYSTEM CONTROL
    // -------------------------------------------------------------
    // HAPPY: "happy ho jao", "khush ho jao", "be happy", "happy mode", "happy emotion"
    if (
      /\b(happy\s+ho\s+jao|khush\s+ho\s+jao|be\s+happy|happy\s+mode|happy\s+emotion|set\s+emotion\s+happy|emotion\s+happy)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'HAPPY' },
        rawText: trimmed,
      };
    }

    // CALM: "calm ho jao", "shant ho jao", "relax ho jao", "be calm", "calm mode", "calm emotion"
    if (
      /\b(calm\s+ho\s+jao|shant\s+ho\s+jao|relax\s+ho\s+jao|be\s+calm|calm\s+mode|calm\s+emotion|set\s+emotion\s+calm|emotion\s+calm)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'CALM' },
        rawText: trimmed,
      };
    }

    // FRIENDLY: "friendly ho jao", "be friendly", "friendly mode", "friendly emotion"
    if (
      /\b(friendly\s+ho\s+jao|be\s+friendly|friendly\s+mode|friendly\s+emotion|emotion\s+friendly)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'FRIENDLY' },
        rawText: trimmed,
      };
    }

    // NEUTRAL: "neutral ho jao", "normal mode", "neutral mode", "normal ho jao"
    if (
      /\b(neutral\s+ho\s+jao|normal\s+ho\s+jao|neutral\s+mode|normal\s+mode|neutral\s+emotion|emotion\s+neutral)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'NEUTRAL' },
        rawText: trimmed,
      };
    }

    // EXCITED: "excited ho jao", "be excited", "excited mode", "excited emotion"
    if (
      /\b(excited\s+ho\s+jao|be\s+excited|excited\s+mode|excited\s+emotion|emotion\s+excited)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'EXCITED' },
        rawText: trimmed,
      };
    }

    // CARING: "caring ho jao", "be caring", "caring mode"
    if (
      /\b(caring\s+ho\s+jao|be\s+caring|caring\s+mode|caring\s+emotion)\b/i.test(cleaned)
    ) {
      return {
        intent: 'EMOTION_SET',
        confidence: 0.96,
        parameters: { emotion: 'CARING' },
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 4. AMBIENT BACKGROUND AUDIO CONTROL
    // -------------------------------------------------------------
    // AMBIENT OFF: "ambient audio off karo", "ambient sound band karo", "turn off ambient", etc.
    if (
      /\bambient\s+(audio|sound|music)?\s*(off|band|stop|mute|disable)\b/i.test(cleaned) ||
      /\b(turn\s+off|stop|band\s+karo|mute)\s+ambient\b/i.test(cleaned) ||
      /\b(background\s+audio|background\s+sound|background\s+music)\s+(off|band|stop|mute)\b/i.test(cleaned) ||
      /\b(turn\s+off|stop|band\s+karo|mute)\s+(background\s+audio|background\s+sound|background\s+music)\b/i.test(cleaned)
    ) {
      return {
        intent: 'AMBIENT_OFF',
        confidence: 0.98,
        parameters: {},
        rawText: trimmed,
      };
    }

    // AMBIENT ON: "ambient audio on karo", "ambient sound chalu karo", "turn on ambient", etc.
    if (
      /\bambient\s+(audio|sound|music)?\s*(on|chalu|start|play|enable)\b/i.test(cleaned) ||
      /\b(turn\s+on|start|play|chalu\s+karo)\s+ambient\b/i.test(cleaned) ||
      /\b(background\s+audio|background\s+sound|background\s+music)\s+(on|chalu|start|play)\b/i.test(cleaned) ||
      /\b(turn\s+on|start|play|chalu\s+karo)\s+(background\s+audio|background\s+sound|background\s+music)\b/i.test(cleaned)
    ) {
      return {
        intent: 'AMBIENT_ON',
        confidence: 0.98,
        parameters: {},
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 5. CORE VISUALS & ANIMATION INTENSITY
    // -------------------------------------------------------------
    // DOWN / DECREASE INTENSITY
    if (
      /\bcore\s+intensity\s+(kam|ghatao|decrease|low|down)\b/i.test(cleaned) ||
      /\b(kam|ghatao|decrease)\s+.*?\bcore\s+intensity\b/i.test(cleaned)
    ) {
      return {
        intent: 'CORE_INTENSITY_SET',
        confidence: 0.96,
        parameters: { direction: 'DOWN' },
        rawText: trimmed,
      };
    }

    // UP / INCREASE INTENSITY
    if (
      /\bcore\s+intensity\s+(badhao|increase|tez|high|up)\b/i.test(cleaned) ||
      /\b(badhao|increase|tez)\s+.*?\bcore\s+intensity\b/i.test(cleaned)
    ) {
      return {
        intent: 'CORE_INTENSITY_SET',
        confidence: 0.96,
        parameters: { direction: 'UP' },
        rawText: trimmed,
      };
    }

    // NORMAL / RESET INTENSITY
    if (
      /\b(core\s+intensity\s+normal|reset\s+core\s+intensity|core\s+normal\s+intensity)\b/i.test(cleaned)
    ) {
      return {
        intent: 'CORE_INTENSITY_SET',
        confidence: 0.96,
        parameters: { direction: 'NORMAL' },
        rawText: trimmed,
      };
    }

    // CORE MODE
    if (
      /\bcore\s+mode\s+(change|badlo)\b/i.test(cleaned) ||
      /\bchange\s+core\s+mode\b/i.test(cleaned)
    ) {
      return {
        intent: 'CORE_MODE_SET',
        confidence: 0.95,
        parameters: { mode: 'IDLE' },
        rawText: trimmed,
      };
    }

    if (/\bcore\s+calm\s+mode\b/i.test(cleaned)) {
      return {
        intent: 'CORE_MODE_SET',
        confidence: 0.95,
        parameters: { mode: 'CALM' },
        rawText: trimmed,
      };
    }

    if (/\bcore\s+(idle|normal)\s+mode\b/i.test(cleaned)) {
      return {
        intent: 'CORE_MODE_SET',
        confidence: 0.95,
        parameters: { mode: 'IDLE' },
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 6. UI NAVIGATION & SETTINGS MODALS
    // -------------------------------------------------------------
    // MEMORY PANEL OPEN: "memory kholo", "memory open karo", "open memory", "open memories", "memory panel kholo", "memory settings kholo"
    if (
      /\b(memory|memories)\s+(panel\s+)?(open|kholo|dikhao|show)\b/i.test(cleaned) ||
      /\b(open|kholo|show|dikhao)\s+.*?\b(memory|memories)\b/i.test(cleaned)
    ) {
      return {
        intent: 'MEMORY_OPEN',
        confidence: 0.98,
        parameters: {},
        rawText: trimmed,
      };
    }

    // AUDIO SETTINGS OPEN
    if (
      /\b(audio|ambient|sound)\s+settings\s+(open|kholo|dikhao|show)\b/i.test(cleaned) ||
      /\b(open|kholo|show)\s+.*?\b(audio|ambient|sound)\s+settings\b/i.test(cleaned)
    ) {
      return {
        intent: 'AUDIO_SETTINGS_OPEN',
        confidence: 0.98,
        parameters: {},
        rawText: trimmed,
      };
    }

    // GENERAL SETTINGS & TABS OPEN: "settings open karo", "settings open", "settings kholo", "open settings", etc.
    if (
      /\bsettings\s+(open|kholo|dikhao|show)\b/i.test(cleaned) ||
      /\b(open|kholo|show|dikhao)\s+settings\b/i.test(cleaned)
    ) {
      let tab = 'GENERAL';
      if (/\bvoice\b/i.test(cleaned)) tab = 'VOICE';
      else if (/\bmemory\b/i.test(cleaned)) tab = 'MEMORY';
      else if (/\b(mic|microphone|privacy)\b/i.test(cleaned)) tab = 'PRIVACY';
      else if (/\b(language|bhasha)\b/i.test(cleaned)) tab = 'LANGUAGE';
      else if (/\b(appearance|theme)\b/i.test(cleaned)) tab = 'APPEARANCE';

      return {
        intent: 'SETTINGS_OPEN',
        confidence: 0.98,
        parameters: { tab },
        rawText: trimmed,
      };
    }

    // SETTINGS CLOSE: "settings close karo", "settings close", "settings band karo", "close settings"
    if (
      /\bsettings\s+(close|band|hide)\b/i.test(cleaned) ||
      /\b(close|band\s+karo|hide)\s+settings\b/i.test(cleaned)
    ) {
      return {
        intent: 'SETTINGS_CLOSE',
        confidence: 0.98,
        parameters: {},
        rawText: trimmed,
      };
    }

    // -------------------------------------------------------------
    // 7. DESTRUCTIVE ACTIONS REQUIRING CONFIRMATION
    // -------------------------------------------------------------
    if (
      /\b(delete|clear|erase)\s+(all|sari|saari|sab)\s+memor(y|ies)\b/i.test(cleaned) ||
      /\b(all|sari|saari|sab)\s+memor(y|ies)\s+(delete|clear|erase)\b/i.test(cleaned)
    ) {
      return {
        intent: 'CLEAR_MEMORIES_REQUEST',
        confidence: 0.99,
        parameters: {},
        rawText: trimmed,
      };
    }

    // Not a recognized application command -> Hand over to Gemini conversation
    return null;
  }
}
