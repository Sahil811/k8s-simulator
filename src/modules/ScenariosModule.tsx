import { useSimulator } from '../store/simulatorStore';
import { SCENARIOS } from '../data/scenarios';

export function ScenariosModule() {
  const { loadScenario, activeScenario } = useSimulator();

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

  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <div style={{ padding: '20px 20px 10px' }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Failure Scenario Library</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          12 production failure patterns. Load any to get a pre-broken cluster — diagnose and fix it.
        </div>
      </div>

      <div className="scenarios-grid">
        {SCENARIOS.map(s => (
          <div
            key={s.id}
            className="scenario-card"
            onClick={() => loadScenario(s.id)}
            id={`scenario-${s.id}`}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span className={`scenario-difficulty difficulty-${s.difficulty}`}>{s.difficulty}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                color: categoryColors[s.category] || 'var(--text-muted)',
                background: `${categoryColors[s.category]}18` || 'var(--bg-elevated)',
                fontWeight: 600,
              }}>
                {s.category}
              </span>
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
              <span>Click to load scenario</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveScenarioView() {
  const { activeScenario, exitScenario, cluster } = useSimulator();
  if (!activeScenario) return null;

  const pods = cluster.pods;
  const failedPods = pods.filter(p =>
    p.phase === 'Failed' || p.status.containerStatuses.some(cs => cs.reason === 'ImagePullBackOff' || cs.reason === 'CrashLoopBackOff' || cs.reason === 'ErrImagePull' || cs.reason === 'OOMKilled')
  );
  const pendingPods = pods.filter(p => p.phase === 'Pending');

  return (
    <div className="scenario-active">
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

      {activeScenario.validate && activeScenario.validate(cluster) && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: 'var(--radius-lg)', padding: '16px 20px', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 12, animation: 'fadeIn 0.5s ease-out'
        }}>
          <div style={{ fontSize: 24 }}>🎉</div>
          <div>
            <div style={{ color: 'var(--k8s-green)', fontWeight: 'bold', fontSize: 14 }}>Scenario Solved!</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 12, marginTop: 4 }}>
              You successfully diagnosed and resolved the issue. The cluster state is healthy again.
            </div>
          </div>
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

      {/* Symptoms */}
      <div className="scenario-symptoms">
        <div className="scenario-section-title" style={{ color: 'var(--k8s-red)' }}>
          ⚠ What you'd see in production
        </div>
        <div className="symptom-list">
          {activeScenario.symptoms.map((s, i) => (
            <div key={i} className="symptom-item">{s}</div>
          ))}
        </div>
      </div>

      {/* Hints (collapsible) */}
      <details style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <summary style={{
          padding: '12px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: 'var(--k8s-yellow)', userSelect: 'none',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          💡 Hints (try without first!)
        </summary>
        <div style={{ padding: '0 16px 16px' }}>
          <div className="hint-list">
            {activeScenario.hints.map((h, i) => (
              <div key={i} className="symptom-item hint-item">{h}</div>
            ))}
          </div>
        </div>
      </details>

      {/* Resolution steps */}
      <details style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
        <summary style={{
          padding: '12px 16px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          color: 'var(--k8s-green)', userSelect: 'none',
          listStyle: 'none', display: 'flex', alignItems: 'center', gap: 8,
        }}>
          ✓ Resolution Steps
        </summary>
        <div style={{ padding: '0 16px 16px' }}>
          <div className="resolution-list">
            {activeScenario.resolution.map((r, i) => (
              <div key={i} className="symptom-item resolution-item">{r}</div>
            ))}
          </div>
        </div>
      </details>

      {/* Root Cause */}
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
