export interface DatasetEntry {
  id: number;
  context: string;
  instruction: string;
  input: string;
  output: {
    tone: 'sarcastic' | 'scheming' | 'annoyed' | 'amused' | 'furious' | 'calm';
    action: string;
    text: string;
  };
}

export interface GenerationConfig {
  systemPrompt: string;
  examples: string;
  count: number;
  startId: number;
  model: string;
  batchSize: number;
}

export interface OllamaModel {
  name: string;
}
