import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { ClusterState, Deployment, Service, HPA, PersistentVolumeClaim, PersistentVolume, ExplanationEntry, Scenario, ScenarioId, NetworkPolicy, Role, RoleBinding, StatefulSet, DaemonSet } from '../types/k8s';
import { createInitialClusterState } from '../engine/reconciler';
import { SCENARIOS } from '../data/scenarios';

interface SimulatorStore {
  cluster: ClusterState;
  explanations: ExplanationEntry[];
  running: boolean;
  tickRate: number; // ms
  xrayMode: boolean;
  activeModule: string;
  activeScenario: Scenario | null;
  scenarioMode: 'guided' | 'challenge' | 'sandbox';
  highlightedObject: { kind: string; name: string } | null;
  controlPlaneStep: number;
  history: ClusterState[];
  historyIndex: number | null;
  cpuSimulation: Record<string, number>; // deploymentName -> cpu%

  // Actions
  startLoop: () => void;
  stopLoop: () => void;
  tick: () => void;
  toggleXrayMode: () => void;
  setModule: (module: string) => void;
  loadScenario: (id: ScenarioId) => void;
  exitScenario: () => void;
  setSandbox: () => void;
  setMode: (mode: 'guided' | 'challenge' | 'sandbox') => void;
  highlight: (kind: string, name: string) => void;
  clearHighlight: () => void;
  setControlPlaneStep: (step: number) => void;

  setTimeTravel: (index: number | null) => void;

  // Cluster mutations
  applyYAML: (yaml: string) => { success: boolean; message: string; applied?: string };
  deleteResource: (kind: string, name: string, namespace: string) => void;
  setNodeStatus: (nodeId: string, status: 'Ready' | 'NotReady') => void;
  addTaint: (nodeId: string, key: string, value: string, effect: 'NoSchedule' | 'NoExecute') => void;
  removeTaint: (nodeId: string, key: string) => void;
  setCPULoad: (deploymentName: string, cpuPercent: number) => void;
  triggerImagePullFail: (deploymentName: string) => void;
  fixImagePull: (deploymentName: string) => void;
  triggerReadinessFailure: (deploymentName: string) => void;
  fixReadinessProbe: (deploymentName: string) => void;
  toggleMetricsServer: (available: boolean) => void;
  reset: () => void;
}

const worker = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });

let intervalId: ReturnType<typeof setInterval> | null = null;

// UUID polyfill for browser
function uid() {
  return uuidv4();
}

export const useSimulator = create<SimulatorStore>((set, get) => ({
  cluster: createInitialClusterState(),
  explanations: [],
  running: false,
  tickRate: 500,
  xrayMode: false,
  activeModule: 'learningpath',
  activeScenario: null,
  scenarioMode: 'sandbox',
  highlightedObject: null,
  controlPlaneStep: -1,
  cpuSimulation: {},
  history: [],
  historyIndex: null,

  startLoop: () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(() => get().tick(), get().tickRate);
    set({ running: true });
  },

  stopLoop: () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    set({ running: false });
  },

  tick: () => {
    const s = get();
    // Do not tick if we are in time-travel mode
    if (s.historyIndex !== null) return;
    worker.postMessage({ state: s.cluster, cpuSimulation: s.cpuSimulation });
  },

  toggleXrayMode: () => set((state) => ({ xrayMode: !state.xrayMode })),

  setModule: (module) => set({ activeModule: module }),

  loadScenario: (id) => {
    const scenario = SCENARIOS.find(s => s.id === id);
    if (!scenario) return;

    // Reset cluster then apply scenario initial state
    const initial = createInitialClusterState();
    const cluster = applyScenarioToCluster(id, initial);

    set({
      cluster,
      explanations: [],
      activeScenario: scenario,
      cpuSimulation: {},
    });
    get().startLoop();
  },

  exitScenario: () => {
    set({ activeScenario: null, cluster: createInitialClusterState(), explanations: [] });
    get().startLoop();
  },

  setSandbox: () => {
    set({ activeScenario: null, scenarioMode: 'sandbox' });
  },

  setMode: (mode) => set({ scenarioMode: mode }),

  highlight: (kind, name) => set({ highlightedObject: { kind, name } }),
  clearHighlight: () => set({ highlightedObject: null }),
  setControlPlaneStep: (step) => set({ controlPlaneStep: step }),
  
  setTimeTravel: (index) => set(state => {
    if (index === null) {
      if (state.history.length === 0) return { historyIndex: null };
      return { historyIndex: null, cluster: state.history[state.history.length - 1] };
    }
    return { historyIndex: index, cluster: state.history[index] };
  }),

  applyYAML: (yamlStr) => {
    try {
      // Dynamic import to avoid circular deps in the store file
      const jsyaml = (window as any).__jsyaml;
      if (!jsyaml) return { success: false, message: 'YAML parser not loaded' };
      const obj = jsyaml.load(yamlStr) as any;
      if (!obj || !obj.kind) return { success: false, message: 'Invalid YAML: missing kind' };

      const now = Date.now();
      set(state => {
        const cluster = { ...state.cluster };

        switch (obj.kind) {
          case 'Deployment': {
            cluster.deployments = [...cluster.deployments];
            const existing = cluster.deployments.findIndex(d =>
              d.name === obj.metadata?.name && d.namespace === (obj.metadata?.namespace || 'default')
            );
            const dep: Deployment = {
              id: existing >= 0 ? cluster.deployments[existing].id : uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              labels: obj.metadata?.labels || {},
              selector: obj.spec?.selector || { matchLabels: {} },
              replicas: obj.spec?.replicas ?? 1,
              strategy: {
                type: obj.spec?.strategy?.type || 'RollingUpdate',
                rollingUpdate: obj.spec?.strategy?.rollingUpdate || { maxSurge: 1, maxUnavailable: 0 },
              },
              template: {
                metadata: { labels: obj.spec?.template?.metadata?.labels || {} },
                spec: {
                  containers: obj.spec?.template?.spec?.containers || [],
                  tolerations: obj.spec?.template?.spec?.tolerations || [],
                  nodeSelector: obj.spec?.template?.spec?.nodeSelector,
                  resources: obj.spec?.template?.spec?.containers?.[0]?.resources?.requests || { cpu: 100, memory: 128 },
                },
              },
              status: { replicas: 0, readyReplicas: 0, updatedReplicas: 0, unavailableReplicas: 0, conditions: [] },
              createdAt: existing >= 0 ? cluster.deployments[existing].createdAt : now,
              _revision: (existing >= 0 ? cluster.deployments[existing]._revision : 0) + 1,
            };
            if (existing >= 0) cluster.deployments[existing] = dep;
            else cluster.deployments.push(dep);
            break;
          }
          case 'StatefulSet': {
            cluster.statefulSets = [...cluster.statefulSets];
            const existing = cluster.statefulSets.findIndex(d =>
              d.name === obj.metadata?.name && d.namespace === (obj.metadata?.namespace || 'default')
            );
            const sts: StatefulSet = {
              id: existing >= 0 ? cluster.statefulSets[existing].id : uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              labels: obj.metadata?.labels || {},
              selector: obj.spec?.selector || { matchLabels: {} },
              replicas: obj.spec?.replicas ?? 1,
              template: {
                metadata: { labels: obj.spec?.template?.metadata?.labels || {} },
                spec: {
                  containers: obj.spec?.template?.spec?.containers || [],
                  tolerations: obj.spec?.template?.spec?.tolerations || [],
                  nodeSelector: obj.spec?.template?.spec?.nodeSelector,
                  resources: obj.spec?.template?.spec?.containers?.[0]?.resources?.requests || { cpu: 100, memory: 128 },
                },
              },
              volumeClaimTemplates: obj.spec?.volumeClaimTemplates,
              status: { replicas: 0, readyReplicas: 0, currentReplicas: 0 },
              createdAt: existing >= 0 ? cluster.statefulSets[existing].createdAt : now,
              _revision: (existing >= 0 ? cluster.statefulSets[existing]._revision : 0) + 1,
            };
            if (existing >= 0) cluster.statefulSets[existing] = sts;
            else cluster.statefulSets.push(sts);
            break;
          }
          case 'DaemonSet': {
            cluster.daemonSets = [...cluster.daemonSets];
            const existing = cluster.daemonSets.findIndex(d =>
              d.name === obj.metadata?.name && d.namespace === (obj.metadata?.namespace || 'default')
            );
            const ds: DaemonSet = {
              id: existing >= 0 ? cluster.daemonSets[existing].id : uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              labels: obj.metadata?.labels || {},
              selector: obj.spec?.selector || { matchLabels: {} },
              template: {
                metadata: { labels: obj.spec?.template?.metadata?.labels || {} },
                spec: {
                  containers: obj.spec?.template?.spec?.containers || [],
                  tolerations: obj.spec?.template?.spec?.tolerations || [],
                  nodeSelector: obj.spec?.template?.spec?.nodeSelector,
                  resources: obj.spec?.template?.spec?.containers?.[0]?.resources?.requests || { cpu: 50, memory: 64 },
                },
              },
              status: { numberReady: 0, desiredNumberScheduled: 0, currentNumberScheduled: 0 },
              createdAt: existing >= 0 ? cluster.daemonSets[existing].createdAt : now,
              _revision: (existing >= 0 ? cluster.daemonSets[existing]._revision : 0) + 1,
            };
            if (existing >= 0) cluster.daemonSets[existing] = ds;
            else cluster.daemonSets.push(ds);
            break;
          }
          case 'Service': {
            cluster.services = [...cluster.services];
            const existing = cluster.services.findIndex(s =>
              s.name === obj.metadata?.name && s.namespace === (obj.metadata?.namespace || 'default')
            );
            const svc: Service = {
              id: existing >= 0 ? cluster.services[existing].id : uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              labels: obj.metadata?.labels || {},
              selector: obj.spec?.selector || {},
              type: obj.spec?.type || 'ClusterIP',
              clusterIP: `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
              ports: obj.spec?.ports || [],
              endpoints: [],
              createdAt: now,
            };
            if (existing >= 0) cluster.services[existing] = svc;
            else cluster.services.push(svc);
            break;
          }
          case 'HorizontalPodAutoscaler': {
            cluster.hpas = [...cluster.hpas];
            const hpa: HPA = {
              id: uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              scaleTargetRef: obj.spec?.scaleTargetRef || {},
              minReplicas: obj.spec?.minReplicas ?? 1,
              maxReplicas: obj.spec?.maxReplicas ?? 10,
              metrics: obj.spec?.metrics || [],
              currentReplicas: 0,
              desiredReplicas: 0,
              metricsAvailable: true,
              createdAt: now,
            };
            cluster.hpas.push(hpa);
            break;
          }
          case 'PersistentVolumeClaim': {
            cluster.pvcs = [...cluster.pvcs];
            const pvc: PersistentVolumeClaim = {
              id: uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              storageClassName: obj.spec?.storageClassName || 'standard',
              accessModes: obj.spec?.accessModes || ['ReadWriteOnce'],
              requestedStorage: parseInt(obj.spec?.resources?.requests?.storage || '1Gi') || 1,
              phase: 'Pending',
              createdAt: now,
            };
            cluster.pvcs.push(pvc);
            break;
          }
          case 'PersistentVolume': {
            cluster.pvs = [...cluster.pvs];
            const pv: PersistentVolume = {
              id: uid(),
              name: obj.metadata?.name,
              capacity: parseInt(obj.spec?.capacity?.storage || '1Gi') || 1,
              accessModes: obj.spec?.accessModes || ['ReadWriteOnce'],
              reclaimPolicy: obj.spec?.persistentVolumeReclaimPolicy || 'Retain',
              storageClassName: obj.spec?.storageClassName || 'standard',
              phase: 'Available',
              createdAt: now,
            };
            cluster.pvs.push(pv);
            break;
          }
          case 'NetworkPolicy': {
            cluster.networkPolicies = [...cluster.networkPolicies];
            const np: NetworkPolicy = {
              id: uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              podSelector: obj.spec?.podSelector || {},
              policyTypes: obj.spec?.policyTypes || ['Ingress'],
              ingress: obj.spec?.ingress,
              egress: obj.spec?.egress,
              createdAt: now,
            };
            cluster.networkPolicies.push(np);
            break;
          }
          case 'Role': {
            cluster.roles = [...cluster.roles];
            const role: Role = {
              id: uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              rules: obj.rules || [],
              createdAt: now,
            };
            cluster.roles.push(role);
            break;
          }
          case 'RoleBinding': {
            cluster.roleBindings = [...cluster.roleBindings];
            const rb: RoleBinding = {
              id: uid(),
              name: obj.metadata?.name,
              namespace: obj.metadata?.namespace || 'default',
              roleRef: obj.roleRef || {},
              subjects: obj.subjects || [],
              createdAt: now,
            };
            cluster.roleBindings.push(rb);
            break;
          }
          default:
            return state; // No change
        }

        return { cluster };
      });

      return { success: true, message: `Applied ${obj.kind} "${obj.metadata?.name}"`, applied: obj.kind };
    } catch (e: any) {
      return { success: false, message: `Parse error: ${e.message}` };
    }
  },

  deleteResource: (kind, name, namespace) => {
    set(state => {
      const cluster = { ...state.cluster };
      switch (kind) {
        case 'Deployment':
          cluster.deployments = cluster.deployments.filter(d => !(d.name === name && d.namespace === namespace));
          cluster.replicaSets = cluster.replicaSets.filter(rs => !(rs.ownerRef?.name === name && rs.namespace === namespace));
          // delete pods owned by any RS that belonged to this deployment
          cluster.pods = cluster.pods.filter(p => {
            const rs = cluster.replicaSets.find(r => r.name === p.ownerRef?.name);
            return rs === undefined || rs.ownerRef?.name !== name;
          });
          break;
        case 'StatefulSet':
          cluster.statefulSets = cluster.statefulSets.filter(d => !(d.name === name && d.namespace === namespace));
          cluster.pods = cluster.pods.filter(p => !(p.ownerRef?.name === name && p.ownerRef?.kind === 'StatefulSet'));
          break;
        case 'DaemonSet':
          cluster.daemonSets = cluster.daemonSets.filter(d => !(d.name === name && d.namespace === namespace));
          cluster.pods = cluster.pods.filter(p => !(p.ownerRef?.name === name && p.ownerRef?.kind === 'DaemonSet'));
          break;
        case 'Pod':
          cluster.pods = cluster.pods.filter(p => !(p.name === name && p.namespace === namespace));
          break;
        case 'Service':
          cluster.services = cluster.services.filter(s => !(s.name === name && s.namespace === namespace));
          break;
        case 'HPA':
          cluster.hpas = cluster.hpas.filter(h => !(h.name === name && h.namespace === namespace));
          break;
      }
      return { cluster };
    });
  },

  setNodeStatus: (nodeId, status) => {
    set(state => {
      const nodes = state.cluster.nodes.map(n =>
        n.id === nodeId ? { ...n, status, lastHeartbeat: status === 'NotReady' ? n.lastHeartbeat : Date.now() } : n
      );
      return { cluster: { ...state.cluster, nodes } };
    });
  },

  addTaint: (nodeId, key, value, effect) => {
    set(state => {
      const nodes = state.cluster.nodes.map(n =>
        n.id === nodeId ? { ...n, taints: [...n.taints, { key, value, effect }] } : n
      );
      return { cluster: { ...state.cluster, nodes } };
    });
  },

  removeTaint: (nodeId, key) => {
    set(state => {
      const nodes = state.cluster.nodes.map(n =>
        n.id === nodeId ? { ...n, taints: n.taints.filter(t => t.key !== key) } : n
      );
      return { cluster: { ...state.cluster, nodes } };
    });
  },

  setCPULoad: (deploymentName, cpuPercent) => {
    set(state => ({ cpuSimulation: { ...state.cpuSimulation, [deploymentName]: cpuPercent } }));
  },

  triggerImagePullFail: (deploymentName) => {
    set(state => {
      const pods = state.cluster.pods.map(p => {
        const rs = state.cluster.replicaSets.find(r => r.name === p.ownerRef?.name);
        if (rs?.ownerRef?.name === deploymentName) {
          return { ...p, _imagePullFailing: true };
        }
        return p;
      });
      return { cluster: { ...state.cluster, pods } };
    });
  },

  fixImagePull: (deploymentName) => {
    set(state => {
      const pods = state.cluster.pods.map(p => {
        const rs = state.cluster.replicaSets.find(r => r.name === p.ownerRef?.name);
        if (rs?.ownerRef?.name === deploymentName) {
          return { ...p, _imagePullFailing: false, phase: 'Pending' as const, _crashCount: 0 };
        }
        return p;
      });
      return { cluster: { ...state.cluster, pods } };
    });
  },

  triggerReadinessFailure: (deploymentName) => {
    set(state => {
      const pods = state.cluster.pods.map(p => {
        const rs = state.cluster.replicaSets.find(r => r.name === p.ownerRef?.name);
        if (rs?.ownerRef?.name === deploymentName) {
          const containers = p.containers.map(c => ({
            ...c,
            readinessProbe: c.readinessProbe
              ? { ...c.readinessProbe, _failCount: 99 }
              : { httpGet: { path: '/health', port: 8080 }, _failCount: 99, failureThreshold: 3 }
          }));
          return { ...p, containers, readinessReady: false };
        }
        return p;
      });
      return { cluster: { ...state.cluster, pods } };
    });
  },

  fixReadinessProbe: (deploymentName) => {
    set(state => {
      const pods = state.cluster.pods.map(p => {
        const rs = state.cluster.replicaSets.find(r => r.name === p.ownerRef?.name);
        if (rs?.ownerRef?.name === deploymentName) {
          const containers = p.containers.map(c => ({
            ...c,
            readinessProbe: c.readinessProbe ? { ...c.readinessProbe, _failCount: 0 } : undefined
          }));
          return { ...p, containers, readinessReady: true };
        }
        return p;
      });
      return { cluster: { ...state.cluster, pods } };
    });
  },

  toggleMetricsServer: (available) => {
    set(state => {
      const hpas = state.cluster.hpas.map(h => ({ ...h, metricsAvailable: available }));
      return { cluster: { ...state.cluster, hpas } };
    });
  },

  reset: () => {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
    set({
      cluster: createInitialClusterState(),
      explanations: [],
      running: false,
      activeScenario: null,
      cpuSimulation: {},
      controlPlaneStep: -1,
      history: [],
      historyIndex: null,
    });
  },
}));

worker.onmessage = (e) => {
  if (e.data.type === 'TICK_RESULT') {
    const { nextState, newExplanations } = e.data;
    useSimulator.setState(state => {
      // Ignore ticks if time-traveling
      if (state.historyIndex !== null) return state;
      
      const newHistory = [...state.history, nextState];
      if (newHistory.length > 500) newHistory.shift();
      
      return {
        cluster: nextState,
        history: newHistory,
        explanations: [...newExplanations, ...state.explanations].slice(0, 100),
      };
    });
  }
};

// ===== SCENARIO LOADER =====
function applyScenarioToCluster(id: ScenarioId, cluster: ClusterState): ClusterState {
  const now = Date.now();

  const dep = (name: string, image: string, replicas = 1, namespace = 'default', extra: Partial<Deployment> = {}): Deployment => ({
    id: uuidv4(),
    name,
    namespace,
    labels: { app: name },
    selector: { matchLabels: { app: name } },
    replicas,
    strategy: { type: 'RollingUpdate', rollingUpdate: { maxSurge: 1, maxUnavailable: 0 } },
    template: {
      metadata: { labels: { app: name } },
      spec: {
        containers: [{ name, image, resources: { requests: { cpu: 100, memory: 128 }, limits: { cpu: 500, memory: 256 } } }],
        tolerations: [],
        resources: { cpu: 100, memory: 128 },
      },
    },
    status: { replicas: 0, readyReplicas: 0, updatedReplicas: 0, unavailableReplicas: 0, conditions: [] },
    createdAt: now,
    _revision: 1,
    ...extra,
  });

  switch (id) {
    case 'image-pull-backoff':
      return {
        ...cluster,
        deployments: [
          dep('bad-image-app', 'nginx:nonexistent-tag-xyz', 3),
        ],
        badImages: ['nginx:nonexistent-tag-xyz'],
      };
    case 'crash-loop-backoff': {
      const d = dep('crasher', 'busybox:latest', 2);
      return {
        ...cluster,
        deployments: [d],
        crashingDeployments: ['crasher'],
      };
    }
    case 'pending-resources':
      return {
        ...cluster,
        deployments: [
          dep('memory-hog', 'nginx:latest', 5, 'default', {
            template: {
              metadata: { labels: { app: 'memory-hog' } },
              spec: {
                containers: [{ name: 'memory-hog', image: 'nginx:latest', resources: { requests: { cpu: 2000, memory: 6000 }, limits: { cpu: 4000, memory: 8000 } } }],
                tolerations: [],
                resources: { cpu: 2000, memory: 6000 },
              },
            },
          } as any),
        ],
      };
    case 'pending-taint':
      cluster.nodes = cluster.nodes.map(n => ({
        ...n, taints: [{ key: 'gpu', value: 'true', effect: 'NoSchedule' as const }]
      }));
      return {
        ...cluster,
        deployments: [dep('no-toleration-app', 'nginx:latest', 2)],
      };
    case 'node-failure':
      // Force node-2 to be NotReady immediately
      cluster.nodes[1].status = 'NotReady';
      // Set last heartbeat to slightly in the past so eviction happens sooner
      cluster.nodes[1].lastHeartbeat = now - 3000;
      return {
        ...cluster,
        deployments: [dep('resilient-app', 'nginx:latest', 4)],
      };
    case 'oom-killed':
      return {
        ...cluster,
        deployments: [
          dep('memory-eater', 'nginx:latest', 2, 'default', {
            template: {
              metadata: { labels: { app: 'memory-eater' } },
              spec: {
                containers: [{ name: 'memory-eater', image: 'nginx:latest', resources: { requests: { cpu: 100, memory: 128 }, limits: { cpu: 100, memory: 64 } } }],
                tolerations: [],
                resources: { cpu: 100, memory: 128 },
              },
            },
          } as any),
        ],
      };
    case 'pvc-pending':
      return {
        ...cluster,
        pvcs: [{
          id: uuidv4(),
          name: 'data-pvc',
          namespace: 'default',
          storageClassName: 'premium-ssd', // No matching PV
          accessModes: ['ReadWriteOnce'],
          requestedStorage: 50,
          phase: 'Pending',
          createdAt: now,
        }],
        deployments: [dep('stateful-app', 'nginx:latest', 1)],
      };
    case 'service-selector-mismatch':
      return {
        ...cluster,
        deployments: [dep('web-app', 'nginx:latest', 3)],
        services: [{
          id: uuidv4(),
          name: 'web-app-svc',
          namespace: 'default',
          labels: {},
          selector: { app: 'web-application' }, // WRONG: should be 'web-app'
          type: 'ClusterIP',
          clusterIP: '10.96.100.100',
          ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }],
          endpoints: [],
          createdAt: now,
        }],
      };
    case 'rolling-update-stuck':
      return {
        ...cluster,
        deployments: [
          dep('web-frontend', 'nginx:1.19', 3, 'default', {
            template: {
              metadata: { labels: { app: 'web-frontend' } },
              spec: {
                containers: [{
                  name: 'web-frontend',
                  image: 'nginx:1.19',
                  resources: { requests: { cpu: 100, memory: 128 }, limits: { cpu: 500, memory: 256 } },
                  readinessProbe: { httpGet: { path: '/health', port: 80 }, initialDelaySeconds: 5, periodSeconds: 10, failureThreshold: 3, _failCount: 99 }
                }],
                tolerations: [],
                resources: { cpu: 100, memory: 128 },
              },
            },
          } as any),
        ],
      };
    case 'hpa-not-scaling':
      return {
        ...cluster,
        deployments: [dep('api-server', 'nginx:latest', 2)],
        hpas: [{
          id: uuidv4(),
          name: 'api-server-hpa',
          namespace: 'default',
          scaleTargetRef: { kind: 'Deployment', name: 'api-server' },
          minReplicas: 2,
          maxReplicas: 10,
          metrics: [{ type: 'Resource', resource: { name: 'cpu', targetAverageUtilization: 50 } }],
          currentMetrics: { cpu: 85 },
          currentReplicas: 2,
          desiredReplicas: 2,
          metricsAvailable: false, // metrics-server missing
          createdAt: now,
        }],
      };
    case 'rbac-forbidden':
      return {
        ...cluster,
        serviceAccounts: [...cluster.serviceAccounts, { id: uuidv4(), name: 'restricted-sa', namespace: 'default', createdAt: now }],
        roles: [{
          id: uuidv4(),
          name: 'pod-reader',
          namespace: 'default',
          rules: [{ apiGroups: [''], resources: ['pods'], verbs: ['get', 'list'] }],
          createdAt: now,
        }],
        // NO RoleBinding — that's the bug
        roleBindings: [],
      };
    case 'network-policy-blocking':
      return {
        ...cluster,
        deployments: [
          dep('frontend', 'nginx:latest', 2),
          dep('backend', 'nginx:latest', 2),
        ],
        networkPolicies: [{
          id: uuidv4(),
          name: 'deny-all-ingress',
          namespace: 'default',
          podSelector: {}, // applies to all pods
          policyTypes: ['Ingress'],
          ingress: [], // empty = deny all ingress
          createdAt: now,
        }],
      };
    default:
      return cluster;
  }
}
