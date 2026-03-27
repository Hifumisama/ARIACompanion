/**
 * Conversion locale des datasets ARIA vers les formats d'entraînement.
 * Miroir de convert.py côté Python, exécuté dans le navigateur.
 */

import type { DatasetEntry } from '../types';

// ── Types ──

export type ConversionFormat = 'chatml' | 'alpaca' | 'sharegpt';

export interface ConvertedEntry {
  [key: string]: unknown;
}

export const FORMAT_LABELS: Record<ConversionFormat, string> = {
  chatml: 'ChatML',
  alpaca: 'Alpaca',
  sharegpt: 'ShareGPT',
};

export const FORMAT_DESCRIPTIONS: Record<ConversionFormat, string> = {
  chatml: 'Format messages role/content — natif llama.cpp, recommande pour Axolotl',
  alpaca: 'Format instruction/input/output — simple et classique',
  sharegpt: 'Format conversations from/value — compatible ShareGPT',
};

// ── Helpers ──

function formatUserMessage(entry: DatasetEntry): string {
  const parts: string[] = [];
  if (entry.context) parts.push(`[Contexte : ${entry.context}]`);
  if (entry.instruction) parts.push(entry.instruction);
  if (entry.input) parts.push(entry.input);
  return parts.join('\n');
}

function formatAssistantMessage(entry: DatasetEntry): string {
  return JSON.stringify(entry.output ?? {});
}

// ── Converters ──

function convertToChatML(entries: DatasetEntry[], systemPrompt: string): ConvertedEntry[] {
  return entries.map((entry) => ({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: formatUserMessage(entry) },
      { role: 'assistant', content: formatAssistantMessage(entry) },
    ],
  }));
}

function convertToAlpaca(entries: DatasetEntry[], systemPrompt: string): ConvertedEntry[] {
  return entries.map((entry) => {
    const parts = [systemPrompt];
    if (entry.context) parts.push(`[Contexte : ${entry.context}]`);
    if (entry.instruction) parts.push(entry.instruction);

    return {
      instruction: parts.join('\n'),
      input: entry.input ?? '',
      output: formatAssistantMessage(entry),
    };
  });
}

function convertToShareGPT(entries: DatasetEntry[], systemPrompt: string): ConvertedEntry[] {
  return entries.map((entry) => ({
    conversations: [
      { from: 'system', value: systemPrompt },
      { from: 'human', value: formatUserMessage(entry) },
      { from: 'gpt', value: formatAssistantMessage(entry) },
    ],
  }));
}

const CONVERTERS: Record<ConversionFormat, (entries: DatasetEntry[], systemPrompt: string) => ConvertedEntry[]> = {
  chatml: convertToChatML,
  alpaca: convertToAlpaca,
  sharegpt: convertToShareGPT,
};

// ── Public API ──

/**
 * Convertit un dataset ARIA dans le format d'entraînement choisi.
 */
export function convertDataset(
  entries: DatasetEntry[],
  systemPrompt: string,
  format: ConversionFormat,
): ConvertedEntry[] {
  const converter = CONVERTERS[format];
  if (!converter) {
    throw new Error(`Format inconnu : ${format}. Formats supportes : ${Object.keys(CONVERTERS).join(', ')}`);
  }
  return converter(entries, systemPrompt);
}

/**
 * Sérialise un dataset converti en JSONL (une ligne JSON par entrée).
 */
export function toJsonl(converted: ConvertedEntry[]): string {
  return converted.map((entry) => JSON.stringify(entry)).join('\n');
}

/**
 * Télécharge le JSONL en tant que fichier dans le navigateur.
 */
export function downloadJsonl(converted: ConvertedEntry[], filename: string): void {
  const blob = new Blob([toJsonl(converted)], { type: 'application/jsonl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
