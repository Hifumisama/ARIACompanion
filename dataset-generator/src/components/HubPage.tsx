import React, { useState } from 'react';
import { CharacterDefinition, PersonalityAxis } from '../types';
import { getFlagForLanguage } from '../data/languages';

/** Mini radar: points only, with hover tooltip */
const MiniRadar = ({ axes, size = 140 }: { axes: PersonalityAxis[]; size?: number }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const count = axes.length;
  if (count < 3) return null;

  const angleStep = (2 * Math.PI) / count;
  const startAngle = -Math.PI / 2;

  const getPoint = (i: number, value: number): [number, number] => {
    const angle = startAngle + i * angleStep;
    const r = (value / 100) * radius;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const getAxisEnd = (i: number): [number, number] => {
    const angle = startAngle + i * angleStep;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)];
  };

  // Grid
  const gridPoints = axes.map((_, i) => getPoint(i, 100).join(',')).join(' ');
  const gridMid = axes.map((_, i) => getPoint(i, 50).join(',')).join(' ');

  // Data polygon
  const dataPoints = axes.map((a, i) => getPoint(i, a.value).join(',')).join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', margin: '0 auto' }}>
      {/* Grid */}
      <polygon points={gridPoints} fill="none" stroke="#333" strokeWidth={1} opacity={0.4} />
      <polygon points={gridMid} fill="none" stroke="#333" strokeWidth={1} opacity={0.25} />
      {/* Axis lines */}
      {axes.map((_, i) => {
        const [ex, ey] = getAxisEnd(i);
        return <line key={i} x1={cx} y1={cy} x2={ex} y2={ey} stroke="#333" strokeWidth={1} opacity={0.2} />;
      })}
      {/* Data shape */}
      <polygon points={dataPoints} fill="rgba(76, 175, 80, 0.15)" stroke="#4CAF50" strokeWidth={1.5} />
      {/* Points with hover */}
      {axes.map((a, i) => {
        const [px, py] = getPoint(i, a.value);
        return (
          <g key={i}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <circle cx={px} cy={py} r={hoveredIdx === i ? 5 : 3.5} fill="#4CAF50" stroke="#1e1e1e" strokeWidth={1.5}
              style={{ transition: 'r 0.15s', cursor: 'default' }} />
            {hoveredIdx === i && (
              <g>
                <rect
                  x={px - 40} y={py - 28}
                  width={80} height={22}
                  rx={4}
                  fill="#0d0d0d" stroke="#4CAF50" strokeWidth={0.5}
                  opacity={0.95}
                />
                <text x={px} y={py - 14} textAnchor="middle" fill="#e0e0e0" fontSize={10} fontWeight={500}>
                  {a.name} {a.value}%
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
};

interface HubPageProps {
  characters: CharacterDefinition[];
  onSelectCharacter: (id: string) => void;
  onCreateCharacter: () => void;
  onDeleteCharacter: (id: string) => void;
}

export const HubPage = ({ characters, onSelectCharacter, onCreateCharacter, onDeleteCharacter }: HubPageProps) => {
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const deleteTarget = deleteTargetId ? characters.find(c => c.id === deleteTargetId) : null;

  return (
    <div style={styles.container}>
      {/* Hero Banner */}
      <div style={styles.hero}>
        <h1 style={styles.heroTitle}>ARIA Character Builder</h1>
        <p style={styles.heroSubtitle}>
          Creez des personnages IA uniques, testez leurs reponses en temps reel,
          et generez des datasets d'entrainement de qualite.
        </p>
        <div style={styles.heroAccent} />
      </div>

      {/* Characters Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>
          Vos personnages
          <span style={styles.sectionCount}>{characters.length}</span>
        </h2>

        <div style={styles.grid}>
          {characters.map(char => {
            const isFlipped = flippedId === char.id;
            const isHovered = hoveredId === char.id;
            return (
              <div
                key={char.id}
                style={styles.cardScene}
                onMouseEnter={() => setHoveredId(char.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div
                  style={{
                    ...styles.cardInner,
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                  }}
                >
                  {/* Front */}
                  <div
                    style={{
                      ...styles.cardFace,
                      ...styles.cardFront,
                      borderColor: isHovered && !isFlipped ? '#4CAF50' : '#333',
                    }}
                    onClick={() => setFlippedId(char.id)}
                  >
                    <div style={styles.avatarContainer}>
                      {char.avatarBase64 ? (
                        <img src={char.avatarBase64} alt={char.name} style={styles.avatarImg} />
                      ) : (
                        <div style={styles.avatarPlaceholder}>
                          <span style={styles.avatarInitial}>
                            {(char.name || '?')[0].toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div style={styles.cardInfo}>
                      <div style={styles.cardName}>{char.name || 'Sans nom'}</div>
                      <div style={styles.cardLang}>
                        {getFlagForLanguage(char.language)} {char.language}
                      </div>
                      <div style={styles.cardMeta}>{char.universe || 'Univers inconnu'}</div>
                      <div style={styles.cardRole}>{char.role || 'Role non defini'}</div>
                    </div>
                  </div>

                  {/* Back */}
                  <div
                    style={{
                      ...styles.cardFace,
                      ...styles.cardBack,
                      borderColor: isHovered && isFlipped ? '#4CAF50' : '#333',
                    }}
                    onClick={(e) => {
                      if (e.target === e.currentTarget || (e.target as HTMLElement).closest('[data-flipback]')) {
                        setFlippedId(null);
                      }
                    }}
                  >
                    <div data-flipback style={styles.cardBackContent}>
                      {/* Mini radar graph — points only with hover tooltips */}
                      {char.personalityAxes.length >= 3 && (
                        <div style={styles.radarContainer}>
                          <MiniRadar axes={char.personalityAxes} size={180} />
                        </div>
                      )}

                      {/* Personality traits list */}
                      {char.personalityAxes.length > 0 && (
                        <div data-flipback style={styles.backSection}>
                          <div style={styles.backSectionLabel}>Personnalite</div>
                          <div style={styles.traitsList}>
                            {char.personalityAxes.map((a, i) => (
                              <span key={i} style={styles.traitChip}>
                                {a.name} <span style={styles.traitPercent}>{a.value}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Vocal style — multi-line */}
                      {(char.speechStyle?.register || char.speechStyle?.languageNotes) && (
                        <div data-flipback style={styles.backSection}>
                          {char.speechStyle.register && (
                            <div style={styles.speechBlock}>
                              <div style={styles.backSectionLabel}>Registre</div>
                              <div style={styles.speechText}>{char.speechStyle.register}</div>
                            </div>
                          )}
                          {char.speechStyle.languageNotes && (
                            <div style={styles.speechBlock}>
                              <div style={styles.backSectionLabel}>Style</div>
                              <div style={styles.speechText}>{char.speechStyle.languageNotes}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={styles.cardActions}>
                      <button
                        style={styles.editButton}
                        onClick={(e) => { e.stopPropagation(); onSelectCharacter(char.id); }}
                      >
                        Modifier
                      </button>
                      <button
                        style={styles.deleteButton}
                        onClick={(e) => { e.stopPropagation(); setDeleteTargetId(char.id); }}
                      >
                        Supprimer
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* New Character Card */}
          <div
            style={styles.cardScene}
            onClick={onCreateCharacter}
            onMouseEnter={() => setHoveredId('__new__')}
            onMouseLeave={() => setHoveredId(null)}
          >
            <div style={{
              ...styles.newCard,
              borderColor: hoveredId === '__new__' ? '#4CAF50' : '#444',
            }}>
              <span style={styles.newCardPlus}>+</span>
              <span style={styles.newCardText}>Nouveau personnage</span>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div style={styles.overlay} onClick={() => setDeleteTargetId(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Supprimer ce personnage ?</h3>
            <div style={styles.modalBody}>
              Etes-vous sur de vouloir supprimer <strong>{deleteTarget.name || 'ce personnage'}</strong> ?
              Cette action est irreversible.
            </div>
            <div style={styles.modalFooter}>
              <button style={styles.cancelButton} onClick={() => setDeleteTargetId(null)}>
                Annuler
              </button>
              <button
                style={styles.confirmDeleteButton}
                onClick={() => {
                  onDeleteCharacter(deleteTarget.id);
                  setDeleteTargetId(null);
                  if (flippedId === deleteTarget.id) setFlippedId(null);
                }}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100%',
  },

  // Hero
  hero: {
    padding: '48px 32px 40px',
    textAlign: 'center',
    background: 'linear-gradient(180deg, #0d0d0d 0%, #1a1a1a 100%)',
    borderBottom: '1px solid #222',
    position: 'relative',
    overflow: 'hidden',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: '#e0e0e0',
    margin: '0 0 12px',
    letterSpacing: '-0.5px',
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#888',
    margin: 0,
    maxWidth: 520,
    marginLeft: 'auto',
    marginRight: 'auto',
    lineHeight: 1.5,
  },
  heroAccent: {
    width: 60,
    height: 3,
    backgroundColor: '#4CAF50',
    borderRadius: 2,
    margin: '20px auto 0',
  },

  // Section
  section: {
    padding: '32px 32px 48px',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#ccc',
    margin: '0 0 24px',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  sectionCount: {
    fontSize: 13,
    color: '#4CAF50',
    backgroundColor: 'rgba(76, 175, 80, 0.12)',
    padding: '2px 10px',
    borderRadius: 12,
    fontWeight: 500,
  },

  // Grid — portrait cards
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 24,
  },

  // Card flip — portrait ratio
  cardScene: {
    perspective: '1000px',
    height: 440,
    cursor: 'pointer',
  },
  cardInner: {
    position: 'relative',
    width: '100%',
    height: '100%',
    transition: 'transform 0.6s',
    transformStyle: 'preserve-3d',
  },
  cardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backfaceVisibility: 'hidden',
    backgroundColor: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: 12,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.2s',
  },
  cardFront: {
    // inherits cardFace
  },
  cardBack: {
    transform: 'rotateY(180deg)',
  },

  // Avatar — takes most of the portrait card
  avatarContainer: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#141414',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 260,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  avatarPlaceholder: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'linear-gradient(135deg, #1a2a1a 0%, #0d1a0d 100%)',
  },
  avatarInitial: {
    fontSize: 64,
    fontWeight: 700,
    color: '#4CAF50',
    opacity: 0.35,
    userSelect: 'none',
  },

  // Card info
  cardInfo: {
    padding: '14px 16px',
  },
  cardName: {
    fontSize: 16,
    fontWeight: 600,
    color: '#e0e0e0',
    marginBottom: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardLang: {
    fontSize: 13,
    color: '#aaa',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 13,
    color: '#777',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  cardRole: {
    fontSize: 12,
    color: '#555',
    marginTop: 2,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  // Card back content
  cardBackContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    overflowY: 'auto',
    gap: 12,
  },
  radarContainer: {
    display: 'flex',
    justifyContent: 'center',
  },

  // Back sections
  backSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderTop: '1px solid #2a2a2a',
    paddingTop: 8,
  },
  backSectionLabel: {
    fontSize: 10,
    color: '#4CAF50',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: 2,
  },

  // Personality chips
  traitsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
  },
  traitChip: {
    fontSize: 11,
    color: '#bbb',
    backgroundColor: '#2a2a2a',
    padding: '2px 8px',
    borderRadius: 10,
    whiteSpace: 'nowrap',
  },
  traitPercent: {
    color: '#4CAF50',
    fontWeight: 600,
    marginLeft: 2,
  },

  // Speech style
  speechBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  speechText: {
    fontSize: 12,
    color: '#999',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },

  // Card actions
  cardActions: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  editButton: {
    flex: 1,
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: '1px solid #4CAF50',
    color: '#4CAF50',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  deleteButton: {
    flex: 1,
    padding: '8px 0',
    backgroundColor: 'transparent',
    border: '1px solid #f44336',
    color: '#f44336',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },

  // New character card
  newCard: {
    width: '100%',
    height: '100%',
    border: '2px dashed #444',
    borderRadius: 12,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    transition: 'border-color 0.2s',
    gap: 12,
    cursor: 'pointer',
  },
  newCardPlus: {
    fontSize: 48,
    fontWeight: 300,
    color: '#555',
    lineHeight: 1,
  },
  newCardText: {
    fontSize: 14,
    color: '#666',
    fontWeight: 500,
  },

  // Modal
  overlay: {
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
  },
  modal: {
    backgroundColor: '#1f1f1f',
    borderRadius: 8,
    border: '1px solid #444',
    width: 420,
    maxWidth: '90vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
  },
  modalTitle: {
    margin: 0,
    padding: '16px 20px',
    borderBottom: '1px solid #333',
    fontSize: 16,
    color: '#e0e0e0',
  },
  modalBody: {
    padding: '20px',
    fontSize: 14,
    color: '#aaa',
    lineHeight: 1.5,
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  cancelButton: {
    padding: '8px 16px',
    backgroundColor: '#333',
    border: 'none',
    color: '#ccc',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
  confirmDeleteButton: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    border: 'none',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
};
