import React, { useState, useRef } from 'react';
import { useSimulator } from '../store/simulatorStore';
import { SCENARIOS } from '../data/scenarios';
import { useProgress } from '../store/progressStore';
import { ConceptLink } from '../components/ConceptLink';
import { QuizModal } from '../components/QuizModal';
import type { ScenarioId } from '../types/k8s';
import { sounds } from '../utils/audio';
import confetti from 'canvas-confetti';

const triggerMassiveConfetti = () => {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } }));
    confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } }));
  }, 250);
};

// Concept links per scenario
const SCENARIO_CONCEPTS: Record<ScenarioId, string[]> = {
  'image-pull-backoff': ['pods', 'controllers'],
  'crash-loop-backoff': ['pods', 'resources'],
  'pending-resources': ['resources', 'scheduling'],
  'pending-taint': ['taints', 'scheduling'],
  'node-failure': ['reconciliation', 'pods'],
  'oom-killed': ['resources', 'pods'],
  'pvc-pending': ['pvc'],
  'service-selector-mismatch': ['services'],
  'rolling-update-stuck': ['rollingupdate', 'controllers'],
  'hpa-not-scaling': ['hpa', 'resources'],
  'rbac-forbidden': ['rbac', 'apiserver'],
  'network-policy-blocking': ['networkpolicy', 'services'],
};

export function ScenariosModule() {
  const { loadScenario, activeScenario, setSandbox: _setSandbox } = useSimulator();
  const { solvedScenarios } = useProgress();

  const categoryColors: Record<string, string> = {
    Workload: 'var(--k8s-blue)',
    Scheduling: 'var(--k8s-purple)',
    Reliability: 'var(--k8s-orange)',
    Resources: 'var(--k8s-red)',
    Storage: 'var(--k8s-cyan)',
    Networking: 'var(--k8s-teal)',
    Scaling: 'var(--k8s-green)',
    Security: 'var(--k8s-yellow)',
  };

  if (activeScenario) {
    return <ActiveScenarioView />;
  }

  const solved = solvedScenarios.length;

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{ padding: '20px 20px 10px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Failure Scenario Library</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>12 production failure patterns. Load any to get a pre-broken cluster — diagnose and fix it.</span>
          {solved > 0 && (
            <span style={{ color: 'var(--k8s-green)', fontWeight: 600 }}>
              ✓ {solved}/12 solved
            </span>
          )}
        </div>
      </div>

      <div className="scenarios-grid">
        {SCENARIOS.map(s => {
          const isSolved = solvedScenarios.includes(s.id);
          return (
            <div
              key={s.id}
              className={`scenario-card ${isSolved ? 'scenario-card-solved' : ''}`}
              onClick={() => loadScenario(s.id)}
              id={`scenario-${s.id}`}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className={`scenario-difficulty difficulty-${s.difficulty}`}>{s.difficulty}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isSolved && <span style={{ color: 'var(--k8s-green)', fontSize: 13 }}>✅</span>}
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    color: categoryColors[s.category] || 'var(--text-muted)',
                    background: `${categoryColors[s.category]}18` || 'var(--bg-elevated)',
                    fontWeight: 600,
                  }}>
                    {s.category}
                  </span>
                </div>
              </div>

              <div className="scenario-title">{s.title}</div>
              <div className="scenario-desc">{s.description}</div>

              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                <span style={{ color: 'var(--k8s-red)' }}>⚠ </span>
                {s.symptoms[0]}
              </div>

              <div style={{
                marginTop: 4, padding: '6px 10px',
                background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                fontSize: 11, color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span>🎯</span>
                <span>{isSolved ? 'Click to replay' : 'Click to load scenario'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ActiveScenarioView() {
  const { activeScenario, exitScenario, cluster } = useSimulator();
  const { markSolved, solvedScenarios, setScenarioStartTime, scenarioStartTime } = useProgress();

  const [mode, setMode] = useState<'guided' | 'challenge'>('guided');
  const [hintsOpened, setHintsOpened] = useState(false);
  const [resolutionOpened, setResolutionOpened] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [justSolved, setJustSolved] = useState(false);
  const [quizShown, setQuizShown] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  if (!activeScenario) return null;

  const isSolved = activeScenario.validate ? activeScenario.validate(cluster) : false;
  const wasSolved = solvedScenarios.includes(activeScenario.id);

  // Award XP/achievements when first solved
  React.useEffect(() => {
    if (isSolved && !justSolved) {
      setJustSolved(true);
      markSolved(activeScenario.id, hintsOpened || resolutionOpened, startTimeRef.current);

      const totallySolvedCount = solvedScenarios.length + (wasSolved ? 0 : 1);
      if (totallySolvedCount >= SCENARIOS.length) {
        sounds.playSuccess();
        triggerMassiveConfetti();
      } else {
        sounds.playSuccess();
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#22c55e', '#00d4ff', '#f59e0b'] // Green, Cyan, Orange
        });
      }
    }
  }, [isSolved]);

  // Reset start time when scenario loads
  React.useEffect(() => {
    startTimeRef.current = Date.now();
    setJustSolved(false);
    setQuizShown(false);
    setHintsOpened(false);
    setResolutionOpened(false);
  }, [activeScenario.id]);

  const pods = cluster.pods;
  const failedPods = pods.filter(p =>
    p.phase === 'Failed' || p.status.containerStatuses.some(cs => cs.reason === 'ImagePullBackOff' || cs.reason === 'CrashLoopBackOff' || cs.reason === 'ErrImagePull' || cs.reason === 'OOMKilled')
  );
  const pendingPods = pods.filter(p => p.phase === 'Pending');

  const conceptIds = SCENARIO_CONCEPTS[activeScenario.id] || [];

  return (
    <div className="scenario-active">
      {showQuiz && (
        <QuizModal
          scenarioId={activeScenario.id}
          onClose={() => { setShowQuiz(false); setQuizShown(true); }}
        />
      )}

      {/* Banner */}
      <div className="scenario-banner">
        <div className="scenario-banner-icon">
          {activeScenario.difficulty === 'beginner' ? '🟢' : activeScenario.difficulty === 'intermediate' ? '🟡' : '🔴'}
        </div>
        <div className="scenario-banner-content">
          <div className="scenario-banner-title">{activeScenario.title}</div>
          <div className="scenario-banner-desc">{activeScenario.description}</div>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
            <span style={{ color: 'var(--k8s-yellow)' }}>Trigger: </span>{activeScenario.trigger}
          </div>
        </div>
        <button className="btn btn-danger" onClick={exitScenario} style={{ fontSize: 11, flexShrink: 0 }}>
          Exit Scenario
        </button>
      </div>

      {/* Mode Toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <button
          className={`btn ${mode === 'guided' ? 'btn-primary' : ''}`}
          style={{ fontSize: 11, padding: '5px 14px' }}
          onClick={() => setMode('guided')}
        >
          📖 Guided Mode
        </button>
        <button
          className={`btn ${mode === 'challenge' ? 'btn-primary' : ''}`}
          style={{ fontSize: 11, padding: '5px 14px' }}
          onClick={() => setMode('challenge')}
        >
          ⚔️ Challenge Mode
        </button>
        {conceptIds.length > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Related concepts:</span>
            {conceptIds.map(id => <ConceptLink key={id} id={id} />)}
          </div>
        )}
      </div>

      {/* Solved Banner */}
      {isSolved && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{ fontSize: 24 }}>🎉</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: 'var(--k8s-green)', fontWeight: 'bold', fontSize: 14 }}>Scenario Solved!</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
              {wasSolved ? 'Already solved — great for review! No additional XP.' : 'You earned +100 XP. Test your understanding with the knowledge check!'}
            </div>
          </div>
          {!quizShown && !wasSolved && (
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, flexShrink: 0 }}
              onClick={() => setShowQuiz(true)}
            >
              🧠 Knowledge Check →
            </button>
          )}
          {quizShown && (
            <span style={{ fontSize: 11, color: 'var(--k8s-green)' }}>✓ Quiz complete</span>
          )}
        </div>
      )}

      {/* Status overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Total Pods', value: pods.length, color: 'var(--text-primary)' },
          { label: 'Failing', value: failedPods.length, color: failedPods.length > 0 ? 'var(--k8s-red)' : 'var(--k8s-green)' },
          { label: 'Pending', value: pendingPods.length, color: pendingPods.length > 0 ? 'var(--k8s-yellow)' : 'var(--k8s-green)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)', padding: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'var(--font-mono)', color: s.color as any }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Guided vs Challenge mode content */}
      {mode === 'guided' ? (
        <GuidedMode scenario={activeScenario} cluster={cluster} isSolved={isSolved} />
      ) : (
        <ChallengeMode
          scenario={activeScenario}
          onHintsOpen={() => setHintsOpened(true)}
          onResolutionOpen={() => setResolutionOpened(true)}
        />
      )}

      {/* Root Cause — always visible */}
      <div style={{
        background: 'rgba(79, 128, 255, 0.06)', border: '1px solid rgba(79, 128, 255, 0.2)',
        borderRadius: 'var(--radius-lg)', padding: 16,
      }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--k8s-blue)', marginBottom: 8, fontWeight: 700 }}>
          Root Cause
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7 }}>
          {activeScenario.rootCause}
        </div>
      </div>
    </div>
  );
}

// ===== GUIDED MODE =====
const GUIDED_STEPS: Partial<Record<ScenarioId, { instruction: string; tip: string; verify?: (state: any) => boolean }[]>> = {
  'image-pull-backoff': [
    { instruction: 'Run `kubectl get pods` in the Terminal to see the current pod state.', tip: 'Look at the STATUS column — it will show the exact failure reason' },
    { instruction: 'Run `kubectl describe pod bad-image-app-<TAB>` and scroll to the Events section.', tip: 'The Events section shows the exact registry error and the image name that failed' },
    { instruction: 'Open the YAML Editor (left sidebar) and fix the image tag from `nginx:nonexistent-tag-xyz` to `nginx:1.25`.', tip: 'Change only the image field under spec.template.spec.containers[0].image' },
    { instruction: 'Apply the fixed YAML and watch the pod status change to Running.', tip: 'The simulator will validate the fix automatically' },
  ],
  'crash-loop-backoff': [
    { instruction: 'Run `kubectl get pods` and note the RESTARTS count for the crasher pod.', tip: 'The restart count increases with each crash cycle' },
    { instruction: 'Run `kubectl logs crasher-<TAB> --previous` to see the last crash output.', tip: 'The --previous flag is crucial — without it you see the new (empty) container' },
    { instruction: 'Open the Workload Lab module and delete the crasher deployment.', tip: 'Use the Delete button on the deployment card' },
    { instruction: 'Apply a new Deployment with a stable image (e.g., nginx:latest) using the YAML Editor.', tip: 'Create a basic deployment with a working image and no crash conditions' },
  ],
  'pending-resources': [
    { instruction: 'Run `kubectl get pods` — all pods should show Pending status.', tip: 'Pending means the scheduler cannot find a suitable node' },
    { instruction: 'Run `kubectl describe pod memory-hog-<TAB>` to see the scheduler\'s reason.', tip: 'Look under Events for "Insufficient cpu" or "Insufficient memory"' },
    { instruction: 'Open the YAML Editor. Reduce the memory-hog deployment CPU request from 2000m to 500m and memory from 6000Mi to 512Mi.', tip: 'The nodes have 3800m allocatable CPU and 7680Mi memory — requests must fit' },
    { instruction: 'Apply the updated YAML and watch pods transition to Running.', tip: 'The scheduler will now find the pods fit on the nodes' },
  ],
  'pending-taint': [
    { instruction: 'Run `kubectl get pods` — pods should be Pending.', tip: 'The nodes are tainted — no pod can schedule without a matching toleration' },
    { instruction: 'Run `kubectl describe node node-1` and look for the Taints section.', tip: 'You will see: gpu=true:NoSchedule — this is the lock on the node' },
    { instruction: 'Open the YAML Editor. Add a tolerations block to the no-toleration-app deployment.', tip: 'Add: tolerations: [{key: "gpu", value: "true", effect: "NoSchedule", operator: "Equal"}]' },
    { instruction: 'Apply the updated YAML and watch the pods get scheduled.', tip: 'With the matching toleration, the scheduler can now place pods on the tainted nodes' },
  ],
  'service-selector-mismatch': [
    { instruction: 'Run `kubectl get endpoints web-app-svc` in the Terminal.', tip: 'If you see <none>, the service has no backends — the selector matches zero pods' },
    { instruction: 'Run `kubectl describe service web-app-svc` and find the Selector field.', tip: 'Compare the selector to the pod labels. Spot the difference!' },
    { instruction: 'Open the YAML Editor, find the web-app-svc Service, and fix the selector from `app: web-application` to `app: web-app`.', tip: 'Selectors are case-sensitive and whitespace-sensitive — must be an exact match' },
    { instruction: 'Apply the fixed Service YAML and run `kubectl get endpoints` again.', tip: 'You should now see pod IP addresses listed as endpoints' },
  ],
};

function GuidedMode({ scenario, cluster, isSolved }: { scenario: any; cluster: any; isSolved: boolean }) {
  const [currentStep, setCurrentStep] = useState(0);
  const steps = GUIDED_STEPS[scenario.id as ScenarioId];

  if (!steps) {
    // Fallback: show symptoms as steps for scenarios without explicit guided steps
    return (
      <div className="guided-steps-panel">
        <div className="guided-steps-title">📖 Guided Walkthrough</div>
        <div style={{ marginTop: 8 }}>
          <div className="guided-steps-title" style={{ fontSize: 12, color: 'var(--k8s-red)', marginBottom: 8 }}>⚠ What you observe in the cluster</div>
          {scenario.symptoms.map((s: string, i: number) => (
            <div key={i} className="guided-step-item">
              <div className="guided-step-number">{i + 1}</div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.5 }}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="guided-steps-title" style={{ fontSize: 12, color: 'var(--k8s-green)', marginBottom: 8 }}>✓ Steps to fix it</div>
          {scenario.resolution.map((r: string, i: number) => (
            <div key={i} className="guided-step-item">
              <div className="guided-step-number" style={{ background: 'var(--k8s-green)' }}>{i + 1}</div>
              <div className="guided-step-text">{r}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="guided-steps-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div className="guided-steps-title">📖 Step-by-Step Walkthrough</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Step {Math.min(currentStep + 1, steps.length)} of {steps.length}</div>
      </div>

      {/* Progress line */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {steps.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i <= currentStep ? 'var(--k8s-blue)' : 'var(--bg-elevated)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep || isSolved;
        const isFuture = i > currentStep;
        return (
          <div
            key={i}
            className={`guided-step-row ${isActive ? 'guided-step-active' : ''} ${isDone ? 'guided-step-done' : ''} ${isFuture ? 'guided-step-future' : ''}`}
          >
            <div className={`guided-step-indicator ${isActive ? 'guided-step-indicator-active' : ''} ${isDone ? 'guided-step-indicator-done' : ''}`}>
              {isDone ? '✓' : i + 1}
            </div>
            <div style={{ flex: 1 }}>
              <div className="guided-step-instruction">{step.instruction}</div>
              {isActive && (
                <div className="guided-step-tip">
                  💡 <em>{step.tip}</em>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {!isSolved && currentStep < steps.length - 1 && (
        <button
          className="btn"
          style={{ marginTop: 12, fontSize: 11 }}
          onClick={() => setCurrentStep(s => Math.min(s + 1, steps.length - 1))}
        >
          Next Step →
        </button>
      )}
      {currentStep > 0 && (
        <button
          className="btn"
          style={{ marginTop: 12, fontSize: 11, marginLeft: 8 }}
          onClick={() => setCurrentStep(s => Math.max(s - 1, 0))}
        >
          ← Back
        </button>
      )}
    </div>
  );
}

function ChallengeMode({ scenario, onHintsOpen, onResolutionOpen }: { scenario: any; onHintsOpen: () => void; onResolutionOpen: () => void }) {
  return (
    <>
      {/* Symptoms */}
      <div className="scenario-symptoms">
        <div className="scenario-section-title" style={{ color: 'var(--k8s-red)' }}>
          ⚠ What you'd see in production
        </div>
        <div className="symptom-list">
          {scenario.symptoms.map((s: string, i: number) => (
            <div key={i} className="symptom-item">{s}</div>
          ))}
        </div>
      </div>

      {/* Hints */}
      <details style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}
        onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) onHintsOpen(); }}>
        <summary style={{
          padding: '12px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: 'var(--k8s-yellow)', userSelect: 'none',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          💡 Hints (try without first!)
        </summary>
        <div style={{ padding: '0 16px 16px' }}>
          <div className="hint-list">
            {scenario.hints.map((h: string, i: number) => (
              <div key={i} className="symptom-item hint-item">{h}</div>
            ))}
          </div>
        </div>
      </details>

      {/* Resolution */}
      <details style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}
        onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) onResolutionOpen(); }}>
        <summary style={{
          padding: '12px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: 'var(--k8s-green)', userSelect: 'none',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ Resolution Steps
        </summary>
        <div style={{ padding: '0 16px 16px' }}>
          <div className="resolution-list">
            {scenario.resolution.map((r: string, i: number) => (
              <div key={i} className="symptom-item resolution-item">{r}</div>
            ))}
          </div>
        </div>
      </details>
    </>
  );
}
