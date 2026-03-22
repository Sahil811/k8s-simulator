import React, { useState } from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { Deployment } from '../types/k8s';

function MiniBarChart({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40 }}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: `${(v / max) * 100}%`,
            background: color,
            borderRadius: '2px 2px 0 0',
            opacity: i === values.length - 1 ? 1 : 0.5,
            transition: 'height 300ms ease',
          }}
        />
      ))}
    </div>
  );
}

export function ScalingModule() {
  const {
    cluster, setCPULoad, toggleMetricsServer, cpuSimulation,
    triggerImagePullFail, fixImagePull,
    triggerReadinessFailure, fixReadinessProbe,
  } = useSimulator();

  const hpas = cluster.hpas;
  const deps = cluster.deployments;

  // CPU history per deployment
  const [cpuHistory, setCpuHistory] = useState<Record<string, number[]>>({});

  function handleCpuChange(depName: string, val: number) {
    setCPULoad(depName, val);
    setCpuHistory(h => ({
      ...h,
      [depName]: [...(h[depName] || []).slice(-19), val],
    }));
  }

  return (
    <div className="scaling-layout">
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Scaling & Self-Healing</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Simulate CPU spikes, HPA triggers, readiness failures, and rolling updates
        </div>
      </div>

      {/* HPA Cards */}
      {hpas.length > 0 ? (
        hpas.map(hpa => {
          const dep = deps.find(d => d.name === hpa.scaleTargetRef.name);
          const cpuVal = cpuSimulation[hpa.scaleTargetRef.name] ?? hpa.currentMetrics?.cpu ?? 0;
          const target = hpa.metrics[0]?.resource.targetAverageUtilization ?? 50;
          const hist = cpuHistory[hpa.scaleTargetRef.name] || Array(10).fill(0);

          return (
            <div key={hpa.id} className="hpa-card" id={`hpa-${hpa.id}`}>
              <div className="panel-header">
                <div className="panel-title">
                  <span>📈</span>
                  HPA: {hpa.name}
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 400 }}>
                    → {hpa.scaleTargetRef.kind}/{hpa.scaleTargetRef.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>metrics-server:</span>
                  <button
                    id={`btn-metrics-${hpa.id}`}
                    onClick={() => toggleMetricsServer(!hpa.metricsAvailable)}
                    style={{
                      padding: '3px 10px', borderRadius: 'var(--radius-md)', fontSize: 11,
                      border: `1px solid ${hpa.metricsAvailable ? 'var(--k8s-green)' : 'var(--k8s-red)'}`,
                      background: hpa.metricsAvailable ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      color: hpa.metricsAvailable ? 'var(--k8s-green)' : 'var(--k8s-red)',
                      cursor: 'pointer', fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {hpa.metricsAvailable ? '● Running' : '● Missing'}
                  </button>
                </div>
              </div>

              <div className="hpa-metrics">
                {[
                  { label: 'Current CPU', value: hpa.metricsAvailable ? `${cpuVal}%` : '<unknown>', color: cpuVal > target ? 'var(--k8s-red)' : 'var(--k8s-green)' },
                  { label: 'Target CPU', value: `${target}%`, color: 'var(--text-primary)' },
                  { label: 'Current Replicas', value: dep?.replicas ?? 0, color: 'var(--k8s-blue)' },
                  { label: 'Min / Max', value: `${hpa.minReplicas} / ${hpa.maxReplicas}`, color: 'var(--text-secondary)' },
                ].map(m => (
                  <div key={m.label} className="hpa-metric">
                    <div className="hpa-metric-label">{m.label}</div>
                    <div className="hpa-metric-value" style={{ color: m.color as any }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* CPU Chart */}
              <div style={{ padding: '8px 16px 4px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>CPU utilization history</div>
                <MiniBarChart
                  values={hist.length > 0 ? hist : Array(10).fill(0)}
                  color={cpuVal > target ? 'var(--k8s-red)' : 'var(--k8s-blue)'}
                />
                {cpuVal > target && hpa.metricsAvailable && (
                  <div style={{ fontSize: 10, color: 'var(--k8s-yellow)', marginTop: 6 }}>
                    ⚡ Above threshold — HPA will scale up within 60s cooldown
                  </div>
                )}
                {!hpa.metricsAvailable && (
                  <div style={{ fontSize: 10, color: 'var(--k8s-red)', marginTop: 6 }}>
                    ⚠ metrics-server not available — HPA cannot make scaling decisions
                  </div>
                )}
              </div>

              {/* CPU Slider */}
              <div className="cpu-gauge-container">
                <span className="cpu-gauge-label">Simulate CPU</span>
                <input
                  id={`cpu-slider-${hpa.id}`}
                  type="range"
                  min={0}
                  max={100}
                  value={cpuVal}
                  onChange={e => handleCpuChange(hpa.scaleTargetRef.name, Number(e.target.value))}
                  className="cpu-slider"
                  style={{
                    background: `linear-gradient(90deg, ${cpuVal > target ? 'var(--k8s-red)' : 'var(--k8s-blue)'} ${cpuVal}%, var(--bg-base) ${cpuVal}%)`
                  }}
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, minWidth: 40, textAlign: 'right', color: cpuVal > target ? 'var(--k8s-red)' : 'var(--k8s-green)' }}>
                  {cpuVal}%
                </span>
              </div>
            </div>
          );
        })
      ) : (
        <div className="panel" style={{ padding: 20 }}>
          <div className="empty-state" style={{ padding: 30 }}>
            <div className="empty-state-icon">📈</div>
            <div className="empty-state-title">No HPA Configured</div>
            <div className="empty-state-desc">
              Apply an HPA manifest in the YAML Editor, or load the "HPA not scaling" scenario.
            </div>
          </div>
        </div>
      )}

      {/* Workload Controls */}
      {deps.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
          <div className="panel-header">
            <div className="panel-title">⚙ Workload Fault Injection</div>
          </div>
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {deps.map(dep => (
              <div key={dep.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', background: 'var(--bg-elevated)',
                borderRadius: 'var(--radius-md)', flexWrap: 'wrap', gap: 10,
              }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--k8s-blue)' }}>
                    {dep.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {dep.status.readyReplicas}/{dep.replicas} ready pods
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    id={`btn-inject-pull-${dep.id}`}
                    className="btn btn-danger"
                    onClick={() => triggerImagePullFail(dep.name)}
                    style={{ fontSize: 11 }}
                  >
                    💥 Fail Image Pull
                  </button>
                  <button
                    id={`btn-fix-pull-${dep.id}`}
                    className="btn btn-success"
                    onClick={() => fixImagePull(dep.name)}
                    style={{ fontSize: 11 }}
                  >
                    ✓ Fix Image
                  </button>
                  <button
                    id={`btn-inject-ready-${dep.id}`}
                    className="btn btn-danger"
                    onClick={() => triggerReadinessFailure(dep.name)}
                    style={{ fontSize: 11 }}
                  >
                    💥 Fail Readiness
                  </button>
                  <button
                    id={`btn-fix-ready-${dep.id}`}
                    className="btn btn-success"
                    onClick={() => fixReadinessProbe(dep.name)}
                    style={{ fontSize: 11 }}
                  >
                    ✓ Fix Readiness
                  </button>
                  <button
                    id={`btn-scale-up-${dep.id}`}
                    className="btn"
                    onClick={() => {
                      useSimulator.getState().applyYAML(`apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${dep.name}\n  namespace: ${dep.namespace}\nspec:\n  replicas: ${dep.replicas + 1}\n  selector:\n    matchLabels:\n      app: ${dep.name}\n  template:\n    metadata:\n      labels:\n        app: ${dep.name}\n    spec:\n      containers:\n        - name: ${dep.name}\n          image: ${dep.template.spec.containers[0]?.image || 'nginx:latest'}`);
                    }}
                    style={{ fontSize: 11 }}
                  >
                    + Scale Up
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
