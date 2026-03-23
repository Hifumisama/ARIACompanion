export const LANGUAGES = [
  'Francais', 'English', 'Espanol', 'Deutsch', 'Italiano',
  'Portugues', 'Nederlands', 'Русский', '日本語', '中文'
] as const;

export const LANGUAGE_FLAGS: Record<string, string> = {
  Francais: '🇫🇷',
  English: '🇬🇧',
  Espanol: '🇪🇸',
  Deutsch: '🇩🇪',
  Italiano: '🇮🇹',
  Portugues: '🇵🇹',
  Nederlands: '🇳🇱',
  'Русский': '🇷🇺',
  '日本語': '🇯🇵',
  '中文': '🇨🇳',
};

export function getFlagForLanguage(lang: string): string {
  return LANGUAGE_FLAGS[lang] || '🌐';
}
