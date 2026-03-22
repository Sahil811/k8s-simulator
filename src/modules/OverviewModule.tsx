import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { Pod, K8sNode } from '../types/k8s';

function getPodBadgeClass(pod: Pod) {
  const r = pod.status?.containerStatuses?.[0]?.reason;
  if (r === 'ImagePullBackOff' || r === 'ErrImagePull') return 'badge-failed';
  if (r === 'CrashLoopBackOff' || r === 'OOMKilled') return 'badge-failed';
  switch (pod.phase) {
    case 'Running': return pod.readinessReady ? 'badge-running' : 'badge-pending';
    case 'Pending': return 'badge-pending';
    case 'Failed': return 'badge-failed';
    case 'Terminating': return 'badge-terminating';
    default: return 'badge-unknown';
  }
}

function getPodLabel(pod: Pod) {
  const r = pod.status?.containerStatuses?.[0]?.reason;
  if (r) return r;
  if (pod.phase === 'Running' && !pod.readinessReady) return 'NotReady';
  return pod.phase;
}

function ResourceBar({ used, total, label }: { used: number; total: number; label: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  const cls = pct > 85 ? 'critical' : pct > 70 ? 'warning' : '';
  return (
    <div className="resource-bar">
      <div className="resource-bar-label">
        <span>{label}</span>
        <span>{pct}% ({used}/{total})</span>
      </div>
      <div className="resource-bar-track">
        <div className={`resource-bar-fill ${cls}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function formatAge(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function OverviewModule() {
  const { cluster, setNodeStatus, addTaint, removeTaint, setModule } = useSimulator();

  const runningPods = cluster.pods.filter(p => p.phase === 'Running').length;
  const pendingPods = cluster.pods.filter(p => p.phase === 'Pending').length;
  const failedPods = cluster.pods.filter(p => 
    p.phase === 'Failed' || p.status.containerStatuses.some(cs => cs.reason === 'ImagePullBackOff' || cs.reason === 'CrashLoopBackOff' || cs.reason === 'ErrImagePull' || cs.reason === 'OOMKilled')
  ).length;
  const readyPods = cluster.pods.filter(p => p.readinessReady && p.phase === 'Running').length;
  const warnings = cluster.events.filter(e => e.type === 'Warning').length;

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      {/* Stats Row */}
      <div className="overview-grid">
        {[
          { label: 'Pods Running', value: runningPods, sub: `${readyPods} ready`, color: 'var(--k8s-green)' },
          { label: 'Pods Pending', value: pendingPods, sub: 'awaiting scheduling', color: 'var(--k8s-yellow)' },
          { label: 'Failed Pods', value: failedPods, sub: 'in error state', color: 'var(--k8s-red)' },
          { label: 'Deployments', value: cluster.deployments.length, sub: `${cluster.replicaSets.length} replica sets`, color: 'var(--k8s-blue)' },
          { label: 'Services', value: cluster.services.length, sub: `${cluster.services.reduce((a, s) => a + s.endpoints.length, 0)} endpoints`, color: 'var(--k8s-cyan)' },
          { label: 'Events', value: cluster.events.length, sub: `${warnings} warnings`, color: warnings > 0 ? 'var(--k8s-yellow)' : 'var(--text-muted)' },
        ].map(stat => (
          <div className="stat-card" key={stat.label}>
            <div className="stat-label">{stat.label}</div>
            <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
            <div className="stat-sub">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Nodes */}
      <div className="section-header">
        <div>
          <div className="section-title">🖥 Nodes</div>
          <div className="section-sub">{cluster.nodes.filter(n => n.status === 'Ready').length}/{cluster.nodes.length} ready</div>
        </div>
        <button className="btn" onClick={() => setModule('workloads')}>View Workloads →</button>
      </div>
      <div className="node-grid">
        {cluster.nodes.map(node => (
          <NodeCard key={node.id} node={node}
            pods={cluster.pods.filter(p => p.nodeName === node.id)}
            onKill={() => setNodeStatus(node.id, 'NotReady')}
            onRestore={() => setNodeStatus(node.id, 'Ready')}
            onTaint={() => addTaint(node.id, 'dedicated', 'true', 'NoSchedule')}
            onUntaint={() => removeTaint(node.id, 'dedicated')}
          />
        ))}
      </div>

      {/* Pods Table */}
      {cluster.pods.length > 0 && (
        <div className="pods-section">
          <div className="section-header" style={{ padding: '0 0 10px' }}>
            <div className="section-title">📦 Pods</div>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
            <table className="pods-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Namespace</th>
                  <th>Phase</th>
                  <th>Node</th>
                  <th>Restarts</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {cluster.pods.map(pod => (
                  <tr key={pod.id} id={`pod-row-${pod.id}`}>
                    <td>
                      <span style={{ color: 'var(--text-accent)' }}>{pod.name}</span>
                    </td>
                    <td><span style={{ color: 'var(--text-muted)' }}>{pod.namespace}</span></td>
                    <td>
                      <span className={`badge ${getPodBadgeClass(pod)}`}>{getPodLabel(pod)}</span>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {pod.nodeName || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: pod.status.containerStatuses[0]?.restartCount > 0 ? 'var(--k8s-orange)' : 'var(--text-muted)' }}>
                        {pod.status.containerStatuses[0]?.restartCount ?? 0}
                      </span>
                    </td>
                    <td><span style={{ color: 'var(--text-muted)' }}>{formatAge(pod.createdAt)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cluster.pods.length === 0 && cluster.deployments.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">⎈</div>
          <div className="empty-state-title">Empty Cluster</div>
          <div className="empty-state-desc">
            Deploy workloads using the <strong>YAML Editor</strong>, or
            load a <strong>Failure Scenario</strong> to start learning.
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={() => setModule('yaml')}>Open YAML Editor</button>
            <button className="btn" onClick={() => setModule('scenarios')}>Load Scenario</button>
          </div>
        </div>
      )}
    </div>
  );
}

function NodeCard({ node, pods, onKill, onRestore, onTaint, onUntaint }: {
  node: K8sNode;
  pods: Pod[];
  onKill: () => void;
  onRestore: () => void;
  onTaint: () => void;
  onUntaint: () => void;
}) {
  const isReady = node.status === 'Ready';

  return (
    <div className={`node-card ${!isReady ? 'not-ready' : ''}`} id={`node-${node.id}`}>
      <div className="node-header">
        <div>
          <div className="node-name">{node.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
            {pods.length} pod{pods.length !== 1 ? 's' : ''}
          </div>
        </div>
        <span className={`badge ${isReady ? 'badge-ready' : 'badge-not-ready'}`}>
          {node.status}
        </span>
      </div>
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <ResourceBar
          used={node.used.cpu}
          total={node.allocatable.cpu}
          label="CPU (millicores)"
        />
        <ResourceBar
          used={node.used.memory}
          total={node.allocatable.memory}
          label="Memory (MiB)"
        />

        {node.taints.length > 0 && (
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Taints</div>
            {node.taints.map((t, i) => (
              <span key={i} style={{
                fontSize: 9, padding: '2px 7px', borderRadius: 8,
                background: 'rgba(234, 179, 8, 0.1)', color: 'var(--k8s-yellow)',
                fontFamily: 'var(--font-mono)', marginRight: 4,
              }}>
                {t.key}{t.value ? `=${t.value}` : ''}:{t.effect}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          {isReady ? (
            <button className="btn btn-danger" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={onKill} id={`btn-kill-${node.id}`}>
              ⚡ Kill Node
            </button>
          ) : (
            <button className="btn btn-success" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={onRestore} id={`btn-restore-${node.id}`}>
              ✓ Restore
            </button>
          )}
          {node.taints.length === 0 ? (
            <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={onTaint} id={`btn-taint-${node.id}`}>
              + Taint
            </button>
          ) : (
            <button className="btn" style={{ fontSize: 11, padding: '4px 10px' }}
              onClick={onUntaint} id={`btn-untaint-${node.id}`}>
              − Untaint
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
