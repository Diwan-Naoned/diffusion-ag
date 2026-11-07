import { describe, expect, it } from 'vitest';
import { parseYoutubeId } from '../src/lib/youtube.ts';

describe('parseYoutubeId', () => {
  it('accepts ids and the usual URL forms', () => {
    for (const input of [
      'dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10',
      'youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ?si=abc',
      'https://www.youtube.com/live/dQw4w9WgXcQ?feature=share',
      'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
      '  dQw4w9WgXcQ  ',
    ]) {
      expect(parseYoutubeId(input), input).toBe('dQw4w9WgXcQ');
    }
  });

  it('returns null for empty and undefined for anything else', () => {
    expect(parseYoutubeId('  ')).toBeNull();
    expect(parseYoutubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBeUndefined();
    expect(parseYoutubeId('not an id')).toBeUndefined();
    expect(parseYoutubeId('https://www.youtube.com/@channel')).toBeUndefined();
  });
});
