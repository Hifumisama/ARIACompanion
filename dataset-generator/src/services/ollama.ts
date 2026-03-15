import { DatasetEntry, GenerationConfig } from '../types';

const OLLAMA_API = 'http://localhost:11434/api/chat';

/**
 * Génère un batch de N entrées en une seule requête Ollama.
 * On contourne la contrainte format:"json" (objet racine uniquement)
 * en demandant { "data": [ ...entries ] } puis on extrait .data
 */
export async function generateBatch(
  config: GenerationConfig,
  startId: number,
  batchSize: number,
  signal?: AbortSignal
): Promise<{ entries: DatasetEntry[]; duration: number }> {
  const startTime = Date.now();

  const ids = Array.from({ length: batchSize }, (_, i) => startId + i);

  const prompt = `Voici des exemples d'entrées existantes:

${config.examples}

Génère EXACTEMENT ${batchSize} nouvelles entrées originales avec les IDs: ${ids.join(', ')}.

Tu DOIS répondre avec un objet JSON contenant une clé "data" qui est un tableau de ${batchSize} objets.

Format EXACT de ta réponse:
{"data": [{"id": ${ids[0]}, "context": "...", "instruction": "...", "input": "...", "output": {"tone": "...", "action": "...", "text": "..."}}, {"id": ${ids.length > 1 ? ids[1] : ids[0]}, ...}, ...${batchSize > 2 ? ` (${batchSize} objets au total)` : ''}]}

Règles:
- Chaque entrée a: id, context, instruction, input, output (tone, action, text)
- tone parmi: sarcastic, scheming, annoyed, amused, furious, calm
- Varie les contextes, les tons et les situations
- Les IDs doivent être exactement: ${ids.join(', ')}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(OLLAMA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: prompt }
          ],
          stream: false,
          format: 'json'
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const content = data.message?.content;

      if (!content) {
        throw new Error('Empty response');
      }

      let jsonStr = content.trim();
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }

      const parsed = JSON.parse(jsonStr);

      // Extraire le tableau: soit .data, soit directement un array, soit l'objet seul
      let rawEntries: any[];
      if (Array.isArray(parsed?.data)) {
        rawEntries = parsed.data;
      } else if (Array.isArray(parsed)) {
        rawEntries = parsed;
      } else if (parsed?.id !== undefined) {
        // Le modèle a quand même renvoyé un seul objet
        rawEntries = [parsed];
      } else {
        throw new Error('Format inattendu: ni {data:[...]}, ni array, ni objet unique');
      }

      // Valider et normaliser
      const validEntries: DatasetEntry[] = rawEntries
        .filter((e: any) =>
          e.context &&
          e.instruction &&
          e.input &&
          e.output?.tone &&
          e.output?.action &&
          e.output?.text
        )
        .map((e: any, i: number) => ({
          id: ids[i] ?? e.id ?? startId + i,
          context: e.context,
          instruction: e.instruction,
          input: e.input,
          output: {
            tone: e.output.tone,
            action: e.output.action,
            text: e.output.text
          }
        }));

      if (validEntries.length === 0) {
        throw new Error(`Aucune entrée valide. Réponse: ${content.substring(0, 300)}`);
      }

      return {
        entries: validEntries,
        duration: Date.now() - startTime
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 1) {
        throw new Error(
          `Échec après 2 tentatives: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  throw new Error('Unexpected error');
}

export async function fetchAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    if (!response.ok) throw new Error('Failed to fetch models');
    const data = await response.json();
    return (data.models || [])
      .map((m: { name: string }) => m.name)
      .sort() as string[];
  } catch (error) {
    console.error('Error fetching models:', error);
    return [];
  }
}
