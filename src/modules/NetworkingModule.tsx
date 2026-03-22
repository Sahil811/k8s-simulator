import React, { useState, useEffect } from 'react';
import { useSimulator } from '../store/simulatorStore';

type TraceStep = {
  label: string;
  detail: string;
  active: boolean;
};

export function NetworkingModule() {
  const { cluster } = useSimulator();
  const [traceRunning, setTraceRunning] = useState(false);
  const [traceStep, setTraceStep] = useState(-1);
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const services = cluster.services;
  const pods = cluster.pods.filter(p => p.phase === 'Running');
  const networkPolicies = cluster.networkPolicies;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (traceRunning && traceStep < 4) {
      t = setTimeout(() => setTraceStep(s => s + 1), 1000);
    } else if (traceRunning && traceStep >= 4) {
      setTraceRunning(false);
    }
    return () => clearTimeout(t);
  }, [traceRunning, traceStep]);

  function startTrace() {
    setTraceStep(0);
    setTraceRunning(true);
  }

  const svc = services.find(s => s.id === selectedService) || services[0];
  const svcEndpoints = svc ? pods.filter(p => svc.endpoints.includes(p.id)) : [];

  const traceHops: { label: string; detail: string }[] = [
    { label: 'External Client', detail: 'curl https://my-app.example.com' },
    { label: `Ingress Controller`, detail: 'Route match: host=my-app.example.com, path=/' },
    { label: `Service (${svc?.clusterIP || '10.x.x.x'})`, detail: `kube-proxy: ClusterIP → iptables/IPVS round-robin to ${svcEndpoints.length} endpoints` },
    { label: `Pod endpoint`, detail: svcEndpoints[0] ? `${svcEndpoints[0].name} (${svcEndpoints[0].nodeName})` : 'No ready endpoints!' },
    { label: `DNS resolution`, detail: `my-app-svc.default.svc.cluster.local → ${svc?.clusterIP || '10.x.x.x'}` },
  ];

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16, overflow: 'auto', flex: 1 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Networking Simulator</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Trace requests, inspect service endpoints, and apply NetworkPolicies
        </div>
      </div>

      {/* Services */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title"><span>🔗</span> Services & Endpoints</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {services.length} service{services.length !== 1 ? 's' : ''}
          </span>
        </div>
        {services.length === 0 ? (
          <div className="empty-state" style={{ padding: 40 }}>
            <div style={{ fontSize: 28, opacity: 0.4 }}>🔗</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No services. Apply a Service manifest in YAML Editor.</div>
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            <table className="pods-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>ClusterIP</th>
                  <th>Selector</th>
                  <th>Endpoints</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {services.map(svc => {
                  const eps = pods.filter(p => svc.endpoints.includes(p.id));
                  const hasEndpoints = eps.length > 0;
                  return (
                    <tr key={svc.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedService(svc.id)}
                    >
                      <td style={{ color: 'var(--k8s-cyan)' }}>{svc.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{svc.type}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--k8s-blue)' }}>{svc.clusterIP}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        {Object.entries(svc.selector).map(([k, v]) => `${k}=${v}`).join(', ')}
                      </td>
                      <td style={{ color: hasEndpoints ? 'var(--k8s-green)' : 'var(--k8s-red)' }}>
                        {eps.length > 0 ? eps.map(p => p.name).join(', ') : '<none>'}
                      </td>
                      <td>
                        <span className={`badge ${hasEndpoints ? 'badge-running' : 'badge-failed'}`}>
                          {hasEndpoints ? `${eps.length} ready` : '0 endpoints'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request Trace */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title"><span>📡</span> Live Request Trace</div>
          <button
            id="btn-trace-request"
            className="btn btn-primary"
            onClick={startTrace}
            style={{ fontSize: 11, padding: '5px 14px' }}
            disabled={traceRunning}
          >
            {traceRunning ? 'Tracing...' : '▶ Send Request'}
          </button>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            {traceHops.map((hop, i) => (
              <React.Fragment key={i}>
                <div className={`trace-hop ${traceStep >= i ? 'active' : ''}`}>
                  <span>{i === 3 ? '📦' : i === 0 ? '🌐' : i === 4 ? '🔤' : i === 1 ? '🚪' : '🔗'}</span>
                  <span>{hop.label}</span>
                </div>
                {i < traceHops.length - 1 && (
                  <span className="trace-arrow" style={{ color: traceStep > i ? 'var(--k8s-cyan)' : undefined }}>→</span>
                )}
              </React.Fragment>
            ))}
          </div>

          {traceStep >= 0 && (
            <div style={{
              marginTop: 12, padding: '10px 14px',
              background: 'var(--bg-terminal)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--k8s-green)',
              animation: 'fadeInUp 200ms ease',
            }}>
              <span style={{ color: 'var(--text-muted)' }}>Step {traceStep + 1}/{traceHops.length}: </span>
              {traceHops[Math.min(traceStep, traceHops.length - 1)]?.detail}
            </div>
          )}

          {!traceRunning && traceStep >= 4 && (
            <div style={{
              marginTop: 8, fontSize: 12, color: svcEndpoints.length > 0 ? 'var(--k8s-green)' : 'var(--k8s-red)',
              fontFamily: 'var(--font-mono)',
            }}>
              {svcEndpoints.length > 0
                ? `✓ 200 OK — request delivered to ${svcEndpoints[0]?.name}`
                : '✗ 503 Service Unavailable — no healthy endpoints'
              }
            </div>
          )}
        </div>
      </div>

      {/* DNS panel */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🔤</span> DNS Resolution (CoreDNS)
        </div>
        {services.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No services to resolve</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            {services.map(svc => (
              <div key={svc.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '8px 12px', background: 'var(--bg-terminal)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ color: 'var(--k8s-cyan)' }}>
                  {svc.name}.{svc.namespace}.svc.cluster.local
                </span>
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <span style={{ color: 'var(--k8s-blue)' }}>{svc.clusterIP}</span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontSize: 10 }}>
                  TYPE=A via CoreDNS
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* NetworkPolicies */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title"><span>🛡</span> NetworkPolicies</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{networkPolicies.length} policies</span>
        </div>
        {networkPolicies.length === 0 ? (
          <div className="empty-state" style={{ padding: 30 }}>
            <div style={{ fontSize: 22, opacity: 0.4 }}>🛡</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              No NetworkPolicies — all pod-to-pod traffic is allowed by default
            </div>
          </div>
        ) : (
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {networkPolicies.map(np => (
              <div key={np.id} style={{
                background: 'var(--bg-elevated)', border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-md)', padding: '10px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--k8s-red)' }}>
                    {np.name}
                  </span>
                  <span style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.1)', color: 'var(--k8s-red)',
                  }}>
                    {np.policyTypes.join(' + ')}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  Selector: {Object.keys(np.podSelector).length === 0 ? 'all pods' : JSON.stringify(np.podSelector)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--k8s-orange)', marginTop: 4 }}>
                  {np.ingress?.length === 0 ? '⚠ Deny ALL ingress (empty ingress rules)' :
                   np.egress?.length === 0 ? '⚠ Deny ALL egress (empty egress rules)' :
                   `✓ ${np.ingress?.length || 0} ingress rule(s), ${np.egress?.length || 0} egress rule(s)`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
