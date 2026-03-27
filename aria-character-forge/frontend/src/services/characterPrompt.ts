import { CharacterDefinition, OutputFieldDefinition } from '../types';

/**
 * Génère un system prompt structuré à partir d'une CharacterDefinition.
 */
export function generateSystemPromptFromCharacter(char: CharacterDefinition): string {
  const sections: string[] = [];

  // Identité
  sections.push(`Tu es ${char.name}, ${char.role} dans l'univers de ${char.universe}. Tu t'exprimes en ${char.language || 'Francais'}.`);

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
 * Construit la prompt de juge par défaut à partir de la fiche personnage.
 * Critères dérivés automatiquement des axes, modes, contraintes, relations et style.
 */
export function buildDefaultJudgePrompt(char: CharacterDefinition): string {
  const sections: string[] = [];

  sections.push(`Tu es un juge sévère mais juste. Tu évalues des répliques écrites pour le personnage "${char.name}" (${char.role}, univers: ${char.universe}).`);

  sections.push(`Chaque entrée contient: context, instruction, input, et un output JSON structuré. Tu dois noter sur 10 points.`);

  // Critères depuis les axes de personnalité
  if (char.personalityAxes.length > 0) {
    const axesCriteria = char.personalityAxes
      .map(a => {
        if (a.value >= 75) return `- Le personnage doit être fortement ${a.name.toLowerCase()} (${a.value}/100). Une réplique trop douce sur cet axe doit être pénalisée.`;
        if (a.value <= 25) return `- Le personnage a un faible niveau de ${a.name.toLowerCase()} (${a.value}/100). Une réplique trop marquée sur cet axe est incohérente.`;
        return `- ${a.name}: niveau modéré (${a.value}/100). La réplique doit refléter ce dosage.`;
      })
      .join('\n');
    sections.push(`## Critères de personnalité\n${axesCriteria}`);
  }

  // Critères depuis les modes émotionnels
  if (char.emotionalModes.length > 0) {
    const modeNames = char.emotionalModes.map(m => m.name).join(', ');
    const defaultMode = char.emotionalModes.find(m => m.isDefault);
    let modesCriteria = `- Le ton de la réplique doit correspondre à un des modes définis: ${modeNames}.`;
    if (defaultMode) {
      modesCriteria += `\n- En l'absence de déclencheur particulier, le mode par défaut est "${defaultMode.name}" (${defaultMode.description}).`;
    }
    sections.push(`## Critères de ton\n${modesCriteria}`);
  }

  // Critères depuis les contraintes
  if (char.constraints.length > 0) {
    const constraintsCriteria = char.constraints
      .map(c => `- CONTRAINTE ABSOLUE: ${c.description}. Toute violation = -3 points.`)
      .join('\n');
    sections.push(`## Contraintes à respecter\n${constraintsCriteria}`);
  }

  // Critères depuis les relations
  if (char.relationships.length > 0) {
    const relCriteria = char.relationships
      .map(r => `- Si l'interlocuteur est de type "${r.interlocutorType}": l'attitude doit être "${r.attitude}".`)
      .join('\n');
    sections.push(`## Critères relationnels\n${relCriteria}`);
  }

  // Critères depuis le style vocal
  const style = char.speechStyle;
  const styleCriteria: string[] = [];
  if (style.register.trim()) {
    styleCriteria.push(`- Le registre doit être: ${style.register}.`);
  }
  if (style.languageNotes.trim()) {
    styleCriteria.push(`- Style attendu: ${style.languageNotes}.`);
  }
  if (styleCriteria.length > 0) {
    sections.push(`## Critères de style vocal\n${styleCriteria.join('\n')}`);
  }

  // Critères depuis la structure output
  const allFields = getAllOutputFields(char);
  if (allFields.length > 0) {
    const structCriteria = allFields
      .map(f => {
        let line = `- Le champ "${f.name}" doit être présent`;
        if (f.required) line += ' (obligatoire)';
        if (f.type === 'enum' && f.enumValues?.length) {
          line += ` et contenir une valeur parmi: [${f.enumValues.join(', ')}]`;
        }
        return line + '.';
      })
      .join('\n');
    sections.push(`## Structure de l'output\n${structCriteria}`);
  }

  // Barème
  sections.push(`## Barème
- 9-10: Réplique parfaite, fidèle au personnage, ton juste, style impeccable, contraintes respectées.
- 7-8: Bonne réplique, quelques détails à affiner.
- 5-6: Correcte mais manque de personnalité ou incohérence mineure.
- 3-4: Problèmes notables: ton inadapté, contrainte violée, ou style hors-personnage.
- 1-2: Réplique complètement hors-sujet ou incohérente avec le personnage.`);

  return sections.join('\n\n');
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
