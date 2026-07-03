import { ChunkingService } from './chunking.service';

describe('ChunkingService', () => {
  let service: ChunkingService;

  beforeEach(() => {
    service = new ChunkingService();
  });

  it('should split short text into a single chunk with offsets', () => {
    const text = 'hello plain text world';
    const result = service.splitText(text, 250, 50);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe(text);
    expect(result[0].startOffset).toBe(0);
    expect(result[0].endOffset).toBe(text.length);
    expect(result[0].tokenCount).toBeGreaterThan(0);
    expect(result[0].characterCount).toBe(text.length);
  });

  it('should split long text into multiple overlapping chunks', () => {
    const baseSentence =
      'EnterpriseIQ is a secure and scalable AI search engine. ';
    const text = baseSentence.repeat(50);

    const result = service.splitText(text, 100, 20);

    expect(result.length).toBeGreaterThan(1);
    for (let i = 0; i < result.length; i++) {
      const chunk = result[i];
      expect(chunk.tokenCount).toBeLessThanOrEqual(100);
      expect(chunk.characterCount).toBe(chunk.content.length);
      expect(chunk.endOffset - chunk.startOffset).toBe(chunk.content.length);

      if (i > 0) {
        expect(chunk.startOffset).toBeLessThan(result[i - 1].endOffset);
      }
    }
  });

  it('should prioritize splitting at double newlines (paragraphs)', () => {
    const p1 =
      'First paragraph content that is relatively long and descriptive.';
    const p2 = 'Second paragraph content that also goes here.';
    const text = `${p1}\n\n${p2}`;

    // Use 0 overlap to verify exact boundary splits
    const result = service.splitText(text, 20, 0);

    expect(result.length).toBe(2);
    expect(result[0].content).toBe(p1);
    expect(result[1].content).toBe(p2);
  });
});
