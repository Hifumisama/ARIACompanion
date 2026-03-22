import React, { useEffect, useState } from 'react';
import { GenerationConfig, DatasetEntry, OutputFieldDefinition, CharacterDefinition } from '../types';
import { fetchAvailableModels, generateScenarios } from '../services/ollama';

interface ConfigPanelProps {
  config: GenerationConfig;
  outputFields: OutputFieldDefinition[];
  character: CharacterDefinition | null;
  onConfigChange: (config: GenerationConfig) => void;
  isGenerating: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  outputFields,
  character,
  onConfigChange,
  isGenerating
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExampleId, setExpandedExampleId] = useState<number | null>(null);
  const [generatingScenarios, setGeneratingScenarios] = useState(false);
  const [editingExample, setEditingExample] = useState<DatasetEntry | null>(null);

  useEffect(() => {
    fetchAvailableModels().then(m => {
      setModels(m);
      if (m.length > 0 && !config.model) {
        const defaultModel =
          m.find(model => model.includes('gemma')) || m[0];
        onConfigChange({ ...config, model: defaultModel });
      }
      setLoading(false);
    });
  }, []);

  const handleImportExamples = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const arr: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.data) ? parsed.data : [parsed]);

        const valid: DatasetEntry[] = arr
          .filter((e: any) => e.context && e.instruction && e.input && e.output && typeof e.output === 'object')
          .map((e: any, i: number) => ({
            id: (config.examples.length + i + 1),
            context: e.context,
            instruction: e.instruction,
            input: e.input,
            output: e.output,
          }));

        if (valid.length === 0) {
          alert('Aucune entree valide trouvee dans le fichier.');
          return;
        }

        onConfigChange({ ...config, examples: [...config.examples, ...valid] });
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    input.click();
  };

  const handleExportExamples = () => {
    if (config.examples.length === 0) return;
    const blob = new Blob(
      [JSON.stringify(config.examples.map(({ id, ...rest }) => rest), null, 2)],
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `examples_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRemoveExample = (id: number) => {
    onConfigChange({ ...config, examples: config.examples.filter(e => e.id !== id) });
  };

  const handleClearExamples = () => {
    if (config.examples.length === 0) return;
    if (!confirm(`Supprimer les ${config.examples.length} exemples ?`)) return;
    onConfigChange({ ...config, examples: [] });
  };

  const handleSaveEdit = () => {
    if (!editingExample) return;
    onConfigChange({
      ...config,
      examples: config.examples.map(e => e.id === editingExample.id ? editingExample : e)
    });
    setEditingExample(null);
  };

  const handleGenerateScenarios = async () => {
    if (!character || !config.model) return;
    setGeneratingScenarios(true);
    try {
      const scenarios = await generateScenarios(character, config.model, 5);
      if (scenarios.length === 0) {
        alert('Aucun scenario genere. Reessaye.');
        return;
      }
      const newEntries: DatasetEntry[] = scenarios.map((s, i) => ({
        id: config.examples.length + i + 1,
        context: s.context,
        instruction: s.instruction,
        input: s.input,
        output: {},
      }));
      onConfigChange({ ...config, examples: [...config.examples, ...newEntries] });
    } catch (err) {
      alert(`Erreur: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    } finally {
      setGeneratingScenarios(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Modele Ollama</label>
        <select
          value={config.model}
          onChange={(e) => onConfigChange({ ...config, model: e.target.value })}
          disabled={isGenerating || loading}
          style={styles.input}
        >
          {models.length === 0 ? (
            <option>Aucun modele trouve (est-ce que Ollama tourne?)</option>
          ) : (
            models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))
          )}
        </select>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>System Prompt</label>
        <textarea
          value={config.systemPrompt}
          onChange={(e) => onConfigChange({ ...config, systemPrompt: e.target.value })}
          disabled={isGenerating}
          style={{ ...styles.input, ...styles.textarea, height: '160px' }}
          placeholder="Genere automatiquement depuis la fiche personnage..."
        />
        <span style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
          Ce prompt est genere depuis l'onglet Personnage. Tu peux le modifier manuellement si besoin.
        </span>
      </div>

      {/* Exemples */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Exemples ({config.examples.length})
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <button onClick={handleImportExamples} disabled={isGenerating} style={styles.actionBtn}>
            Importer JSON
          </button>
          <button onClick={handleExportExamples} disabled={isGenerating || config.examples.length === 0} style={styles.actionBtn}>
            Exporter JSON
          </button>
          <button onClick={handleClearExamples} disabled={isGenerating || config.examples.length === 0}
            style={{ ...styles.actionBtn, borderColor: '#f44336', color: '#f44336' }}>
            Tout supprimer
          </button>
          {character && character.triggers.length > 0 && (
            <button onClick={handleGenerateScenarios} disabled={isGenerating || generatingScenarios || !config.model}
              style={{ ...styles.actionBtn, borderColor: '#FF9800', color: '#FF9800' }}>
              {generatingScenarios ? 'Generation...' : 'Generer scenarios'}
            </button>
          )}
        </div>

        {config.examples.length === 0 ? (
          <div style={{
            padding: '16px',
            textAlign: 'center',
            color: '#666',
            fontSize: 13,
            border: '1px dashed #444',
            borderRadius: 6,
            background: '#1a1a1a',
          }}>
            Aucun exemple. Le modele se basera uniquement sur le system prompt.
            <br />
            <span style={{ fontSize: 11, color: '#555' }}>
              Importe un JSON ou capture des exemples depuis le Playground.
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 400, overflowY: 'auto', padding: '2px 0' }}>
            {config.examples.map(ex => {
              const isExpanded = expandedExampleId === ex.id;
              return (
                <div key={ex.id} style={{
                  background: '#1f1f1f',
                  border: '1px solid #333',
                  borderLeft: '3px solid #4CAF50',
                  borderRadius: 6,
                }}>
                  {/* Header row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '10px 12px',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                    onClick={() => setExpandedExampleId(isExpanded ? null : ex.id)}
                  >
                    <span style={{ fontSize: 11, color: '#666', minWidth: 14, userSelect: 'none' }}>
                      {isExpanded ? '\u25BC' : '\u25B6'}
                    </span>
                    <span style={{ color: '#4CAF50', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 12 }}>
                      #{ex.id}
                    </span>
                    <span style={{
                      color: '#bbb', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      fontSize: 12,
                    }}>
                      {ex.context || '(pas de contexte)'}
                    </span>
                    {ex.output.tone && (
                      <span style={{
                        fontSize: 10, color: '#4CAF50', fontWeight: 'bold', textTransform: 'uppercase',
                        padding: '2px 8px', background: '#1a2e1a', borderRadius: 4, border: '1px solid #2e5a2e',
                      }}>
                        {ex.output.tone}
                      </span>
                    )}
                    {/* Edit button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingExample({ ...ex }); }}
                      style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                      title="Modifier"
                    >
                      {'\u270E'}
                    </button>
                    {/* Remove button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveExample(ex.id); }}
                      style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}
                      title="Supprimer"
                    >
                      {'\u2715'}
                    </button>
                  </div>
                  {/* Expanded details */}
                  {isExpanded && (
                    <div style={{
                      padding: '12px 16px',
                      borderTop: '1px solid #2a2a2a',
                      background: '#161616',
                      fontSize: 13,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}>
                      <ExField label="Context" value={ex.context} />
                      <ExField label="Instruction" value={ex.instruction} />
                      <ExField label="Input" value={ex.input} />
                      {Object.entries(ex.output).map(([key, val]) => (
                        <ExField key={key} label={`output.${key}`} value={val} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Params row */}
      <div style={styles.row}>
        <div style={{ ...styles.formGroup, width: '140px' }}>
          <label style={styles.label}>Nombre d'entrees</label>
          <input
            type="number"
            value={config.count}
            onChange={(e) => onConfigChange({ ...config, count: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            disabled={isGenerating}
            style={styles.input}
            min="1"
            max="5000"
          />
        </div>

        <div style={{ ...styles.formGroup, width: '120px' }}>
          <label style={styles.label}>ID de depart</label>
          <input
            type="number"
            value={config.startId}
            onChange={(e) => onConfigChange({ ...config, startId: parseInt(e.target.value, 10) })}
            disabled={isGenerating}
            style={styles.input}
            min="1"
          />
        </div>

        <div style={{ ...styles.formGroup, width: '120px' }}>
          <label style={styles.label}>Taille batch</label>
          <input
            type="number"
            value={config.batchSize}
            onChange={(e) => onConfigChange({ ...config, batchSize: Math.max(1, parseInt(e.target.value, 10)) })}
            disabled={isGenerating}
            style={styles.input}
            min="1"
            max={config.count}
          />
        </div>
      </div>

      {/* Edit Modal */}
      {editingExample && (
        <div style={styles.modalOverlay} onClick={() => setEditingExample(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 16px', color: '#4CAF50', fontSize: 16 }}>
              Modifier l'exemple #{editingExample.id}
            </h3>

            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Context</label>
              <textarea
                style={{ ...styles.input, ...styles.textarea, height: '60px' }}
                value={editingExample.context}
                onChange={e => setEditingExample({ ...editingExample, context: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Instruction</label>
              <textarea
                style={{ ...styles.input, ...styles.textarea, height: '60px' }}
                value={editingExample.instruction}
                onChange={e => setEditingExample({ ...editingExample, instruction: e.target.value })}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={styles.label}>Input</label>
              <textarea
                style={{ ...styles.input, ...styles.textarea, height: '60px' }}
                value={editingExample.input}
                onChange={e => setEditingExample({ ...editingExample, input: e.target.value })}
              />
            </div>

            {/* Output fields */}
            {Object.entries(editingExample.output).map(([key, val]) => (
              <div key={key} style={{ marginBottom: 12 }}>
                <label style={styles.label}>output.{key}</label>
                <input
                  style={styles.input}
                  value={val}
                  onChange={e => setEditingExample({
                    ...editingExample,
                    output: { ...editingExample.output, [key]: e.target.value }
                  })}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                style={{ ...styles.actionBtn, padding: '8px 20px' }}
                onClick={() => setEditingExample(null)}
              >
                Annuler
              </button>
              <button
                style={{ ...styles.actionBtn, padding: '8px 20px', background: '#1b5e20', borderColor: '#4CAF50', color: '#4CAF50' }}
                onClick={handleSaveEdit}
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ExField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ paddingBottom: 6, borderBottom: '1px solid #222' }}>
    <span style={{ fontSize: 10, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
      {label}
    </span>
    <p style={{ margin: '3px 0 0', fontSize: 13, lineHeight: 1.5, color: '#ddd', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
      {value || '(vide)'}
    </p>
  </div>
);

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  } as React.CSSProperties,
  formGroup: {
    marginBottom: '12px'
  } as React.CSSProperties,
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#aaa',
    display: 'block',
    marginBottom: '4px'
  } as React.CSSProperties,
  row: {
    display: 'flex',
    gap: '16px'
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #555',
    backgroundColor: '#1f1f1f',
    color: '#e0e0e0',
    fontFamily: 'inherit',
    fontSize: '14px',
    marginTop: '4px',
    boxSizing: 'border-box',
  } as React.CSSProperties,
  textarea: {
    fontFamily: 'monospace',
    resize: 'vertical'
  } as React.CSSProperties,
  actionBtn: {
    padding: '5px 12px',
    borderRadius: 4,
    border: '1px solid #555',
    background: '#2a2a2a',
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
  } as React.CSSProperties,
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  } as React.CSSProperties,
  modal: {
    background: '#1e1e1e',
    border: '1px solid #444',
    borderRadius: 10,
    padding: 24,
    width: '90%',
    maxWidth: 600,
    maxHeight: '80vh',
    overflowY: 'auto',
  } as React.CSSProperties,
};
