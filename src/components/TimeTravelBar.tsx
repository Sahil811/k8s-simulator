import React, { useRef } from 'react';
import { useSimulator } from '../store/simulatorStore';
import { useProgress } from '../store/progressStore';

export function TimeTravelBar() {
  const { history, historyIndex, setTimeTravel, cluster } = useSimulator();
  const { markTimeLord } = useProgress();
  const timeLordFired = useRef(false);
  
  if (history.length < 2) return null; // Not enough history to scrub yet

  const isLive = historyIndex === null;
  const currentIndex = isLive ? history.length - 1 : historyIndex;

  return (
    <div 
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '4px 12px',
        borderRadius: 'var(--radius-md)',
        background: isLive ? 'rgba(255, 255, 255, 0.02)' : 'rgba(234, 179, 8, 0.1)',
        border: `1px solid ${isLive ? 'var(--border-subtle)' : 'rgba(234, 179, 8, 0.3)'}`,
        transition: 'all var(--transition-base)',
        minWidth: '300px',
        maxWidth: '450px',
        flex: 1,
      }}
    >
      <button 
        className={isLive ? 'header-btn' : 'header-btn active'}
        onClick={() => setTimeTravel(null)}
        style={{
          padding: '2px 8px',
          fontSize: '10px',
          fontWeight: 700,
          border: 'none',
          background: isLive ? 'transparent' : 'var(--k8s-yellow)',
          color: isLive ? 'var(--k8s-green)' : 'var(--bg-base)',
          whiteSpace: 'nowrap',
          borderRadius: '4px',
        }}
        title="Resume live simulation"
      >
        {isLive ? '🟢 LIVE' : '▶️ RESUME'}
      </button>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
        <input 
          type="range" 
          min={0} 
          max={history.length - 1} 
          value={currentIndex}
          onChange={(e) => {
            const val = Number(e.target.value);
            if (!timeLordFired.current && val !== history.length - 1) {
              timeLordFired.current = true;
              markTimeLord();
            }
            if (val === history.length - 1) {
              setTimeTravel(null);
            } else {
              setTimeTravel(val);
            }
          }}
          style={{ 
            width: '100%', 
            cursor: 'ew-resize',
            accentColor: isLive ? 'var(--k8s-blue)' : 'var(--k8s-yellow)',
            height: '4px',
          }}
          title={`Scrub history (Tick ${history[currentIndex]?.tick || 0})`}
        />
      </div>

      <div style={{ 
        fontFamily: 'var(--font-mono)', 
        fontSize: '11px', 
        color: isLive ? 'var(--text-muted)' : 'var(--k8s-yellow)', 
        minWidth: '65px', 
        textAlign: 'right',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        lineHeight: 1.2
      }}>
        <span style={{ fontWeight: isLive ? 400 : 700 }}>
          {isLive ? 'Latest' : `T - ${history.length - 1 - currentIndex}`}
        </span>
        {!isLive && <span style={{ fontSize: '8px', letterSpacing: '0.5px' }}>TIME TRAVEL</span>}
      </div>
    </div>
  );
}
