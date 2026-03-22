import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { PersistentVolume, PersistentVolumeClaim } from '../types/k8s';

export function StorageModule() {
  const { cluster } = useSimulator();
  const pvs = cluster.pvs;
  const pvcs = cluster.pvcs;

  function getPVCStatus(pvc: PersistentVolumeClaim) {
    switch (pvc.phase) {
      case 'Bound': return { cls: 'badge-bound', label: 'Bound' };
      case 'Pending': return { cls: 'badge-pending', label: 'Pending' };
      case 'Released': return { cls: 'badge-unknown', label: 'Released' };
      case 'Failed': return { cls: 'badge-failed', label: 'Failed' };
    }
  }

  function getPVStatus(pv: PersistentVolume) {
    switch (pv.phase) {
      case 'Available': return { cls: 'badge-available', label: 'Available' };
      case 'Bound': return { cls: 'badge-bound', label: 'Bound' };
      case 'Released': return { cls: 'badge-unknown', label: 'Released' };
      case 'Failed': return { cls: 'badge-failed', label: 'Failed' };
    }
  }

  return (
    <div className="storage-layout">
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Storage Module</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          PV → PVC binding lifecycle, StorageClass dynamic provisioning
        </div>
      </div>

      {/* PV/PVC Flow */}
      {(pvs.length > 0 || pvcs.length > 0) ? (
        <>
          {pvcs.map(pvc => {
            const boundPV = pvs.find(pv => pv.id === pvc.boundTo);
            const { cls, label } = getPVCStatus(pvc);
            return (
              <div key={pvc.id} className="pv-pvc-flow" id={`pvc-flow-${pvc.id}`}>
                {/* PV Side */}
                <div className="pv-box">
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>
                    PersistentVolume
                  </div>
                  {boundPV ? (
                    <>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--k8s-green)', marginBottom: 4 }}>
                        {boundPV.name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                        <div>Capacity: <span style={{ color: 'var(--text-primary)' }}>{boundPV.capacity}Gi</span></div>
                        <div>StorageClass: <span style={{ color: 'var(--k8s-cyan)', fontFamily: 'var(--font-mono)' }}>{boundPV.storageClassName}</span></div>
                        <div>AccessModes: <span style={{ color: 'var(--text-primary)' }}>{boundPV.accessModes.join(', ')}</span></div>
                        <div>ReclaimPolicy: <span style={{ color: 'var(--text-primary)' }}>{boundPV.reclaimPolicy}</span></div>
                      </div>
                    </>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                      No matching PV found for storageClass: <strong style={{ color: 'var(--k8s-yellow)', fontFamily: 'var(--font-mono)' }}>{pvc.storageClassName}</strong>
                    </div>
                  )}
                </div>

                {/* Arrow + Status */}
                <div className="pv-pvc-arrow">
                  <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: pvc.phase === 'Bound' ? 'var(--k8s-cyan)' : 'var(--text-muted)' }}>
                    {pvc.phase === 'Bound' ? '⇄' : '⟵'}
                  </div>
                  <div style={{ fontSize: 9, textAlign: 'center', color: pvc.phase === 'Bound' ? 'var(--k8s-cyan)' : 'var(--k8s-yellow)' }}>
                    {pvc.phase === 'Bound' ? 'BOUND' : 'SEEKING'}
                  </div>
                </div>

                {/* PVC Side */}
                <div className="pvc-box">
                  <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 700 }}>
                    PersistentVolumeClaim
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--k8s-cyan)', marginBottom: 4 }}>
                    {pvc.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    <div>Requested: <span style={{ color: 'var(--text-primary)' }}>{pvc.requestedStorage}Gi</span></div>
                    <div>StorageClass: <span style={{ color: 'var(--k8s-cyan)', fontFamily: 'var(--font-mono)' }}>{pvc.storageClassName}</span></div>
                    <div>AccessModes: <span style={{ color: 'var(--text-primary)' }}>{pvc.accessModes.join(', ')}</span></div>
                    <div>Phase: <span className={`badge ${cls}`}>{label}</span></div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* PV Table */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            <div className="panel-header">
              <div className="panel-title">💾 PersistentVolumes</div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{pvs.length} volumes</span>
            </div>
            <table className="pods-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Capacity</th>
                  <th>StorageClass</th>
                  <th>AccessModes</th>
                  <th>ReclaimPolicy</th>
                  <th>Status</th>
                  <th>Claim</th>
                </tr>
              </thead>
              <tbody>
                {pvs.map(pv => {
                  const { cls, label } = getPVStatus(pv);
                  const claim = pvcs.find(c => c.id === pv.boundTo);
                  return (
                    <tr key={pv.id}>
                      <td style={{ color: 'var(--k8s-green)' }}>{pv.name}</td>
                      <td>{pv.capacity}Gi</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--k8s-cyan)' }}>{pv.storageClassName}</td>
                      <td style={{ fontSize: 10 }}>{pv.accessModes.join(', ')}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{pv.reclaimPolicy}</td>
                      <td><span className={`badge ${cls}`}>{label}</span></td>
                      <td style={{ color: 'var(--text-muted)' }}>{claim?.name || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">💾</div>
          <div className="empty-state-title">No Storage Resources</div>
          <div className="empty-state-desc">
            Apply a PVC manifest to see the PV→PVC binding lifecycle, or load the
            "PVC Stuck in Pending" failure scenario.
          </div>
        </div>
      )}

      {/* Lifecycle explanation */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)', padding: 20,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
          ⚙ PV Lifecycle States
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {[
            { phase: 'Available', color: 'var(--k8s-green)', desc: 'Free — waiting to be claimed by a PVC' },
            { phase: 'Bound', color: 'var(--k8s-cyan)', desc: 'Exclusively reserved for one PVC' },
            { phase: 'Released', color: 'var(--text-muted)', desc: 'PVC deleted, PV not yet reclaimed' },
            { phase: 'Failed', color: 'var(--k8s-red)', desc: 'Reclaim failed — manual cleanup needed' },
          ].map(({ phase, color, desc }) => (
            <div key={phase} style={{
              flex: '1 1 180px', background: 'var(--bg-elevated)',
              border: `1px solid rgba(${color === 'var(--k8s-green)' ? '34,197,94' : '0,0,0'},0.2)`,
              borderRadius: 'var(--radius-md)', padding: 12,
              borderLeftColor: color, borderLeftWidth: 3,
            }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color, marginBottom: 4 }}>{phase}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
