import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import { TimeTravelBar } from './TimeTravelBar';

export function Header() {
  const { cluster, running, startLoop, stopLoop, reset, tick, activeScenario, exitScenario } = useSimulator();

  const warnings = cluster.events.filter(e => e.type === 'Warning').length;

  return (
    <header className="app-header" role="banner">
      <div className="app-logo">
        <div className="app-logo-icon">⎈</div>
        <span>k8s<span style={{ color: 'var(--k8s-cyan)' }}>sim</span></span>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 8px' }} />

      {activeScenario && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', borderRadius: 'var(--radius-md)',
          background: 'rgba(79, 128, 255, 0.1)', border: '1px solid rgba(79, 128, 255, 0.3)',
          fontSize: 12, fontFamily: 'var(--font-mono)',
          color: 'var(--k8s-blue)',
        }}>
          <span>⚠️</span>
          <span>Scenario: <strong>{activeScenario.title}</strong></span>
          <button
            onClick={exitScenario}
            style={{
              border: 'none', background: 'none', color: 'var(--text-muted)',
              cursor: 'pointer', fontSize: 12, padding: '0 4px'
            }}
          >✕</button>
        </div>
      )}

      <div className="header-spacer" />
      <TimeTravelBar />
      <div className="header-spacer" />

      {warnings > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
          color: 'var(--k8s-yellow)', fontFamily: 'var(--font-mono)',
          padding: '4px 10px', borderRadius: 'var(--radius-md)',
          background: 'rgba(234, 179, 8, 0.08)',
        }}>
          ⚠ {warnings} warning{warnings !== 1 ? 's' : ''}
        </div>
      )}

      <div className="header-ticker">
        <div className={`ticker-dot ${running ? '' : 'paused'}`} />
        <span>tick #{cluster.tick}</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>{cluster.pods.length} pods</span>
        <span style={{ color: 'var(--text-muted)' }}>|</span>
        <span>{cluster.nodes.filter(n => n.status === 'Ready').length}/{cluster.nodes.length} nodes</span>
      </div>

      <div style={{ width: 1, height: 24, background: 'var(--border-subtle)', margin: '0 4px' }} />

      <button
        id="btn-manual-tick"
        className="header-btn"
        onClick={tick}
        title="Manual tick"
      >
        ↻
      </button>

      <button
        id="btn-toggle-sim"
        className={`header-btn ${running ? 'active' : ''}`}
        onClick={running ? stopLoop : startLoop}
      >
        {running ? '⏸ Pause' : '▶ Run'}
      </button>

      <button
        id="btn-reset"
        className="header-btn"
        onClick={reset}
      >
        ↺ Reset
      </button>
    </header>
  );
}
