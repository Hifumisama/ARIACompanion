import React, { useState } from 'react';
import { DatasetEntry } from '../types';

const ITEMS_PER_PAGE = 20;

interface ResultPanelProps {
  entries: DatasetEntry[];
  onDownload: () => void;
}

export const ResultPanel: React.FC<ResultPanelProps> = ({ entries }) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showRawJson, setShowRawJson] = useState(false);
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(entries.length / ITEMS_PER_PAGE));
  const pagedEntries = entries.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  // Reset to last page when new entries arrive and we're beyond bounds
  React.useEffect(() => {
    if (page >= totalPages && totalPages > 0) {
      setPage(totalPages - 1);
    }
  }, [entries.length, totalPages, page]);

  const toggleExpanded = (id: number) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const handleDownload = () => {
    const dataStr = JSON.stringify(entries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataset_generated_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={{ margin: 0 }}>Entrees generees ({entries.length})</h3>
        <div style={styles.buttons}>
          {entries.length > 0 && (
            <>
              <button
                onClick={() => setShowRawJson(!showRawJson)}
                style={{ ...styles.button, backgroundColor: showRawJson ? '#FF9800' : '#555' }}
              >
                {showRawJson ? 'Vue structuree' : 'Mode brut'}
              </button>
              <button onClick={handleDownload} style={styles.downloadButton}>
                Telecharger JSON
              </button>
            </>
          )}
        </div>
      </div>

      <div style={styles.list}>
        {entries.length === 0 ? (
          <p style={styles.empty}>Aucune entree generee.</p>
        ) : showRawJson ? (
          <pre style={styles.rawJson}>{JSON.stringify(entries, null, 2)}</pre>
        ) : (
          <>
            {pagedEntries.map(entry => {
              const isExpanded = expandedIds.has(entry.id);
              return (
                <div key={entry.id} style={styles.entry}>
                  <button
                    onClick={() => toggleExpanded(entry.id)}
                    style={styles.expandButton}
                  >
                    <span style={styles.arrow}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={styles.id}>#{entry.id}</span>
                    <span style={styles.context}>{entry.context}</span>
                    <span style={styles.tone}>{entry.output.tone}</span>
                  </button>

                  {isExpanded && (
                    <div style={styles.expanded}>
                      <Field label="Context" value={entry.context} />
                      <Field label="Instruction" value={entry.instruction} />
                      <Field label="Input" value={entry.input} />
                      <Field label="Tone" value={entry.output.tone} />
                      <Field label="Action" value={entry.output.action} />
                      <Field label="Text" value={entry.output.text} last />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={styles.pagination}>
                <button
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                  style={styles.pageButton}
                >
                  ««
                </button>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={styles.pageButton}
                >
                  «
                </button>
                <span style={styles.pageInfo}>
                  Page {page + 1} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  style={styles.pageButton}
                >
                  »
                </button>
                <button
                  onClick={() => setPage(totalPages - 1)}
                  disabled={page >= totalPages - 1}
                  style={styles.pageButton}
                >
                  »»
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; last?: boolean }> = ({
  label,
  value,
  last
}) => (
  <div style={{ ...fieldStyles.field, ...(last ? { borderBottom: 'none', marginBottom: 0, paddingBottom: 0 } : {}) }}>
    <strong style={fieldStyles.label}>{label}</strong>
    <p style={fieldStyles.value}>{value}</p>
  </div>
);

const fieldStyles = {
  field: {
    marginBottom: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid #333'
  } as React.CSSProperties,
  label: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  } as React.CSSProperties,
  value: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    lineHeight: '1.5'
  } as React.CSSProperties
};

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minHeight: 0
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '12px',
    flexShrink: 0
  } as React.CSSProperties,
  buttons: {
    display: 'flex',
    gap: '8px'
  } as React.CSSProperties,
  button: {
    padding: '6px 12px',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  } as React.CSSProperties,
  downloadButton: {
    padding: '6px 12px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  } as React.CSSProperties,
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  } as React.CSSProperties,
  empty: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '40px 20px'
  } as React.CSSProperties,
  rawJson: {
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
    border: '1px solid #333',
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#4CAF50',
    overflow: 'auto',
    margin: 0
  } as React.CSSProperties,
  entry: {
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
    border: '1px solid #333',
    borderLeft: '3px solid #4CAF50',
    overflow: 'hidden'
  } as React.CSSProperties,
  expandButton: {
    width: '100%',
    padding: '10px 12px',
    backgroundColor: 'transparent',
    color: '#e0e0e0',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px'
  } as React.CSSProperties,
  arrow: {
    fontSize: '10px',
    minWidth: '12px',
    color: '#666'
  } as React.CSSProperties,
  id: {
    fontSize: '12px',
    color: '#4CAF50',
    fontFamily: 'monospace',
    fontWeight: 'bold',
    minWidth: '45px'
  } as React.CSSProperties,
  context: {
    fontSize: '12px',
    color: '#aaa',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  } as React.CSSProperties,
  tone: {
    fontSize: '11px',
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    padding: '2px 6px',
    backgroundColor: '#2a2a2a',
    borderRadius: '3px'
  } as React.CSSProperties,
  expanded: {
    padding: '12px',
    backgroundColor: '#0f0f0f',
    borderTop: '1px solid #333',
    fontSize: '12px'
  } as React.CSSProperties,
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 0',
    flexShrink: 0
  } as React.CSSProperties,
  pageButton: {
    padding: '6px 10px',
    backgroundColor: '#333',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  } as React.CSSProperties,
  pageInfo: {
    fontSize: '13px',
    color: '#888',
    padding: '0 8px'
  } as React.CSSProperties
};
