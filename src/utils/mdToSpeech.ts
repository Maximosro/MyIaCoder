import { marked } from 'marked';

/**
 * Flattens Markdown into plain, readable text for text-to-speech (Flujo 3).
 *
 * Reuses `marked` (already a dependency for the MD preview) to turn the document
 * into HTML, then strips tags and decodes the few entities marked emits. Code
 * fences and inline code (incl. mermaid blocks) are dropped first so the reader
 * doesn't spell out source. Whitespace is collapsed so prosody isn't broken by
 * the markdown line breaks.
 */

// ponytail: marked only escapes these five entities in text; map them, anything
// else (rare) collapses to a space. A full HTML-entity table would be overkill.
const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

export function mdToSpeech(md: string): string {
  const noCode = md
    .replace(/```[\s\S]*?```/g, ' ') // fenced code / mermaid
    .replace(/~~~[\s\S]*?~~~/g, ' ') // alt fenced code
    .replace(/`[^`\n]*`/g, ' '); // inline code

  const html = marked.parse(noCode, { async: false }) as string;

  return html
    .replace(/<[^>]+>/g, ' ') // strip tags
    .replace(/&#?\w+;/g, (m) => ENTITIES[m] ?? ' ') // decode known entities
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?…)])/g, '$1') // no space before punctuation (inline tag artifact)
    .trim();
}
