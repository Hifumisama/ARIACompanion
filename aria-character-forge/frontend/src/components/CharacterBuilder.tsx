import React, { useState, useMemo, useEffect } from 'react';
import { CharacterDefinition } from '../types';
import { generateSystemPromptFromCharacter } from '../services/characterPrompt';
import { saveCharacter, exportCharacterToJson, importCharacterFromJson } from '../services/storage';
// createBlankCharacter and DEFAULT_HADES are now only used from App.tsx / HubPage
import { fetchAvailableModels, generateCharacterSheet } from '../services/ollama';
import { RadarChart } from './RadarChart';
import { LANGUAGES } from '../data/languages';

interface CharacterBuilderProps {
  characters: CharacterDefinition[];
  activeCharacterId: string | null;
  onCharactersChange: (characters: CharacterDefinition[]) => void;
  onActiveCharacterChange: (id: string | null) => void;
  onBackToHub?: () => void;
}

// ── Styles ──

const sectionStyle: React.CSSProperties = {
  padding: 16,
  background: '#1e1e1e',
  borderRadius: 8,
  border: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
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

const baseBadgeStyle: React.CSSProperties = {
  padding: '1px 6px',
  background: '#1a2e1a',
  border: '1px solid #2e5a2e',
  borderRadius: 3,
  color: '#4CAF50',
  fontSize: 10,
  fontWeight: 600,
};

// ── Phase detection ──

function isIdentityPhase(char: CharacterDefinition): boolean {
  return char.personalityAxes.length === 0 && char.emotionalModes.length === 0;
}

// ── Component ──

export const CharacterBuilder = ({
  characters,
  activeCharacterId,
  onCharactersChange,
  onActiveCharacterChange,
  onBackToHub,
}: CharacterBuilderProps) => {
  const [showPreview, setShowPreview] = useState(false);
  const [forceFullPhase, setForceFullPhase] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');

  const char = useMemo(
    () => characters.find(c => c.id === activeCharacterId) || null,
    [characters, activeCharacterId]
  );

  const generatedPrompt = useMemo(
    () => (char ? generateSystemPromptFromCharacter(char) : ''),
    [char]
  );

  // Reset forceFullPhase when switching characters
  useEffect(() => {
    setForceFullPhase(false);
    setGenerationError('');
  }, [activeCharacterId]);

  // Fetch models
  useEffect(() => {
    fetchAvailableModels().then(m => {
      setModels(m);
      if (m.length > 0 && !selectedModel) {
        setSelectedModel(m.find(model => model.includes('gemma')) || m[0]);
      }
    });
  }, []);

  const showIdentity = char && isIdentityPhase(char) && !forceFullPhase;

  // ── Helpers ──

  function updateChar(patch: Partial<CharacterDefinition>) {
    if (!char) return;
    const updated = { ...char, ...patch, updatedAt: Date.now() };
    const newList = characters.map(c => (c.id === updated.id ? updated : c));
    onCharactersChange(newList);
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

  async function handleGenerate() {
    if (!char || !selectedModel || !char.name.trim()) return;
    setIsGenerating(true);
    setGenerationError('');
    try {
      const result = await generateCharacterSheet(
        { name: char.name, universe: char.universe, role: char.role, backstory: char.backstory },
        selectedModel
      );
      updateChar(result);
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setIsGenerating(false);
    }
  }

  // ── No character selected ──

  if (!char) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#999' }}>
        <h2 style={{ color: '#eee', marginBottom: 16 }}>Aucun personnage selectionne</h2>
        <p style={{ marginBottom: 24 }}>Retourne au hub pour choisir ou creer un personnage.</p>
        {onBackToHub && (
          <button style={{ ...actionBtnStyle, background: '#1b5e20', borderColor: '#4CAF50' }} onClick={onBackToHub}>
            Retour au Hub
          </button>
        )}
      </div>
    );
  }

  // ── Shared: Identity section ──


  const identitySection = (compact: boolean) => (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Identite</div>
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 1fr 1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Nom</label>
          <input style={inputStyle} value={char.name} onChange={e => updateChar({ name: e.target.value })} placeholder="Hades, Gimli..." disabled={isGenerating} />
        </div>
        <div>
          <label style={labelStyle}>Univers</label>
          <input style={inputStyle} value={char.universe} onChange={e => updateChar({ universe: e.target.value })} placeholder="Mythologie grecque, Terre du Milieu..." disabled={isGenerating} />
        </div>
        {compact && (
          <div>
            <label style={labelStyle}>Role</label>
            <input style={inputStyle} value={char.role} onChange={e => updateChar({ role: e.target.value })} placeholder="Dieu des Enfers, Guerrier nain..." disabled={isGenerating} />
          </div>
        )}
      </div>
      {!compact && (
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Role</label>
          <input style={inputStyle} value={char.role} onChange={e => updateChar({ role: e.target.value })} placeholder="Dieu des Enfers, agent artistique" disabled={isGenerating} />
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr 3fr' : '1fr 2fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>Langue</label>
          <select
            style={selectStyle}
            value={char.language || 'Francais'}
            onChange={e => updateChar({ language: e.target.value })}
            disabled={isGenerating}
          >
            {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Backstory</label>
          <textarea
            style={{ ...textareaStyle, minHeight: compact ? 60 : 100 }}
            value={char.backstory}
            onChange={e => updateChar({ backstory: e.target.value })}
            placeholder="Histoire et contexte du personnage..."
            disabled={isGenerating}
          />
        </div>
      </div>
    </div>
  );

  // ── PHASE 1: Identity + Generate ──

  if (showIdentity) {
    return (
      <div style={{ padding: '0 16px 24px', maxWidth: 700, margin: '0 auto' }}>
        {/* Action bar */}
        <div style={actionBarStyle}>
          <button style={actionBtnStyle} onClick={handleImport}>Importer</button>
        </div>

        {identitySection(false)}

        {/* Model selector + Generate */}
        <div style={{ ...sectionStyle, marginTop: 16, textAlign: 'center' }}>
          <div style={sectionTitleStyle}>Generation de la fiche</div>
          <p style={{ color: '#999', fontSize: 13, marginBottom: 16 }}>
            Remplis l'identite ci-dessus, choisis un modele, et le LLM generera la fiche de personnalite complete.
            {char.name.trim() && char.universe.trim() && (
              <span style={{ color: '#4CAF50' }}>
                {' '}Si "{char.name}" est un personnage connu, la fiche sera basee sur le materiau source.
              </span>
            )}
          </p>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Modele:</label>
            <select
              style={{ ...selectStyle, maxWidth: 280 }}
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              disabled={isGenerating}
            >
              {models.length === 0 ? (
                <option>Aucun modele (Ollama tourne?)</option>
              ) : (
                models.map(m => <option key={m} value={m}>{m}</option>)
              )}
            </select>
          </div>

          <button
            style={{
              padding: '14px 32px',
              background: isGenerating ? '#333' : '#1b5e20',
              border: '2px solid #4CAF50',
              borderRadius: 8,
              color: '#4CAF50',
              fontSize: 16,
              fontWeight: 700,
              cursor: isGenerating || !char.name.trim() || !selectedModel ? 'not-allowed' : 'pointer',
              opacity: isGenerating || !char.name.trim() || !selectedModel ? 0.5 : 1,
            }}
            onClick={handleGenerate}
            disabled={isGenerating || !char.name.trim() || !selectedModel}
          >
            {isGenerating ? 'Generation en cours...' : 'Generer la fiche'}
          </button>

          {isGenerating && (
            <div style={{ marginTop: 12, color: '#888', fontSize: 13 }}>
              Le LLM analyse le personnage et genere sa fiche...
            </div>
          )}

          {generationError && (
            <div style={{ marginTop: 12, padding: 10, background: '#4a1515', border: '1px solid #f44336', borderRadius: 6, color: '#f44336', fontSize: 13 }}>
              {generationError}
            </div>
          )}

          <div style={{ marginTop: 16, borderTop: '1px solid #333', paddingTop: 12 }}>
            <button
              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 13, textDecoration: 'underline' }}
              onClick={() => setForceFullPhase(true)}
            >
              Remplir manuellement
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── PHASE 2: Full character sheet ──

  return (
    <div style={{ padding: '0 16px 24px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Action bar */}
      <div style={actionBarStyle}>
        <button style={actionBtnStyle} onClick={handleSave}>Sauvegarder</button>
        <button style={actionBtnStyle} onClick={handleExport}>Exporter</button>
        <button style={actionBtnStyle} onClick={handleImport}>Importer</button>
      </div>

      {/* Identity — full width, compact */}
      {identitySection(true)}

      {/* Two-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 16,
        alignItems: 'start',
        marginTop: 16,
      }}>
        {/* ── LEFT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Personnalité */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              Personnalite
              <button style={addBtnStyle} onClick={() => updateChar({ personalityAxes: [...char.personalityAxes, { name: '', value: 50 }] })}>
                + Trait
              </button>
            </div>

            {char.personalityAxes.length >= 3 && (
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
                <RadarChart
                  axes={char.personalityAxes}
                  onChange={axes => updateChar({ personalityAxes: axes })}
                  size={320}
                />
              </div>
            )}

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
                  type="range" min={0} max={100} value={axis.value}
                  style={{ flex: 1, accentColor: '#4CAF50' }}
                  onChange={e => {
                    const axes = [...char.personalityAxes];
                    axes[i] = { ...axes[i], value: Number(e.target.value) };
                    updateChar({ personalityAxes: axes });
                  }}
                />
                <span style={{ color: '#4CAF50', minWidth: 32, textAlign: 'right', fontSize: 13 }}>{axis.value}</span>
                <button style={removeBtnStyle} onClick={() => updateChar({ personalityAxes: char.personalityAxes.filter((_, j) => j !== i) })}>x</button>
              </div>
            ))}

            {char.personalityAxes.length > 0 && char.personalityAxes.length < 3 && (
              <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                Ajoute encore {3 - char.personalityAxes.length} trait{3 - char.personalityAxes.length > 1 ? 's' : ''} pour le radar.
              </div>
            )}
          </div>

          {/* Tons / Modes émotionnels */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              Tons / Modes
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
                <div style={{ flex: '0 0 120px' }}>
                  <input
                    style={inputStyle}
                    value={mode.name}
                    onChange={e => {
                      const modes = [...char.emotionalModes];
                      modes[i] = { ...modes[i], name: e.target.value };
                      updateChar({ emotionalModes: modes });
                    }}
                    placeholder="Mode"
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
                  placeholder="Description..."
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  <input
                    type="radio" name="defaultMode" checked={mode.isDefault}
                    onChange={() => {
                      const modes = char.emotionalModes.map((m, j) => ({ ...m, isDefault: j === i }));
                      updateChar({ emotionalModes: modes });
                    }}
                  />
                  Def.
                </label>
                <button style={removeBtnStyle} onClick={() => updateChar({ emotionalModes: char.emotionalModes.filter((_, j) => j !== i) })}>x</button>
              </div>
            ))}
            {char.emotionalModes.length > 0 && (
              <div style={{ color: '#666', fontSize: 11, marginTop: 4, fontStyle: 'italic' }}>
                Tone auto: [{char.emotionalModes.filter(m => m.name.trim()).map(m => m.name).join(', ')}]
              </div>
            )}
          </div>

          {/* Déclencheurs */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>
              Declencheurs
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
                  placeholder="Condition..."
                />
                <select
                  style={{ ...selectStyle, flex: '0 0 100px' }}
                  value={trigger.fromMode}
                  onChange={e => {
                    const triggers = [...char.triggers];
                    triggers[i] = { ...triggers[i], fromMode: e.target.value };
                    updateChar({ triggers });
                  }}
                >
                  <option value="*">Tous</option>
                  {char.emotionalModes.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
                <span style={{ color: '#666' }}>→</span>
                <select
                  style={{ ...selectStyle, flex: '0 0 100px' }}
                  value={trigger.toMode}
                  onChange={e => {
                    const triggers = [...char.triggers];
                    triggers[i] = { ...triggers[i], toMode: e.target.value };
                    updateChar({ triggers });
                  }}
                >
                  <option value="">Cible...</option>
                  {char.emotionalModes.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                </select>
                <button style={removeBtnStyle} onClick={() => updateChar({ triggers: char.triggers.filter((_, j) => j !== i) })}>x</button>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Avatar */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Image du personnage</div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              {char.avatarBase64 ? (
                <img
                  src={char.avatarBase64}
                  alt={char.name}
                  style={{ width: '100%', maxWidth: 280, aspectRatio: '3/4', borderRadius: 8, objectFit: 'cover', border: '2px solid #444' }}
                />
              ) : (
                <div style={{
                  width: '100%', maxWidth: 280, aspectRatio: '3/4', borderRadius: 8, background: '#2a2a2a', border: '2px dashed #444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: 13,
                }}>
                  Aucune image
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button
                  style={addBtnStyle}
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = () => {
                      const file = input.files?.[0];
                      if (!file) return;
                      if (file.size > 512000) {
                        alert('Image trop lourde (max 500 Ko)');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => updateChar({ avatarBase64: reader.result as string });
                      reader.readAsDataURL(file);
                    };
                    input.click();
                  }}
                >
                  Choisir une image
                </button>
                {char.avatarBase64 && (
                  <button style={removeBtnStyle} onClick={() => updateChar({ avatarBase64: undefined })}>
                    Supprimer
                  </button>
                )}
                <span style={{ fontSize: 11, color: '#666' }}>Max 500 Ko</span>
              </div>
            </div>
          </div>

          {/* Style vocal */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Style vocal</div>
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Registre</label>
              <input
                style={inputStyle}
                value={char.speechStyle.register}
                onChange={e => updateChar({ speechStyle: { ...char.speechStyle, register: e.target.value } })}
                placeholder="Tutoiement, familier mais dominant"
              />
            </div>
            <div>
              <label style={labelStyle}>Notes sur le langage</label>
              <textarea
                style={{ ...textareaStyle, minHeight: 50 }}
                value={char.speechStyle.languageNotes}
                onChange={e => updateChar({ speechStyle: { ...char.speechStyle, languageNotes: e.target.value } })}
                placeholder="Melange de mythologie et ton vendeur de tapis..."
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
                  placeholder="Contrainte (ex: Ne sois JAMAIS gentil)"
                />
                <button style={removeBtnStyle} onClick={() => updateChar({ constraints: char.constraints.filter((_, j) => j !== i) })}>x</button>
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
                <div style={{ flex: '0 0 150px' }}>
                  <input
                    style={inputStyle}
                    value={rel.interlocutorType}
                    onChange={e => {
                      const relationships = [...char.relationships];
                      relationships[i] = { ...relationships[i], interlocutorType: e.target.value };
                      updateChar({ relationships });
                    }}
                    placeholder="Type (ex: Ame perdue)"
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
                  placeholder="Attitude..."
                />
                <button style={removeBtnStyle} onClick={() => updateChar({ relationships: char.relationships.filter((_, j) => j !== i) })}>x</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FULL WIDTH: Output schema ── */}
      <div style={{ ...sectionStyle, marginTop: 16 }}>
        <div style={sectionTitleStyle}>
          Schema de sortie (output)
          <button
            style={addBtnStyle}
            onClick={() => updateChar({
              outputFields: [...char.outputFields, { name: '', type: 'string', description: '', required: true }],
            })}
          >
            + Ajouter
          </button>
        </div>

        {/* Auto-derived tone field */}
        {char.emotionalModes.length > 0 && (
          <div style={{
            padding: 10,
            background: '#1a2e1a',
            borderRadius: 6,
            marginBottom: 8,
            border: '1px solid #2e5a2e',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}>
            <span style={{ color: '#4CAF50', fontWeight: 600, fontSize: 13 }}>tone</span>
            <span style={{ color: '#888', fontSize: 12 }}>
              enum [{char.emotionalModes.filter(m => m.name.trim()).map(m => m.name).join(', ')}]
            </span>
            <span style={{ ...baseBadgeStyle, marginLeft: 'auto' }}>auto</span>
          </div>
        )}

        {/* Base fields (action, text) — locked */}
        {char.outputFields.map((field, i) => {
          const isBase = field.name === 'action' || field.name === 'text';
          return (
            <div key={i} style={{
              padding: 10,
              background: isBase ? '#1a2e1a' : '#252525',
              borderRadius: 6,
              marginBottom: 8,
              border: `1px solid ${isBase ? '#2e5a2e' : '#383838'}`,
            }}>
              <div style={rowStyle}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Nom du champ</label>
                  <input
                    style={{ ...inputStyle, ...(isBase ? { color: '#4CAF50', fontWeight: 600 } : {}) }}
                    value={field.name}
                    onChange={e => {
                      if (isBase) return;
                      const fields = [...char.outputFields];
                      fields[i] = { ...fields[i], name: e.target.value };
                      updateChar({ outputFields: fields });
                    }}
                    placeholder="nom_du_champ"
                    readOnly={isBase}
                  />
                </div>
                <div style={{ flex: '0 0 120px' }}>
                  <label style={labelStyle}>Type</label>
                  <select
                    style={selectStyle}
                    value={field.type}
                    onChange={e => {
                      if (isBase) return;
                      const fields = [...char.outputFields];
                      fields[i] = { ...fields[i], type: e.target.value as 'string' | 'enum', enumValues: e.target.value === 'enum' ? [] : undefined };
                      updateChar({ outputFields: fields });
                    }}
                    disabled={isBase}
                  >
                    <option value="string">Texte libre</option>
                    <option value="enum">Enum (choix)</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#999', fontSize: 12, cursor: isBase ? 'default' : 'pointer', paddingTop: 16 }}>
                  <input
                    type="checkbox" checked={field.required} disabled={isBase}
                    onChange={e => {
                      if (isBase) return;
                      const fields = [...char.outputFields];
                      fields[i] = { ...fields[i], required: e.target.checked };
                      updateChar({ outputFields: fields });
                    }}
                  />
                  Requis
                </label>
                {isBase ? (
                  <span style={{ ...baseBadgeStyle, marginTop: 16 }}>base</span>
                ) : (
                  <button
                    style={{ ...removeBtnStyle, marginTop: 16 }}
                    onClick={() => updateChar({ outputFields: char.outputFields.filter((_, j) => j !== i) })}
                  >
                    x
                  </button>
                )}
              </div>
              {field.type === 'enum' && (
                <div style={{ marginTop: 8 }}>
                  <label style={labelStyle}>Valeurs (separees par des virgules)</label>
                  <input
                    style={inputStyle}
                    value={(field.enumValues || []).join(', ')}
                    onChange={e => {
                      const fields = [...char.outputFields];
                      fields[i] = { ...fields[i], enumValues: e.target.value.split(',').map(v => v.trim()).filter(Boolean) };
                      updateChar({ outputFields: fields });
                    }}
                    placeholder="valeur1, valeur2, valeur3"
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
          );
        })}
      </div>

      {/* ── FULL WIDTH: Preview ── */}
      <div style={{ ...sectionStyle, marginTop: 16 }}>
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
