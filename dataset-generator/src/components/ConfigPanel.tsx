import React, { useEffect, useState } from 'react';
import { GenerationConfig, DatasetEntry, OutputFieldDefinition } from '../types';
import { fetchAvailableModels } from '../services/ollama';
import { validateOutput } from '../services/characterPrompt';

interface ConfigPanelProps {
  config: GenerationConfig;
  outputFields: OutputFieldDefinition[];
  onConfigChange: (config: GenerationConfig) => void;
  isGenerating: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  outputFields,
  onConfigChange,
  isGenerating
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedExampleId, setExpandedExampleId] = useState<number | null>(null);

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
          alert('Aucune entrée valide trouvée dans le fichier.');
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
          placeholder="Généré automatiquement depuis la fiche personnage..."
        />
        <span style={{ fontSize: 11, color: '#666', marginTop: 2 }}>
          Ce prompt est généré depuis l'onglet Personnage. Tu peux le modifier manuellement si besoin.
        </span>
      </div>

      {/* Exemples */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Exemples ({config.examples.length})
        </label>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <button
            onClick={handleImportExamples}
            disabled={isGenerating}
            style={styles.actionBtn}
          >
            Importer JSON
          </button>
          <button
            onClick={handleExportExamples}
            disabled={isGenerating || config.examples.length === 0}
            style={styles.actionBtn}
          >
            Exporter JSON
          </button>
          <button
            onClick={handleClearExamples}
            disabled={isGenerating || config.examples.length === 0}
            style={{ ...styles.actionBtn, borderColor: '#f44336', color: '#f44336' }}
          >
            Tout supprimer
          </button>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 300, overflowY: 'auto' }}>
            {config.examples.map(ex => {
              const isExpanded = expandedExampleId === ex.id;
              return (
                <div key={ex.id} style={{
                  background: '#1f1f1f',
                  border: '1px solid #333',
                  borderLeft: '3px solid #4CAF50',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      fontSize: 12,
                    }}
                    onClick={() => setExpandedExampleId(isExpanded ? null : ex.id)}
                  >
                    <span style={{ fontSize: 10, color: '#666', minWidth: 12 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ color: '#4CAF50', fontFamily: 'monospace', fontWeight: 'bold', fontSize: 11 }}>#{ex.id}</span>
                    <span style={{ color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ex.context}
                    </span>
                    {ex.output.tone && (
                      <span style={{
                        fontSize: 10,
                        color: '#888',
                        fontWeight: 'bold',
                        textTransform: 'uppercase',
                        padding: '1px 6px',
                        background: '#2a2a2a',
                        borderRadius: 3,
                      }}>
                        {ex.output.tone}
                      </span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveExample(ex.id); }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f44336',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '0 4px',
                      }}
                    >
                      x
                    </button>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '8px 12px', borderTop: '1px solid #333', background: '#0f0f0f', fontSize: 12 }}>
                      <ExField label="Context" value={ex.context} />
                      <ExField label="Instruction" value={ex.instruction} />
                      <ExField label="Input" value={ex.input} />
                      {Object.entries(ex.output).map(([key, val]) => (
                        <ExField key={key} label={key} value={val} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={styles.row}>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Nombre d'entrees</label>
          <div style={styles.rangeRow}>
            <input
              type="range"
              min="1"
              max="500"
              value={config.count}
              onChange={(e) => onConfigChange({ ...config, count: parseInt(e.target.value, 10) })}
              disabled={isGenerating}
              style={{ flex: 1 }}
            />
            <span style={styles.rangeValue}>{config.count}</span>
          </div>
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
    </div>
  );
};

const ExField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ marginBottom: 6, paddingBottom: 6, borderBottom: '1px solid #222' }}>
    <span style={{ fontSize: 10, color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
    <p style={{ margin: '2px 0 0', fontSize: 12, lineHeight: 1.4, color: '#ccc' }}>{value}</p>
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
  rangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '4px'
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
    marginTop: '4px'
  } as React.CSSProperties,
  textarea: {
    fontFamily: 'monospace',
    resize: 'vertical'
  } as React.CSSProperties,
  rangeValue: {
    fontWeight: 'bold',
    fontSize: '16px',
    minWidth: '30px',
    textAlign: 'right'
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
};
