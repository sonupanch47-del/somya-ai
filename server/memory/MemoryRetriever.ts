import { MemoryRecord } from './types';

export class MemoryRetriever {
  private readonly STOP_WORDS = new Set([
    'what', 'is', 'my', 'the', 'a', 'an', 'do', 'you', 'know', 'tell', 'me', 'about',
    'mera', 'meri', 'mere', 'kya', 'hai', 'h', 'tha', 'thi', 'the', 'batao', 'kaun',
    'sa', 'si', 'are', 'was', 'i', 'like', 'in', 'of', 'for', 'to', 'and', 'or',
    'tumhe', 'aapko', 'mujhe', 'hum', 'it', 'its', 'at', 'on', 'by', 'as', 'if', 'so',
    'no', 'up', 'out', 'all', 'any', 'can', 'will', 'this', 'that', 'there', 'here',
    'with', 'from', 'be', 'has', 'have', 'had', 'been', 'would', 'could', 'should',
    'favorite', 'favourite', 'fav', 'prefer', 'preference', 'preferences', 'preferred',
    'current', 'best', 'top', 'general', 'note', 'facts', 'fact', 'user', 'something'
  ]);

  /**
   * Retrieves and ranks the most relevant memories for a user query.
   * Does NOT dump unrelated memories if the query is topic-specific.
   */
  public retrieveRelevant(query: string, allActiveMemories: MemoryRecord[], maxResults = 5): MemoryRecord[] {
    if (!allActiveMemories || allActiveMemories.length === 0) {
      return [];
    }

    const lowerQuery = query.toLowerCase().trim();

    // 1. General query check: "What do you remember about me?", "Show my memories", "Do you remember what I told you?"
    const isGeneralMemoryQuery =
      lowerQuery.includes('what do you remember about me') ||
      lowerQuery.includes('what do you remember') ||
      lowerQuery.includes('show my memories') ||
      lowerQuery.includes('show memories') ||
      lowerQuery.includes('list my memories') ||
      lowerQuery.includes('list memories') ||
      lowerQuery.includes('what do you know about me') ||
      lowerQuery.includes('what do you know') ||
      lowerQuery.includes('do you remember what i told you') ||
      lowerQuery.includes('tell me what you know about me') ||
      lowerQuery.includes('tell me what you know') ||
      lowerQuery.includes('mere baare me kya janti') ||
      lowerQuery.includes('mere baare mein kya janti') ||
      lowerQuery.includes('mere baare me kya pata') ||
      lowerQuery.includes('mere baare mein kya pata') ||
      lowerQuery.includes('tumhe mere baare mein kya') ||
      lowerQuery.includes('tumhe mere baare me kya') ||
      lowerQuery.includes('all memories') ||
      lowerQuery.includes('everything you remember') ||
      lowerQuery.includes('kya yaad hai') ||
      lowerQuery === 'my memories' ||
      query.includes('क्या याद है') ||
      query.includes('सब कुछ बताओ जो याद है');

    if (isGeneralMemoryQuery) {
      return [...allActiveMemories]
        .sort(
          (a, b) =>
            this.getImportanceWeight(b.importance) - this.getImportanceWeight(a.importance) ||
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )
        .slice(0, maxResults);
    }

    // 2. Direct Name / Identity Query
    const isNameQuery =
      lowerQuery.includes('my name') ||
      lowerQuery.includes('what is my name') ||
      lowerQuery.includes('what was my name') ||
      lowerQuery.includes('whats my name') ||
      lowerQuery.includes("what's my name") ||
      lowerQuery.includes('who am i') ||
      lowerQuery.includes('who i am') ||
      lowerQuery.includes('mera naam') ||
      lowerQuery.includes('mera name') ||
      lowerQuery.includes('call me') ||
      lowerQuery.includes('should you call me') ||
      lowerQuery.includes('remember my name') ||
      lowerQuery.includes('remember what i told you my name was') ||
      lowerQuery.includes('told you my name') ||
      lowerQuery.includes('my identity') ||
      lowerQuery.includes('mera kya naam') ||
      lowerQuery.includes('naam kya hai') ||
      lowerQuery.includes('naam batao') ||
      lowerQuery.includes('naam yaad hai') ||
      lowerQuery.includes('tum mujhe kis naam se') ||
      lowerQuery.includes('tum mujhe kya bulaogi') ||
      query.includes('नाम') ||
      query.includes('मेरा नाम') ||
      query.includes('नाम क्या है');

    // 3. Extract query keywords preserving alphanumeric and Devanagari Unicode characters
    const words = lowerQuery
      .replace(/[^a-z0-9\s\u0900-\u097F]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !this.STOP_WORDS.has(w));

    // 4. Score each memory based on relevance
    const scored = allActiveMemories.map((mem) => {
      const score = this.calculateRelevance(mem, lowerQuery, words, isNameQuery, query);
      return { mem, score };
    });

    // 5. Filter only those with genuine relevance (score >= 25)
    const relevant = scored
      .filter((item) => item.score >= 25)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.mem);

    if (relevant.length > 0) {
      console.log(`[MEMORY] Memory retrieved: ${relevant.length} relevant record(s) found for query`);
      return relevant.slice(0, maxResults);
    }

    console.log('[MEMORY] No relevant memory found for current query');
    return [];
  }

  private calculateRelevance(
    mem: MemoryRecord,
    lowerQuery: string,
    queryWords: string[],
    isNameQuery: boolean,
    rawQuery: string
  ): number {
    let score = 0;
    const lowerKey = mem.key.toLowerCase();
    const lowerVal = mem.value.toLowerCase();
    const lowerContent = mem.content.toLowerCase();
    const keyParts = lowerKey.split('_');

    // 1. DIRECT NAME / IDENTITY INTENT
    if (isNameQuery) {
      if (
        lowerKey === 'user_name' ||
        lowerKey === 'name' ||
        lowerKey.includes('name') ||
        mem.category === 'PROFILE'
      ) {
        score += 150;
      }
    }

    // 2. DIRECT PROJECT INTENT
    const isProjectQuery =
      lowerQuery.includes('my project') ||
      lowerQuery.includes('current project') ||
      lowerQuery.includes('what project') ||
      lowerQuery.includes('what am i building') ||
      lowerQuery.includes('what am i working on') ||
      lowerQuery.includes('working on') ||
      lowerQuery.includes('mera project') ||
      lowerQuery.includes('kis project par') ||
      rawQuery.includes('प्रोजेक्ट');

    if (isProjectQuery && (lowerKey.includes('project') || mem.category === 'PROJECT')) {
      score += 120;
    }

    // 3. DIRECT TOPIC INTENTS (Game, Food, Movie, Music, Sport, Goal, Language)
    const isGameQuery =
      lowerQuery.includes('game') || lowerQuery.includes('khel') || rawQuery.includes('खेल') || lowerQuery.includes('play');
    if (isGameQuery && (lowerKey.includes('game') || lowerContent.includes('game'))) {
      score += 100;
    }

    const isFoodQuery =
      lowerQuery.includes('food') || lowerQuery.includes('dish') || lowerQuery.includes('khana') || rawQuery.includes('खाना');
    if (isFoodQuery && (lowerKey.includes('food') || lowerContent.includes('food'))) {
      score += 100;
    }

    const isMovieQuery =
      lowerQuery.includes('movie') || lowerQuery.includes('film') || lowerQuery.includes('cinema');
    if (isMovieQuery && (lowerKey.includes('movie') || lowerContent.includes('movie'))) {
      score += 100;
    }

    const isMusicQuery =
      lowerQuery.includes('music') || lowerQuery.includes('song') || lowerQuery.includes('gana') || rawQuery.includes('गाना');
    if (isMusicQuery && (lowerKey.includes('music') || lowerKey.includes('song') || lowerContent.includes('music'))) {
      score += 100;
    }

    const isSportQuery =
      lowerQuery.includes('sport') || lowerQuery.includes('cricket') || lowerQuery.includes('football');
    if (isSportQuery && (lowerKey.includes('sport') || lowerContent.includes('sport'))) {
      score += 100;
    }

    const isGoalQuery =
      lowerQuery.includes('goal') || lowerQuery.includes('aim') || lowerQuery.includes('lakshya') || rawQuery.includes('लक्ष्य');
    if (isGoalQuery && (lowerKey.includes('goal') || mem.category === 'GOAL')) {
      score += 100;
    }

    const isLanguageQuery =
      lowerQuery.includes('language') || lowerQuery.includes('hinglish') || lowerQuery.includes('hindi') || lowerQuery.includes('english') || rawQuery.includes('भाषा');
    if (isLanguageQuery && (lowerKey.includes('language') || mem.category === 'USER_SETTING')) {
      score += 100;
    }

    const isColorQuery =
      lowerQuery.includes('color') || lowerQuery.includes('colour') || lowerQuery.includes('rang') || rawQuery.includes('रंग');
    if (isColorQuery && (lowerKey.includes('color') || lowerContent.includes('color'))) {
      score += 100;
    }

    const isLocationQuery =
      lowerQuery.includes('where do i live') ||
      lowerQuery.includes('my city') ||
      lowerQuery.includes('my location') ||
      lowerQuery.includes('mera shahar') ||
      lowerQuery.includes('kahan rehta hoon') ||
      lowerQuery.includes('kahan rehti hoon');
    if (isLocationQuery && (lowerKey.includes('location') || lowerKey.includes('city'))) {
      score += 100;
    }

    // 4. Exact whole-word key fragment in query (e.g. query has word "game" and key is "favorite_game")
    for (const part of keyParts) {
      if (part.length >= 3 && !this.STOP_WORDS.has(part)) {
        const regex = new RegExp(`\\b${part}\\b`, 'i');
        if (regex.test(lowerQuery)) {
          score += 35;
        }
      }
    }

    // 5. Query asks for value directly as whole word (e.g., "GTA", "Lucky", "Cricket")
    if (lowerVal.length >= 3) {
      const cleanVal = lowerVal.replace(/[^a-z0-9\s]/gi, ' ').trim();
      const valWords = cleanVal.split(/\s+/).filter((w) => w.length >= 3 && !this.STOP_WORDS.has(w));
      for (const vw of valWords) {
        const regex = new RegExp(`\\b${vw}\\b`, 'i');
        if (regex.test(lowerQuery)) {
          score += 40;
        }
      }
    }

    // 6. Distinct keyword overlap (using whole words, no partial substring collisions)
    const keyWordSet = new Set(lowerKey.split('_').filter((w) => w.length >= 3 && !this.STOP_WORDS.has(w)));
    const valWordSet = new Set(
      lowerVal
        .replace(/[^a-z0-9\s\u0900-\u097F]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !this.STOP_WORDS.has(w))
    );

    for (const word of queryWords) {
      if (keyWordSet.has(word)) score += 30;
      if (valWordSet.has(word)) score += 35;
    }

    // 7. Devanagari Hindi keyword mapping
    if (rawQuery.includes('नाम') && (lowerKey.includes('name') || mem.category === 'PROFILE')) {
      score += 120;
    }
    if (rawQuery.includes('खेल') && lowerKey.includes('game')) {
      score += 90;
    }
    if (rawQuery.includes('पसंद') && (lowerKey.includes('favorite') || mem.category === 'PREFERENCE')) {
      score += 50;
    }

    // If there is any genuine topical match, factor in importance, confidence, recency, and access frequency
    if (score > 0) {
      score += this.getImportanceWeight(mem.importance);
      score += (mem.confidence || 1.0) * 10;
      score += Math.min(10, (mem.access_count || 0) * 2);

      // Recency bonus if updated in last 7 days
      const updatedTime = new Date(mem.updated_at).getTime();
      const ageHours = (Date.now() - updatedTime) / (1000 * 60 * 60);
      if (ageHours < 24) score += 10;
      else if (ageHours < 168) score += 5;
    }

    return score;
  }

  private getImportanceWeight(importance: string): number {
    switch (importance) {
      case 'CRITICAL':
        return 20;
      case 'HIGH':
        return 12;
      case 'MEDIUM':
        return 6;
      case 'LOW':
      default:
        return 2;
    }
  }
}
