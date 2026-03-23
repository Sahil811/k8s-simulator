import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import { ConceptLink } from '../components/ConceptLink';

export function LearningPathModule() {
  const { setModule } = useSimulator();

  return (
    <div className="learning-path-module">
      {/* Hero Welcome */}
      <div className="learning-hero">
        <h1 className="learning-hero-title">Welcome to the K8s Simulator</h1>
        <p className="learning-hero-desc">
          The fastest way to gain mechanical intuition for Kubernetes is to break it, 
          inspect the wreckage, and fix it. Follow this guided journey to master the core abstractions.
        </p>
      </div>

      <div className="journey-timeline">
        {/* Phase 1 */}
        <div className="journey-phase">
          <div className="phase-node phase-blue">1</div>
          <div className="phase-content">
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
          </div>
        </div>

        {/* Phase 2 */}
        <div className="journey-phase">
          <div className="phase-node phase-teal">2</div>
          <div className="phase-content">
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
          </div>
        </div>

        {/* Phase 3 */}
        <div className="journey-phase">
          <div className="phase-node phase-cyan">3</div>
          <div className="phase-content">
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
          </div>
        </div>

        {/* Phase 4 */}
        <div className="journey-phase">
          <div className="phase-node phase-green">4</div>
          <div className="phase-content">
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
          </div>
        </div>

        {/* Phase 5 */}
        <div className="journey-phase">
          <div className="phase-node phase-purple">5</div>
          <div className="phase-content">
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
          </div>
        </div>

        {/* Phase 6 */}
        <div className="journey-phase finale">
          <div className="phase-node phase-red">6</div>
          <div className="phase-content">
            <div className="phase-header">
              <div className="phase-subtitle">FINAL PHASE</div>
              <h2 className="phase-title">Trial by Fire</h2>
            </div>
            <p className="phase-desc">
              You know the abstractions. Now it's time to test your intuition. Dive into 
              12 realistic production failures, diagnose the root causes, and fix them.
            </p>
            <button className="phase-btn btn-red" onClick={() => setModule('scenarios')}>
              Face the Failure Scenarios 🔥
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
