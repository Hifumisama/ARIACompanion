import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DatasetEntry, AffinageEntry, OutputFieldDefinition, CharacterDefinition } from '../types';
import { fetchAvailableModels, judgeEntry, regenerateEntry, improveJudgePrompt } from '../services/ollama';
import { buildDefaultJudgePrompt } from '../services/characterPrompt';
import { TinderMode } from './TinderMode';

interface AffinagePanelProps {
  entries: DatasetEntry[];
  systemPrompt: string;
  outputFields: OutputFieldDefinition[];
  character: CharacterDefinition | null;
  onEntriesUpdate: (entries: DatasetEntry[]) => void;
}

type ModalType = 'edit' | 'analyze' | 'regenerate' | null;
type SortOrder = 'none' | 'asc' | 'desc';

interface Toast {
  message: string;
  type: 'success' | 'error';
  id: number;
}

const ITEMS_PER_PAGE = 20;

// Notification sound via Web Audio API
function playNotificationSound(success: boolean) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;

    if (success) {
      osc.frequency.value = 523;
      osc.type = 'sine';
      osc.start();
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.25);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
      osc.stop(ctx.currentTime + 0.4);
    } else {
      osc.frequency.value = 330;
      osc.type = 'square';
      osc.start();
      osc.frequency.setValueAtTime(260, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + 0.2);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Audio not available
  }
}

export const AffinagePanel = ({
  entries,
  outputFields,
  character,
  onEntriesUpdate
}: AffinagePanelProps) => {
  const [affinageEntries, setAffinageEntries] = useState<AffinageEntry[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [models, setModels] = useState<string[]>([]);
  const [scoreSort, setScoreSort] = useState<SortOrder>('none');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  // Tinder mode
  const [tinderMode, setTinderMode] = useState(false);

  // Modal state
  const [modalType, setModalType] = useState<ModalType>(null);
  const [modalModel, setModalModel] = useState('');
  const [modalPrompt, setModalPrompt] = useState('');
  const [editEntry, setEditEntry] = useState<AffinageEntry | null>(null);
  const [useJudgeComments, setUseJudgeComments] = useState(false);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState({ current: 0, total: 0 });
  const [lastJudgeModel, setLastJudgeModel] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  // Toast helper
  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { message, type, id }]);
    playNotificationSound(type === 'success');
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  // Sync entries from generation tab
  useEffect(() => {
    setAffinageEntries(entries.map(e => {
      const existing = affinageEntries.find(ae => ae.id === e.id);
      return existing || { ...e };
    }));
  }, [entries]);

  useEffect(() => {
    fetchAvailableModels().then(m => {
      setModels(m);
    });
  }, []);

  // Sorted entries
  const sortedEntries = React.useMemo(() => {
    if (scoreSort === 'none') return affinageEntries;
    return [...affinageEntries].sort((a, b) => {
      const sa = a.judgeScore ?? -1;
      const sb = b.judgeScore ?? -1;
      return scoreSort === 'asc' ? sa - sb : sb - sa;
    });
  }, [affinageEntries, scoreSort]);

  const totalPages = Math.max(1, Math.ceil(sortedEntries.length / ITEMS_PER_PAGE));
  const pagedEntries = sortedEntries.slice(
    page * ITEMS_PER_PAGE,
    (page + 1) * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (page >= totalPages && totalPages > 0) setPage(totalPages - 1);
  }, [sortedEntries.length, totalPages, page]);

  // Selection
  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === affinageEntries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(affinageEntries.map(e => e.id)));
    }
  };

  const cycleScoreSort = () => {
    setScoreSort(prev => prev === 'none' ? 'desc' : prev === 'desc' ? 'asc' : 'none');
  };

  const sortIndicator = scoreSort === 'asc' ? ' ▲' : scoreSort === 'desc' ? ' ▼' : '';

  // Import JSON
  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const imported: DatasetEntry[] = (Array.isArray(parsed) ? parsed : parsed.data || [])
          .filter((e: any) => e.id !== undefined && e.context && e.instruction && e.input && e.output);
        if (imported.length === 0) {
          showToast('Aucune entree valide trouvee dans le fichier.', 'error');
          return;
        }
        onEntriesUpdate([...entries, ...imported]);
        showToast(`${imported.length} entree(s) importee(s)`, 'success');
      } catch {
        showToast('Erreur lors de la lecture du fichier JSON.', 'error');
      }
    };
    input.click();
  };

  // Export JSON
  const handleExport = () => {
    const cleanEntries = affinageEntries.map(({ judgeScore, judgeComment, ...rest }) => rest);
    const dataStr = JSON.stringify(cleanEntries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataset_affine_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${cleanEntries.length} entrees exportees`, 'success');
  };

  // Delete selected
  const handleDelete = () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    const remaining = affinageEntries.filter(e => !selectedIds.has(e.id));
    setAffinageEntries(remaining);
    onEntriesUpdate(remaining.map(({ judgeScore, judgeComment, ...rest }) => rest));
    setSelectedIds(new Set());
    showToast(`${count} entree(s) supprimee(s)`, 'success');
  };

  // Open edit modal
  const openEdit = (entry: AffinageEntry) => {
    setEditEntry({ ...entry });
    setModalType('edit');
  };

  // Save edit
  const saveEdit = () => {
    if (!editEntry) return;
    const updated = affinageEntries.map(e =>
      e.id === editEntry.id ? { ...editEntry, judgeScore: undefined, judgeComment: undefined } : e
    );
    setAffinageEntries(updated);
    onEntriesUpdate(updated.map(({ judgeScore, judgeComment, ...rest }) => rest));
    setModalType(null);
    setEditEntry(null);
  };

  // Open analyze modal — pre-fill with default judge prompt from character
  const openAnalyze = () => {
    const defaultPrompt = character ? buildDefaultJudgePrompt(character) : '';
    setModalPrompt(defaultPrompt);
    setModalModel(models[0] || '');
    setModalType('analyze');
  };

  // Improve judge prompt via LLM
  const handleImproveJudgePrompt = async () => {
    if (!modalModel || !modalPrompt.trim()) return;
    setIsGeneratingPrompt(true);
    try {
      const improved = await improveJudgePrompt(modalPrompt, modalModel);
      setModalPrompt(improved);
    } catch (err) {
      showToast('Erreur lors de l\'amelioration de la prompt juge', 'error');
      console.error(err);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Run analysis
  const runAnalysis = async () => {
    const usedModel = modalModel;
    const usedPrompt = modalPrompt;
    setModalType(null);
    setIsProcessing(true);
    setLastJudgeModel(usedModel);
    abortRef.current = new AbortController();

    const targetIds = selectedIds.size > 0
      ? Array.from(selectedIds)
      : affinageEntries.map(e => e.id);

    setProcessProgress({ current: 0, total: targetIds.length });
    const updated = [...affinageEntries];
    let successCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      if (abortRef.current.signal.aborted) break;
      const idx = updated.findIndex(e => e.id === targetIds[i]);
      if (idx === -1) continue;

      try {
        const { score, comment } = await judgeEntry(
          updated[idx],
          usedModel,
          usedPrompt,
          character,
          abortRef.current.signal
        );
        updated[idx] = { ...updated[idx], judgeScore: score, judgeComment: comment };
        setAffinageEntries([...updated]);
        setProcessProgress({ current: i + 1, total: targetIds.length });
        successCount++;
      } catch (err) {
        if (abortRef.current.signal.aborted) break;
        console.error(`Judge error for entry ${targetIds[i]}:`, err);
      }
    }

    setIsProcessing(false);
    abortRef.current = null;

    if (abortRef.current === null) {
      showToast(`Analyse terminee : ${successCount}/${targetIds.length} entrees evaluees`, successCount > 0 ? 'success' : 'error');
    }
  };

  // Open regenerate modal
  const openRegenerate = () => {
    if (selectedIds.size === 0) return;
    setModalPrompt('');
    setModalModel(models[0] || '');
    setUseJudgeComments(false);
    setModalType('regenerate');
  };

  // Run regeneration
  const runRegeneration = async () => {
    const useComments = useJudgeComments;
    const usedPrompt = modalPrompt;
    setModalType(null);
    setIsProcessing(true);
    abortRef.current = new AbortController();

    const targetIds = Array.from(selectedIds);
    setProcessProgress({ current: 0, total: targetIds.length });
    const updated = [...affinageEntries];
    let successCount = 0;

    for (let i = 0; i < targetIds.length; i++) {
      if (abortRef.current.signal.aborted) break;
      const idx = updated.findIndex(e => e.id === targetIds[i]);
      if (idx === -1) continue;

      try {
        const newEntry = await regenerateEntry(
          updated[idx],
          modalModel,
          usedPrompt,
          useComments,
          outputFields,
          abortRef.current.signal
        );
        updated[idx] = { ...newEntry, judgeScore: undefined, judgeComment: undefined };
        setAffinageEntries([...updated]);
        onEntriesUpdate(updated.map(({ judgeScore, judgeComment, ...rest }) => rest));
        setProcessProgress({ current: i + 1, total: targetIds.length });
        successCount++;
      } catch (err) {
        if (abortRef.current.signal.aborted) break;
        console.error(`Regenerate error for entry ${targetIds[i]}:`, err);
      }
    }

    setIsProcessing(false);
    abortRef.current = null;

    showToast(`Regeneration terminee : ${successCount}/${targetIds.length} entrees`, successCount > 0 ? 'success' : 'error');
  };

  const cancelProcessing = () => {
    abortRef.current?.abort();
  };

  const scoreColor = (score?: number) => {
    if (score === undefined) return '#555';
    if (score >= 8) return '#4CAF50';
    if (score >= 5) return '#FF9800';
    return '#f44336';
  };

  // Check if any selected entry has a judge comment
  const hasJudgeComments = Array.from(selectedIds).some(id => {
    const e = affinageEntries.find(ae => ae.id === id);
    return e?.judgeComment;
  });

  // Tinder mode callbacks
  const handleTinderDownloadLiked = (liked: AffinageEntry[]) => {
    const cleanEntries = liked.map(({ judgeScore, judgeComment, ...rest }) => rest);
    const dataStr = JSON.stringify(cleanEntries, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataset_liked_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${cleanEntries.length} entrees liked exportees`, 'success');
    setTinderMode(false);
  };

  const handleTinderRegenerateDisliked = (dislikedEntries: AffinageEntry[]) => {
    // Pre-select the disliked entries and open the regeneration modal
    setSelectedIds(new Set(dislikedEntries.map(e => e.id)));
    setModalPrompt('');
    setModalModel(models[0] || '');
    setUseJudgeComments(false);
    setModalType('regenerate');
    // We stay in tinder mode — after regeneration the entries will be updated
    // and the user can re-enter tinder mode with fresh entries
    setTinderMode(false);
  };

  // Tinder mode render
  if (tinderMode) {
    return (
      <div style={styles.container}>
        {/* Toast notifications */}
        <div style={styles.toastContainer}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              style={{
                ...styles.toast,
                backgroundColor: toast.type === 'success' ? '#2e7d32' : '#c62828',
                animation: 'toastSlide 0.3s ease-out'
              }}
            >
              <span style={styles.toastIcon}>{toast.type === 'success' ? '\u2713' : '\u2717'}</span>
              {toast.message}
            </div>
          ))}
        </div>
        <TinderMode
          entries={affinageEntries}
          outputFields={outputFields}
          onExit={() => setTinderMode(false)}
          onDownloadLiked={handleTinderDownloadLiked}
          onRegenerateDisliked={handleTinderRegenerateDisliked}
        />
        <style>{`
          @keyframes toastSlide {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toast notifications */}
      <div style={styles.toastContainer}>
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              ...styles.toast,
              backgroundColor: toast.type === 'success' ? '#2e7d32' : '#c62828',
              animation: 'toastSlide 0.3s ease-out'
            }}
          >
            <span style={styles.toastIcon}>{toast.type === 'success' ? '\u2713' : '\u2717'}</span>
            {toast.message}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button onClick={handleImport} style={styles.btnSecondary} disabled={isProcessing}>
            Importer JSON
          </button>
          <button
            onClick={handleExport}
            style={{ ...styles.btnSecondary, backgroundColor: '#2196F3' }}
            disabled={affinageEntries.length === 0}
          >
            Exporter JSON
          </button>
          <button
            onClick={() => setTinderMode(true)}
            style={{ ...styles.btnSecondary, backgroundColor: '#FF9800' }}
            disabled={affinageEntries.length === 0 || isProcessing}
          >
            Mode Tinder
          </button>
        </div>
        <div style={styles.toolbarRight}>
          {isProcessing ? (
            <div style={styles.progressInline}>
              <span style={styles.progressText}>
                {processProgress.current} / {processProgress.total}
              </span>
              <button onClick={cancelProcessing} style={styles.btnDanger}>Annuler</button>
            </div>
          ) : (
            <>
              <button
                onClick={openAnalyze}
                style={styles.btnPrimary}
                disabled={affinageEntries.length === 0}
              >
                Analyser
              </button>
              <button
                onClick={openRegenerate}
                style={{ ...styles.btnSecondary, backgroundColor: '#FF9800' }}
                disabled={selectedIds.size === 0}
              >
                Regenerer
              </button>
              <button
                onClick={handleDelete}
                style={styles.btnDanger}
                disabled={selectedIds.size === 0}
              >
                Supprimer
              </button>
            </>
          )}
        </div>
      </div>

      {/* Selection info */}
      {affinageEntries.length > 0 && (
        <div style={styles.selectionInfo}>
          {selectedIds.size > 0
            ? `${selectedIds.size} entree(s) selectionnee(s) sur ${affinageEntries.length}`
            : `${affinageEntries.length} entrees`
          }
        </div>
      )}

      {/* Table */}
      {affinageEntries.length === 0 ? (
        <p style={styles.empty}>
          Aucune entree. Generez des donnees dans l'onglet Generation ou importez un fichier JSON.
        </p>
      ) : (
        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    checked={selectedIds.size === affinageEntries.length && affinageEntries.length > 0}
                    onChange={toggleSelectAll}
                    style={styles.checkbox}
                  />
                </th>
                <th style={{ ...styles.th, width: '60px' }}>ID</th>
                <th style={styles.th}>Contexte</th>
                <th style={styles.th}>Instruction</th>
                <th
                  style={{ ...styles.th, width: '80px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                  onClick={cycleScoreSort}
                  title="Cliquer pour trier par score"
                >
                  Score{sortIndicator}
                </th>
                <th style={{ ...styles.th, width: '80px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedEntries.map(entry => (
                <React.Fragment key={entry.id}>
                  <tr
                    style={{
                      ...styles.tr,
                      backgroundColor: expandedId === entry.id ? '#2a2a2a' : undefined
                    }}
                  >
                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(entry.id)}
                        onChange={() => toggleSelect(entry.id)}
                        style={styles.checkbox}
                      />
                    </td>
                    <td
                      style={{ ...styles.td, ...styles.idCell, cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      #{entry.id}
                    </td>
                    <td
                      style={{ ...styles.td, ...styles.truncated, cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      {entry.context}
                    </td>
                    <td
                      style={{ ...styles.td, ...styles.truncated, cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    >
                      {entry.instruction}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {entry.judgeScore !== undefined ? (
                        <span style={{
                          ...styles.scoreBadge,
                          backgroundColor: scoreColor(entry.judgeScore)
                        }}>
                          {entry.judgeScore}
                        </span>
                      ) : (
                        <span style={styles.noScore}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(entry); }}
                        style={styles.btnSmall}
                      >
                        Editer
                      </button>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={6} style={styles.expandedCell}>
                        <div style={styles.expandedContent}>
                          <div style={styles.sideBySide}>
                            <div style={styles.sidePanel}>
                              <h4 style={styles.sidePanelTitle}>Input</h4>
                              <div style={styles.fieldBlock}>
                                <span style={styles.fieldLabel}>Input</span>
                                <p style={styles.fieldValue}>{entry.input}</p>
                              </div>
                            </div>
                            <div style={styles.sidePanel}>
                              <h4 style={styles.sidePanelTitle}>Output</h4>
                              {(outputFields.length > 0
                                ? outputFields.map(f => [f.name, entry.output[f.name] || ''] as const)
                                : Object.entries(entry.output)
                              ).map(([key, val]) => (
                                <div key={key} style={styles.fieldBlock}>
                                  <span style={styles.fieldLabel}>{key}</span>
                                  <p style={styles.fieldValue}>{val}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          {entry.judgeComment && (
                            <div style={styles.commentBlock}>
                              <span style={styles.fieldLabel}>
                                Commentaire du juge{lastJudgeModel ? ` (${lastJudgeModel})` : ''}
                              </span>
                              <p style={styles.fieldValue}>{entry.judgeComment}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button onClick={() => setPage(0)} disabled={page === 0} style={styles.pageBtn}>««</button>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={styles.pageBtn}>«</button>
              <span style={styles.pageInfo}>Page {page + 1} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={styles.pageBtn}>»</button>
              <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} style={styles.pageBtn}>»»</button>
            </div>
          )}
        </div>
      )}

      {/* === MODALS === */}

      {/* Edit Modal */}
      {modalType === 'edit' && editEntry && (
        <div style={styles.overlay} onClick={() => setModalType(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Editer l'entree #{editEntry.id}</h3>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.smallLabel}>Contexte</label>
                <input
                  style={styles.modalInput}
                  value={editEntry.context}
                  onChange={e => setEditEntry({ ...editEntry, context: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.smallLabel}>Instruction</label>
                <textarea
                  style={{ ...styles.modalInput, height: '60px', resize: 'vertical' }}
                  value={editEntry.instruction}
                  onChange={e => setEditEntry({ ...editEntry, instruction: e.target.value })}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.smallLabel}>Input</label>
                <textarea
                  style={{ ...styles.modalInput, height: '60px', resize: 'vertical' }}
                  value={editEntry.input}
                  onChange={e => setEditEntry({ ...editEntry, input: e.target.value })}
                />
              </div>
              {(outputFields.length > 0 ? outputFields : Object.keys(editEntry.output).map(k => ({ name: k, type: 'string' as const, description: '', required: true } as OutputFieldDefinition))).map(field => (
                <div key={field.name} style={styles.formGroup}>
                  <label style={styles.smallLabel}>{field.name}</label>
                  {field.type === 'enum' && field.enumValues?.length ? (
                    <select
                      style={styles.modalInput}
                      value={editEntry.output[field.name] || ''}
                      onChange={e => setEditEntry({
                        ...editEntry,
                        output: { ...editEntry.output, [field.name]: e.target.value }
                      })}
                    >
                      {field.enumValues.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  ) : (
                    <textarea
                      style={{ ...styles.modalInput, height: field.name === 'text' ? '80px' : '60px', resize: 'vertical' }}
                      value={editEntry.output[field.name] || ''}
                      onChange={e => setEditEntry({
                        ...editEntry,
                        output: { ...editEntry.output, [field.name]: e.target.value }
                      })}
                    />
                  )}
                </div>
              ))}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setModalType(null)} style={styles.btnSecondary}>Annuler</button>
              <button onClick={saveEdit} style={styles.btnPrimary}>Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {/* Analyze Modal */}
      {modalType === 'analyze' && (
        <div style={styles.overlay} onClick={() => setModalType(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Analyser les entrees</h3>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.smallLabel}>Modele Juge</label>
                <select
                  style={styles.modalInput}
                  value={modalModel}
                  onChange={e => setModalModel(e.target.value)}
                >
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}>
                <div style={styles.promptHeader}>
                  <label style={styles.smallLabel}>Prompt d'evaluation</label>
                  <div style={styles.promptActions}>
                    <button
                      onClick={() => setModalPrompt(character ? buildDefaultJudgePrompt(character) : '')}
                      style={styles.btnClone}
                    >
                      Reinitialiser criteres
                    </button>
                    <button
                      onClick={handleImproveJudgePrompt}
                      style={{ ...styles.btnClone, backgroundColor: '#1a3a2a', borderColor: '#4CAF50', color: '#4CAF50' }}
                      disabled={isGeneratingPrompt || !modalModel || !modalPrompt.trim()}
                    >
                      {isGeneratingPrompt ? 'Amelioration...' : 'Ameliorer via IA'}
                    </button>
                  </div>
                </div>
                <textarea
                  style={{ ...styles.modalInput, height: '180px', resize: 'vertical', fontFamily: 'monospace' }}
                  value={modalPrompt}
                  onChange={e => setModalPrompt(e.target.value)}
                  placeholder="Decrivez les criteres d'evaluation pour le juge..."
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setModalType(null)} style={styles.btnSecondary}>Annuler</button>
              <button
                onClick={runAnalysis}
                style={styles.btnPrimary}
                disabled={!modalPrompt.trim()}
              >
                Lancer l'analyse
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Regenerate Modal */}
      {modalType === 'regenerate' && (
        <div style={styles.overlay} onClick={() => setModalType(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Regenerer les entrees</h3>
            <div style={styles.modalBody}>
              <div style={styles.formGroup}>
                <label style={styles.smallLabel}>Modele</label>
                <select
                  style={styles.modalInput}
                  value={modalModel}
                  onChange={e => setModalModel(e.target.value)}
                >
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {hasJudgeComments && (
                <div style={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    id="useJudgeComments"
                    checked={useJudgeComments}
                    onChange={e => setUseJudgeComments(e.target.checked)}
                    style={styles.checkbox}
                  />
                  <label htmlFor="useJudgeComments" style={styles.checkboxLabel}>
                    Utiliser les commentaires du juge pour guider la regeneration
                  </label>
                </div>
              )}
              {!useJudgeComments && (
                <div style={styles.formGroup}>
                  <label style={styles.smallLabel}>Prompt de regeneration</label>
                  <textarea
                    style={{ ...styles.modalInput, height: '180px', resize: 'vertical', fontFamily: 'monospace' }}
                    value={modalPrompt}
                    onChange={e => setModalPrompt(e.target.value)}
                    placeholder="Instructions pour la regeneration des entrees selectionnees..."
                  />
                </div>
              )}
              {useJudgeComments && (
                <div style={styles.formGroup}>
                  <label style={styles.smallLabel}>Prompt additionnelle (optionnel)</label>
                  <textarea
                    style={{ ...styles.modalInput, height: '80px', resize: 'vertical', fontFamily: 'monospace' }}
                    value={modalPrompt}
                    onChange={e => setModalPrompt(e.target.value)}
                    placeholder="Instructions supplementaires (optionnel)..."
                  />
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button onClick={() => setModalType(null)} style={styles.btnSecondary}>Annuler</button>
              <button
                onClick={runRegeneration}
                style={{ ...styles.btnPrimary, backgroundColor: '#FF9800' }}
                disabled={!useJudgeComments && !modalPrompt.trim()}
              >
                Regenerer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inject toast animation */}
      <style>{`
        @keyframes toastSlide {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '24px',
    overflowY: 'auto',
    position: 'relative'
  },
  toastContainer: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  toast: {
    padding: '12px 20px',
    borderRadius: '6px',
    color: 'white',
    fontSize: '13px',
    fontWeight: 'bold',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    minWidth: '250px'
  },
  toastIcon: {
    fontSize: '16px'
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
    flexShrink: 0
  },
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  selectionInfo: {
    fontSize: '13px',
    color: '#888',
    flexShrink: 0
  },
  smallLabel: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#aaa',
    display: 'block',
    marginBottom: '2px'
  },
  btnPrimary: {
    padding: '8px 16px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  btnSecondary: {
    padding: '8px 16px',
    backgroundColor: '#555',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  btnDanger: {
    padding: '8px 16px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold'
  },
  btnSmall: {
    padding: '4px 10px',
    backgroundColor: '#2196F3',
    color: 'white',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px',
    fontWeight: 'bold'
  },
  btnClone: {
    padding: '4px 10px',
    backgroundColor: '#333',
    color: '#aaa',
    border: '1px solid #555',
    borderRadius: '3px',
    cursor: 'pointer',
    fontSize: '11px'
  },
  promptActions: {
    display: 'flex',
    gap: '6px'
  },
  empty: {
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    padding: '60px 20px',
    fontSize: '15px'
  },
  tableWrapper: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px'
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    borderBottom: '2px solid #444',
    color: '#aaa',
    fontWeight: 'bold',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    position: 'sticky',
    top: 0,
    backgroundColor: '#1a1a1a',
    zIndex: 1
  },
  tr: {
    borderBottom: '1px solid #2a2a2a',
    transition: 'background-color 0.15s'
  },
  td: {
    padding: '10px 12px',
    verticalAlign: 'middle'
  },
  idCell: {
    fontFamily: 'monospace',
    color: '#4CAF50',
    fontWeight: 'bold',
    fontSize: '12px'
  },
  truncated: {
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  checkbox: {
    cursor: 'pointer',
    accentColor: '#4CAF50'
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 0',
    marginBottom: '8px'
  },
  checkboxLabel: {
    fontSize: '13px',
    color: '#ccc',
    cursor: 'pointer'
  },
  scoreBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '10px',
    color: 'white',
    fontWeight: 'bold',
    fontSize: '12px',
    minWidth: '28px',
    textAlign: 'center'
  },
  noScore: {
    color: '#555',
    fontSize: '14px'
  },
  expandedCell: {
    padding: 0,
    backgroundColor: '#0f0f0f'
  },
  expandedContent: {
    padding: '16px 20px'
  },
  sideBySide: {
    display: 'flex',
    gap: '20px'
  },
  sidePanel: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    padding: '14px',
    border: '1px solid #333'
  },
  sidePanelTitle: {
    margin: '0 0 12px 0',
    fontSize: '13px',
    color: '#4CAF50',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  fieldBlock: {
    marginBottom: '10px',
    paddingBottom: '10px',
    borderBottom: '1px solid #2a2a2a'
  },
  fieldLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontWeight: 'bold'
  },
  fieldValue: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    lineHeight: '1.5',
    color: '#e0e0e0'
  },
  commentBlock: {
    marginTop: '16px',
    padding: '12px',
    backgroundColor: '#1a1a1a',
    borderRadius: '6px',
    border: '1px solid #444',
    borderLeft: '3px solid #FF9800'
  },
  progressInline: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  progressText: {
    fontSize: '13px',
    color: '#FF9800',
    fontWeight: 'bold'
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 0',
    flexShrink: 0
  },
  pageBtn: {
    padding: '6px 10px',
    backgroundColor: '#333',
    color: '#e0e0e0',
    border: '1px solid #555',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  pageInfo: {
    fontSize: '13px',
    color: '#888',
    padding: '0 8px'
  },
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
    zIndex: 1000
  },
  modal: {
    backgroundColor: '#1f1f1f',
    borderRadius: '8px',
    border: '1px solid #444',
    width: '600px',
    maxWidth: '90vw',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
  },
  modalTitle: {
    margin: 0,
    padding: '16px 20px',
    borderBottom: '1px solid #333',
    fontSize: '16px'
  },
  modalBody: {
    padding: '20px',
    overflowY: 'auto',
    flex: 1
  },
  modalFooter: {
    padding: '12px 20px',
    borderTop: '1px solid #333',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '8px'
  },
  modalInput: {
    width: '100%',
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #555',
    backgroundColor: '#2a2a2a',
    color: '#e0e0e0',
    fontSize: '13px',
    fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  formGroup: {
    marginBottom: '14px'
  },
  promptHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
    flexWrap: 'wrap',
    gap: '6px'
  }
};
