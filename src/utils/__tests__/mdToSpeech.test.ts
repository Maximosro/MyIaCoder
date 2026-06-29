import { describe, it, expect } from 'vitest';
import { mdToSpeech } from '../mdToSpeech';

describe('mdToSpeech', () => {
  it('flattens headings, bold and italics to plain words', () => {
    const out = mdToSpeech('# Título\n\nTexto **fuerte** y *suave*.');
    expect(out).toBe('Título Texto fuerte y suave.');
  });

  it('reads link text but not the URL', () => {
    expect(mdToSpeech('Ver [la guía](https://example.com).')).toBe('Ver la guía.');
  });

  it('drops fenced code and mermaid blocks', () => {
    const md = 'Antes.\n\n```js\nconst x = 1;\n```\n\n```mermaid\ngraph TD; A-->B;\n```\n\nDespués.';
    const out = mdToSpeech(md);
    expect(out).toBe('Antes. Después.');
  });

  it('drops inline code', () => {
    expect(mdToSpeech('Usa `npm run dev` ya.')).toBe('Usa ya.');
  });

  it('decodes entities and flattens list markers', () => {
    const out = mdToSpeech('- uno & dos\n- 5 < 10');
    expect(out).toBe('uno & dos 5 < 10');
  });
});
