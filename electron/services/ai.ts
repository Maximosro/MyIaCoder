import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { net } from 'electron';
import { loadSettings } from './settings';

/**
 * AI curator for dictated prompts (Flujo 2, MVP).
 *
 * Takes raw dictated text and rewrites it into the fixed "New feature" RPI
 * template, cleaning filler words, spelling and punctuation WITHOUT inventing
 * content. Uses Groq's OpenAI-compatible chat/completions endpoint.
 *
 * MVP shortcuts (ponytail): provider/model/template are hardcoded. Make them
 * settings when a second provider or template is actually needed.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
// Fixed blueprint template, portable across machines via the user home dir.
const TEMPLATE_PATH = path.join(os.homedir(), '.copilot', 'blueprints', 'New-feature.md');

function buildSystemPrompt(template: string): string {
  return [
    'Eres un curador de prompts dictados por voz en español.',
    'Tu tarea: reescribir el dictado en bruto encajándolo en la PLANTILLA dada.',
    'Reglas estrictas:',
    '- Limpia muletillas, repeticiones y titubeos; corrige ortografía y puntuación.',
    '- Estructura el contenido en las secciones de la plantilla.',
    '- NO inventes información que no esté en el dictado. Si una sección no tiene',
    '  contenido dictado, déjala con un breve marcador o vacía; no la rellenes a la fuerza.',
    '- Mantén las cabeceras de la plantilla tal cual (los "# TÍTULO").',
    '- Responde SOLO con el markdown final, sin explicaciones ni comentarios.',
    '',
    'PLANTILLA:',
    template,
  ].join('\n');
}

/** Rewrites raw dictation into the New-feature template via Groq. */
export async function curate(text: string): Promise<string> {
  const key = loadSettings().groqApiKey?.trim();
  if (!key) {
    throw new Error('Falta la API key de Groq. Configúrala en Ajustes → IA.');
  }
  if (!text.trim()) {
    throw new Error('No hay texto que curar.');
  }

  let template = '';
  try {
    template = readFileSync(TEMPLATE_PATH, 'utf-8');
  } catch {
    throw new Error(`No se encontró la plantilla en ${TEMPLATE_PATH}`);
  }

  // ponytail: Electron's net.fetch uses Chromium's network stack, so it trusts
  // the Windows cert store (incl. corporate proxy CAs) and honors system proxies
  // — Node's global fetch does not, and fails with SELF_SIGNED_CERT_IN_CHAIN
  // behind a TLS-intercepting proxy.
  const res = await net.fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      messages: [
        { role: 'system', content: buildSystemPrompt(template) },
        { role: 'user', content: `DICTADO EN BRUTO:\n${text}` },
      ],
    }),
  });

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Groq respondió HTTP ${res.status}`);
  }
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}
