import React, { useState } from 'react';
import { useSimulator } from '../store/simulatorStore';

export function RBACModule() {
  const { cluster } = useSimulator();
  const roles = cluster.roles;
  const bindings = cluster.roleBindings;
  const serviceAccounts = cluster.serviceAccounts;
  const [simUser, setSimUser] = useState('');
  const [simResource, setSimResource] = useState('pods');
  const [simVerb, setSimVerb] = useState('list');
  const [simResult, setSimResult] = useState<null | { allowed: boolean; reason: string }>(null);

  function simulateAccess() {
    const sa = serviceAccounts.find(s => s.name === simUser);
    if (!sa) {
      setSimResult({ allowed: false, reason: `ServiceAccount "${simUser}" not found in namespace default` });
      return;
    }

    // Find RoleBindings that include this SA
    const binding = bindings.find(b =>
      b.subjects.some(s => s.kind === 'ServiceAccount' && s.name === simUser)
    );

    if (!binding) {
      setSimResult({
        allowed: false,
        reason: `User "${simUser}" cannot ${simVerb} ${simResource}: no RoleBinding grants access. Error: Forbidden\n\nkubectl auth can-i ${simVerb} ${simResource} --as=system:serviceaccount:default:${simUser}`
      });
      return;
    }

    // Find the role
    const role = roles.find(r => r.name === binding.roleRef.name);
    if (!role) {
      setSimResult({ allowed: false, reason: `RoleBinding references Role "${binding.roleRef.name}" which doesn't exist` });
      return;
    }

    // Check if the role permits the verb on the resource
    const allowed = role.rules.some(rule =>
      rule.resources.includes(simResource) && rule.verbs.includes(simVerb)
    );

    setSimResult({
      allowed,
      reason: allowed
        ? `Allowed: ${simUser} → RoleBinding "${binding.name}" → Role "${role.name}" → allows [${role.rules.find(r => r.resources.includes(simResource))?.verbs.join(', ')}] on ${simResource}`
        : `Forbidden: Role "${role.name}" does not grant verb "${simVerb}" on "${simResource}". Available verbs: ${role.rules.flatMap(r => r.verbs).join(', ')}`
    });
  }

  return (
    <div className="rbac-layout">
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>RBAC Sandbox</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Role → RoleBinding → ServiceAccount graph and access simulator
        </div>
      </div>

      {/* RBAC Graph */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">🔐 RBAC Graph</div>
        </div>
        <div className="rbac-graph">
          {/* ServiceAccounts */}
          <div className="rbac-column">
            <div className="rbac-column-label">ServiceAccounts</div>
            {serviceAccounts.map(sa => (
              <div key={sa.id} className="rbac-node" style={{ borderColor: 'rgba(168, 85, 247, 0.3)', color: 'var(--k8s-purple)' }}>
                {sa.name}
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{sa.namespace}</div>
              </div>
            ))}
            {serviceAccounts.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>none</div>
            )}
          </div>

          {/* Connector */}
          <div className="rbac-connector">→</div>

          {/* RoleBindings */}
          <div className="rbac-column">
            <div className="rbac-column-label">RoleBindings</div>
            {bindings.map(rb => (
              <div key={rb.id} className="rbac-node" style={{ borderColor: 'rgba(79, 128, 255, 0.3)', color: 'var(--k8s-blue)' }}>
                {rb.name}
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  → {rb.roleRef.name}
                </div>
              </div>
            ))}
            {bindings.length === 0 && (
              <div style={{
                fontSize: 11, color: 'var(--k8s-red)',
                padding: '8px 12px',background: 'rgba(239, 68, 68, 0.08)',
                borderRadius: 'var(--radius-md)', border: '1px dashed rgba(239, 68, 68, 0.3)',
              }}>
                ⚠ No bindings — all actions will be Forbidden
              </div>
            )}
          </div>

          {/* Connector */}
          <div className="rbac-connector">→</div>

          {/* Roles */}
          <div className="rbac-column">
            <div className="rbac-column-label">Roles</div>
            {roles.map(role => (
              <div key={role.id} className="rbac-node" style={{ borderColor: 'rgba(0, 212, 255, 0.3)', color: 'var(--k8s-cyan)' }}>
                {role.name}
                <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>
                  {role.rules.flatMap(r => r.resources).join(', ')}
                </div>
              </div>
            ))}
            {roles.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>none</div>
            )}
          </div>

          {/* Connector */}
          <div className="rbac-connector">→</div>

          {/* Permissions summary */}
          <div className="rbac-column" style={{ minWidth: 180 }}>
            <div className="rbac-column-label">Permissions</div>
            {roles.map(role => (
              <div key={role.id} style={{ fontSize: 10, fontFamily: 'var(--font-mono)', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', marginBottom: 6 }}>
                {role.rules.map((rule, i) => (
                  <div key={i}>
                    <span style={{ color: 'var(--k8s-green)' }}>[{rule.verbs.join(', ')}]</span>
                    {' '}{rule.resources.join(', ')}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Access Simulator */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">🎭 Simulate as User</div>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>kubectl auth can-i</span>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>ServiceAccount:</span>
              <input
                id="rbac-sim-user"
                value={simUser}
                onChange={e => setSimUser(e.target.value)}
                placeholder="e.g. restricted-sa"
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '5px 10px',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  width: 150, outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Verb:</span>
              <select
                id="rbac-sim-verb"
                value={simVerb}
                onChange={e => setSimVerb(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '5px 10px',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              >
                {['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Resource:</span>
              <select
                id="rbac-sim-resource"
                value={simResource}
                onChange={e => setSimResource(e.target.value)}
                style={{
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', padding: '5px 10px',
                  color: 'var(--text-primary)', fontSize: 12, fontFamily: 'var(--font-mono)',
                  outline: 'none',
                }}
              >
                {['pods', 'deployments', 'services', 'secrets', 'configmaps', 'nodes'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              id="btn-rbac-simulate"
              className="btn btn-primary"
              onClick={simulateAccess}
              style={{ fontSize: 12 }}
            >
              Check Access
            </button>
          </div>

          {simResult && (
            <div style={{
              padding: '12px 14px',
              background: simResult.allowed ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
              border: `1px solid ${simResult.allowed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              borderRadius: 'var(--radius-md)',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: simResult.allowed ? 'var(--k8s-green)' : 'var(--k8s-red)',
              whiteSpace: 'pre-wrap', lineHeight: 1.7,
              animation: 'fadeInUp 200ms ease',
            }}>
              {simResult.allowed ? '✓ yes' : '✗ no'}{'\n'}{simResult.reason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
