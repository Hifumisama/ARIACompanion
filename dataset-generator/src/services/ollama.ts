import { DatasetEntry, AffinageEntry, GenerationConfig, OutputFieldDefinition } from '../types';
import { buildOutputFormatDescription, validateOutput } from './characterPrompt';

const OLLAMA_API = 'http://localhost:11434/api/chat';

/**
 * Construit l'exemple de format JSON pour le prompt de génération.
 */
function buildOutputExample(fields: OutputFieldDefinition[]): string {
  const parts = fields.map(f => {
    if (f.type === 'enum' && f.enumValues?.length) {
      return `"${f.name}": "${f.enumValues.join('|')}"`;
    }
    return `"${f.name}": "..."`;
  });
  return `{${parts.join(', ')}}`;
}

/**
 * Génère un batch de N entrées en une seule requête Ollama.
 */
export async function generateBatch(
  config: GenerationConfig,
  startId: number,
  batchSize: number,
  outputFields: OutputFieldDefinition[],
  signal?: AbortSignal
): Promise<{ entries: DatasetEntry[]; duration: number }> {
  const startTime = Date.now();

  const outputDesc = buildOutputFormatDescription(outputFields);
  const outputExample = buildOutputExample(outputFields);

  // Sérialiser les exemples (sans les IDs)
  const examplesBlock = config.examples.length > 0
    ? `Voici des exemples d'entrées existantes:\n\n${JSON.stringify(
        config.examples.map(({ id, ...rest }) => rest),
        null, 2
      )}\n\nInspire-toi de ces exemples pour le style et la qualité, mais génère des situations DIFFÉRENTES.\n\n`
    : '';

  const prompt = `${examplesBlock}Génère EXACTEMENT ${batchSize} nouvelles entrées originales.

Tu DOIS répondre avec un objet JSON contenant une clé "data" qui est un tableau de ${batchSize} objets.

Format EXACT de ta réponse:
{"data": [{"context": "...", "instruction": "...", "input": "...", "output": ${outputExample}}, ...${batchSize > 2 ? ` (${batchSize} objets au total)` : ''}]}

Champs de "output":
${outputDesc}

Règles:
- Chaque entrée a: context, instruction, input, output
- Varie les contextes, les tons et les situations
- Ne génère PAS de champ "id", il sera attribué automatiquement`;

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
          format: 'json',
          options: {
            seed: Math.floor(Math.random() * 1000000),
            temperature: 0.8,
            num_ctx: 4096
          }
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

      let rawEntries: any[];
      if (Array.isArray(parsed?.data)) {
        rawEntries = parsed.data;
      } else if (Array.isArray(parsed)) {
        rawEntries = parsed;
      } else if (parsed?.context) {
        rawEntries = [parsed];
      } else {
        throw new Error('Format inattendu: ni {data:[...]}, ni array, ni objet unique');
      }

      // Valider et normaliser avec le schéma dynamique
      const validEntries: DatasetEntry[] = rawEntries
        .filter((e: any) =>
          e.context &&
          e.instruction &&
          e.input &&
          e.output &&
          typeof e.output === 'object' &&
          validateOutput(e.output, outputFields)
        )
        .map((e: any, i: number) => {
          const output: Record<string, string> = {};
          for (const field of outputFields) {
            if (e.output[field.name] !== undefined) {
              output[field.name] = String(e.output[field.name]);
            }
          }
          return {
            id: startId + i,
            context: e.context,
            instruction: e.instruction,
            input: e.input,
            output,
          };
        });

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

/**
 * Tente de parser du JSON en nettoyant les artefacts courants des LLM.
 */
function safeJsonParse(raw: string): any {
  let str = raw.trim();

  const codeMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) str = codeMatch[1].trim();

  str = str.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start !== -1 && end > start) {
    str = str.substring(start, end + 1);
  }

  return JSON.parse(str);
}

/**
 * Fait évaluer une entrée par un LLM juge.
 */
export async function judgeEntry(
  entry: AffinageEntry,
  judgeModel: string,
  judgePrompt: string,
  signal?: AbortSignal
): Promise<{ score: number; comment: string }> {
  const prompt = `${judgePrompt}

Voici l'entrée à évaluer:
${JSON.stringify({ context: entry.context, instruction: entry.instruction, input: entry.input, output: entry.output }, null, 2)}

Evalue cette entrée et réponds UNIQUEMENT en JSON valide, sans aucun autre texte.
Le commentaire doit faire 2 lignes maximum et indiquer ce qu'il faudrait changer.

Format EXACT:
{"score": 7, "comment": "Ligne 1. Ligne 2."}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(OLLAMA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: judgeModel,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: {
            seed: Math.floor(Math.random() * 1000000),
            temperature: 0.8,
            num_ctx: 4096
          }
        }),
        signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content = data.message?.content;
      if (!content) throw new Error('Empty response from judge');

      const parsed = safeJsonParse(content);
      const score = Math.max(1, Math.min(10, Math.round(Number(parsed.score) || 5)));
      const comment = String(parsed.comment || parsed.explanation || 'Pas de commentaire');

      return { score, comment };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 1) {
        throw new Error(
          `Échec évaluation après 2 tentatives: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  throw new Error('Unexpected error');
}

/**
 * Régénère une entrée en utilisant un schéma de sortie dynamique.
 */
export async function regenerateEntry(
  entry: AffinageEntry,
  model: string,
  userPrompt: string,
  useJudgeComment: boolean,
  outputFields: OutputFieldDefinition[],
  signal?: AbortSignal
): Promise<DatasetEntry> {
  const judgeContext = useJudgeComment && entry.judgeComment
    ? `\n\nRetour du juge sur cette entrée:\n"${entry.judgeComment}"\nTiens compte de ces remarques dans ta régénération.`
    : '';

  const outputDesc = buildOutputFormatDescription(outputFields);
  const outputExample = buildOutputExample(outputFields);

  const prompt = `${userPrompt}

Voici l'entrée existante à utiliser comme base de référence:
${JSON.stringify({ context: entry.context, instruction: entry.instruction, input: entry.input, output: entry.output }, null, 2)}${judgeContext}

Génère une nouvelle version améliorée de cette entrée. Garde le même esprit mais améliore la qualité.
Réponds UNIQUEMENT en JSON valide, sans aucun autre texte.

Champs de "output":
${outputDesc}

Format EXACT:
{"context": "...", "instruction": "...", "input": "...", "output": ${outputExample}}`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(OLLAMA_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          stream: false,
          format: 'json',
          options: {
            seed: Math.floor(Math.random() * 1000000),
            temperature: 0.8,
            num_ctx: 4096
          }
        }),
        signal
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content = data.message?.content;
      if (!content) throw new Error('Empty response');

      const parsed = safeJsonParse(content);

      if (!parsed.context || !parsed.instruction || !parsed.input || !parsed.output) {
        throw new Error('Réponse incomplète du modèle');
      }

      if (!validateOutput(parsed.output, outputFields)) {
        throw new Error('Output ne respecte pas le schéma défini');
      }

      const output: Record<string, string> = {};
      for (const field of outputFields) {
        if (parsed.output[field.name] !== undefined) {
          output[field.name] = String(parsed.output[field.name]);
        }
      }

      return {
        id: entry.id,
        context: parsed.context,
        instruction: parsed.instruction,
        input: parsed.input,
        output,
      };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 1) {
        throw new Error(
          `Échec régénération après 2 tentatives: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  throw new Error('Unexpected error');
}

/**
 * Génère automatiquement une prompt de juge.
 */
export async function generateJudgePrompt(
  systemPrompt: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const prompt = `Voici un system prompt utilisé pour générer des entrées de dataset d'entraînement pour un personnage IA:

${systemPrompt}

À partir de ce system prompt, génère une prompt d'évaluation pour un "juge LLM" qui devra noter la qualité des entrées générées.
Le juge doit évaluer: la cohérence avec le personnage, la qualité du dialogue, la variété des tons, et le respect des contraintes.

Réponds UNIQUEMENT en JSON valide:
{"prompt": "ta prompt de juge ici"}`;

  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.7,
        num_ctx: 4096
      }
    }),
    signal
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error('Empty response');

  const parsed = safeJsonParse(content);
  return String(parsed.prompt || parsed.judge_prompt || content);
}

/**
 * Chat en streaming avec un personnage via Ollama.
 * Lit le flux NDJSON et appelle onToken pour chaque chunk de texte.
 */
export async function chatWithCharacter(
  systemPrompt: string,
  messages: { role: string; content: string }[],
  model: string,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      options: {
        temperature: 0.8,
        num_ctx: 4096
      }
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Parse NDJSON lines
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const chunk = JSON.parse(trimmed);
        if (chunk.message?.content) {
          fullText += chunk.message.content;
          onToken(chunk.message.content);
        }
      } catch {
        // Skip malformed lines
      }
    }
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const chunk = JSON.parse(buffer.trim());
      if (chunk.message?.content) {
        fullText += chunk.message.content;
        onToken(chunk.message.content);
      }
    } catch {
      // Skip
    }
  }

  return fullText;
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
