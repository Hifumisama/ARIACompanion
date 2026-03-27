import { CharacterDefinition } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

export async function loadAllCharacters(): Promise<CharacterDefinition[]> {
  try {
    const response = await fetch(`${API_URL}/api/characters`);
    if (!response.ok) return [];
    return await response.json();
  } catch {
    return [];
  }
}

export async function saveCharacter(char: CharacterDefinition): Promise<void> {
  const updated = { ...char, updatedAt: Date.now() };

  // Try PUT first (update), if 404 then POST (create)
  const putResponse = await fetch(`${API_URL}/api/characters/${char.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated),
  });

  if (putResponse.status === 404) {
    await fetch(`${API_URL}/api/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    });
  }
}

export async function deleteCharacter(id: string): Promise<void> {
  await fetch(`${API_URL}/api/characters/${id}`, { method: 'DELETE' });
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
