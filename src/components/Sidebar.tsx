import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import { SCENARIOS } from '../data/scenarios';
import { ProgressPanel } from './ProgressPanel';
import { useProgress } from '../store/progressStore';

const MODULES = [
  { id: 'overview', label: 'Cluster Overview', icon: '⎈' },
  { id: 'controlplane', label: 'Control Plane', icon: '🔄' },
  { id: 'workloads', label: 'Workload Lab', icon: '📦' },
  { id: 'networking', label: 'Networking', icon: '🕸' },
  { id: 'storage', label: 'Storage', icon: '💾' },
  { id: 'rbac', label: 'RBAC Sandbox', icon: '🔐' },
  { id: 'scaling', label: 'Scaling & Healing', icon: '📈' },
  { id: 'scenarios', label: 'Failure Scenarios', icon: '⚠️' },
  { id: 'yaml', label: 'YAML Editor', icon: '📝' },
  { id: 'terminal', label: 'kubectl Terminal', icon: '⌨️' },
];

export function Sidebar() {
  const { activeModule, setModule, cluster, activeScenario, explanations } = useSimulator();
  const { solvedScenarios } = useProgress();

  const warningCount = cluster.events.filter(e => e.type === 'Warning').length;
  const podFailed = cluster.pods.filter(p => 
    p.phase === 'Failed' || 
    p.status.containerStatuses.some(cs => cs.reason === 'ImagePullBackOff' || cs.reason === 'CrashLoopBackOff' || cs.reason === 'ErrImagePull' || cs.reason === 'OOMKilled')
  ).length;
  const podPending = cluster.pods.filter(p => p.phase === 'Pending' && !p.status.containerStatuses.some(cs => cs.reason)).length;

  function getBadge(id: string) {
    if (id === 'scenarios') {
      const active = activeScenario ? '1' : null;
      return active ? { label: 'ACTIVE', cls: 'warning' } : null;
    }
    if (id === 'workloads') {
      if (podFailed > 0) return { label: String(podFailed), cls: 'error' };
      if (podPending > 0) return { label: String(podPending), cls: 'warning' };
    }
    if (id === 'overview') {
      if (warningCount > 0) return { label: String(warningCount), cls: 'warning' };
    }
    return null;
  }

  return (
    <nav className="sidebar" role="navigation" aria-label="Module navigation" style={{ overflow: 'hidden' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div className="sidebar-section" style={{ paddingTop: 12 }}>Modules</div>
        {MODULES.map(m => {
        const badge = getBadge(m.id);
        return (
          <div
            key={m.id}
            id={`nav-${m.id}`}
            className={`nav-item ${activeModule === m.id ? 'active' : ''}`}
            onClick={() => setModule(m.id)}
            role="button"
            aria-current={activeModule === m.id ? 'page' : undefined}
          >
            <span style={{ fontSize: 15 }}>{m.icon}</span>
            <span>{m.label}</span>
            {badge && (
              <span className={`nav-badge ${badge.cls}`}>{badge.label}</span>
            )}
          </div>
        );
      })}

      <div className="sidebar-section" style={{ marginTop: 12 }}>Quick Scenarios</div>
      {SCENARIOS.slice(0, 4).map(s => (
        <div
          key={s.id}
          className={`nav-item ${activeScenario?.id === s.id ? 'active' : ''}`}
          onClick={() => { useSimulator.getState().loadScenario(s.id); setModule('scenarios'); }}
          style={{ fontSize: 11, paddingLeft: 20 }}
        >
          <span className={`difficulty-${s.difficulty}`} style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', flexShrink: 0 }}></span>
          <span className="text-mono" style={{ fontSize: 11 }}>{s.title}</span>
          {solvedScenarios.includes(s.id) && <span style={{ marginLeft: 'auto', color: 'var(--k8s-green)', fontSize: 10 }}>✓</span>}
        </div>
      ))}

      {explanations.length > 0 && (
        <>
          <div className="sidebar-section" style={{ marginTop: 12 }}>Recent Actions</div>
          <div style={{ padding: '4px 8px', fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {explanations.slice(0, 2).map(e => (
              <div key={e.id} style={{ marginBottom: 6, lineHeight: 1.4 }}>
                <span style={{ color: 'var(--k8s-cyan)' }}>{e.controller}</span>
                {' → '}{e.objectName}
              </div>
            ))}
          </div>
        </>
      )}
      </div>
      <div style={{ marginTop: 'auto', flexShrink: 0 }}>
        <ProgressPanel />
      </div>
    </nav>
  );
}
