import { MemoryRecord } from './types';

export class MemoryContextBuilder {
  /**
   * Builds background context for Gemini using only relevant memories.
   */
  public buildContext(memories: MemoryRecord[]): string {
    if (!memories || memories.length === 0) {
      return '';
    }

    const lines: string[] = ['[VERIFIED PERSISTENT MEMORIES FROM DATABASE]'];

    for (const mem of memories) {
      const formattedKey = this.formatKey(mem.key);
      lines.push(`• ${formattedKey}: "${mem.value}" (${mem.category})`);
    }

    lines.push(
      '\nMEMORY DIRECTIVES FOR SOMYA:',
      '1. The facts above are REAL persistent long-term memories retrieved from the user database.',
      '2. If the user asks about their identity or name (e.g., "What is my name?", "Who am I?", "Mera naam kya hai?"), use the stored User Name above directly and warmly.',
      '3. If the user asks about their preferences, projects, or favorites, use the stored facts above.',
      '4. NEVER claim you do not know the user\'s name or information if it is present in the stored memories above.',
      '5. Speak naturally and seamlessly like a personal companion (e.g., "Aapka naam Lucky hai" or "Your name is Lucky").',
      '6. Never mention database internals, tables, keys, IDs, or SQLite to the user.'
    );

    return lines.join('\n');
  }

  private formatKey(key: string): string {
    return key
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
