// Authoritative DateTime Service for SOMYA AI Server
// Guarantees real system runtime date and time with Asia/Kolkata timezone

export interface DateTimeInfo {
  iso: string;
  timestamp: number;
  timezone: string;
  dayOfWeek: string;
  dayHindi: string;
  dayHinglish: string;
  dayNumber: number;
  monthName: string;
  monthHindi: string;
  year: number;
  dateFormatted: string;
  dateFormattedHindi: string;
  time12: string;
  time24: string;
  timeWithSeconds: string;
  fullFormatted: string;
}

export type DateTimeQueryType = 'DATE_ONLY' | 'DAY_ONLY' | 'TIME_ONLY' | 'DATETIME_BOTH';

const HINDI_DAYS: Record<string, { devanagari: string; hinglish: string }> = {
  Sunday: { devanagari: 'रविवार', hinglish: 'Ravivar' },
  Monday: { devanagari: 'सोमवार', hinglish: 'Somvar' },
  Tuesday: { devanagari: 'मंगलवार', hinglish: 'Mangalwar' },
  Wednesday: { devanagari: 'बुधवार', hinglish: 'Budhwar' },
  Thursday: { devanagari: 'गुरुवार', hinglish: 'Guruwar' },
  Friday: { devanagari: 'शुक्रवार', hinglish: 'Shukrawar' },
  Saturday: { devanagari: 'शनिवार', hinglish: 'Shanivar' },
};

const HINDI_MONTHS: Record<string, string> = {
  January: 'जनवरी',
  February: 'फ़रवरी',
  March: 'मार्च',
  April: 'अप्रैल',
  May: 'मई',
  June: 'जून',
  July: 'जुलाई',
  August: 'अगस्त',
  September: 'सितंबर',
  October: 'अक्टूबर',
  November: 'नवंबर',
  December: 'दिसंबर',
};

/**
 * Returns the authoritative live date & time dynamically from runtime clock.
 * Defaults to 'Asia/Kolkata' for Indian Standard Time (IST).
 * NEVER hard-codes dates; recalculates on every invocation.
 */
export function getLiveDateTime(timezone: string = 'Asia/Kolkata'): DateTimeInfo {
  const now = new Date();

  let activeTz = timezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: activeTz });
  } catch {
    activeTz = 'Asia/Kolkata';
  }

  const dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: activeTz, weekday: 'long' });
  const dayNumFmt = new Intl.DateTimeFormat('en-US', { timeZone: activeTz, day: 'numeric' });
  const monthFmt = new Intl.DateTimeFormat('en-US', { timeZone: activeTz, month: 'long' });
  const yearFmt = new Intl.DateTimeFormat('en-US', { timeZone: activeTz, year: 'numeric' });

  const time12Fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: activeTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const timeSecFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: activeTz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const time24Fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: activeTz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const dayOfWeek = dayFmt.format(now);
  const dayNumber = parseInt(dayNumFmt.format(now), 10);
  const monthName = monthFmt.format(now);
  const year = parseInt(yearFmt.format(now), 10);
  const time12 = time12Fmt.format(now);
  const timeWithSeconds = timeSecFmt.format(now);
  const time24 = time24Fmt.format(now);

  const dayInfo = HINDI_DAYS[dayOfWeek] || { devanagari: dayOfWeek, hinglish: dayOfWeek };
  const monthHindi = HINDI_MONTHS[monthName] || monthName;

  return {
    iso: now.toISOString(),
    timestamp: now.getTime(),
    timezone: activeTz,
    dayOfWeek,
    dayHindi: dayInfo.devanagari,
    dayHinglish: dayInfo.hinglish,
    dayNumber,
    monthName,
    monthHindi,
    year,
    dateFormatted: `${dayNumber} ${monthName} ${year}`,
    dateFormattedHindi: `${dayNumber} ${monthHindi} ${year}`,
    time12,
    time24,
    timeWithSeconds,
    fullFormatted: `${dayOfWeek}, ${dayNumber} ${monthName} ${year}, ${time12} (IST)`,
  };
}

/**
 * Natural language detector for date and time requests in English, Hindi, and Hinglish.
 */
export function detectDateTimeQuery(text: string): DateTimeQueryType | null {
  if (!text || typeof text !== 'string') return null;

  const raw = text.trim().toLowerCase();
  const clean = raw.replace(/['"`?!,.:;\-_/\\()[\]{}]/g, ' ').replace(/\s+/g, ' ').trim();

  // Check for combined Date & Time questions
  const hasDateWord =
    clean.includes('date') ||
    clean.includes('tareekh') ||
    clean.includes('tarikh') ||
    clean.includes('tariq');

  const hasDayWord =
    clean.includes('din') ||
    clean.includes('day') ||
    clean.includes('vaar') ||
    clean.includes('war');

  const hasTimeWord =
    clean.includes('time') ||
    clean.includes('samay') ||
    clean.includes('waqt') ||
    clean.includes('baje') ||
    clean.includes('baj rahe');

  if ((hasDateWord || hasDayWord) && hasTimeWord) {
    if (
      clean.includes('kya') ||
      clean.includes('what') ||
      clean.includes('batao') ||
      clean.includes('tell') ||
      clean.includes('current') ||
      clean.includes('aaj') ||
      clean.includes('today')
    ) {
      return 'DATETIME_BOTH';
    }
  }

  // Date queries (Date / Tareekh / Tarikh)
  const datePatterns = [
    /\b(today|aaj)\s+(ki\s+|kya\s+|konsi\s+|kaun\s*si\s+)?(date|tareekh|tarikh|tariq)\b/,
    /\bwhat\s+(is\s+)?today\s*s?\s+date\b/,
    /\bwhat\s*s\s+today\s*s?\s+date\b/,
    /\bwhat\s+date\s+is\s+it\b/,
    /\bwhat\s+is\s+the\s+date\b/,
    /\bdate\s+kya\s+hai\b/,
    /\btareekh\s+kya\s+hai\b/,
    /\btarikh\s+kya\s+hai\b/,
    /\baaj\s+ki\s+tareekh\b/,
    /\baaj\s+ki\s+date\b/,
    /\baaj\s+ki\s+tarikh\b/,
    /\btell\s+me\s+today\s*s?\s+date\b/,
    /\bcurrent\s+date\b/,
    /\btoday\s+date\b/,
    /\btareekh\s+batao\b/,
    /\bdate\s+batao\b/,
    /\btarikh\s+batao\b/,
    /\baaj\s+kya\s+date\s+hai\b/,
    /\baaj\s+konsi\s+date\s+hai\b/,
    /\baaj\s+konsi\s+tarikh\s+hai\b/,
    /\baaj\s+konsi\s+tareekh\s+hai\b/,
    /\baaj\s+kaun\s*si\s+date\s+hai\b/,
    /\baaj\s+kaun\s*si\s+tareekh\s+hai\b/,
    /\baaj\s+kaun\s*si\s+tarikh\s+hai\b/,
    /\bwhat\s+is\s+the\s+date\s+today\b/,
    /\bwhat\s*s\s+the\s+date\s+today\b/,
    /\bwhat\s*s\s+the\s+date\b/,
    /आज\s*की\s*तारीख/,
    /आज\s*क्या\s*तारीख\s*है/,
    /आज\s*कौन\s*सी\s*तारीख\s*है/,
  ];

  for (const p of datePatterns) {
    if (p.test(clean)) return 'DATE_ONLY';
  }

  // Day queries (Day / Din / Vaar)
  const dayPatterns = [
    /\b(aaj\s+(kaun\s*sa|konsa|kya)\s+(din|day|vaar|war))\b/,
    /\bwhat\s+day\s+is\s+today\b/,
    /\bwhat\s+day\s+is\s+it(\s+today)?\b/,
    /\bwhich\s+day\s+is\s+today\b/,
    /\btoday\s+is\s+which\s+day\b/,
    /\bwhat\s*s\s+the\s+day\s+today\b/,
    /\bwhat\s*s\s+the\s+day\b/,
    /\baaj\s+ka\s+din\s+kya\s+hai\b/,
    /\baaj\s+ka\s+din\b/,
    /\baaj\s+kya\s+din\s+hai\b/,
    /\baaj\s+kya\s+day\s+hai\b/,
    /\bday\s+kya\s+hai\b/,
    /\bdin\s+kya\s+hai\b/,
    /\bdin\s+batao\b/,
    /\baaj\s+kaun\s*sa\s+vaar\s+hai\b/,
    /\baaj\s+konsa\s+vaar\s+hai\b/,
    /आज\s*कौन\s*सा\s*दिन\s*है/,
    /आज\s*क्या\s*दिन\s*है/,
  ];

  for (const p of dayPatterns) {
    if (p.test(clean)) return 'DAY_ONLY';
  }

  // Time queries (Time / Samay / Waqt / Baje)
  const timePatterns = [
    /\bwhat\s+time\s+is\s+it\b/,
    /\bwhat\s*s?\s+(is\s+)?the\s+current\s+time\b/,
    /\bwhat\s*s?\s+the\s+time\b/,
    /\bcurrent\s+time\b/,
    /\btime\s+right\s+now\b/,
    /\btell\s+me\s+the\s+time\b/,
    /\btime\s+kya\s+hua\s+hai\b/,
    /\btime\s+kya\s+hai\b/,
    /\btime\s+kya\s+ho\s+raha\s+hai\b/,
    /\babhi\s+kitne\s+baje\s+hain\b/,
    /\bkitne\s+baje\s+hain\b/,
    /\bkitne\s+baj\s+rahe\s+hain\b/,
    /\babhi\s+kya\s+time\s+hua\s+hai\b/,
    /\babhi\s+ka\s+time\b/,
    /\bsamay\s+kya\s+hua\s+hai\b/,
    /\bwaqt\s+kya\s+hua\s+hai\b/,
    /\bsamay\s+batao\b/,
    /\bwaqt\s+batao\b/,
    /\bkya\s+time\s+hua\s+hai\b/,
    /\bkya\s+time\s+hai\b/,
    /\btime\s+batao\b/,
    /अभी\s*कितने\s*बजे\s*हैं/,
    /क्या\s*समय\s*हुआ\s*है/,
    /समय\s*क्या\s*है/,
  ];

  for (const p of timePatterns) {
    if (p.test(clean)) return 'TIME_ONLY';
  }

  return null;
}

/**
 * Generates natural conversational response for date/time queries
 */
export function generateDateTimeReply(
  type: DateTimeQueryType,
  dt: DateTimeInfo,
  languageMode: string = 'AUTO',
  userQuery: string = ''
): { reply: string; language: string; emotion: string } {
  const queryLower = userQuery.toLowerCase();

  const isDevanagari = /[\u0900-\u097F]/.test(userQuery);
  const isExplicitEnglish =
    languageMode === 'ENGLISH' ||
    (languageMode === 'AUTO' &&
      !isDevanagari &&
      (queryLower.includes('what') || queryLower.includes('tell me') || queryLower.includes('current')));
  const isExplicitHindi = languageMode === 'HINDI' || isDevanagari;

  // 1. ENGLISH
  if (isExplicitEnglish && !isDevanagari) {
    switch (type) {
      case 'DATE_ONLY':
        return {
          reply: `Today's date is ${dt.dateFormatted}.`,
          language: 'English',
          emotion: 'NEUTRAL',
        };
      case 'DAY_ONLY':
        return {
          reply: `Today is ${dt.dayOfWeek}.`,
          language: 'English',
          emotion: 'NEUTRAL',
        };
      case 'TIME_ONLY':
        return {
          reply: `The current time is ${dt.time12} (IST).`,
          language: 'English',
          emotion: 'NEUTRAL',
        };
      case 'DATETIME_BOTH':
        return {
          reply: `Today is ${dt.dayOfWeek}, ${dt.dateFormatted}, and the current time is ${dt.time12} (IST).`,
          language: 'English',
          emotion: 'NEUTRAL',
        };
    }
  }

  // 2. HINDI (DEVANAGARI)
  if (isExplicitHindi) {
    switch (type) {
      case 'DATE_ONLY':
        return {
          reply: `आज की तारीख ${dt.dateFormattedHindi} है।`,
          language: 'Hindi',
          emotion: 'NEUTRAL',
        };
      case 'DAY_ONLY':
        return {
          reply: `आज ${dt.dayHindi} (${dt.dayOfWeek}) है।`,
          language: 'Hindi',
          emotion: 'NEUTRAL',
        };
      case 'TIME_ONLY':
        return {
          reply: `अभी का समय ${dt.time12} (IST) है।`,
          language: 'Hindi',
          emotion: 'NEUTRAL',
        };
      case 'DATETIME_BOTH':
        return {
          reply: `आज ${dt.dayHindi}, ${dt.dateFormattedHindi} है, और अभी समय ${dt.time12} (IST) हुआ है।`,
          language: 'Hindi',
          emotion: 'NEUTRAL',
        };
    }
  }

  // 3. HINGLISH (DEFAULT)
  switch (type) {
    case 'DATE_ONLY':
      return {
        reply: `Aaj ki date ${dt.dateFormatted} hai.`,
        language: 'Hinglish',
        emotion: 'NEUTRAL',
      };
    case 'DAY_ONLY':
      return {
        reply: `Aaj ${dt.dayOfWeek} (${dt.dayHinglish}) hai.`,
        language: 'Hinglish',
        emotion: 'NEUTRAL',
      };
    case 'TIME_ONLY':
      return {
        reply: `Abhi ${dt.time12} (IST) ho rahe hain.`,
        language: 'Hinglish',
        emotion: 'NEUTRAL',
      };
    case 'DATETIME_BOTH':
      return {
        reply: `Aaj ${dt.dayOfWeek}, ${dt.dateFormatted} hai, aur abhi time ${dt.time12} (IST) hai.`,
        language: 'Hinglish',
        emotion: 'NEUTRAL',
      };
  }
}
