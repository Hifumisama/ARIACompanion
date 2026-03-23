import React, { useState, useRef, useEffect, useCallback } from 'react';
import { DatasetEntry, OutputFieldDefinition, CharacterDefinition } from '../types';
import { chatWithCharacter } from '../services/ollama';

interface PlaygroundMessage {
  role: 'user' | 'assistant';
  content: string;
  captured?: boolean;
}

interface PlaygroundPanelProps {
  character: CharacterDefinition | null;
  systemPrompt: string;
  model: string;
  outputFields: OutputFieldDefinition[];
  onCapture: (entry: DatasetEntry) => void;
}

export const PlaygroundPanel = ({
  character,
  systemPrompt,
  model,
  outputFields,
  onCapture,
}: PlaygroundPanelProps) => {
  const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [captureIndex, setCaptureIndex] = useState<number | null>(null);
  const [captureForm, setCaptureForm] = useState({ context: '', instruction: '' });
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nextCaptureId = useRef(1);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !model) return;

    const userMsg: PlaygroundMessage = { role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsStreaming(true);

    const assistantMsg: PlaygroundMessage = { role: 'assistant', content: '' };
    setMessages([...newMessages, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      const chatMessages = newMessages.map(m => ({ role: m.role, content: m.content }));

      await chatWithCharacter(
        systemPrompt,
        chatMessages,
        model,
        (token) => {
          assistantMsg.content += token;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = { ...assistantMsg };
            return updated;
          });
        },
        abortRef.current.signal
      );
    } catch (err) {
      if (!abortRef.current?.signal.aborted) {
        assistantMsg.content += '\n\n[Erreur: ' + (err instanceof Error ? err.message : 'Unknown') + ']';
        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { ...assistantMsg };
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }, [input, isStreaming, model, messages, systemPrompt]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleReset = () => {
    if (isStreaming) handleStop();
    setMessages([]);
    setCaptureIndex(null);
  };

  const openCapture = (msgIndex: number) => {
    setCaptureIndex(msgIndex);
    // Pre-fill context from character name
    setCaptureForm({
      context: '',
      instruction: '',
    });
  };

  const confirmCapture = () => {
    if (captureIndex === null) return;
    const assistantMsg = messages[captureIndex];
    // Find the user message right before this assistant message
    const userMsg = captureIndex > 0 ? messages[captureIndex - 1] : null;

    if (!assistantMsg || assistantMsg.role !== 'assistant') return;

    const entry: DatasetEntry = {
      id: nextCaptureId.current++,
      context: captureForm.context || 'Conversation playground',
      instruction: captureForm.instruction || (userMsg ? 'L\'utilisateur engage la conversation.' : ''),
      input: userMsg?.content || '',
      output: parseAssistantOutput(assistantMsg.content, outputFields),
    };

    onCapture(entry);

    // Mark as captured
    setMessages(prev => prev.map((m, i) => i === captureIndex ? { ...m, captured: true } : m));
    setCaptureIndex(null);
  };

  if (!character) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Crée un personnage dans l'onglet Personnage pour commencer.
      </div>
    );
  }

  if (!model) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}>
        Sélectionne un modèle dans l'onglet Configuration.
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          Playground — {character.name || 'Sans nom'}
        </span>
        <span style={styles.headerModel}>{model}</span>
        <button onClick={handleReset} style={styles.resetBtn}>
          Reset
        </button>
      </div>

      {/* Messages */}
      <div style={styles.messagesArea}>
        {messages.length === 0 && (
          <div style={styles.emptyState}>
            Envoie un message pour discuter avec {character.name || 'ton personnage'}.
            <br />
            <span style={{ fontSize: 12, color: '#555' }}>
              Tu pourras capturer les meilleures répliques comme exemples.
            </span>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={msg.role === 'user' ? styles.userRow : styles.assistantRow}>
            <div style={msg.role === 'user' ? styles.userBubble : styles.assistantBubble}>
              <div style={styles.bubbleHeader}>
                <span style={styles.roleBadge}>
                  {msg.role === 'user' ? 'Toi' : character.name || 'IA'}
                </span>
                {msg.captured && (
                  <span style={styles.capturedBadge}>capturé</span>
                )}
              </div>
              <div style={styles.bubbleContent}>
                {msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}
              </div>
              {msg.role === 'assistant' && msg.content && !msg.captured && (
                <button
                  onClick={() => openCapture(i)}
                  style={styles.captureBtn}
                  title="Capturer comme exemple"
                >
                  Capturer
                </button>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Capture modal */}
      {captureIndex !== null && (
        <div style={styles.captureOverlay} onClick={() => setCaptureIndex(null)}>
          <div style={styles.captureModal} onClick={e => e.stopPropagation()}>
            <h4 style={{ margin: '0 0 12px', color: '#4CAF50' }}>Capturer comme exemple</h4>
            <div style={{ marginBottom: 10 }}>
              <label style={styles.captureLabel}>Contexte</label>
              <input
                style={styles.captureInput}
                value={captureForm.context}
                onChange={e => setCaptureForm(f => ({ ...f, context: e.target.value }))}
                placeholder="Ex: Provocation familiale"
                autoFocus
              />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={styles.captureLabel}>Instruction</label>
              <input
                style={styles.captureInput}
                value={captureForm.instruction}
                onChange={e => setCaptureForm(f => ({ ...f, instruction: e.target.value }))}
                placeholder="Ex: L'utilisateur compare Hadès à Zeus"
              />
            </div>
            <div style={styles.capturePreview}>
              <span style={{ fontSize: 11, color: '#888' }}>Input:</span>
              <span style={{ fontSize: 12, color: '#ccc' }}>
                {captureIndex > 0 ? messages[captureIndex - 1]?.content?.substring(0, 100) : '(vide)'}
              </span>
            </div>
            <div style={styles.capturePreview}>
              <span style={{ fontSize: 11, color: '#888' }}>Output (brut):</span>
              <span style={{ fontSize: 12, color: '#ccc' }}>
                {messages[captureIndex]?.content?.substring(0, 150)}...
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button onClick={() => setCaptureIndex(null)} style={styles.cancelBtn}>Annuler</button>
              <button onClick={confirmCapture} style={styles.confirmBtn}>Capturer</button>
            </div>
          </div>
        </div>
      )}

      {/* Input area */}
      <div style={styles.inputArea}>
        <textarea
          ref={inputRef}
          style={styles.textInput}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Parle à ${character.name || 'ton personnage'}...`}
          rows={2}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <button onClick={handleStop} style={styles.stopBtn}>Stop</button>
        ) : (
          <button onClick={handleSend} style={styles.sendBtn} disabled={!input.trim()}>
            Envoyer
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Tente de parser la réponse du LLM en output structuré.
 * Si la réponse est du JSON, on extrait les champs. Sinon, tout va dans "text".
 */
function parseAssistantOutput(
  content: string,
  outputFields: OutputFieldDefinition[]
): Record<string, string> {
  // Try JSON parse first
  try {
    const trimmed = content.trim();
    let jsonStr = trimmed;

    // Try to extract JSON from markdown code blocks
    const codeMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeMatch) jsonStr = codeMatch[1].trim();

    // Try to find a JSON object
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(jsonStr.substring(start, end + 1));
      // If parsed has an "output" key, use that
      const output = parsed.output || parsed;
      if (typeof output === 'object' && !Array.isArray(output)) {
        const result: Record<string, string> = {};
        for (const field of outputFields) {
          if (output[field.name] !== undefined) {
            result[field.name] = String(output[field.name]);
          }
        }
        // If we got at least one field, use structured output
        if (Object.keys(result).length > 0) {
          // Ensure 'text' field has something
          if (!result.text && outputFields.some(f => f.name === 'text')) {
            result.text = output.text || content;
          }
          return result;
        }
      }
    }
  } catch {
    // Not JSON, fall through
  }

  // Fallback: put everything in "text" field
  const result: Record<string, string> = {};
  for (const field of outputFields) {
    if (field.name === 'text') {
      result.text = content;
    } else {
      result[field.name] = '';
    }
  }
  if (Object.keys(result).length === 0) {
    result.text = content;
  }
  return result;
}

// ── Styles ──

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    borderBottom: '1px solid #333',
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#e0e0e0',
    flex: 1,
  },
  headerModel: {
    fontSize: 12,
    color: '#888',
    padding: '2px 8px',
    background: '#2a2a2a',
    borderRadius: 3,
  },
  resetBtn: {
    padding: '5px 14px',
    background: '#555',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  emptyState: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    padding: '60px 20px',
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  assistantRow: {
    display: 'flex',
    justifyContent: 'flex-start',
  },
  userBubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    background: '#1b3a1b',
    borderRadius: '12px 12px 2px 12px',
    border: '1px solid #2e5a2e',
  },
  assistantBubble: {
    maxWidth: '70%',
    padding: '10px 14px',
    background: '#1f1f1f',
    borderRadius: '12px 12px 12px 2px',
    border: '1px solid #333',
    position: 'relative',
  },
  bubbleHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  roleBadge: {
    fontSize: 11,
    fontWeight: 700,
    color: '#4CAF50',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  capturedBadge: {
    fontSize: 10,
    color: '#FF9800',
    fontWeight: 600,
    padding: '1px 6px',
    background: '#3d2e00',
    borderRadius: 3,
  },
  bubbleContent: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#e0e0e0',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  captureBtn: {
    marginTop: 8,
    padding: '3px 10px',
    background: 'none',
    border: '1px solid #4CAF50',
    borderRadius: 3,
    color: '#4CAF50',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: 600,
  },
  inputArea: {
    display: 'flex',
    gap: 10,
    padding: '12px 20px',
    borderTop: '1px solid #333',
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    padding: '10px 14px',
    background: '#1f1f1f',
    border: '1px solid #444',
    borderRadius: 8,
    color: '#e0e0e0',
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    lineHeight: 1.4,
  },
  sendBtn: {
    padding: '10px 20px',
    background: '#4CAF50',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  stopBtn: {
    padding: '10px 20px',
    background: '#f44336',
    color: 'white',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    whiteSpace: 'nowrap',
  },
  // Capture modal
  captureOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  captureModal: {
    background: '#1e1e1e',
    border: '1px solid #444',
    borderRadius: 10,
    padding: 20,
    width: 440,
    maxWidth: '90vw',
  },
  captureLabel: {
    fontSize: 12,
    color: '#999',
    display: 'block',
    marginBottom: 4,
  },
  captureInput: {
    width: '100%',
    padding: '8px 12px',
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 6,
    color: '#eee',
    fontSize: 13,
    boxSizing: 'border-box',
  },
  capturePreview: {
    display: 'flex',
    gap: 8,
    padding: '6px 0',
    borderTop: '1px solid #333',
    marginTop: 6,
    overflow: 'hidden',
  },
  cancelBtn: {
    padding: '6px 16px',
    background: '#333',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#ccc',
    cursor: 'pointer',
    fontSize: 12,
  },
  confirmBtn: {
    padding: '6px 16px',
    background: '#1b5e20',
    border: '1px solid #4CAF50',
    borderRadius: 4,
    color: '#4CAF50',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
};
