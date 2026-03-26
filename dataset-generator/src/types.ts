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

// ── Training ──

export interface ModelInfo {
  id: string;
  name: string;
  size: string;
  vram_gb: number;
  gpu_minimum: string;
  description: string;
}

export interface HyperparamDef {
  value: number;
  min: number;
  max: number;
  tooltip: string;
}

export interface TrainingConfig {
  dataset_path: string;
  base_model: string;
  output_name: string;
  dataset_format: string;
  lora_r: number;
  lora_alpha: number;
  learning_rate: number;
  num_epochs: number;
  micro_batch_size: number;
  gradient_accumulation_steps: number;
  sequence_len: number;
  warmup_steps: number;
  weight_decay: number;
  quantization: string;
}

export interface TrainingProgress {
  status: 'waiting' | 'starting' | 'loading' | 'converting' | 'training' | 'exporting' | 'done' | 'error' | 'stopped';
  current_step?: number;
  total_steps?: number;
  current_epoch?: number;
  total_epochs?: number;
  loss?: number | null;
  learning_rate?: number | null;
  elapsed_seconds?: number;
  eta_seconds?: number;
  error?: string | null;
  message?: string | null;
  details?: string | null;
  output_dir?: string;
}

export interface QuantizationOption {
  id: string;
  name: string;
  description: string;
}

export interface DownloadFile {
  name: string;
  path: string;
  size_mb: number;
}

export interface HealthStatus {
  status: string;
  gpu: string;
  vram_total_mb: number;
}
