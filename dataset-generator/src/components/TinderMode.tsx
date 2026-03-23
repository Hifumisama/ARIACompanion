import React, { useState, useEffect, useCallback } from 'react';
import { AffinageEntry, OutputFieldDefinition } from '../types';

interface TinderModeProps {
  entries: AffinageEntry[];
  outputFields: OutputFieldDefinition[];
  onExit: () => void;
  onDownloadLiked: (liked: AffinageEntry[]) => void;
  onRegenerateDisliked: (disliked: AffinageEntry[]) => void;
}

export const TinderMode = ({
  entries,
  outputFields,
  onExit,
  onDownloadLiked,
  onRegenerateDisliked
}: TinderModeProps) => {
  const [queue] = useState<AffinageEntry[]>([...entries]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [liked, setLiked] = useState<AffinageEntry[]>([]);
  const [disliked, setDisliked] = useState<AffinageEntry[]>([]);
  const [expandedLiked, setExpandedLiked] = useState<Set<number>>(new Set());
  const [expandedDisliked, setExpandedDisliked] = useState<Set<number>>(new Set());
  const [swipeAnim, setSwipeAnim] = useState<'left' | 'right' | null>(null);

  const currentEntry = currentIndex < queue.length ? queue[currentIndex] : null;
  const isComplete = currentIndex >= queue.length && queue.length > 0;
  const totalSeen = liked.length + disliked.length;

  // Keyboard controls
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!currentEntry) return;
    if (e.key === 'ArrowRight') swipe('like');
    if (e.key === 'ArrowLeft') swipe('dislike');
  }, [currentEntry, currentIndex]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const swipe = (direction: 'like' | 'dislike') => {
    if (!currentEntry) return;
    setSwipeAnim(direction === 'like' ? 'right' : 'left');
    setTimeout(() => {
      if (direction === 'like') {
        setLiked(prev => [...prev, currentEntry]);
      } else {
        setDisliked(prev => [...prev, currentEntry]);
      }
      setCurrentIndex(prev => prev + 1);
      setSwipeAnim(null);
    }, 250);
  };

  const moveToOpposite = (entry: AffinageEntry, from: 'liked' | 'disliked') => {
    if (from === 'liked') {
      setLiked(prev => prev.filter(e => e.id !== entry.id));
      setDisliked(prev => [...prev, entry]);
    } else {
      setDisliked(prev => prev.filter(e => e.id !== entry.id));
      setLiked(prev => [...prev, entry]);
    }
  };

  const toggleExpand = (id: number, list: 'liked' | 'disliked') => {
    const setter = list === 'liked' ? setExpandedLiked : setExpandedDisliked;
    setter(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleRegenerateDisliked = () => {
    onRegenerateDisliked(disliked);
  };

  // Called from parent after regeneration completes — add regenerated entries back to queue
  // This is handled via the parent re-mounting with new entries

  return (
    <div style={styles.container}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button onClick={onExit} style={styles.exitBtn}>
          Quitter le mode Tinder
        </button>
        <span style={styles.topTitle}>Mode Tinder</span>
        <span style={styles.counter}>
          {totalSeen} / {queue.length} triees
        </span>
      </div>

      {/* Main layout: disliked | card | liked */}
      <div style={styles.mainLayout}>
        {/* Disliked list */}
        <SideList
          title="Disliked"
          entries={disliked}
          color="#f44336"
          expandedIds={expandedDisliked}
          outputFields={outputFields}
          onToggleExpand={(id) => toggleExpand(id, 'disliked')}
          onMoveToOpposite={(entry) => moveToOpposite(entry, 'disliked')}
          moveLabel="Deplacer vers Liked"
          moveColor="#4CAF50"
        />

        {/* Center card */}
        <div style={styles.centerColumn}>
          {currentEntry ? (
            <>
              <div
                style={{
                  ...styles.card,
                  ...(swipeAnim === 'left' ? styles.swipeLeft : {}),
                  ...(swipeAnim === 'right' ? styles.swipeRight : {})
                }}
              >
                <div style={styles.cardHeader}>
                  <span style={styles.cardId}>#{currentEntry.id}</span>
                  {currentEntry.output.tone && <span style={styles.cardTone}>{currentEntry.output.tone}</span>}
                  {currentEntry.judgeScore !== undefined && (
                    <span style={{
                      ...styles.cardScore,
                      backgroundColor: currentEntry.judgeScore >= 8 ? '#4CAF50'
                        : currentEntry.judgeScore >= 5 ? '#FF9800' : '#f44336'
                    }}>
                      {currentEntry.judgeScore}/10
                    </span>
                  )}
                </div>

                <CardField label="Context" value={currentEntry.context} />
                <CardField label="Instruction" value={currentEntry.instruction} />
                <CardField label="Input" value={currentEntry.input} />
                {outputFields.length > 0
                  ? outputFields.map(f => (
                      <CardField key={f.name} label={f.name} value={currentEntry.output[f.name] || ''} />
                    ))
                  : Object.entries(currentEntry.output).map(([key, val]) => (
                      <CardField key={key} label={key} value={val} />
                    ))
                }
                {currentEntry.judgeComment && (
                  <CardField label="Commentaire du juge" value={currentEntry.judgeComment} />
                )}
              </div>

              {/* Swipe buttons */}
              <div style={styles.swipeButtons}>
                <button
                  onClick={() => swipe('dislike')}
                  style={styles.dislikeBtn}
                  title="Dislike (Fleche gauche)"
                >
                  ✕
                </button>
                <span style={styles.swipeHint}>← / →</span>
                <button
                  onClick={() => swipe('like')}
                  style={styles.likeBtn}
                  title="Like (Fleche droite)"
                >
                  ✓
                </button>
              </div>

              {/* Progress counter */}
              <div style={styles.progressCounter}>
                {totalSeen} / {queue.length}
              </div>
            </>
          ) : isComplete ? (
            <div style={styles.completionPanel}>
              <h3 style={styles.completionTitle}>Tri termine !</h3>
              <p style={styles.completionStats}>
                {liked.length} liked · {disliked.length} disliked
              </p>
              <div style={styles.completionActions}>
                <button
                  onClick={() => onDownloadLiked(liked)}
                  style={styles.downloadBtn}
                  disabled={liked.length === 0}
                >
                  Telecharger les liked ({liked.length})
                </button>
                <button
                  onClick={handleRegenerateDisliked}
                  style={styles.regenerateBtn}
                  disabled={disliked.length === 0}
                >
                  Regenerer les disliked ({disliked.length})
                </button>
                <button onClick={onExit} style={styles.exitBtnAlt}>
                  Retour au mode classique
                </button>
              </div>
            </div>
          ) : (
            <p style={styles.emptyMsg}>Aucune entree a trier.</p>
          )}
        </div>

        {/* Liked list */}
        <SideList
          title="Liked"
          entries={liked}
          color="#4CAF50"
          expandedIds={expandedLiked}
          outputFields={outputFields}
          onToggleExpand={(id) => toggleExpand(id, 'liked')}
          onMoveToOpposite={(entry) => moveToOpposite(entry, 'liked')}
          moveLabel="Deplacer vers Disliked"
          moveColor="#f44336"
        />
      </div>

      {/* Animations */}
      <style>{`
        @keyframes swipeLeft {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(-120px); opacity: 0; }
        }
        @keyframes swipeRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(120px); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

// ── Sub-components ──

const CardField = ({ label, value }: { label: string; value: string }) => (
  <div style={cardFieldStyles.field}>
    <span style={cardFieldStyles.label}>{label}</span>
    <p style={cardFieldStyles.value}>{value}</p>
  </div>
);

interface SideListProps {
  title: string;
  entries: AffinageEntry[];
  color: string;
  expandedIds: Set<number>;
  outputFields: OutputFieldDefinition[];
  onToggleExpand: (id: number) => void;
  onMoveToOpposite: (entry: AffinageEntry) => void;
  moveLabel: string;
  moveColor: string;
}

const SideList = ({
  title, entries, color, expandedIds, outputFields,
  onToggleExpand, onMoveToOpposite, moveLabel, moveColor
}: SideListProps) => (
  <div style={styles.sideList}>
    <div style={{ ...styles.sideListHeader, borderBottomColor: color }}>
      <span style={{ color }}>{title}</span>
      <span style={styles.sideListCount}>{entries.length}</span>
    </div>
    <div style={styles.sideListItems}>
      {entries.length === 0 ? (
        <p style={styles.sideListEmpty}>Vide</p>
      ) : (
        entries.map(entry => {
          const isExpanded = expandedIds.has(entry.id);
          return (
            <div key={entry.id} style={{ ...styles.sideListEntry, borderLeftColor: color }}>
              <button
                onClick={() => onToggleExpand(entry.id)}
                style={styles.sideListEntryBtn}
              >
                <span style={styles.sideListArrow}>{isExpanded ? '▼' : '▶'}</span>
                <span style={{ ...styles.sideListId, color }}>#{entry.id}</span>
                <span style={styles.sideListContext}>{entry.context}</span>
              </button>

              {isExpanded && (
                <div style={styles.sideListExpanded}>
                  <CardField label="Context" value={entry.context} />
                  <CardField label="Instruction" value={entry.instruction} />
                  <CardField label="Input" value={entry.input} />
                  {outputFields.length > 0
                    ? outputFields.map(f => (
                        <CardField key={f.name} label={f.name} value={entry.output[f.name] || ''} />
                      ))
                    : Object.entries(entry.output).map(([key, val]) => (
                        <CardField key={key} label={key} value={val} />
                      ))
                  }
                  <button
                    onClick={() => onMoveToOpposite(entry)}
                    style={{ ...styles.moveBtn, backgroundColor: moveColor }}
                  >
                    {moveLabel}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  </div>
);

// ── Styles ──

const cardFieldStyles: Record<string, React.CSSProperties> = {
  field: {
    marginBottom: '8px',
    paddingBottom: '8px',
    borderBottom: '1px solid #333'
  },
  label: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 'bold'
  },
  value: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#e0e0e0'
  }
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #333',
    flexShrink: 0
  },
  topTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#FF9800'
  },
  counter: {
    fontSize: '13px',
    color: '#888',
    fontWeight: 'bold'
  },
  exitBtn: {
    padding: '6px 14px',
    backgroundColor: '#555',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },

  // Main layout
  mainLayout: {
    flex: 1,
    display: 'flex',
    gap: '16px',
    padding: '16px',
    minHeight: 0,
    overflow: 'hidden'
  },

  // Center column
  centerColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
    gap: '16px'
  },
  card: {
    width: '100%',
    maxWidth: '550px',
    backgroundColor: '#1f1f1f',
    border: '1px solid #444',
    borderRadius: '10px',
    padding: '20px',
    maxHeight: '60vh',
    overflowY: 'auto',
    transition: 'transform 0.25s ease, opacity 0.25s ease'
  },
  swipeLeft: {
    animation: 'swipeLeft 0.25s ease forwards'
  },
  swipeRight: {
    animation: 'swipeRight 0.25s ease forwards'
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '16px',
    paddingBottom: '12px',
    borderBottom: '2px solid #333'
  },
  cardId: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#FF9800',
    fontSize: '16px'
  },
  cardTone: {
    fontSize: '11px',
    color: '#888',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    padding: '2px 8px',
    backgroundColor: '#2a2a2a',
    borderRadius: '3px'
  },
  cardScore: {
    fontSize: '11px',
    color: 'white',
    fontWeight: 'bold',
    padding: '2px 8px',
    borderRadius: '10px',
    marginLeft: 'auto'
  },

  // Swipe buttons
  swipeButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '24px'
  },
  dislikeBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '24px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s',
  },
  likeBtn: {
    width: '56px',
    height: '56px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: '24px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s',
  },
  swipeHint: {
    fontSize: '12px',
    color: '#666'
  },
  progressCounter: {
    fontSize: '14px',
    color: '#888',
    fontWeight: 'bold'
  },

  // Completion panel
  completionPanel: {
    textAlign: 'center',
    padding: '40px 20px'
  },
  completionTitle: {
    fontSize: '22px',
    margin: '0 0 8px 0',
    color: '#4CAF50'
  },
  completionStats: {
    fontSize: '15px',
    color: '#aaa',
    margin: '0 0 24px 0'
  },
  completionActions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center'
  },
  downloadBtn: {
    padding: '10px 24px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '280px'
  },
  regenerateBtn: {
    padding: '10px 24px',
    backgroundColor: '#FF9800',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '280px'
  },
  exitBtnAlt: {
    padding: '10px 24px',
    backgroundColor: '#555',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    minWidth: '280px'
  },
  emptyMsg: {
    color: '#666',
    fontStyle: 'italic',
    fontSize: '15px'
  },

  // Side lists
  sideList: {
    width: '260px',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#141414',
    borderRadius: '8px',
    border: '1px solid #333',
    overflow: 'hidden'
  },
  sideListHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    fontWeight: 'bold',
    fontSize: '14px',
    borderBottom: '2px solid',
    flexShrink: 0
  },
  sideListCount: {
    fontSize: '12px',
    color: '#888',
    backgroundColor: '#2a2a2a',
    padding: '2px 8px',
    borderRadius: '10px'
  },
  sideListItems: {
    flex: 1,
    overflowY: 'auto',
    padding: '6px'
  },
  sideListEmpty: {
    color: '#555',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '20px 10px',
    fontSize: '12px'
  },
  sideListEntry: {
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
    borderLeft: '3px solid',
    marginBottom: '4px',
    overflow: 'hidden'
  },
  sideListEntryBtn: {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'transparent',
    color: '#e0e0e0',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px'
  },
  sideListArrow: {
    fontSize: '9px',
    color: '#666',
    minWidth: '10px'
  },
  sideListId: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: '11px',
    flexShrink: 0
  },
  sideListContext: {
    fontSize: '11px',
    color: '#aaa',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  sideListExpanded: {
    padding: '10px',
    backgroundColor: '#0f0f0f',
    borderTop: '1px solid #333'
  },
  moveBtn: {
    marginTop: '8px',
    padding: '4px 10px',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold',
    width: '100%'
  }
};
