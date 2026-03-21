import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { DatasetEntry, GenerationConfig, CharacterDefinition } from './types';
import { generateBatch } from './services/ollama';
import { generateSystemPromptFromCharacter, getAllOutputFields } from './services/characterPrompt';
import { loadAllCharacters, saveCharacter } from './services/storage';
import { DEFAULT_HADES } from './data/defaultCharacters';
import { ConfigPanel } from './components/ConfigPanel';
import { ProgressBar } from './components/ProgressBar';
import { ResultPanel } from './components/ResultPanel';
import { AffinagePanel } from './components/AffinagePanel';
import { CharacterBuilder } from './components/CharacterBuilder';
import { PlaygroundPanel } from './components/PlaygroundPanel';

type Tab = 'character' | 'config' | 'playground' | 'generation' | 'affinage';

interface Toast {
  message: string;
  type: 'success' | 'error';
  id: number;
}

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
  } catch { /* Audio not available */ }
}

const DEFAULT_CONFIG: GenerationConfig = {
  systemPrompt: '',
  examples: [],
  count: 5,
  startId: 1,
  batchSize: 10,
  model: ''
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('character');
  const [characters, setCharacters] = useState<CharacterDefinition[]>(() => {
    const stored = loadAllCharacters();
    return stored.length > 0 ? stored : [{ ...DEFAULT_HADES, id: crypto.randomUUID(), createdAt: Date.now(), updatedAt: Date.now() }];
  });
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(() => {
    const stored = loadAllCharacters();
    return stored.length > 0 ? stored[0].id : null;
  });

  // Sync activeCharacterId after initial characters are set
  useEffect(() => {
    if (!activeCharacterId && characters.length > 0) {
      setActiveCharacterId(characters[0].id);
    }
  }, [characters, activeCharacterId]);

  // Auto-save characters to localStorage on change
  useEffect(() => {
    characters.forEach(c => saveCharacter(c));
  }, [characters]);

  // Derive system prompt from active character
  const activeCharacter = useMemo(
    () => characters.find(c => c.id === activeCharacterId) || null,
    [characters, activeCharacterId]
  );

  const derivedSystemPrompt = useMemo(
    () => activeCharacter ? generateSystemPromptFromCharacter(activeCharacter) : DEFAULT_CONFIG.systemPrompt,
    [activeCharacter]
  );

  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_CONFIG);
  const [entries, setEntries] = useState<DatasetEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentBatch, setCurrentBatch] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [averageBatchTime, setAverageBatchTime] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);
  const [error, setError] = useState<string>('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const batchTimesRef = useRef<number[]>([]);
  const toastIdRef = useRef(0);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { message, type, id }]);
    playNotificationSound(type === 'success');
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setEntries([]);
    setProgress(0);
    setError('');
    batchTimesRef.current = [];
    abortControllerRef.current = new AbortController();

    const numBatches = Math.ceil(config.count / config.batchSize);
    setTotalBatches(numBatches);

    const allEntries: DatasetEntry[] = [];

    try {
      for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
        if (abortControllerRef.current.signal.aborted) break;

        setCurrentBatch(batchIdx + 1);

        const startId = config.startId + allEntries.length;
        const batchSize = Math.min(
          config.batchSize,
          config.count - allEntries.length
        );

        try {
          const currentOutputFields = activeCharacter ? getAllOutputFields(activeCharacter) : [];
          const { entries: batchEntries, duration } = await generateBatch(
            config,
            startId,
            batchSize,
            currentOutputFields,
            abortControllerRef.current.signal
          );

          allEntries.push(...batchEntries);
          setEntries([...allEntries]);
          setProgress(allEntries.length);

          batchTimesRef.current.push(duration);
          const avgTime =
            batchTimesRef.current.reduce((a, b) => a + b, 0) /
            batchTimesRef.current.length;
          setAverageBatchTime(avgTime);
          setEstimatedTimeRemaining(avgTime * (numBatches - (batchIdx + 1)));
        } catch (err) {
          if (abortControllerRef.current.signal.aborted) break;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`Batch ${batchIdx + 1} error:`, msg);
          setError(`Erreur batch ${batchIdx + 1}: ${msg}`);
        }
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
      setEstimatedTimeRemaining(0);
      if (allEntries.length > 0) {
        showToast(`Generation terminee : ${allEntries.length} entrees`, 'success');
      }
    }
  };

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleCapture = useCallback((entry: DatasetEntry) => {
    setConfig(prev => ({ ...prev, examples: [...prev.examples, entry] }));
    showToast(`Exemple #${entry.id} capture !`, 'success');
  }, [showToast]);

  // Sync derived system prompt into config when character changes
  useEffect(() => {
    setConfig(prev => ({ ...prev, systemPrompt: derivedSystemPrompt, characterId: activeCharacterId || undefined }));
  }, [derivedSystemPrompt, activeCharacterId]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'character', label: `Personnage${activeCharacter ? ` (${activeCharacter.name || '...'})` : ''}` },
    { key: 'config', label: 'Configuration' },
    { key: 'playground', label: 'Playground' },
    { key: 'generation', label: `Generation${entries.length > 0 ? ` (${entries.length})` : ''}` },
    { key: 'affinage', label: 'Affinage' }
  ];

  return (
    <div style={styles.app}>
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
            <span style={{ fontSize: '16px' }}>{toast.type === 'success' ? '\u2713' : '\u2717'}</span>
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`@keyframes toastSlide { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

      {/* Header */}
      <header style={styles.header}>
        <h1 style={styles.title}>ARIA Character Builder</h1>
      </header>

      {/* Tabs */}
      <nav style={styles.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...styles.tab,
              ...(activeTab === tab.key ? styles.tabActive : {})
            }}
          >
            {tab.label}
            {tab.key === 'generation' && isGenerating && (
              <span style={styles.dot} />
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div style={styles.content}>
        {activeTab === 'character' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <CharacterBuilder
              characters={characters}
              activeCharacterId={activeCharacterId}
              onCharactersChange={setCharacters}
              onActiveCharacterChange={setActiveCharacterId}
            />
          </div>
        )}

        {activeTab === 'config' && (
          <div style={styles.configContent}>
            <ConfigPanel
              config={config}
              outputFields={activeCharacter ? getAllOutputFields(activeCharacter) : []}
              onConfigChange={setConfig}
              isGenerating={isGenerating}
            />
            {/* Generate button at bottom of config */}
            <div style={styles.generateSection}>
              <button
                onClick={() => { handleGenerate(); setActiveTab('generation'); }}
                style={styles.generateButton}
                disabled={isGenerating}
              >
                Generer {config.count} entree{config.count > 1 ? 's' : ''}
                <span style={styles.buttonSub}>
                  ({Math.ceil(config.count / config.batchSize)} batch{Math.ceil(config.count / config.batchSize) > 1 ? 'es' : ''} de {config.batchSize})
                </span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'playground' && (
          <PlaygroundPanel
            character={activeCharacter}
            systemPrompt={derivedSystemPrompt}
            model={config.model}
            outputFields={activeCharacter ? getAllOutputFields(activeCharacter) : []}
            onCapture={handleCapture}
          />
        )}

        {activeTab === 'generation' && (
          <div style={styles.generationContent}>
            {/* Progress + Cancel */}
            {(isGenerating || entries.length > 0) && (
              <div style={styles.progressSection}>
                <ProgressBar
                  current={progress}
                  total={config.count}
                  currentBatch={currentBatch}
                  totalBatches={totalBatches}
                  averageBatchTime={averageBatchTime}
                  estimatedTimeRemaining={estimatedTimeRemaining}
                />
                {isGenerating && (
                  <button onClick={handleCancel} style={styles.cancelButton}>
                    Annuler
                  </button>
                )}
              </div>
            )}

            {/* Error */}
            {error && <div style={styles.errorBox}>{error}</div>}

            {/* Results — scrollable independently */}
            <div style={styles.resultWrapper}>
              <ResultPanel entries={entries} outputFields={activeCharacter ? getAllOutputFields(activeCharacter) : []} onDownload={() => {}} />
            </div>
          </div>
        )}

        {activeTab === 'affinage' && (
          <AffinagePanel
            entries={entries}
            systemPrompt={config.systemPrompt}
            outputFields={activeCharacter ? getAllOutputFields(activeCharacter) : []}
            onEntriesUpdate={setEntries}
          />
        )}
      </div>
    </div>
  );
};

const styles = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    backgroundColor: '#1a1a1a',
    color: '#e0e0e0'
  } as React.CSSProperties,
  header: {
    padding: '16px 24px',
    backgroundColor: '#0d0d0d',
    borderBottom: '1px solid #333'
  } as React.CSSProperties,
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 'bold'
  } as React.CSSProperties,
  tabBar: {
    display: 'flex',
    backgroundColor: '#0d0d0d',
    borderBottom: '2px solid #333',
    padding: '0 24px',
    gap: '0'
  } as React.CSSProperties,
  tab: {
    padding: '12px 24px',
    backgroundColor: 'transparent',
    color: '#888',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '-2px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'color 0.2s'
  } as React.CSSProperties,
  tabActive: {
    color: '#4CAF50',
    borderBottomColor: '#4CAF50'
  } as React.CSSProperties,
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#FF9800',
    display: 'inline-block',
    animation: 'pulse 1.5s infinite'
  } as React.CSSProperties,
  content: {
    flex: 1,
    overflow: 'hidden',
    display: 'flex'
  } as React.CSSProperties,
  configContent: {
    flex: 1,
    padding: '24px',
    overflowY: 'auto',
    maxWidth: '800px'
  } as React.CSSProperties,
  generationContent: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    overflow: 'hidden'
  } as React.CSSProperties,
  generateSection: {
    marginTop: '24px',
    paddingTop: '16px',
    borderTop: '1px solid #333'
  } as React.CSSProperties,
  progressSection: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px'
  } as React.CSSProperties,
  resultWrapper: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto'
  } as React.CSSProperties,
  generateButton: {
    padding: '14px 28px',
    backgroundColor: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  } as React.CSSProperties,
  buttonSub: {
    fontSize: '12px',
    opacity: 0.8,
    fontWeight: 'normal'
  } as React.CSSProperties,
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap',
    flexShrink: 0
  } as React.CSSProperties,
  errorBox: {
    padding: '12px',
    backgroundColor: '#f44336',
    color: 'white',
    borderRadius: '4px',
    fontSize: '14px',
    flexShrink: 0
  } as React.CSSProperties,
  affinageContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  } as React.CSSProperties,
  toastContainer: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  } as React.CSSProperties,
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
  } as React.CSSProperties
};
