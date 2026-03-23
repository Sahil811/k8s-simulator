import React, { useState, useRef, useEffect } from 'react';
import { useSimulator } from '../store/simulatorStore';
import { useProgress } from '../store/progressStore';
import MonacoEditor from '@monaco-editor/react';

// YAML templates
const TEMPLATES: Record<string, { label: string; yaml: string }> = {
  deployment: {
    label: 'Deployment',
    yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: nginx:1.25
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "500m"
              memory: "256Mi"
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10`,
  },
  service: {
    label: 'Service',
    yaml: `apiVersion: v1
kind: Service
metadata:
  name: my-app-svc
  namespace: default
spec:
  selector:
    app: my-app
  type: ClusterIP
  ports:
    - port: 80
      targetPort: 80
      protocol: TCP`,
  },
  hpa: {
    label: 'HPA',
    yaml: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app-hpa
  namespace: default
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 50`,
  },
  pvc: {
    label: 'PVC',
    yaml: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-pvc
  namespace: default
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast
  resources:
    requests:
      storage: 5Gi`,
  },
  networkpolicy: {
    label: 'NetworkPolicy',
    yaml: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - protocol: TCP
          port: 8080`,
  },
  rolebinding: {
    label: 'RoleBinding',
    yaml: `apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: pod-reader-binding
  namespace: default
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader
subjects:
  - kind: ServiceAccount
    name: restricted-sa
    namespace: default`,
  },
};

// Field annotations: describe what each field does at runtime
const FIELD_ANNOTATIONS: Record<string, string> = {
  'replicas': '→ ReplicaSet controller maintains exactly this many pod copies. If one dies, a replacement is created within ~10s.',
  'image': '→ kubelet pulls this image from the registry when scheduling the pod. Wrong tag = ImagePullBackOff.',
  'cpu': '→ scheduler uses requests for placement decisions. kubelet enforces limits via cgroups.',
  'memory': '→ pod is OOMKilled if container exceeds the limit (exit code 137).',
  'readinessProbe': '→ Service only routes traffic to pods passing this probe. Failing probe = not Ready.',
  'livenessProbe': '→ kubelet restarts the container if this probe fails (→ CrashLoopBackOff).',
  'selector': '→ must match pod labels exactly. Mismatch = 0 endpoints (silent traffic loss).',
  'maxSurge': '→ max extra pods above desired during rolling update.',
  'maxUnavailable': '→ max pods that can be unavailable during rolling update. 0 = zero-downtime.',
  'nodeSelector': '→ pod only schedules on nodes with matching labels.',
  'tolerations': '→ allows pod to schedule on tainted nodes.',
  'storageClassName': '→ PVC binds to PV with same storageClassName. No match = Pending forever.',
};

export function YAMLEditorModule() {
  const { applyYAML } = useSimulator();
  const { incrementYamlApplied } = useProgress();
  const [yaml, setYaml] = useState(TEMPLATES.deployment.yaml);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // Load jsyaml globally for the store
  useEffect(() => {
    import('js-yaml').then(m => {
      (window as any).__jsyaml = m.default || m;
    });
  }, []);

  function handleApply() {
    const res = applyYAML(yaml);
    setResult(res);
    if (res.success) {
      incrementYamlApplied();
      setTimeout(() => setResult(null), 4000);
    }
  }

  function detectHoveredField(value: string) {
    for (const key of Object.keys(FIELD_ANNOTATIONS)) {
      if (value.includes(key + ':')) {
        setHoveredField(key);
        return;
      }
    }
    setHoveredField(null);
  }

  return (
    <div className="yaml-editor-layout" style={{ height: '100%' }}>
      <div className="yaml-toolbar">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          Templates:
        </span>
        {Object.entries(TEMPLATES).map(([key, tmpl]) => (
          <button
            key={key}
            id={`yaml-tmpl-${key}`}
            className="yaml-template-btn"
            onClick={() => { setYaml(tmpl.yaml); setResult(null); }}
          >
            {tmpl.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {result && (
          <div className={`yaml-result ${result.success ? 'success' : 'error'}`}>
            {result.success ? '✓' : '✗'} {result.message}
          </div>
        )}

        <button
          id="btn-yaml-apply"
          className="yaml-apply-btn"
          onClick={handleApply}
        >
          ⚡ kubectl apply
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', flex: 1, overflow: 'hidden' }}>
        {/* Monaco Editor */}
        <div style={{ overflow: 'hidden', borderRight: '1px solid var(--border-subtle)' }}>
          <MonacoEditor
            height="100%"
            language="yaml"
            theme="vs-dark"
            value={yaml}
            onChange={v => {
              setYaml(v || '');
              detectHoveredField(v || '');
            }}
            options={{
              fontSize: 13,
              fontFamily: 'JetBrains Mono, monospace',
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbersMinChars: 3,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              smoothScrolling: true,
            }}
          />
        </div>

        {/* Annotation Panel */}
        <div style={{
          background: 'var(--bg-terminal)', overflow: 'auto', padding: 16,
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Field Reference
          </div>

          {hoveredField && FIELD_ANNOTATIONS[hoveredField] && (
            <div style={{
              background: 'rgba(79, 128, 255, 0.1)',
              border: '1px solid rgba(79, 128, 255, 0.3)',
              borderRadius: 'var(--radius-md)',
              padding: 12,
              animation: 'fadeInUp 200ms ease',
            }}>
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--k8s-cyan)', marginBottom: 6, fontWeight: 700 }}>
                {hoveredField}:
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {FIELD_ANNOTATIONS[hoveredField]}
              </div>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            Type in the editor to see field explanations here.
          </div>

          {/* All field annotations */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(FIELD_ANNOTATIONS).map(([field, annotation]) => (
              <div
                key={field}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-card)',
                  border: `1px solid ${hoveredField === field ? 'var(--k8s-blue)' : 'var(--border-subtle)'}`,
                  transition: 'all 150ms ease',
                }}
              >
                <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--k8s-cyan)', marginBottom: 3, fontWeight: 600 }}>
                  {field}:
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {annotation.replace('→ ', '')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
