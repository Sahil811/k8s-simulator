import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import { useProgress } from '../store/progressStore';
import { ConceptLink } from '../components/ConceptLink';
import { WorkloadsMap, NetworkingMap, StorageMap, ScalingMap, ControlPlaneMap } from '../components/LearningVisuals';
import { SCENARIOS } from '../data/scenarios';
import type { ScenarioId } from '../types/k8s';

export function LearningPathModule() {
  const { setModule, loadScenario } = useSimulator();
  const { solvedScenarios } = useProgress();

  const handleLaunchScenario = (id: ScenarioId) => {
    loadScenario(id);
    setModule('scenarios');
  };

  const getScenarioState = (id: ScenarioId) => {
    const scenario = SCENARIOS.find(s => s.id === id);
    const solved = solvedScenarios.includes(id);
    return { scenario, solved };
  };

  const renderScenarioItem = (id: ScenarioId) => {
    const { scenario, solved } = getScenarioState(id);
    if (!scenario) return null;

    return (
      <div key={id} className={`scenario-quest-item ${solved ? 'solved' : ''}`} onClick={() => handleLaunchScenario(id)} role="button">
        <div className="quest-checkbox">{solved ? '✓' : ''}</div>
        <div className="quest-content">
          <div className="quest-title">{scenario.title}</div>
          <div className="quest-diff">Difficulty: {scenario.difficulty}</div>
        </div>
        <div className="quest-action">
          <button className="quest-btn">{solved ? 'Replay' : 'Launch'}</button>
        </div>
      </div>
    );
  };

  const totalScenarios = SCENARIOS.length;
  const completedCount = solvedScenarios.length;
  const progressPercent = Math.round((completedCount / totalScenarios) * 100);

  return (
    <div className="learning-path-module">
      {/* Hero Welcome & Progress */}
      <div className="learning-hero">
        <h1 className="learning-hero-title">Welcome to the K8s Simulator</h1>
        <p className="learning-hero-desc">
          The fastest way to gain mechanical intuition for Kubernetes is to break it, 
          inspect the wreckage, and fix it. Follow this guided journey to master the core abstractions.
        </p>

        <div className="learning-progress-container">
          <div className="learning-progress-header">
            <span>Overall Progress</span>
            <span>{completedCount} / {totalScenarios} Scenarios Completed</span>
          </div>
          <div className="learning-progress-track">
            <div className="learning-progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      <div className="journey-timeline">
        {/* Phase 1 */}
        <div className="journey-phase">
          <div className="phase-node phase-blue">1</div>
          <div className="phase-content">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 1</div>
                <h2 className="phase-title">The Core Foundation</h2>
              </div>
              <p className="phase-desc">
                Applications in Kubernetes don't run directly on machines — they run inside Pods. 
                Instead of managing Pods by hand, we use Controllers to declare how many copies we want.
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <ConceptLink id="pods" />
                <ConceptLink id="controllers" />
                <ConceptLink id="reconciliation" />
              </div>
              <button className="phase-btn btn-blue" onClick={() => setModule('workloads')}>
                Go to Workload Lab →
              </button>

              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('image-pull-backoff')}
                  {renderScenarioItem('crash-loop-backoff')}
                  {renderScenarioItem('rolling-update-stuck')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <WorkloadsMap />
            </div>
          </div>
        </div>

        {/* Phase 2 */}
        <div className="journey-phase">
          <div className="phase-node phase-teal">2</div>
          <div className="phase-content">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 2</div>
                <h2 className="phase-title">Connecting the Dots</h2>
              </div>
              <p className="phase-desc">
                Pods are ephemeral; their IP addresses change constantly. Services provide a stable 
                virtual IP and load balance traffic across matching Pods.
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <ConceptLink id="services" />
                <ConceptLink id="labels" />
                <ConceptLink id="networkpolicy" />
              </div>
              <button className="phase-btn btn-teal" onClick={() => setModule('networking')}>
                Go to Networking Lab →
              </button>

              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('service-selector-mismatch')}
                  {renderScenarioItem('network-policy-blocking')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <NetworkingMap />
            </div>
          </div>
        </div>

        {/* Phase 3 */}
        <div className="journey-phase">
          <div className="phase-node phase-cyan">3</div>
          <div className="phase-content">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 3</div>
                <h2 className="phase-title">Persistence & Storage</h2>
              </div>
              <p className="phase-desc">
                Containers lose their data when they crash. To keep data safe, we map 
                Persistent Volume Claims (PVCs) inside Pods to physical disks (PVs).
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <ConceptLink id="pvc" />
              </div>
              <button className="phase-btn btn-cyan" onClick={() => setModule('storage')}>
                Go to Storage Lab →
              </button>

              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('pvc-pending')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <StorageMap />
            </div>
          </div>
        </div>

        {/* Phase 4 */}
        <div className="journey-phase">
          <div className="phase-node phase-green">4</div>
          <div className="phase-content">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 4</div>
                <h2 className="phase-title">Scaling & Auto-healing</h2>
              </div>
              <p className="phase-desc">
                Prepare for heavy traffic and random crashes. Horizontal Pod Autoscalers (HPAs) spin 
                up new replicas dynamically, while Health Probes constantly check for frozen applications.
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <ConceptLink id="hpa" />
                <ConceptLink id="rollingupdate" />
              </div>
              <button className="phase-btn btn-green" onClick={() => setModule('scaling')}>
                Go to Scaling & Healing →
              </button>

              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('hpa-not-scaling')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <ScalingMap />
            </div>
          </div>
        </div>

        {/* Phase 5 */}
        <div className="journey-phase">
          <div className="phase-node phase-purple">5</div>
          <div className="phase-content vertical">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 5</div>
                <h2 className="phase-title">The Control Plane</h2>
              </div>
              <p className="phase-desc">
                The "brain" of Kubernetes. API requests validate against RBAC rules and sit in etcd. 
                Control loops watch etcd and take action to match reality to definition.
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <ConceptLink id="apiserver" />
                <ConceptLink id="etcd" />
                <ConceptLink id="rbac" />
              </div>
              <button className="phase-btn btn-purple" onClick={() => setModule('controlplane')}>
                Go to Control Plane Lab →
              </button>

              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('rbac-forbidden')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <ControlPlaneMap />
            </div>
          </div>
        </div>

        {/* Phase 6 */}
        <div className="journey-phase finale">
          <div className="phase-node phase-orange">6</div>
          <div className="phase-content vertical">
            <div className="phase-text-panel">
              <div className="phase-header">
                <div className="phase-subtitle">PHASE 6</div>
                <h2 className="phase-title">Scheduling & Resources</h2>
              </div>
              <p className="phase-desc">
                Where should workloads run? How much memory do they need? The Node Scheduler 
                respects resource requests, limits, taints, and tolerations to place Pods securely.
              </p>
              <div className="phase-concepts">
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Concepts:</span>
                <span className="concept-badge">Node Scheduler</span>
                <span className="concept-badge">Taints & Tolerations</span>
                <span className="concept-badge">Resource Limits</span>
              </div>
              
              <div className="phase-quests">
                <div className="quests-header">Hands-On Scenarios</div>
                <div className="quests-list">
                  {renderScenarioItem('pending-resources')}
                  {renderScenarioItem('pending-taint')}
                  {renderScenarioItem('node-failure')}
                  {renderScenarioItem('oom-killed')}
                </div>
              </div>
            </div>
            <div className="phase-visual-panel">
              <div className="learning-visual">
                <div className="viz-box viz-orange" style={{ width: '100%', marginBottom: 8, padding: '16px' }}>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>Scheduler</div>
                  <div style={{ fontSize: 16 }}>kube-scheduler</div>
                </div>
                <div className="viz-arrow">↓</div>
                <div style={{ display: 'flex', gap: 12, width: '100%', justifyContent: 'space-between' }}>
                  <div className="viz-box viz-cyan" style={{ flex: 1, padding: '16px 8px' }}>
                    <div style={{ fontSize: 10 }}>Node 1</div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 4 }}>gpu=true:NoSchedule</div>
                  </div>
                  <div className="viz-box viz-green" style={{ flex: 1, padding: '16px 8px' }}>
                    <div style={{ fontSize: 10 }}>Node 2</div>
                    <div style={{ fontSize: 8, opacity: 0.6, marginTop: 4 }}>CPU: 80% used</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
