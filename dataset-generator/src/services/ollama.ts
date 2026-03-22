import { DatasetEntry, AffinageEntry, GenerationConfig, OutputFieldDefinition, CharacterDefinition } from '../types';
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
  character?: CharacterDefinition | null,
  signal?: AbortSignal
): Promise<{ score: number; comment: string }> {
  let characterContext = '';
  if (character) {
    const axes = character.personalityAxes.map(a => `${a.name}: ${a.value}/100`).join(', ');
    const modes = character.emotionalModes.map(m => m.name).join(', ');
    const constraints = character.constraints.map(c => c.description).join('; ');
    characterContext = `\n\nGrille d'évaluation basée sur la fiche personnage "${character.name}":
- Personnalité (${axes})
- Modes émotionnels attendus: ${modes}
- Contraintes: ${constraints}
- Rôle: ${character.role}
Vérifie que l'entrée respecte ces traits et contraintes.\n`;
  }

  const prompt = `${judgePrompt}${characterContext}

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
 * Améliore une prompt de juge existante via le LLM.
 */
export async function improveJudgePrompt(
  currentPrompt: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const prompt = `Voici une prompt d'évaluation pour un juge de répliques de personnage IA:

---
${currentPrompt}
---

Améliore cette prompt de juge. Tu peux:
- Rendre les critères plus précis et mesurables
- Ajouter des exemples de ce qui mérite un bon ou mauvais score
- Reformuler pour plus de clarté
- Renforcer la sévérité sur les points critiques

IMPORTANT: garde la même structure et les mêmes axes d'évaluation, tu les AMÉLIORES, tu ne les remplaces pas.

Réponds UNIQUEMENT en JSON valide:
{"prompt": "la prompt améliorée ici"}`;

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

/**
 * Génère des scénarios automatiquement à partir des triggers et relations du personnage.
 */
export async function generateScenarios(
  character: CharacterDefinition,
  model: string,
  count: number = 5,
  signal?: AbortSignal
): Promise<{ context: string; instruction: string; input: string }[]> {
  const triggersDesc = character.triggers
    .map(t => `- Quand "${t.condition}" → passe en mode ${t.toMode}`)
    .join('\n');

  const relationsDesc = character.relationships
    .map(r => `- Face à "${r.interlocutorType}": ${r.attitude}`)
    .join('\n');

  const modesDesc = character.emotionalModes
    .map(m => `- ${m.name}: ${m.description}`)
    .join('\n');

  const prompt = `Tu es un scénariste de dataset. Tu dois générer ${count} scénarios de conversation pour le personnage "${character.name}" (${character.role}, univers: ${character.universe}).

Voici ses modes émotionnels:
${modesDesc}

Voici ses déclencheurs de changement de ton:
${triggersDesc}

Voici ses relations types:
${relationsDesc}

Génère ${count} scénarios variés qui exploitent ces déclencheurs et relations. Chaque scénario doit provoquer une réaction intéressante du personnage.

Réponds UNIQUEMENT en JSON valide:
{"data": [{"context": "description de la situation", "instruction": "ce que le personnage doit faire", "input": "ce que l'utilisateur dit"}, ...]}`;

  const response = await fetch(OLLAMA_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      format: 'json',
      options: { temperature: 0.9, num_ctx: 4096 }
    }),
    signal
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const content = data.message?.content;
  if (!content) throw new Error('Empty response');

  const parsed = safeJsonParse(content);
  const arr = Array.isArray(parsed?.data) ? parsed.data : (Array.isArray(parsed) ? parsed : []);

  return arr
    .filter((s: any) => s.context && s.instruction && s.input)
    .map((s: any) => ({ context: String(s.context), instruction: String(s.instruction), input: String(s.input) }));
}

/**
 * Génère une fiche de personnage complète à partir de l'identité.
 * Si le personnage est connu (fiction, mythologie...), colle au matériau source.
 * Si inventé, se base sur le rôle et la backstory.
 */
export async function generateCharacterSheet(
  identity: { name: string; universe: string; role: string; backstory: string },
  model: string,
  signal?: AbortSignal
): Promise<Partial<CharacterDefinition>> {
  const prompt = `Tu es un expert en création de personnages de fiction pour des datasets de dialogue.
À partir de l'identité suivante, génère une fiche de personnage complète et détaillée.

Nom: ${identity.name}
Univers: ${identity.universe}
Rôle: ${identity.role}
Backstory: ${identity.backstory}

IMPORTANT:
- Si ce personnage est un personnage CONNU de fiction (film, livre, jeu, mythologie, série...), base ta fiche sur le matériau source original. Sois fidèle au personnage tel qu'il est connu.
- Si c'est un personnage INVENTÉ, base-toi uniquement sur le rôle et la backstory fournis pour créer une fiche cohérente et intéressante.

Réponds UNIQUEMENT en JSON valide avec cette structure exacte:
{
  "personalityAxes": [{"name": "NomDuTrait", "value": 0}],
  "emotionalModes": [{"name": "nom_du_mode", "description": "description du mode", "isDefault": false}],
  "triggers": [{"condition": "quand ceci arrive", "fromMode": "*", "toMode": "nom_du_mode"}],
  "speechStyle": {
    "register": "description du registre de langue",
    "languageNotes": "notes sur le style de langage, expressions typiques, tics verbaux, etc."
  },
  "constraints": [{"description": "règle absolue du personnage"}],
  "relationships": [{"interlocutorType": "type d'interlocuteur", "attitude": "attitude adoptée"}]
}

Règles:
- personalityAxes: 5 à 7 traits, valeurs entre 0 et 100
- emotionalModes: 4 à 6 modes, exactement UN avec isDefault: true (le mode par défaut)
- triggers: 2 à 4 déclencheurs de changement de mode
- constraints: 2 à 4 contraintes comportementales absolues
- relationships: 2 à 4 types de relations
- Les noms de modes doivent être en minuscules, courts (1 mot)`;

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

      // Validate and normalize personalityAxes
      const personalityAxes = (Array.isArray(parsed.personalityAxes) ? parsed.personalityAxes : [])
        .filter((a: any) => a.name && typeof a.value === 'number')
        .map((a: any) => ({ name: String(a.name), value: Math.max(0, Math.min(100, Math.round(Number(a.value)))) }));

      // Validate and normalize emotionalModes
      const emotionalModes = (Array.isArray(parsed.emotionalModes) ? parsed.emotionalModes : [])
        .filter((m: any) => m.name && m.description)
        .map((m: any) => ({ name: String(m.name).toLowerCase(), description: String(m.description), isDefault: Boolean(m.isDefault) }));

      // Ensure exactly one default
      const hasDefault = emotionalModes.some((m: any) => m.isDefault);
      if (!hasDefault && emotionalModes.length > 0) {
        emotionalModes[0].isDefault = true;
      }

      // Validate triggers
      const triggers = (Array.isArray(parsed.triggers) ? parsed.triggers : [])
        .filter((t: any) => t.condition && t.toMode)
        .map((t: any) => ({ condition: String(t.condition), fromMode: String(t.fromMode || '*'), toMode: String(t.toMode).toLowerCase() }));

      // Validate speechStyle
      const raw = parsed.speechStyle || {};
      const speechStyle = {
        register: String(raw.register || ''),
        languageNotes: String(raw.languageNotes || ''),
      };

      // Validate constraints
      const constraints = (Array.isArray(parsed.constraints) ? parsed.constraints : [])
        .filter((c: any) => c.description)
        .map((c: any) => ({ description: String(c.description) }));

      // Validate relationships
      const relationships = (Array.isArray(parsed.relationships) ? parsed.relationships : [])
        .filter((r: any) => r.interlocutorType && r.attitude)
        .map((r: any) => ({ interlocutorType: String(r.interlocutorType), attitude: String(r.attitude) }));

      if (personalityAxes.length === 0 && emotionalModes.length === 0) {
        throw new Error('Fiche générée vide — aucun trait ni mode émotionnel');
      }

      return { personalityAxes, emotionalModes, triggers, speechStyle, constraints, relationships };
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt === 1) {
        throw new Error(`Échec génération fiche après 2 tentatives: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
