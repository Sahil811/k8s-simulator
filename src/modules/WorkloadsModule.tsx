import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { Pod, Deployment, ReplicaSet } from '../types/k8s';

function getPodStatusColor(pod: Pod): string {
  const reason = pod.status.containerStatuses[0]?.reason;
  if (reason === 'ImagePullBackOff' || reason === 'CrashLoopBackOff' || reason === 'OOMKilled') return 'var(--k8s-red)';
  switch (pod.phase) {
    case 'Running': return pod.readinessReady ? 'var(--k8s-green)' : 'var(--k8s-yellow)';
    case 'Pending': return pod.status.containerStatuses.some(cs => cs.reason === 'ErrImagePull') ? 'var(--k8s-red)' : 'var(--k8s-yellow)';
    case 'Failed': return 'var(--k8s-red)';
    case 'Terminating': return 'var(--k8s-purple)';
    default: return 'var(--text-muted)';
  }
}

function PodDot({ pod, onClick }: { pod: Pod; onClick: () => void }) {
  const color = getPodStatusColor(pod);
  const reason = pod.status.containerStatuses[0]?.reason;
  const label = reason || pod.phase;

  return (
    <div
      title={`${pod.name}: ${label}`}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: `2px solid ${color}`,
        background: `${color}25`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 150ms ease',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.2)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
    >
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
    </div>
  );
}

export function WorkloadsModule() {
  const { cluster, deleteResource } = useSimulator();
  const [selectedPod, setSelectedPod] = React.useState<Pod | null>(null);

  const deps = cluster.deployments;
  const replicaSets = cluster.replicaSets;
  const pods = cluster.pods;

  function getRSForDep(dep: Deployment): ReplicaSet | undefined {
    return replicaSets.find(rs => rs.ownerRef?.name === dep.name && rs.namespace === dep.namespace);
  }

  function getPodsForRS(rs: ReplicaSet): Pod[] {
    return pods.filter(p => p.ownerRef?.name === rs.name && p.namespace === rs.namespace);
  }

  return (
    <div style={{ overflow: 'auto', flex: 1, padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Workload Lab</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Deployment → ReplicaSet → Pod ownership chain with scheduling decisions
        </div>
      </div>

      {deps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📦</div>
          <div className="empty-state-title">No Workloads</div>
          <div className="empty-state-desc">
            Apply a Deployment YAML to see the ownership chain, or load a failure scenario.
          </div>
        </div>
      ) : (
        deps.map(dep => {
          const rs = getRSForDep(dep);
          const rsPods = rs ? getPodsForRS(rs) : [];
          const readyCount = rsPods.filter(p => p.readinessReady && p.phase === 'Running').length;
          const pendingCount = rsPods.filter(p => p.phase === 'Pending').length;
          const failedCount = rsPods.filter(p => p.phase === 'Failed' || p.status.containerStatuses.some(cs => cs.reason === 'ImagePullBackOff' || cs.reason === 'CrashLoopBackOff' || cs.reason === 'ErrImagePull' || cs.reason === 'OOMKilled')).length;

          return (
            <div key={dep.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-lg)', overflow: 'hidden',
              borderLeft: `4px solid ${failedCount > 0 ? 'var(--k8s-red)' : pendingCount > 0 ? 'var(--k8s-yellow)' : 'var(--k8s-blue)'}`,
            }} id={`dep-${dep.id}`}>
              {/* Deployment Header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
              }}>
                <span style={{ fontSize: 18 }}>🗃</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 14, color: 'var(--k8s-blue)' }}>
                    Deployment/{dep.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    namespace: {dep.namespace} · strategy: {dep.strategy.type} · revision #{dep._revision}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                  <span style={{ color: 'var(--k8s-green)' }}>{readyCount} ready</span>
                  {pendingCount > 0 && <span style={{ color: 'var(--k8s-yellow)' }}>{pendingCount} pending</span>}
                  {failedCount > 0 && <span style={{ color: 'var(--k8s-red)' }}>{failedCount} failing</span>}
                  <span style={{ color: 'var(--text-muted)' }}>/ {dep.replicas} desired</span>
                </div>
                <button
                  className="btn btn-danger"
                  onClick={() => deleteResource('Deployment', dep.name, dep.namespace)}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  Delete
                </button>
              </div>

              {/* RS Row */}
              {rs && (
                <div style={{
                  padding: '12px 18px', borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'center', gap: 12,
                  marginLeft: 24,
                }}>
                  <div style={{ width: 20, borderLeft: '2px dashed var(--border-default)', borderBottom: '2px dashed var(--border-default)', height: 20, borderRadius: '0 0 0 4px' }} />
                  <span style={{ fontSize: 16 }}>📋</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--k8s-cyan)' }}>
                      ReplicaSet/{rs.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      desired: {rs.replicas} · ready: {rs.readyReplicas} · available: {rs.availableReplicas}
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    selector: {JSON.stringify(rs.selector.matchLabels)}
                  </div>
                </div>
              )}

              {/* Pods Row */}
              {rsPods.length > 0 && (
                <div style={{ padding: '12px 18px 16px', marginLeft: 48, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {rsPods.map(pod => (
                      <React.Fragment key={pod.id}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 16, borderLeft: '2px dashed var(--border-default)', borderBottom: '2px dashed var(--border-default)', height: 16, borderRadius: '0 0 0 4px' }} />
                          <PodDot pod={pod} onClick={() => setSelectedPod(pod === selectedPod ? null : pod)} />
                        </div>
                      </React.Fragment>
                    ))}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                      ↑ click a pod to inspect
                    </span>
                  </div>

                  {/* Pod Detail */}
                  {selectedPod && rsPods.find(p => p.id === selectedPod.id) && (
                    <PodDetailCard pod={selectedPod} nodes={cluster.nodes} />
                  )}
                </div>
              )}

              {rs && rsPods.length === 0 && (
                <div style={{ padding: '12px 18px', marginLeft: 48, fontSize: 11, color: 'var(--text-muted)' }}>
                  Pods being created...
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 16, padding: '10px 14px',
        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)', flexWrap: 'wrap', fontSize: 11,
      }}>
        {[
          { color: 'var(--k8s-green)', label: 'Running & Ready' },
          { color: 'var(--k8s-yellow)', label: 'Pending / Not Ready' },
          { color: 'var(--k8s-red)', label: 'Failed / CrashLoopBackOff' },
          { color: 'var(--k8s-purple)', label: 'Terminating' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
            <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PodDetailCard({ pod, nodes }: { pod: Pod; nodes: any[] }) {
  const node = nodes.find(n => n.id === pod.nodeName);
  const cs = pod.status.containerStatuses[0];

  return (
    <div style={{
      background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)', padding: 14, fontSize: 12,
      animation: 'fadeInUp 200ms ease',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Pod Name</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--k8s-cyan)' }}>{pod.name}</div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Phase</div>
          <div style={{ color: getPodStatusColor(pod) }}>
            {cs?.reason || pod.phase}
            {cs?.restartCount ? ` (${cs.restartCount} restarts)` : ''}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Node</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            {node?.name || 'Unscheduled'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Readiness</div>
          <div style={{ color: pod.readinessReady ? 'var(--k8s-green)' : 'var(--k8s-yellow)' }}>
            {pod.readinessReady ? '✓ Ready' : '✗ Not Ready'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Resources</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', fontSize: 11 }}>
            {pod.resources.cpu}m CPU, {pod.resources.memory}Mi
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>Image</div>
          <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontSize: 11 }}>
            {pod.containers[0]?.image}
          </div>
        </div>
      </div>
      {cs?.message && (
        <div style={{
          marginTop: 10, padding: '6px 10px',
          background: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-sm)',
          fontSize: 11, color: 'var(--k8s-red)', fontFamily: 'var(--font-mono)',
        }}>
          {cs.message}
        </div>
      )}
    </div>
  );
}
