import { CharacterDefinition } from '../types';

const STORAGE_KEY = 'aria_characters';

export function loadAllCharacters(): CharacterDefinition[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CharacterDefinition[];
  } catch {
    return [];
  }
}

export function saveCharacter(char: CharacterDefinition): void {
  const all = loadAllCharacters();
  const idx = all.findIndex(c => c.id === char.id);
  const updated = { ...char, updatedAt: Date.now() };
  if (idx >= 0) {
    all[idx] = updated;
  } else {
    all.push(updated);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function deleteCharacter(id: string): void {
  const all = loadAllCharacters().filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export function exportCharacterToJson(char: CharacterDefinition): void {
  const blob = new Blob([JSON.stringify(char, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `character_${char.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importCharacterFromJson(file: File): Promise<CharacterDefinition> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const char = JSON.parse(reader.result as string) as CharacterDefinition;
        if (!char.id || !char.name || !char.outputFields) {
          reject(new Error('Fichier personnage invalide : champs requis manquants (id, name, outputFields)'));
          return;
        }
        resolve(char);
      } catch {
        reject(new Error('Fichier JSON invalide'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier'));
    reader.readAsText(file);
  });
}
