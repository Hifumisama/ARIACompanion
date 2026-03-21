import React, { useState, useMemo } from 'react';
import { CharacterDefinition } from '../types';
import { generateSystemPromptFromCharacter } from '../services/characterPrompt';
import { saveCharacter, exportCharacterToJson, importCharacterFromJson } from '../services/storage';
import { createBlankCharacter, DEFAULT_HADES } from '../data/defaultCharacters';

interface CharacterBuilderProps {
  characters: CharacterDefinition[];
  activeCharacterId: string | null;
  onCharactersChange: (characters: CharacterDefinition[]) => void;
  onActiveCharacterChange: (id: string | null) => void;
}

// ── Styles ──

const sectionStyle: React.CSSProperties = {
  marginBottom: 24,
  padding: 16,
  background: '#1e1e1e',
  borderRadius: 8,
  border: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: '#4CAF50',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  background: '#2a2a2a',
  border: '1px solid #444',
  borderRadius: 6,
  color: '#eee',
  fontSize: 14,
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  minHeight: 80,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const smallBtnStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: '#333',
  border: '1px solid #555',
  borderRadius: 4,
  color: '#ccc',
  cursor: 'pointer',
  fontSize: 12,
};

const addBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  background: '#1b5e20',
  borderColor: '#4CAF50',
  color: '#4CAF50',
};

const removeBtnStyle: React.CSSProperties = {
  ...smallBtnStyle,
  background: '#4a1515',
  borderColor: '#f44336',
  color: '#f44336',
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'center',
  marginBottom: 8,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  color: '#999',
  marginBottom: 4,
  display: 'block',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const actionBarStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  padding: '12px 0',
  borderBottom: '1px solid #333',
  marginBottom: 16,
};

const actionBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  borderRadius: 6,
  border: '1px solid #555',
  background: '#2a2a2a',
  color: '#eee',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};

// ── Component ──

export const CharacterBuilder: React.FC<CharacterBuilderProps> = ({
  characters,
  activeCharacterId,
  onCharactersChange,
  onActiveCharacterChange,
}) => {
  const [showPreview, setShowPreview] = useState(false);

  const char = useMemo(
    () => characters.find(c => c.id === activeCharacterId) || null,
    [characters, activeCharacterId]
  );

  const generatedPrompt = useMemo(
    () => (char ? generateSystemPromptFromCharacter(char) : ''),
    [char]
  );

  // ── Helpers ──

  function updateChar(patch: Partial<CharacterDefinition>) {
    if (!char) return;
    const updated = { ...char, ...patch, updatedAt: Date.now() };
    const newList = characters.map(c => (c.id === updated.id ? updated : c));
    onCharactersChange(newList);
  }

  function handleNew() {
    const blank = createBlankCharacter();
    onCharactersChange([...characters, blank]);
    onActiveCharacterChange(blank.id);
  }

  function handleLoadDefault() {
    const hades = { ...DEFAULT_HADES, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() };
    onCharactersChange([...characters, hades]);
    onActiveCharacterChange(hades.id);
  }

  function handleSave() {
    if (!char) return;
    saveCharacter(char);
  }

  function handleExport() {
    if (!char) return;
    exportCharacterToJson(char);
  }

  async function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const imported = await importCharacterFromJson(file);
        imported.id = crypto.randomUUID();
        onCharactersChange([...characters, imported]);
        onActiveCharacterChange(imported.id);
      } catch (err) {
        alert((err as Error).message);
      }
    };
    input.click();
  }

  function handleDelete() {
    if (!char) return;
    if (!confirm(`Supprimer le personnage "${char.name || 'Sans nom'}" ?`)) return;
    const newList = characters.filter(c => c.id !== char.id);
    onCharactersChange(newList);
    onActiveCharacterChange(newList.length > 0 ? newList[0].id : null);
  }

  // ── No character selected ──

  if (!char) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        <h2 style={{ color: '#eee', marginBottom: 16 }}>Character Builder</h2>
        <p style={{ marginBottom: 24 }}>Aucun personnage sélectionné. Crée-en un ou charge le template Hadès.</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button style={{ ...actionBtnStyle, background: '#1b5e20', borderColor: '#4CAF50' }} onClick={handleNew}>
            Nouveau personnage
          </button>
          <button style={{ ...actionBtnStyle, background: '#1a237e', borderColor: '#5c6bc0' }} onClick={handleLoadDefault}>
            Charger Hadès (template)
          </button>
          <button style={actionBtnStyle} onClick={handleImport}>
            Importer JSON
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ──

  return (
    <div style={{ padding: '0 16px 24px', maxWidth: 900, margin: '0 auto' }}>
      {/* Action bar */}
      <div style={actionBarStyle}>
        <select
          style={{ ...selectStyle, maxWidth: 220 }}
          value={activeCharacterId || ''}
          onChange={e => onActiveCharacterChange(e.target.value || null)}
        >
          {characters.map(c => (
            <option key={c.id} value={c.id}>
              {c.name || 'Sans nom'}
            </option>
          ))}
        </select>
        <button style={{ ...actionBtnStyle, background: '#1b5e20', borderColor: '#4CAF50' }} onClick={handleNew}>
          + Nouveau
        </button>
        <button style={{ ...actionBtnStyle, background: '#1a237e', borderColor: '#5c6bc0' }} onClick={handleLoadDefault}>
          + Hadès
        </button>
        <button style={actionBtnStyle} onClick={handleSave}>Sauvegarder</button>
        <button style={actionBtnStyle} onClick={handleExport}>Exporter</button>
        <button style={actionBtnStyle} onClick={handleImport}>Importer</button>
        <button style={{ ...actionBtnStyle, background: '#4a1515', borderColor: '#f44336', color: '#f44336' }} onClick={handleDelete}>
          Supprimer
        </button>
      </div>

      {/* Identité */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Identité</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Nom</label>
            <input style={inputStyle} value={char.name} onChange={e => updateChar({ name: e.target.value })} placeholder="Hadès" />
          </div>
          <div>
            <label style={labelStyle}>Univers</label>
            <input style={inputStyle} value={char.universe} onChange={e => updateChar({ universe: e.target.value })} placeholder="Mythologie grecque" />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Rôle</label>
          <input style={inputStyle} value={char.role} onChange={e => updateChar({ role: e.target.value })} placeholder="Dieu des Enfers, agent artistique" />
        </div>
        <div>
          <label style={labelStyle}>Backstory</label>
          <textarea style={textareaStyle} value={char.backstory} onChange={e => updateChar({ backstory: e.target.value })} placeholder="Histoire et contexte du personnage..." />
        </div>
      </div>

      {/* Personnalité */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Personnalité
          <button style={addBtnStyle} onClick={() => updateChar({ personalityAxes: [...char.personalityAxes, { name: '', value: 50 }] })}>
            + Ajouter
          </button>
        </div>
        {char.personalityAxes.map((axis, i) => (
          <div key={i} style={rowStyle}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={axis.name}
              onChange={e => {
                const axes = [...char.personalityAxes];
                axes[i] = { ...axes[i], name: e.target.value };
                updateChar({ personalityAxes: axes });
              }}
              placeholder="Trait (ex: Cynisme)"
            />
            <input
              type="range"
              min={0}
              max={100}
              value={axis.value}
              style={{ flex: 1, accentColor: '#4CAF50' }}
              onChange={e => {
                const axes = [...char.personalityAxes];
                axes[i] = { ...axes[i], value: Number(e.target.value) };
                updateChar({ personalityAxes: axes });
              }}
            />
            <span style={{ color: '#4CAF50', minWidth: 32, textAlign: 'right', fontSize: 13 }}>{axis.value}</span>
            <button style={removeBtnStyle} onClick={() => updateChar({ personalityAxes: char.personalityAxes.filter((_, j) => j !== i) })}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* Modes émotionnels */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Modes émotionnels
          <button
            style={addBtnStyle}
            onClick={() => updateChar({
              emotionalModes: [...char.emotionalModes, { name: '', description: '', isDefault: char.emotionalModes.length === 0 }],
            })}
          >
            + Ajouter
          </button>
        </div>
        {char.emotionalModes.map((mode, i) => (
          <div key={i} style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 140px' }}>
              <input
                style={inputStyle}
                value={mode.name}
                onChange={e => {
                  const modes = [...char.emotionalModes];
                  modes[i] = { ...modes[i], name: e.target.value };
                  updateChar({ emotionalModes: modes });
                }}
                placeholder="Nom (ex: BLEU)"
              />
            </div>
            <textarea
              style={{ ...inputStyle, flex: 1, minHeight: 36, resize: 'none' }}
              value={mode.description}
              onChange={e => {
                const modes = [...char.emotionalModes];
                modes[i] = { ...modes[i], description: e.target.value };
                updateChar({ emotionalModes: modes });
              }}
              placeholder="Description du mode..."
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <input
                type="radio"
                name="defaultMode"
                checked={mode.isDefault}
                onChange={() => {
                  const modes = char.emotionalModes.map((m, j) => ({ ...m, isDefault: j === i }));
                  updateChar({ emotionalModes: modes });
                }}
              />
              Défaut
            </label>
            <button style={removeBtnStyle} onClick={() => updateChar({ emotionalModes: char.emotionalModes.filter((_, j) => j !== i) })}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* Déclencheurs */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Déclencheurs
          <button style={addBtnStyle} onClick={() => updateChar({ triggers: [...char.triggers, { condition: '', fromMode: '*', toMode: '' }] })}>
            + Ajouter
          </button>
        </div>
        {char.triggers.map((trigger, i) => (
          <div key={i} style={rowStyle}>
            <input
              style={{ ...inputStyle, flex: 2 }}
              value={trigger.condition}
              onChange={e => {
                const triggers = [...char.triggers];
                triggers[i] = { ...triggers[i], condition: e.target.value };
                updateChar({ triggers });
              }}
              placeholder="Condition (ex: L'utilisateur mentionne Hercule)"
            />
            <select
              style={{ ...selectStyle, flex: '0 0 120px' }}
              value={trigger.fromMode}
              onChange={e => {
                const triggers = [...char.triggers];
                triggers[i] = { ...triggers[i], fromMode: e.target.value };
                updateChar({ triggers });
              }}
            >
              <option value="*">Tous</option>
              {char.emotionalModes.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
            <span style={{ color: '#666' }}>→</span>
            <select
              style={{ ...selectStyle, flex: '0 0 120px' }}
              value={trigger.toMode}
              onChange={e => {
                const triggers = [...char.triggers];
                triggers[i] = { ...triggers[i], toMode: e.target.value };
                updateChar({ triggers });
              }}
            >
              <option value="">Cible...</option>
              {char.emotionalModes.map(m => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
            <button style={removeBtnStyle} onClick={() => updateChar({ triggers: char.triggers.filter((_, j) => j !== i) })}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* Style vocal */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>Style vocal</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Registre</label>
          <input
            style={inputStyle}
            value={char.speechStyle.register}
            onChange={e => updateChar({ speechStyle: { ...char.speechStyle, register: e.target.value } })}
            placeholder="Tutoiement, familier mais dominant"
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Expressions récurrentes (une par ligne)</label>
          <textarea
            style={{ ...textareaStyle, minHeight: 60 }}
            value={char.speechStyle.recurringExpressions.join('\n')}
            onChange={e => updateChar({
              speechStyle: { ...char.speechStyle, recurringExpressions: e.target.value.split('\n').filter(s => s.trim()) },
            })}
            placeholder={"Mon grand\nBabe\nC'est un concept"}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Tics verbaux (un par ligne)</label>
          <textarea
            style={{ ...textareaStyle, minHeight: 60 }}
            value={char.speechStyle.verbalTics.join('\n')}
            onChange={e => updateChar({
              speechStyle: { ...char.speechStyle, verbalTics: e.target.value.split('\n').filter(s => s.trim()) },
            })}
            placeholder="On est d'accord?"
          />
        </div>
        <div>
          <label style={labelStyle}>Notes sur le langage</label>
          <textarea
            style={textareaStyle}
            value={char.speechStyle.languageNotes}
            onChange={e => updateChar({ speechStyle: { ...char.speechStyle, languageNotes: e.target.value } })}
            placeholder="Mélange de mythologie et ton de vendeur de tapis moderne..."
          />
        </div>
      </div>

      {/* Contraintes */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Contraintes
          <button style={addBtnStyle} onClick={() => updateChar({ constraints: [...char.constraints, { description: '' }] })}>
            + Ajouter
          </button>
        </div>
        {char.constraints.map((c, i) => (
          <div key={i} style={rowStyle}>
            <input
              style={{ ...inputStyle, flex: 1 }}
              value={c.description}
              onChange={e => {
                const constraints = [...char.constraints];
                constraints[i] = { description: e.target.value };
                updateChar({ constraints });
              }}
              placeholder="Contrainte (ex: Ne sois JAMAIS gentil gratuitement)"
            />
            <button style={removeBtnStyle} onClick={() => updateChar({ constraints: char.constraints.filter((_, j) => j !== i) })}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* Relations */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Relations
          <button style={addBtnStyle} onClick={() => updateChar({ relationships: [...char.relationships, { interlocutorType: '', attitude: '' }] })}>
            + Ajouter
          </button>
        </div>
        {char.relationships.map((rel, i) => (
          <div key={i} style={{ ...rowStyle, alignItems: 'flex-start' }}>
            <div style={{ flex: '0 0 180px' }}>
              <input
                style={inputStyle}
                value={rel.interlocutorType}
                onChange={e => {
                  const relationships = [...char.relationships];
                  relationships[i] = { ...relationships[i], interlocutorType: e.target.value };
                  updateChar({ relationships });
                }}
                placeholder="Type (ex: Âme perdue)"
              />
            </div>
            <textarea
              style={{ ...inputStyle, flex: 1, minHeight: 36, resize: 'none' }}
              value={rel.attitude}
              onChange={e => {
                const relationships = [...char.relationships];
                relationships[i] = { ...relationships[i], attitude: e.target.value };
                updateChar({ relationships });
              }}
              placeholder="Attitude face à ce type d'interlocuteur..."
            />
            <button style={removeBtnStyle} onClick={() => updateChar({ relationships: char.relationships.filter((_, j) => j !== i) })}>
              x
            </button>
          </div>
        ))}
      </div>

      {/* Schéma de sortie */}
      <div style={sectionStyle}>
        <div style={sectionTitleStyle}>
          Schéma de sortie (output)
          <button
            style={addBtnStyle}
            onClick={() => updateChar({
              outputFields: [...char.outputFields, { name: '', type: 'string', description: '', required: true }],
            })}
          >
            + Ajouter
          </button>
        </div>
        {char.outputFields.map((field, i) => (
          <div key={i} style={{ padding: 10, background: '#252525', borderRadius: 6, marginBottom: 8, border: '1px solid #383838' }}>
            <div style={rowStyle}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Nom du champ</label>
                <input
                  style={inputStyle}
                  value={field.name}
                  onChange={e => {
                    const fields = [...char.outputFields];
                    fields[i] = { ...fields[i], name: e.target.value };
                    updateChar({ outputFields: fields });
                  }}
                  placeholder="tone, action, text..."
                />
              </div>
              <div style={{ flex: '0 0 120px' }}>
                <label style={labelStyle}>Type</label>
                <select
                  style={selectStyle}
                  value={field.type}
                  onChange={e => {
                    const fields = [...char.outputFields];
                    fields[i] = { ...fields[i], type: e.target.value as 'string' | 'enum', enumValues: e.target.value === 'enum' ? [] : undefined };
                    updateChar({ outputFields: fields });
                  }}
                >
                  <option value="string">Texte libre</option>
                  <option value="enum">Enum (choix)</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 12, cursor: 'pointer', paddingTop: 16 }}>
                <input
                  type="checkbox"
                  checked={field.required}
                  onChange={e => {
                    const fields = [...char.outputFields];
                    fields[i] = { ...fields[i], required: e.target.checked };
                    updateChar({ outputFields: fields });
                  }}
                />
                Requis
              </label>
              <button
                style={{ ...removeBtnStyle, marginTop: 16 }}
                onClick={() => updateChar({ outputFields: char.outputFields.filter((_, j) => j !== i) })}
              >
                x
              </button>
            </div>
            {field.type === 'enum' && (
              <div style={{ marginTop: 8 }}>
                <label style={labelStyle}>Valeurs (séparées par des virgules)</label>
                <input
                  style={inputStyle}
                  value={(field.enumValues || []).join(', ')}
                  onChange={e => {
                    const fields = [...char.outputFields];
                    fields[i] = { ...fields[i], enumValues: e.target.value.split(',').map(v => v.trim()).filter(Boolean) };
                    updateChar({ outputFields: fields });
                  }}
                  placeholder="sarcastic, scheming, annoyed, amused, furious, calm"
                />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={field.description}
                onChange={e => {
                  const fields = [...char.outputFields];
                  fields[i] = { ...fields[i], description: e.target.value };
                  updateChar({ outputFields: fields });
                }}
                placeholder="Description du champ pour guider le LLM..."
              />
            </div>
          </div>
        ))}
      </div>

      {/* Preview du prompt */}
      <div style={sectionStyle}>
        <div
          style={{ ...sectionTitleStyle, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setShowPreview(!showPreview)}
        >
          {showPreview ? '▼' : '▶'} Preview du System Prompt
        </div>
        {showPreview && (
          <pre style={{
            background: '#111',
            padding: 16,
            borderRadius: 6,
            color: '#ccc',
            fontSize: 13,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 500,
            overflow: 'auto',
          }}>
            {generatedPrompt}
          </pre>
        )}
      </div>
    </div>
  );
};
