import React, { useState, useEffect } from 'react';
import { useSimulator } from '../store/simulatorStore';

const CP_STEPS = [
  {
    id: 0,
    label: 'kubectl apply',
    icon: '💻',
    title: 'kubectl apply',
    sub: 'Client CLI',
    detail: {
      what: 'User runs `kubectl apply -f deployment.yaml`',
      mechanics: 'kubectl serializes the manifest to JSON and sends an HTTP PATCH/POST request to the API Server endpoint (e.g., /apis/apps/v1/namespaces/default/deployments). It attaches the current kubectl context credentials (kubeconfig) for authentication.',
      etcdKey: null,
      transport: 'HTTPS → kube-apiserver:6443',
    }
  },
  {
    id: 1,
    label: 'API Server',
    icon: '🏛',
    title: 'kube-apiserver',
    sub: 'Authentication → RBAC → Admission → etcd write',
    detail: {
      what: 'API Server validates, authorizes, and persists the object',
      mechanics: '1. Authentication: verifies the bearer token/cert\n2. Authorization: RBAC check — can this user create Deployments?\n3. Admission Controllers: MutatingWebhooks may add defaults; ValidatingWebhooks reject invalid specs\n4. API Server writes the object to etcd\n5. Returns 200/201 to kubectl',
      etcdKey: '/registry/apps/v1/deployments/default/my-app',
      transport: 'Writes to etcd via gRPC',
    }
  },
  {
    id: 2,
    label: 'etcd',
    icon: '🗄',
    title: 'etcd',
    sub: 'Distributed key-value store (source of truth)',
    detail: {
      what: 'etcd durably stores the desired state',
      mechanics: 'etcd is a Raft consensus cluster. The Deployment object is stored at a well-known path. etcd guarantees linearizability — once written, every subsequent read sees the new value. All other components watch etcd via the API Server\'s watch mechanism, not etcd directly.',
      etcdKey: '/registry/apps/v1/deployments/default/my-app',
      transport: 'Watch notifications → API Server → controllers',
    }
  },
  {
    id: 3,
    label: 'Deployment Controller',
    icon: '🔄',
    title: 'Deployment Controller',
    sub: 'kube-controller-manager',
    detail: {
      what: 'Deployment controller watches for Deployment objects and manages ReplicaSets',
      mechanics: 'The controller-manager runs many controllers in goroutines. Each controller uses an informer (list+watch) to cache objects locally. When the Deployment is created, the Deployment controller creates a ReplicaSet with the same pod template. On update, it manages rolling updates by creating a new RS and scaling down the old one.',
      etcdKey: '/registry/apps/v1/replicasets/default/my-app-abc12',
      transport: 'Patches ReplicaSet via API Server',
    }
  },
  {
    id: 4,
    label: 'Scheduler',
    icon: '📋',
    title: 'kube-scheduler',
    sub: 'Filter → Score → Bind',
    detail: {
      what: 'Scheduler watches for Pending pods (no nodeName) and assigns them to nodes',
      mechanics: 'Scheduler pipeline:\n1. Filter: removes nodes that don\'t satisfy predicates (resources, taints, affinity, PVC topology)\n2. Score: ranks remaining nodes (LeastAllocated, ImageLocality, etc.)\n3. Bind: writes nodeName to the Pod spec via a Binding API call\n\nAfter binding, the pod\'s nodeName is set — scheduler\'s job is done.',
      etcdKey: null,
      transport: 'Binding API call → API Server → etcd',
    }
  },
  {
    id: 5,
    label: 'Kubelet',
    icon: '⚙️',
    title: 'kubelet (on node)',
    sub: 'Pull image → Create container → Report status',
    detail: {
      what: 'Kubelet on the assigned node creates the container',
      mechanics: '1. Kubelet watches API Server for pods assigned to its node\n2. Calls ContainerRuntime (containerd/Docker) via CRI gRPC\n3. Runtime pulls the image (if not cached) via the OCI distribution spec\n4. Creates the container with cgroup limits matching resource limits\n5. Starts readiness/liveness probes\n6. Reports pod phase and container status back to API Server every 10s',
      etcdKey: '/registry/v1/pods/default/my-app-abc12-xyz99',
      transport: 'CRI → containerd/runc; Status via PATCH to API Server',
    }
  },
];

export function ControlPlaneModule() {
  const { cluster, controlPlaneStep, setControlPlaneStep } = useSimulator();
  const [animating, setAnimating] = useState(false);
  const [autoplay, setAutoplay] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (autoplay && controlPlaneStep < CP_STEPS.length - 1) {
      timeout = setTimeout(() => {
        setControlPlaneStep(controlPlaneStep + 1);
      }, 2200);
    } else if (autoplay && controlPlaneStep === CP_STEPS.length - 1) {
      timeout = setTimeout(() => {
        setControlPlaneStep(-1);
        setAutoplay(false);
      }, 2000);
    }
    return () => clearTimeout(timeout);
  }, [autoplay, controlPlaneStep]);

  function runAnimation() {
    setControlPlaneStep(0);
    setAutoplay(true);
  }

  const activeStep = CP_STEPS.find(s => s.id === controlPlaneStep);

  // Build etcd entries from cluster state
  const etcdEntries: { key: string; val: string }[] = [
    { key: '/registry/v1/namespaces/default', val: 'Namespace{default}' },
    ...cluster.deployments.map(d => ({
      key: `/registry/apps/v1/deployments/${d.namespace}/${d.name}`,
      val: `Deployment{replicas:${d.replicas}}`,
    })),
    ...cluster.replicaSets.map(rs => ({
      key: `/registry/apps/v1/replicasets/${rs.namespace}/${rs.name}`,
      val: `ReplicaSet{replicas:${rs.replicas}}`,
    })),
    ...cluster.pods.slice(0, 8).map(p => ({
      key: `/registry/v1/pods/${p.namespace}/${p.name}`,
      val: `Pod{phase:${p.phase},node:${p.nodeName ?? 'nil'}}`,
    })),
    ...cluster.services.map(s => ({
      key: `/registry/v1/services/${s.namespace}/${s.name}`,
      val: `Service{ClusterIP:${s.clusterIP}}`,
    })),
  ];

  return (
    <div className="control-plane-layout">
      {/* Title */}
      <div>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Control Plane Flow</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          Animate the exact path of <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--k8s-cyan)' }}>kubectl apply</code> through the system
        </div>
      </div>

      {/* Flow Diagram */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 24 }}>
        <div className="cp-flow">
          {CP_STEPS.map((step, i) => (
            <React.Fragment key={step.id}>
              <div
                className="cp-component"
                onClick={() => setControlPlaneStep(step.id === controlPlaneStep ? -1 : step.id)}
                id={`cp-step-${step.id}`}
              >
                <div className={`cp-icon ${controlPlaneStep >= step.id && controlPlaneStep !== -1 ? 'active' : ''}`}>
                  {step.icon}
                </div>
                <div className="cp-label">
                  <div style={{ fontWeight: 600, fontSize: 11 }}>{step.label}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{step.sub}</div>
                </div>
              </div>
              {i < CP_STEPS.length - 1 && (
                <div className={`cp-arrow ${controlPlaneStep > step.id && controlPlaneStep !== -1 ? 'active' : ''}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button
            id="btn-cp-animate"
            className="btn btn-primary"
            onClick={runAnimation}
            style={{ fontSize: 12 }}
          >
            ▶ Animate kubectl apply
          </button>
          <button
            className="btn"
            onClick={() => { setControlPlaneStep(-1); setAutoplay(false); }}
            style={{ fontSize: 12 }}
          >
            Reset
          </button>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8, alignSelf: 'center' }}>
            Click any component to inspect it
          </span>
        </div>
      </div>

      {/* Detail Box */}
      {activeStep && (
        <div className="cp-detail-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontSize: 32 }}>{activeStep.icon}</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{activeStep.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{activeStep.sub}</div>
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>What it does</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{activeStep.detail.what}</div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>Mechanics</div>
            <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
              {activeStep.detail.mechanics}
            </div>
          </div>

          {activeStep.detail.transport && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11,
              color: 'var(--k8s-cyan)', background: 'var(--bg-terminal)',
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}>
              {activeStep.detail.transport}
            </div>
          )}
        </div>
      )}

      {/* etcd Live Panel */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
        <div className="panel-header">
          <div className="panel-title">
            <span>🗄</span>
            etcd — Live Key-Value Store
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {etcdEntries.length} entries
          </span>
        </div>
        <div style={{ padding: 16 }}>
          {etcdEntries.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 20 }}>
              No objects written to etcd yet. Apply a manifest.
            </div>
          ) : (
            <div className="etcd-grid">
              {etcdEntries.map((e, i) => (
                <div key={i} className="etcd-entry">
                  <span className="etcd-key">{e.key}</span>
                  <span className="etcd-val">{e.val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
