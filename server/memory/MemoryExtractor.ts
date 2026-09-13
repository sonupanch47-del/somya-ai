import { ExtractedMemory, MemoryCategory, MemoryImportance, MemoryIntent } from './types';

export class MemoryExtractor {
  // Confidence thresholds
  private readonly AUTO_SAVE_THRESHOLD = 0.75;

  // Sensitive patterns that MUST NEVER be stored in memory
  private readonly SENSITIVE_PATTERNS = [
    /password/i,
    /api[-_\s]?key/i,
    /secret/i,
    /bearer\s+[a-z0-9_\-\.]+/i,
    /ghp_[a-zA-Z0-9]+/i,
    /ai[a-zA-Z0-9_-]{30,}/i,
    /private\s+key/i,
    /credentials/i,
    /credit\s*card/i,
    /cvv/i,
    /pin\s*number/i,
  ];

  // Greetings and casual conversational filler that must NEVER trigger memory
  private readonly FILLER_PATTERNS = [
    /^(hi|hello|hey|namaste|good\s+morning|good\s+evening|kaise\s+ho|kya\s+haal|how\s+are\s+you)\b/i,
    /^(ok|okay|cool|thanks|thank\s+you|shukriya|alright|bye|goodbye|see\s+you)\b/i,
    /^(yes|no|haan|nahi|sure|yup|nope)$/i,
    /^(what\s+is\s+the\s+weather|tell\s+me\s+a\s+joke|what\s+time\s+is\s+it)/i,
  ];

  // Words that can NEVER be treated as a user's name
  private readonly INVALID_NAME_WORDS = new Set([
    'kya', 'what', 'who', 'kaun', 'kiska', 'kiski', 'kiske', 'kahan', 'kab', 'kyun', 'kyu',
    'kaise', 'batao', 'tell', 'hai', 'tha', 'thi', 'the', 'is', 'am', 'are', 'was', 'were',
    'not', 'nahi', 'building', 'working', 'playing', 'feeling', 'happy', 'sad', 'fine', 'good',
    'here', 'ready', 'sorry', 'okay', 'ok', 'trying', 'going', 'coming', 'asking', 'telling',
    'calling', 'doing', 'saying', 'thinking', 'listening', 'watching', 'eating', 'sleeping',
    'reading', 'writing', 'talking', 'speaking', 'learning', 'coding', 'running', 'walking',
    'a', 'an', 'the', 'so', 'very', 'just', 'now', 'sure', 'bhi', 'toh', 'aur', 'par',
    'yaad', 'pata', 'jaanti', 'jaante', 'somya', 'user', 'ai', 'assistant', 'online', 'offline',
    'lucky', // Note: 'lucky' as a lowercase adjective vs Lucky as a capitalized name
  ]);

  /**
   * Detects whether a string is a question or inquiry rather than a declarative statement.
   */
  public isQuestion(text: string): boolean {
    const raw = text.trim();
    if (!raw) return false;
    if (raw.endsWith('?')) return true;

    const lower = raw.toLowerCase();

    // Standard English and Hindi question starters
    if (/^(what|who|where|when|why|how|which|whose|whom|do|does|did|can|could|will|would|is|are|am)\b/i.test(lower)) {
      return true;
    }
    if (/^(kya|kaun|kaunsa|kaunsi|kiska|kiski|kiske|kahan|kaha|kab|kyun|kyu|kaise)\b/i.test(lower)) {
      return true;
    }

    // Common memory inquiry and question phrases
    if (
      lower.includes('kya hai') ||
      lower.includes('kya tha') ||
      lower.includes('kya h') ||
      lower.includes('kaun hai') ||
      lower.includes('kahan hai') ||
      lower.includes('batao') ||
      lower.includes('bata do') ||
      lower.includes('tell me') ||
      lower.includes('remember my') ||
      lower.includes('remember what') ||
      lower.includes('do you remember') ||
      lower.includes('do you know') ||
      lower.includes('kya tumhe') ||
      lower.includes('kya aapko') ||
      lower.includes('yaad hai') ||
      lower.includes('pata hai') ||
      lower.includes('jaanti ho') ||
      lower.includes('jaante ho') ||
      lower.includes('who am i') ||
      lower.includes('who i am') ||
      lower.includes('what should you call me') ||
      lower.includes('what do you know') ||
      lower.includes('what do you remember') ||
      lower.includes('show my memories') ||
      lower.includes('show memories') ||
      raw.includes('क्या') ||
      raw.includes('कौन') ||
      raw.includes('याद') ||
      raw.includes('बताओ')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Identifies explicit memory commands or natural statements to save/retrieve.
   */
  public parseMemoryIntent(userQuery: string): MemoryIntent {
    const text = userQuery.trim();
    const lower = text.toLowerCase();

    // 1. Clear all memories command
    if (
      lower.includes('clear my memories') ||
      lower.includes('clear all memories') ||
      lower.includes('delete all memories') ||
      lower.includes('erase all memories') ||
      lower.includes('saari memory delete kar do') ||
      lower.includes('saari memories delete kar do') ||
      lower.includes('sab bhool jao')
    ) {
      return { type: 'CLEAR_ALL' };
    }

    // 2. Forget / Delete specific memory command
    const deleteMatch =
      lower.match(/(?:forget|delete|remove|erase)\s+(?:my\s+|the\s+memory\s+(?:about|of)\s+|that\s+)?([a-z0-9_\s]+)/i);
    if (deleteMatch && deleteMatch[1]) {
      const rawTarget = deleteMatch[1].trim();
      if (rawTarget && !['all', 'everything', 'it', 'this'].includes(rawTarget)) {
        const key = this.normalizeKeyFromPhrase(rawTarget);
        return { type: 'DELETE_KEY', targetKey: key };
      }
    }

    // 3. Retrieve / Show all memories command
    if (
      lower.includes('what do you remember about me') ||
      lower.includes('what do you remember') ||
      lower.includes('show my memories') ||
      lower.includes('list my memories') ||
      lower.includes('what do you know about me') ||
      lower.includes('tell me what you know about me') ||
      lower.includes('mere baare me kya janti ho') ||
      lower.includes('mere baare mein kya janti ho') ||
      lower.includes('tumhe mere baare mein kya pata hai') ||
      lower.includes('tumhe mere baare me kya pata hai') ||
      lower === 'show memories' ||
      lower === 'my memories'
    ) {
      return { type: 'RETRIEVE_ALL' };
    }

    // 4. Check for EXPLICIT SAVE triggers (Prefix or Suffix)
    // Suffix patterns: e.g., "My name is Lucky. Remember this.", "Mera favorite game GTA hai, ye yaad rakhna."
    const suffixPatterns = [
      /(.+?)[,.]?\s+(?:please\s+)?remember\s+this(?:\s+for\s+later)?\.?$/i,
      /(.+?)[,.]?\s+(?:please\s+)?don['’]t\s+forget(?:\s+this)?\.?$/i,
      /(.+?)[,.]?\s+(?:kripya\s+)?yaad\s+rakhna\.?$/i,
      /(.+?)[,.]?\s+ye\s+yaad\s+rakhna\.?$/i,
      /(.+?)[,.]?\s+isko\s+memory\s+me(?:in)?\s+save\s+kar\s+lo\.?$/i,
      /(.+?)[,.]?\s+save\s+this(?:\s+in\s+memory)?\.?$/i,
      /(.+?)[,.]?\s+keep\s+this\s+in\s+memory\.?$/i,
    ];

    for (const pat of suffixPatterns) {
      const match = text.match(pat);
      if (match && match[1]) {
        const payload = match[1].trim();
        const extracted = this.extractFromStatement(payload, true);
        if (extracted) {
          return { type: 'SAVE', extractedMemory: extracted };
        }
      }
    }

    // Prefix patterns: e.g., "Remember that my favorite game is GTA", "Keep this in memory: ...", "Yaad rakhna: ..."
    const prefixPatterns = [
      /^(?:please\s+)?remember\s+that\s+(.+)/i,
      /^(?:please\s+)?remember(?:\s+this)?(?:\s*:)?\s+(.+)/i,
      /^(?:please\s+)?save\s+this(?:\s*:)?\s+(.+)/i,
      /^(?:please\s+)?keep\s+this\s+in\s+memory(?:\s*:)?\s+(.+)/i,
      /^(?:please\s+)?don['’]t\s+forget\s+(?:that\s+)?(.+)/i,
      /^(?:kripya\s+)?yaad\s+rakhna\s*(?:ki)?(?:\s*:)?\s+(.+)/i,
      /^(?:kripya\s+)?ye\s+yaad\s+rakhna\s*(?:ki)?(?:\s*:)?\s+(.+)/i,
      /^isko\s+memory\s+me(?:in)?\s+save\s+kar\s+lo(?:\s*:)?\s+(.+)/i,
      /^note\s+down\s+(?:that\s+)?(.+)/i,
    ];

    for (const pattern of prefixPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const payload = match[1].trim();
        const extracted = this.extractFromStatement(payload, true);
        if (extracted) {
          return { type: 'SAVE', extractedMemory: extracted };
        }
      }
    }

    // 5. Automatic extraction check from natural declarative statements ONLY
    // CRITICAL: Questions must NEVER trigger automatic memory save!
    if (!this.isQuestion(text)) {
      const autoExtracted = this.extractFromStatement(text, false);
      if (autoExtracted && autoExtracted.confidence >= this.AUTO_SAVE_THRESHOLD) {
        return { type: 'SAVE', extractedMemory: autoExtracted };
      }
    }

    // 6. Normal query / conversation
    return { type: 'NORMAL' };
  }

  /**
   * Extracts structured key/value from user statements.
   */
  public extractFromStatement(statement: string, isExplicit: boolean): ExtractedMemory | null {
    const raw = statement.trim();
    if (!raw || raw.length < 3) return null;

    // Guard: sensitive credentials
    for (const pat of this.SENSITIVE_PATTERNS) {
      if (pat.test(raw)) {
        console.warn('[MEMORY] Extraction blocked: sensitive credential pattern detected');
        return null;
      }
    }

    // Guard: questions are NOT declarative statements
    if (!isExplicit && this.isQuestion(raw)) {
      return null;
    }

    // Guard: System commands must NEVER be stored as conversational memories
    const isSystemCommand =
      /\b(mic|microphone|listening)\s+(on|off|mute|unmute|band|chalu|start|stop|disable|enable)\b/i.test(raw) ||
      /\b(ambient|background)\s+(audio|sound|music)\s+(on|off|band|chalu|mute|unmute)\b/i.test(raw) ||
      /\b(settings|memory\s+panel|audio\s+settings)\s+(kholo|open|band|close)\b/i.test(raw) ||
      /\b(ye|is|current)\s+voice\s+(save|default)\b/i.test(raw) ||
      /\b(voice)\s+(change|save|default|hindi|english|reset)\b/i.test(raw) ||
      /\b(calm|happy|neutral|friendly|excited)\s+(mode|emotion|ho jao|set)\b/i.test(raw) ||
      /\b(core)\s+(animation|intensity|mode)\b/i.test(raw);

    if (isSystemCommand) {
      return null;
    }

    // Guard: meaningless filler for non-explicit
    if (!isExplicit) {
      for (const pat of this.FILLER_PATTERNS) {
        if (pat.test(raw)) return null;
      }
    }

    // 1. User Name / Profile
    // "My name is Lucky", "Actually, call me Alex", "Call me Lucky", "Mera naam Lucky hai", "Mera naam Lucky"
    const nameMatch =
      raw.match(/(?:actually[,]?\s+)?(?:my\s+name\s+is|call\s+me|mera\s+naam\s+is|mera\s+naam\s+hai|mera\s+naam|i\s+am)\s+([a-zA-Z\u0900-\u097F]{2,25})\b/i);
    if (nameMatch && nameMatch[1]) {
      const candidateName = nameMatch[1].trim();
      const lowerCandidate = candidateName.toLowerCase();

      // Check against invalid words (e.g. 'building', 'working', 'playing', etc.)
      if (!this.INVALID_NAME_WORDS.has(lowerCandidate) || lowerCandidate === 'lucky') {
        return {
          category: 'PROFILE',
          key: 'name', // Canonical key is 'name'
          value: this.capitalizeWord(candidateName),
          importance: 'HIGH',
          confidence: isExplicit ? 0.99 : 0.95,
          source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
        };
      }
    }

    // 2. Favorite Entities (Game, Color, Food, Movie, Music, Sport, Book, Actor, etc.)
    // "My favorite game is GTA", "My favorite color is blue", "Actually, my favorite game is Minecraft now"
    const favEntityMatch =
      raw.match(/(?:actually[,]?\s+)?(?:my\s+)?fav(?:orite|ourite)?\s+(game|food|dish|movie|film|song|music|band|color|colour|book|sport|actor|singer)\s+(?:is(?:\s+now)?|hai)?\s*[:=\-]?\s*(.+)/i);
    if (favEntityMatch && favEntityMatch[1] && favEntityMatch[2]) {
      const entity = favEntityMatch[1]
        .toLowerCase()
        .replace('colour', 'color')
        .replace('film', 'movie')
        .replace('dish', 'food');
      const val = this.cleanValue(favEntityMatch[2]);
      if (val) {
        return {
          category: 'PREFERENCE',
          key: `favorite_${entity}`,
          value: val,
          importance: 'MEDIUM',
          confidence: isExplicit ? 0.98 : 0.92,
          source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
        };
      }
    }

    // "I like GTA", "I love playing GTA"
    const likeGameMatch = raw.match(/i\s+(?:really\s+)?(?:like|love|enjoy)\s+(?:playing\s+)?(gta(?:\s+v|\s+vi|\s+5|\s+6)?|minecraft|valorant|fortnite|pubg|bgmi|fifa|call of duty|cod|chess|cricket|football)\b/i);
    if (likeGameMatch && likeGameMatch[1]) {
      return {
        category: 'PREFERENCE',
        key: 'favorite_game',
        value: likeGameMatch[1].toUpperCase(),
        importance: 'MEDIUM',
        confidence: isExplicit ? 0.95 : 0.88,
        source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
      };
    }

    // 3. Current Project / Work / Building
    // "I am building SOMYA AI", "I am working on a Godot project", "I'm making an AI called SOMYA"
    const projectMatch =
      raw.match(/(?:i['’]m|i\s+am)\s+(?:building|working\s+on|creating|developing|making)(?:\s+(?:an?|the))?(?:\s+(?:ai|app|project|software)(?:\s+called)?)?\s+(.+)/i) ||
      raw.match(/(?:my\s+)?(?:current\s+)?project\s+is\s+(.+)/i);
    if (projectMatch && projectMatch[1]) {
      const projVal = this.cleanValue(projectMatch[1]);
      if (projVal) {
        return {
          category: 'PROJECT',
          key: 'current_project',
          value: projVal,
          importance: 'HIGH',
          confidence: isExplicit ? 0.98 : 0.92,
          source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
        };
      }
    }

    // 4. Language / User Setting Preference
    // "I prefer Hindi", "I prefer English responses", "Always speak in Hindi"
    const langMatch =
      raw.match(/(?:i\s+)?prefer\s+(english|hindi|hinglish)(?:\s+responses|\s+language)?/i) ||
      raw.match(/(?:always\s+(?:answer|reply|speak)\s+(?:me\s+)?in|speak\s+in)\s+(english|hindi|hinglish)/i);
    if (langMatch && langMatch[1]) {
      return {
        category: 'USER_SETTING',
        key: 'language_preference',
        value: this.capitalizeWord(langMatch[1]),
        importance: 'HIGH',
        confidence: isExplicit ? 0.98 : 0.95,
        source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
      };
    }

    // 5. Location / Living place (e.g. "I live in Mumbai", "I am from Delhi")
    const locMatch = raw.match(/(?:i\s+live\s+in|i\s+am\s+from|i['’]m\s+from|mera\s+shahar|mera\s+city)\s+(.+)/i);
    if (locMatch && locMatch[1]) {
      const locVal = this.cleanValue(locMatch[1]);
      if (locVal) {
        return {
          category: 'PROFILE',
          key: 'location',
          value: this.capitalizeWord(locVal),
          importance: 'MEDIUM',
          confidence: isExplicit ? 0.98 : 0.90,
          source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
        };
      }
    }

    // 6. Goals
    const goalMatch = raw.match(/(?:my\s+goal\s+is\s+to|i\s+want\s+to\s+become|aiming\s+to)\s+(.+)/i);
    if (goalMatch && goalMatch[1]) {
      const goalVal = this.cleanValue(goalMatch[1]);
      if (goalVal) {
        return {
          category: 'GOAL',
          key: 'primary_goal',
          value: goalVal,
          importance: 'HIGH',
          confidence: isExplicit ? 0.95 : 0.85,
          source: isExplicit ? 'EXPLICIT' : 'AUTOMATIC',
        };
      }
    }

    // 7. Generic explicit fallback when user specifically used "Remember that ... / Save this ..."
    if (isExplicit) {
      const cleanKey = this.generateKeyFromText(raw);
      return {
        category: this.guessCategoryFromContent(raw),
        key: cleanKey,
        value: raw,
        importance: 'MEDIUM',
        confidence: 0.95,
        source: 'EXPLICIT',
      };
    }

    return null;
  }

  public normalizeKeyFromPhrase(phrase: string): string {
    const p = phrase.toLowerCase().trim();
    if (p.includes('game') || p.includes('khel')) return 'favorite_game';
    if (p.includes('name') || p.includes('naam') || p.includes('call me')) return 'name';
    if (p.includes('project') || p.includes('work') || p.includes('kaam')) return 'current_project';
    if (p.includes('language') || p.includes('hinglish') || p.includes('hindi') || p.includes('english') || p.includes('bhasha')) return 'language_preference';
    if (p.includes('food') || p.includes('dish') || p.includes('khana')) return 'favorite_food';
    if (p.includes('color') || p.includes('colour') || p.includes('rang')) return 'favorite_color';
    if (p.includes('movie') || p.includes('film') || p.includes('cinema')) return 'favorite_movie';
    if (p.includes('music') || p.includes('song') || p.includes('gana')) return 'favorite_music';
    if (p.includes('sport') || p.includes('cricket') || p.includes('football')) return 'favorite_sport';
    if (p.includes('goal') || p.includes('aim') || p.includes('lakshya')) return 'primary_goal';
    if (p.includes('city') || p.includes('location') || p.includes('live')) return 'location';
    return p.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'general_fact';
  }

  private guessCategoryFromContent(text: string): MemoryCategory {
    const l = text.toLowerCase();
    if (l.includes('name') || l.includes('age') || l.includes('live') || l.includes('city')) return 'PROFILE';
    if (l.includes('game') || l.includes('like') || l.includes('love') || l.includes('prefer') || l.includes('favorite') || l.includes('color')) return 'PREFERENCE';
    if (l.includes('project') || l.includes('app') || l.includes('code') || l.includes('software')) return 'PROJECT';
    if (l.includes('goal') || l.includes('aim') || l.includes('target')) return 'GOAL';
    if (l.includes('habit') || l.includes('every day') || l.includes('daily') || l.includes('routine')) return 'HABIT';
    if (l.includes('always') || l.includes('setting') || l.includes('mode') || l.includes('style')) return 'USER_SETTING';
    return 'IMPORTANT_FACT';
  }

  private generateKeyFromText(text: string): string {
    return (
      text
        .toLowerCase()
        .replace(/^(my|i|we|the|that|to|a|an)\s+/gi, '')
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join('_') || 'custom_note'
    );
  }

  private cleanValue(val: string): string {
    let cleaned = val
      .replace(/[.!?,;\r\n]+$/, '')
      .replace(/^(is\s+|hai\s+|that\s+)/i, '')
      .replace(/\s+(now|bhi|hai)$/i, '')
      .trim();

    // If starts with "a " or "an " before a noun phrase (e.g. "a Godot project" -> "Godot project")
    if (/^an?\s+[a-z0-9]/i.test(cleaned)) {
      cleaned = cleaned.replace(/^an?\s+/i, '');
    }
    return cleaned.trim();
  }

  private capitalizeWord(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
}
