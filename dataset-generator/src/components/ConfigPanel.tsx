import React, { useEffect, useState } from 'react';
import { GenerationConfig } from '../types';
import { fetchAvailableModels } from '../services/ollama';

interface ConfigPanelProps {
  config: GenerationConfig;
  onConfigChange: (config: GenerationConfig) => void;
  isGenerating: boolean;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  config,
  onConfigChange,
  isGenerating
}) => {
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

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
          style={{ ...styles.input, ...styles.textarea, height: '200px' }}
          placeholder="Entrez le system prompt pour guider la generation..."
        />
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Exemples (JSON)</label>
        <textarea
          value={config.examples}
          onChange={(e) => onConfigChange({ ...config, examples: e.target.value })}
          disabled={isGenerating}
          style={{ ...styles.input, ...styles.textarea, height: '250px' }}
          placeholder="Collez des entrees existantes en JSON pour guider le modele..."
        />
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
  } as React.CSSProperties
};
