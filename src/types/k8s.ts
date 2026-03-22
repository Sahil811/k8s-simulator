// ========== Core Kubernetes Types ==========

export type Phase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown' | 'Terminating';
export type NodeStatus = 'Ready' | 'NotReady' | 'SchedulingDisabled';
export type ConditionStatus = 'True' | 'False' | 'Unknown';
export type EventType = 'Normal' | 'Warning';
export type PVCPhase = 'Pending' | 'Bound' | 'Released' | 'Failed';
export type PVPhase = 'Available' | 'Bound' | 'Released' | 'Failed';
export type RolloutStrategy = 'RollingUpdate' | 'Recreate';

export interface ResourceRequirements {
  cpu: number;    // millicores (e.g. 500 = 0.5 CPU)
  memory: number; // MiB
}

export interface Taint {
  key: string;
  value?: string;
  effect: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

export interface Toleration {
  key?: string;
  value?: string;
  operator: 'Equal' | 'Exists';
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute';
}

export interface LabelSelector {
  matchLabels?: Record<string, string>;
}

export interface NodeAffinity {
  requiredNodeSelector?: Record<string, string>;
}

export interface Container {
  name: string;
  image: string;
  resources?: {
    requests?: ResourceRequirements;
    limits?: ResourceRequirements;
  };
  readinessProbe?: {
    httpGet?: { path: string; port: number };
    initialDelaySeconds?: number;
    periodSeconds?: number;
    failureThreshold?: number;
    _failCount?: number;  // internal
  };
  livenessProbe?: {
    httpGet?: { path: string; port: number };
    initialDelaySeconds?: number;
    periodSeconds?: number;
    failureThreshold?: number;
    _failCount?: number;  // internal
  };
}

// ========== Node ==========
export interface K8sNode {
  id: string;
  name: string;
  status: NodeStatus;
  labels: Record<string, string>;
  taints: Taint[];
  capacity: ResourceRequirements;
  allocatable: ResourceRequirements;
  used: ResourceRequirements; // computed
  createdAt: number;
  lastHeartbeat: number;
  conditions: { type: string; status: ConditionStatus }[];
}

// ========== Pod ==========
export interface Pod {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  phase: Phase;
  nodeName?: string;
  containers: Container[];
  ownerRef?: { kind: string; name: string; uid: string };
  status: {
    containerStatuses: {
      name: string;
      ready: boolean;
      restartCount: number;
      state: 'waiting' | 'running' | 'terminated';
      reason?: string;  // ImagePullBackOff, CrashLoopBackOff, OOMKilled...
      message?: string;
    }[];
    conditions: { type: string; status: ConditionStatus }[];
  };
  resources: ResourceRequirements; // aggregate requests
  tolerations: Toleration[];
  nodeSelector?: Record<string, string>;
  affinity?: { nodeAffinity?: NodeAffinity };
  createdAt: number;
  startedAt?: number;
  readinessReady: boolean;
  _crashCount: number;
  _imagePullFailing: boolean;
  _schedulingAttempts: number;
  _pendingSince?: number;
  deletionTimestamp?: number;
}

// ========== ReplicaSet ==========
export interface RSPodTemplate {
  namespace: string;
  labels: Record<string, string>;
  containers: Container[];
  tolerations: Toleration[];
  nodeSelector?: Record<string, string>;
  resources: ResourceRequirements;
  affinity?: { nodeAffinity?: NodeAffinity };
  // Internal simulation flags
  readinessReady: boolean;
  _crashCount: number;
  _imagePullFailing: boolean;
  _schedulingAttempts: number;
  deletionTimestamp?: number;
}

export interface ReplicaSet {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  selector: LabelSelector;
  replicas: number;
  readyReplicas: number;
  availableReplicas: number;
  podTemplate: RSPodTemplate;
  ownerRef?: { kind: string; name: string; uid: string };
  createdAt: number;
}

// ========== Deployment ==========
export interface Deployment {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  selector: LabelSelector;
  replicas: number;
  strategy: {
    type: RolloutStrategy;
    rollingUpdate?: {
      maxSurge: number;
      maxUnavailable: number;
    };
  };
  template: {
    metadata: { labels: Record<string, string> };
    spec: {
      containers: Container[];
      tolerations?: Toleration[];
      nodeSelector?: Record<string, string>;
      resources?: ResourceRequirements;
    };
  };
  status: {
    replicas: number;
    readyReplicas: number;
    updatedReplicas: number;
    unavailableReplicas: number;
    conditions: { type: string; status: ConditionStatus; reason?: string; message?: string }[];
  };
  createdAt: number;
  _currentRSName?: string;
  _revision: number;
}

// ========== StatefulSet ==========
export interface StatefulSet {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  selector: LabelSelector;
  replicas: number;
  template: {
    metadata: { labels: Record<string, string> };
    spec: {
      containers: Container[];
      tolerations?: Toleration[];
      nodeSelector?: Record<string, string>;
      resources?: ResourceRequirements;
    };
  };
  volumeClaimTemplates?: {
    metadata: { name: string; labels?: Record<string, string> };
    spec: { accessModes: string[]; resources: { requests: { storage: string } } };
  }[];
  status: {
    replicas: number;
    readyReplicas: number;
    currentReplicas: number;
  };
  createdAt: number;
  _revision: number;
}

// ========== DaemonSet ==========
export interface DaemonSet {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  selector: LabelSelector;
  template: {
    metadata: { labels: Record<string, string> };
    spec: {
      containers: Container[];
      tolerations?: Toleration[];
      nodeSelector?: Record<string, string>;
      resources?: ResourceRequirements;
    };
  };
  status: {
    numberReady: number;
    desiredNumberScheduled: number;
    currentNumberScheduled: number;
  };
  createdAt: number;
  _revision: number;
}

// ========== Service ==========
export interface Service {
  id: string;
  name: string;
  namespace: string;
  labels: Record<string, string>;
  selector: Record<string, string>;
  type: 'ClusterIP' | 'NodePort' | 'LoadBalancer';
  clusterIP: string;
  ports: { port: number; targetPort: number; protocol: 'TCP' | 'UDP'; nodePort?: number }[];
  endpoints: string[]; // pod IDs
  createdAt: number;
}

// ========== Ingress ==========
export interface Ingress {
  id: string;
  name: string;
  namespace: string;
  rules: { host: string; paths: { path: string; serviceName: string; servicePort: number }[] }[];
  createdAt: number;
}

// ========== PersistentVolume ==========
export interface PersistentVolume {
  id: string;
  name: string;
  capacity: number; // GiB
  accessModes: ('ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany')[];
  reclaimPolicy: 'Retain' | 'Delete' | 'Recycle';
  storageClassName: string;
  phase: PVPhase;
  boundTo?: string; // PVC id
  createdAt: number;
}

// ========== PersistentVolumeClaim ==========
export interface PersistentVolumeClaim {
  id: string;
  name: string;
  namespace: string;
  storageClassName: string;
  accessModes: ('ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany')[];
  requestedStorage: number; // GiB
  phase: PVCPhase;
  boundTo?: string; // PV id
  mountedBy?: string[]; // pod ids
  createdAt: number;
}

// ========== NetworkPolicy ==========
export interface NetworkPolicy {
  id: string;
  name: string;
  namespace: string;
  podSelector: LabelSelector;
  policyTypes: ('Ingress' | 'Egress')[];
  ingress?: { from: LabelSelector[]; ports?: { port: number; protocol: string }[] }[];
  egress?: { to: LabelSelector[]; ports?: { port: number; protocol: string }[] }[];
  createdAt: number;
}

// ========== RBAC ==========
export interface Role {
  id: string;
  name: string;
  namespace: string;
  rules: { apiGroups: string[]; resources: string[]; verbs: string[] }[];
  createdAt: number;
}

export interface RoleBinding {
  id: string;
  name: string;
  namespace: string;
  roleRef: { name: string; kind: 'Role' | 'ClusterRole' };
  subjects: { kind: 'User' | 'ServiceAccount' | 'Group'; name: string; namespace?: string }[];
  createdAt: number;
}

export interface ServiceAccount {
  id: string;
  name: string;
  namespace: string;
  createdAt: number;
}

// ========== HPA ==========
export interface HPA {
  id: string;
  name: string;
  namespace: string;
  scaleTargetRef: { kind: string; name: string };
  minReplicas: number;
  maxReplicas: number;
  metrics: { type: 'Resource'; resource: { name: 'cpu' | 'memory'; targetAverageUtilization: number } }[];
  currentMetrics?: { cpu: number }; // 0-100 %
  currentReplicas: number;
  desiredReplicas: number;
  lastScaleTime?: number;
  metricsAvailable: boolean;
  createdAt: number;
}

// ========== Events ==========
export interface KubeEvent {
  id: string;
  type: EventType;
  reason: string;
  message: string;
  objectKind: string;
  objectName: string;
  namespace: string;
  count: number;
  firstTimestamp: number;
  lastTimestamp: number;
  source: string;
}

// ========== Cluster State ==========
export interface ClusterState {
  nodes: K8sNode[];
  pods: Pod[];
  replicaSets: ReplicaSet[];
  deployments: Deployment[];
  statefulSets: StatefulSet[];
  daemonSets: DaemonSet[];
  services: Service[];
  ingresses: Ingress[];
  pvs: PersistentVolume[];
  pvcs: PersistentVolumeClaim[];
  networkPolicies: NetworkPolicy[];
  roles: Role[];
  roleBindings: RoleBinding[];
  serviceAccounts: ServiceAccount[];
  hpas: HPA[];
  namespaces: string[];
  events: KubeEvent[];
  tick: number;
  time: number;
  // Fault injection sets — scenario-controlled
  badImages: string[];         // image strings that should always fail to pull
  crashingDeployments: string[]; // deployment names whose pods should crash-loop
}

// ========== Reconciliation ==========
export interface ReconcileAction {
  type: string;
  description: string;
  controller: string;
  affectedObject: string;
  why: string;
}

export interface ExplanationEntry {
  id: string;
  timestamp: number;
  title: string;
  what: string;
  controller: string;
  action: string;
  why: string;
  objectKind: string;
  objectName: string;
}

// ========== Scenarios ==========
export type ScenarioId = 
  | 'image-pull-backoff'
  | 'crash-loop-backoff'
  | 'pending-resources'
  | 'pending-taint'
  | 'node-failure'
  | 'oom-killed'
  | 'pvc-pending'
  | 'service-selector-mismatch'
  | 'rolling-update-stuck'
  | 'hpa-not-scaling'
  | 'rbac-forbidden'
  | 'network-policy-blocking';

export interface Scenario {
  id: ScenarioId;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  trigger: string;
  symptoms: string[];
  rootCause: string;
  resolution: string[];
  hints: string[];
  validate?: (state: any) => boolean; // Use any to avoid circular deps if needed, or ClusterState
}
