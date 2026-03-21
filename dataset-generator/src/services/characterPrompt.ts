import { CharacterDefinition, OutputFieldDefinition } from '../types';

/**
 * Génère un system prompt structuré à partir d'une CharacterDefinition.
 */
export function generateSystemPromptFromCharacter(char: CharacterDefinition): string {
  const sections: string[] = [];

  // Identité
  sections.push(`Tu es ${char.name}, ${char.role} dans l'univers de ${char.universe}.`);

  if (char.backstory.trim()) {
    sections.push(`## Identité\n${char.backstory}`);
  }

  // Personnalité
  if (char.personalityAxes.length > 0) {
    const axes = char.personalityAxes
      .map(a => `- ${a.name}: ${a.value}/100`)
      .join('\n');
    sections.push(`## Personnalité\n${axes}`);
  }

  // Modes émotionnels
  if (char.emotionalModes.length > 0) {
    const modes = char.emotionalModes
      .map(m => `- ${m.name}${m.isDefault ? ' (défaut)' : ''}: ${m.description}`)
      .join('\n');
    sections.push(`## Modes émotionnels\n${modes}`);
  }

  // Déclencheurs
  if (char.triggers.length > 0) {
    const triggers = char.triggers
      .map(t => {
        const from = t.fromMode === '*' ? 'n\'importe quel mode' : `mode ${t.fromMode}`;
        return `- Quand ${t.condition}: passe de ${from} à mode ${t.toMode}`;
      })
      .join('\n');
    sections.push(`## Déclencheurs\n${triggers}`);
  }

  // Style de parole
  const style = char.speechStyle;
  const styleParts: string[] = [];
  if (style.register.trim()) {
    styleParts.push(`Registre: ${style.register}`);
  }
  if (style.recurringExpressions.length > 0) {
    styleParts.push(`Expressions récurrentes: "${style.recurringExpressions.join('", "')}"`);
  }
  if (style.verbalTics.length > 0) {
    styleParts.push(`Tics verbaux: "${style.verbalTics.join('", "')}"`);
  }
  if (style.languageNotes.trim()) {
    styleParts.push(`Notes: ${style.languageNotes}`);
  }
  if (styleParts.length > 0) {
    sections.push(`## Style de parole\n${styleParts.join('\n')}`);
  }

  // Contraintes
  if (char.constraints.length > 0) {
    const constraints = char.constraints
      .map(c => `- ${c.description}`)
      .join('\n');
    sections.push(`## Contraintes\n${constraints}`);
  }

  // Relations
  if (char.relationships.length > 0) {
    const rels = char.relationships
      .map(r => `- Face à ${r.interlocutorType}: ${r.attitude}`)
      .join('\n');
    sections.push(`## Relations\n${rels}`);
  }

  // Format de réponse — combine auto-derived tone + custom output fields
  const allFields = getAllOutputFields(char);
  sections.push(`## Format de réponse\nTu réponds TOUJOURS en JSON valide avec la structure suivante dans "output":\n${buildOutputFormatDescription(allFields)}`);

  return sections.join('\n\n');
}

/**
 * Retourne tous les output fields, incluant le champ "tone" auto-dérivé des modes émotionnels.
 */
export function getAllOutputFields(char: CharacterDefinition): OutputFieldDefinition[] {
  const fields: OutputFieldDefinition[] = [];

  // Auto-derive tone from emotional modes
  const modeNames = char.emotionalModes
    .map(m => m.name.trim())
    .filter(Boolean);

  if (modeNames.length > 0) {
    fields.push({
      name: 'tone',
      type: 'enum',
      enumValues: modeNames,
      description: 'Le ton émotionnel de la réponse',
      required: true,
    });
  }

  // Add user-defined output fields (excluding any manual "tone" to avoid duplicates)
  for (const f of char.outputFields) {
    if (f.name.toLowerCase() !== 'tone') {
      fields.push(f);
    }
  }

  return fields;
}

/**
 * Génère la description du format JSON attendu pour les output fields.
 */
export function buildOutputFormatDescription(fields: OutputFieldDefinition[]): string {
  return fields
    .map(f => {
      let desc = `- "${f.name}"`;
      if (f.required) desc += ' (obligatoire)';
      else desc += ' (optionnel)';

      if (f.type === 'enum' && f.enumValues && f.enumValues.length > 0) {
        desc += `: un parmi [${f.enumValues.join(', ')}]`;
      }
      if (f.description.trim()) {
        desc += ` — ${f.description}`;
      }
      return desc;
    })
    .join('\n');
}

/**
 * Valide qu'un output respecte le schéma défini par les outputFields.
 */
export function validateOutput(
  output: Record<string, string>,
  fields: OutputFieldDefinition[]
): boolean {
  if (!output || typeof output !== 'object') return false;

  for (const field of fields) {
    const value = output[field.name];

    if (field.required && (!value || typeof value !== 'string' || !value.trim())) {
      return false;
    }

    if (value && field.type === 'enum' && field.enumValues && field.enumValues.length > 0) {
      if (!field.enumValues.includes(value)) {
        return false;
      }
    }
  }

  return true;
}
