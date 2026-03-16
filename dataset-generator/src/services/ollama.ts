import { DatasetEntry, AffinageEntry, GenerationConfig } from '../types';

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

  const prompt = `Voici des exemples d'entrées existantes:

${config.examples}

Génère EXACTEMENT ${batchSize} nouvelles entrées originales.

Tu DOIS répondre avec un objet JSON contenant une clé "data" qui est un tableau de ${batchSize} objets.

Format EXACT de ta réponse:
{"data": [{"context": "...", "instruction": "...", "input": "...", "output": {"tone": "...", "action": "...", "text": "..."}}, ...${batchSize > 2 ? ` (${batchSize} objets au total)` : ''}]}

Règles:
- Chaque entrée a: context, instruction, input, output (tone, action, text)
- tone parmi: sarcastic, scheming, annoyed, amused, furious, calm
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
          id: startId + i,
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

/**
 * Tente de parser du JSON en nettoyant les artefacts courants des LLM.
 */
function safeJsonParse(raw: string): any {
  let str = raw.trim();

  // Retirer les blocs markdown
  const codeMatch = str.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeMatch) str = codeMatch[1].trim();

  // Retirer les balises <think>...</think> (qwen, etc.)
  str = str.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  // Trouver le premier { et le dernier }
  const start = str.indexOf('{');
  const end = str.lastIndexOf('}');
  if (start !== -1 && end > start) {
    str = str.substring(start, end + 1);
  }

  return JSON.parse(str);
}

/**
 * Fait évaluer une entrée par un LLM juge.
 * Retourne un score (1-10) et un commentaire court.
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
 * Régénère une entrée en utilisant un modèle et une prompt,
 * en se basant sur l'entrée existante comme contexte.
 */
export async function regenerateEntry(
  entry: AffinageEntry,
  model: string,
  userPrompt: string,
  useJudgeComment: boolean,
  signal?: AbortSignal
): Promise<DatasetEntry> {
  const judgeContext = useJudgeComment && entry.judgeComment
    ? `\n\nRetour du juge sur cette entrée:\n"${entry.judgeComment}"\nTiens compte de ces remarques dans ta régénération.`
    : '';

  const prompt = `${userPrompt}

Voici l'entrée existante à utiliser comme base de référence:
${JSON.stringify({ context: entry.context, instruction: entry.instruction, input: entry.input, output: entry.output }, null, 2)}${judgeContext}

Génère une nouvelle version améliorée de cette entrée. Garde le même esprit mais améliore la qualité.
Réponds UNIQUEMENT en JSON valide, sans aucun autre texte.

Format EXACT:
{"context": "...", "instruction": "...", "input": "...", "output": {"tone": "sarcastic|scheming|annoyed|amused|furious|calm", "action": "...", "text": "..."}}`;

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

      if (!parsed.context || !parsed.instruction || !parsed.input || !parsed.output?.tone || !parsed.output?.action || !parsed.output?.text) {
        throw new Error('Réponse incomplète du modèle');
      }

      return {
        id: entry.id,
        context: parsed.context,
        instruction: parsed.instruction,
        input: parsed.input,
        output: {
          tone: parsed.output.tone,
          action: parsed.output.action,
          text: parsed.output.text
        }
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
 * Génère automatiquement une prompt de juge à partir du system prompt,
 * en utilisant le modèle sélectionné.
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
