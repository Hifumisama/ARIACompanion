import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  currentBatch?: number;
  totalBatches?: number;
  estimatedTimeRemaining?: number;
  averageBatchTime?: number;
}

const formatTime = (ms: number): string => {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m${secs > 0 ? ` ${secs}s` : ''}`;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  currentBatch,
  totalBatches,
  estimatedTimeRemaining,
  averageBatchTime
}) => {
  const percentage = total === 0 ? 0 : (current / total) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3>Progression</h3>
        <span style={styles.counter}>
          {current} / {total} entrées
        </span>
      </div>

      <div style={styles.barContainer}>
        <div
          style={{
            ...styles.bar,
            width: `${percentage}%`
          }}
        />
      </div>

      <div style={styles.stats}>
        {currentBatch && totalBatches && (
          <p>
            Batch {currentBatch} / {totalBatches}
            {averageBatchTime && ` • Temps moyen: ${formatTime(averageBatchTime)}`}
          </p>
        )}
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <p style={styles.estimate}>
            ⏱️ Temps estimé restant: <strong>{formatTime(estimatedTimeRemaining)}</strong>
          </p>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '20px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
    border: '1px solid #444'
  } as React.CSSProperties,
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  } as React.CSSProperties,
  counter: {
    fontSize: '14px',
    color: '#888'
  } as React.CSSProperties,
  barContainer: {
    width: '100%',
    height: '24px',
    backgroundColor: '#1f1f1f',
    borderRadius: '4px',
    overflow: 'hidden',
    border: '1px solid #555'
  } as React.CSSProperties,
  bar: {
    height: '100%',
    backgroundColor: '#4CAF50',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: '8px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  } as React.CSSProperties,
  stats: {
    marginTop: '12px',
    fontSize: '12px',
    color: '#888'
  } as React.CSSProperties,
  estimate: {
    marginTop: '4px',
    color: '#4CAF50'
  } as React.CSSProperties
};
