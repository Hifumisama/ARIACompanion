import React, { useMemo, useState } from 'react';
import { DatasetEntry, CharacterDefinition, AffinageEntry } from '../types';
import { convertDataset, downloadJsonl, ConversionFormat, FORMAT_LABELS, FORMAT_DESCRIPTIONS } from '../services/datasetConverter';

interface ResultsPanelProps {
  entries: DatasetEntry[];
  character: CharacterDefinition | null;
  systemPrompt: string;
  generatorModel: string;
  judgeModel: string;
}

const EMOTION_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#82E0AA'
];

// Simple pie chart SVG component
const PieChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) return <div style={{ color: '#888', fontSize: 14 }}>Pas de données</div>;

  // Special case: if only one slice (100%), show a full circle with border
  if (data.length === 1) {
    return (
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        <div style={{ position: 'relative', width: 200, height: 200 }}>
          <svg width="200" height="200" viewBox="0 0 200 200" style={{ position: 'absolute' }}>
            <circle cx="100" cy="100" r="80" fill={EMOTION_COLORS[0]} opacity={0.8} />
            <circle cx="100" cy="100" r="80" fill="none" stroke="#4CAF50" strokeWidth="2" />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              color: 'white',
              fontWeight: 'bold'
            }}
          >
            <div style={{ fontSize: 28 }}>100%</div>
          </div>
        </div>
        <div style={{ fontSize: 12 }}>
          {data.map((d, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: EMOTION_COLORS[idx % EMOTION_COLORS.length]
                }}
              />
              <span>
                {d.label}: {d.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  let currentAngle = 0;
  const slices = data.map((d, idx) => {
    const percentage = (d.value / total) * 100;
    const sliceAngle = (d.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sliceAngle;
    currentAngle = endAngle;

    // Convert to radians
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // SVG arc path
    const radius = 80;
    const x1 = 100 + radius * Math.cos(startRad);
    const y1 = 100 + radius * Math.sin(startRad);
    const x2 = 100 + radius * Math.cos(endRad);
    const y2 = 100 + radius * Math.sin(endRad);

    const largeArc = sliceAngle > 180 ? 1 : 0;
    const path = `M 100 100 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    // Label position
    const labelAngle = (startAngle + endAngle) / 2;
    const labelRad = (labelAngle * Math.PI) / 180;
    const labelX = 100 + (radius * 0.65) * Math.cos(labelRad);
    const labelY = 100 + (radius * 0.65) * Math.sin(labelRad);

    return (
      <g key={idx}>
        <path d={path} fill={EMOTION_COLORS[idx % EMOTION_COLORS.length]} opacity={0.8} />
        {percentage > 8 && (
          <text
            x={labelX}
            y={labelY}
            textAnchor="middle"
            dy="0.3em"
            fontSize="12"
            fontWeight="bold"
            fill="white"
          >
            {percentage.toFixed(0)}%
          </text>
        )}
      </g>
    );
  });

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <svg width="200" height="200" viewBox="0 0 200 200">
        {slices}
      </svg>
      <div style={{ fontSize: 12 }}>
        {data.map((d, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: EMOTION_COLORS[idx % EMOTION_COLORS.length]
              }}
            />
            <span>
              {d.label}: {d.value} ({((d.value / total) * 100).toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Helper: find all enum fields present in entries
function findEnumFieldsInEntries(entries: DatasetEntry[]): string[] {
  const enumFields = new Set<string>();
  entries.forEach(entry => {
    Object.keys(entry.output).forEach(key => {
      // Simple heuristic: if value looks like a single word (no spaces), treat as potential enum
      const value = entry.output[key];
      if (typeof value === 'string' && value.length < 50 && !value.includes(' ')) {
        enumFields.add(key);
      }
    });
  });
  return Array.from(enumFields);
}

// Helper: count distribution of a field
function getFieldDistribution(entries: DatasetEntry[], fieldName: string): { label: string; value: number }[] {
  const counts: Record<string, number> = {};
  entries.forEach(entry => {
    const value = entry.output[fieldName];
    if (value) {
      counts[value] = (counts[value] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => (b[1] as number) - (a[1] as number))
    .map(([label, count]) => ({ label, value: count as number }));
}

// Helper: calculate average output size
function getAverageOutputSize(entries: DatasetEntry[]): number {
  if (entries.length === 0) return 0;
  const totalSize = entries.reduce((sum, e) => sum + JSON.stringify(e.output).length, 0);
  return Math.round(totalSize / entries.length);
}

// Helper: calculate total dataset size
function getTotalDatasetSize(entries: DatasetEntry[]): number {
  const totalSize = entries.reduce((sum, e) => sum + JSON.stringify(e.output).length, 0);
  return totalSize;
}

// Helper: calculate judge score average
function getAverageJudgeScore(entries: DatasetEntry[]): number | null {
  const affinageEntries = entries as AffinageEntry[];
  const scored = affinageEntries.filter(e => e.judgeScore !== undefined);
  if (scored.length === 0) return null;
  const sum = scored.reduce((s, e) => s + (e.judgeScore || 0), 0);
  return sum / scored.length;
}

// Helper: get dataset quality label
function getQualityLabel(score: number | null): { label: string; color: string } {
  if (score === null) return { label: 'Non évalué', color: '#888' };
  if (score >= 8) return { label: 'Excellent dataset', color: '#4CAF50' };
  if (score >= 6) return { label: 'Bon dataset', color: '#8BC34A' };
  if (score >= 4) return { label: 'Dataset moyen', color: '#FF9800' };
  return { label: 'Dataset faible', color: '#f44336' };
}

export const ResultsPanel: React.FC<ResultsPanelProps> = ({
  entries,
  character,
  systemPrompt,
  generatorModel,
  judgeModel
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ConversionFormat>('chatml');
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);

  const enumFields = useMemo(() => findEnumFieldsInEntries(entries), [entries]);
  const enumFieldDistributions = useMemo(() => {
    return enumFields.map(fieldName => ({
      fieldName,
      distribution: getFieldDistribution(entries, fieldName)
    }));
  }, [entries, enumFields]);
  const avgOutputSize = useMemo(() => getAverageOutputSize(entries), [entries]);
  const totalSize = useMemo(() => getTotalDatasetSize(entries), [entries]);
  const avgJudgeScore = useMemo(() => getAverageJudgeScore(entries), [entries]);
  const judgedCount = useMemo(() => (entries as AffinageEntry[]).filter(e => e.judgeScore !== undefined).length, [entries]);
  const quality = useMemo(() => getQualityLabel(avgJudgeScore), [avgJudgeScore]);

  const handleDownload = () => {
    if (entries.length === 0) return;
    try {
      const converted = convertDataset(entries, systemPrompt, selectedFormat);
      const filename = `${character?.name || 'dataset'}_${selectedFormat}_${entries.length}entries.jsonl`;
      downloadJsonl(converted, filename);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* ─── Section 1: Général ─── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📋 Général</h2>
          <div style={styles.generalGrid}>
            {character?.avatarBase64 && (
              <img
                src={character.avatarBase64}
                alt="avatar"
                style={styles.avatar}
              />
            )}
            <div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Personnage:</span>
                <span>{character?.name || '—'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Univers:</span>
                <span>{character?.universe || '—'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Rôle:</span>
                <span>{character?.role || '—'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Langue:</span>
                <span>{character?.language || '—'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Modèle générateur:</span>
                <span>{generatorModel ? generatorModel : '—'}</span>
              </div>
              <div style={styles.infoRow}>
                <span style={styles.label}>Modèle juge:</span>
                <span>{judgeModel ? judgeModel : '—'}</span>
              </div>
            </div>
          </div>

          {/* Accordéon System Prompt */}
          <div style={styles.accordion}>
            <button
              onClick={() => setShowSystemPrompt(!showSystemPrompt)}
              style={styles.accordionButton}
            >
              {showSystemPrompt ? '▼' : '▶'} System Prompt
            </button>
            {showSystemPrompt && (
              <div style={styles.accordionContent}>
                <pre style={styles.systemPromptText}>{systemPrompt}</pre>
              </div>
            )}
          </div>
        </section>

        {/* ─── Section 2: Dataset ─── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📊 Dataset</h2>
          <div style={styles.cardsGrid}>
            <div style={styles.card}>
              <div style={styles.cardValue}>{entries.length}</div>
              <div style={styles.cardLabel}>Entrées</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardValue}>{judgedCount}</div>
              <div style={styles.cardLabel}>Entrées jugées</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardValue}>{avgOutputSize}</div>
              <div style={styles.cardLabel}>Caractères/Entrée</div>
            </div>
            <div style={styles.card}>
              <div style={styles.cardValue}>{(totalSize / 1024).toFixed(1)}</div>
              <div style={styles.cardLabel}>Taille (KB)</div>
            </div>
          </div>

          {/* Enum field distributions + Judge scores on same line */}
          {entries.length > 0 && (enumFieldDistributions.length > 0 || judgedCount > 0) && (
            <div style={{ marginTop: 24, display: 'flex', gap: 40, alignItems: 'flex-start' }}>
              {/* Left: Enum distributions */}
              {enumFieldDistributions.length > 0 && (
                <div style={{ flex: 1 }}>
                  {enumFieldDistributions.map(({ fieldName, distribution }) => (
                    <div key={fieldName} style={{ marginBottom: 32 }}>
                      <h3 style={styles.subtitle}>Distribution — {fieldName}</h3>
                      {distribution.length > 0 ? (
                        <PieChart data={distribution} />
                      ) : (
                        <div style={{ color: '#888', fontSize: 14 }}>Aucune donnée</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Right: Judge scores distribution */}
              {judgedCount > 0 && (
                <div style={{ flex: 1 }}>
                  <h3 style={styles.subtitle}>Distribution des scores</h3>
                  <PieChart
                    data={(() => {
                      const scoreGroups: Record<number, number> = {};
                      (entries as AffinageEntry[]).forEach(e => {
                        if (e.judgeScore !== undefined) {
                          const bucket = Math.round(e.judgeScore);
                          scoreGroups[bucket] = (scoreGroups[bucket] || 0) + 1;
                        }
                      });
                      return Object.entries(scoreGroups)
                        .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
                        .map(([score, count]) => ({ label: `${score}/10`, value: count }));
                    })()}
                  />
                </div>
              )}
            </div>
          )}
          {entries.length > 0 && enumFieldDistributions.length === 0 && (
            <div style={{ marginTop: 24, color: '#888', fontSize: 14 }}>
              Aucun champ énuméré détecté dans les données
            </div>
          )}

          {/* Quality badge */}
          {entries.length > 0 && (
            <div style={{ marginTop: 32 }}>
              <div
                style={{
                  ...styles.qualityBadge,
                  backgroundColor: quality.color
                }}
              >
                <div style={styles.qualityValue}>
                  {avgJudgeScore !== null ? avgJudgeScore.toFixed(1) : '—'}
                </div>
                <div style={styles.qualityLabel}>{quality.label}</div>
              </div>
            </div>
          )}
        </section>

        {/* ─── Section 3: Export ─── */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>📥 Export</h2>

          {/* Format selector cards */}
          <div style={styles.formatCardsGrid}>
            {(['chatml', 'alpaca', 'sharegpt'] as ConversionFormat[]).map(fmt => (
              <div
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                style={{
                  ...styles.formatCard,
                  ...(selectedFormat === fmt ? styles.formatCardActive : {})
                }}
              >
                <div style={styles.formatCardTitle}>{FORMAT_LABELS[fmt]}</div>
                <div style={styles.formatCardDescription}>{FORMAT_DESCRIPTIONS[fmt]}</div>
              </div>
            ))}
          </div>

          {/* Preview */}
          {entries.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={styles.subtitle}>
                Aperçu — <span style={{ color: '#4CAF50' }}>{FORMAT_LABELS[selectedFormat]}</span>
              </h3>
              <pre style={styles.previewBox}>
                {JSON.stringify(convertDataset([entries[0]], systemPrompt, selectedFormat)[0], null, 2)}
              </pre>
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={entries.length === 0}
            style={{
              ...styles.downloadButton,
              opacity: entries.length === 0 ? 0.5 : 1,
              cursor: entries.length === 0 ? 'not-allowed' : 'pointer',
              marginTop: 24
            }}
          >
            Récupérer le dataset
          </button>
        </section>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflowY: 'auto',
    padding: '24px',
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0'
  },
  content: {
    maxWidth: 1000,
    margin: '0 auto',
    width: '100%'
  },
  section: {
    marginBottom: 40,
    backgroundColor: '#252525',
    padding: 20,
    borderRadius: 8,
    borderLeft: '4px solid #4CAF50'
  },
  sectionTitle: {
    margin: '0 0 20px 0',
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50'
  },
  subtitle: {
    margin: '0 0 16px 0',
    fontSize: 14,
    fontWeight: 'bold',
    color: '#b0b0b0'
  },
  generalGrid: {
    display: 'flex',
    gap: 24,
    alignItems: 'flex-start',
    marginBottom: 20
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 8,
    objectFit: 'cover',
    border: '2px solid #4CAF50'
  },
  infoRow: {
    display: 'flex',
    gap: 12,
    marginBottom: 8,
    fontSize: 14
  },
  label: {
    color: '#888',
    minWidth: 140,
    fontWeight: 'bold'
  },
  accordion: {
    marginTop: 16
  },
  accordionButton: {
    width: '100%',
    padding: '12px 16px',
    backgroundColor: '#333',
    color: '#e0e0e0',
    border: '1px solid #444',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'left',
    transition: 'background-color 0.2s'
  },
  accordionContent: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    maxHeight: 200,
    overflowY: 'auto'
  },
  systemPromptText: {
    margin: 0,
    fontSize: 12,
    color: '#aaa',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word'
  },
  cardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 16,
    marginBottom: 20
  },
  card: {
    padding: 16,
    backgroundColor: '#333',
    borderRadius: 6,
    textAlign: 'center',
    border: '1px solid #444'
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8
  },
  cardLabel: {
    fontSize: 12,
    color: '#888'
  },
  qualityBadge: {
    padding: 20,
    borderRadius: 8,
    textAlign: 'center',
    color: 'white'
  },
  qualityValue: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8
  },
  qualityLabel: {
    fontSize: 14,
    fontWeight: 'bold'
  },
  formatCardsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 24
  },
  formatCard: {
    padding: 16,
    backgroundColor: '#333',
    border: '2px solid transparent',
    borderRadius: 8,
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  formatCardActive: {
    backgroundColor: '#2a3a2a',
    borderColor: '#4CAF50'
  },
  formatCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8
  },
  formatCardDescription: {
    fontSize: 12,
    color: '#aaa',
    lineHeight: 1.4
  },
  previewBox: {
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    border: '1px solid #444',
    fontSize: 11,
    color: '#aaa',
    fontFamily: 'monospace',
    overflowX: 'auto',
    maxHeight: 250,
    margin: 0,
    lineHeight: 1.4
  },
  downloadButton: {
    width: '100%',
    padding: '16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
