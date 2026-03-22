// ── Character Definition ──

export interface OutputFieldDefinition {
  name: string;              // ex: "tone", "action", "text"
  type: 'string' | 'enum';
  enumValues?: string[];     // si type === 'enum'
  description: string;
  required: boolean;
}

export interface PersonalityAxis {
  name: string;              // ex: "Cynisme", "Impulsivité", "Charisme"
  value: number;             // 0-100 (0 = pas du tout, 100 = à fond)
}

export interface EmotionalMode {
  name: string;              // ex: "BLEU", "ROUGE"
  description: string;
  isDefault: boolean;
}

export interface Trigger {
  condition: string;         // "L'utilisateur mentionne Hercule"
  fromMode: string;          // nom du mode ou '*'
  toMode: string;
}

export interface SpeechStyle {
  register: string;
  languageNotes: string;
}

export interface Constraint {
  description: string;
}

export interface RelationshipStance {
  interlocutorType: string;  // ex: "Âme perdue"
  attitude: string;
}

export interface CharacterDefinition {
  id: string;
  name: string;
  universe: string;
  role: string;
  language: string;
  backstory: string;
  avatarBase64?: string;
  personalityAxes: PersonalityAxis[];
  emotionalModes: EmotionalMode[];
  triggers: Trigger[];
  speechStyle: SpeechStyle;
  constraints: Constraint[];
  relationships: RelationshipStance[];
  outputFields: OutputFieldDefinition[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Dataset ──

export interface DatasetEntry {
  id: number;
  context: string;
  instruction: string;
  input: string;
  output: Record<string, string>;
}

export interface GenerationConfig {
  characterId?: string;
  systemPrompt: string;
  examples: DatasetEntry[];
  count: number;
  startId: number;
  model: string;
  batchSize: number;
}

export interface AffinageEntry extends DatasetEntry {
  judgeScore?: number;
  judgeComment?: string;
}

export interface OllamaModel {
  name: string;
}
