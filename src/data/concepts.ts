export interface Concept {
  id: string;
  title: string;
  icon: string;
  summary: string;
  analogy: string;
  deepDive: string;
  yamlExample?: string;
  relatedConcepts: string[];
}

export const CONCEPTS: Record<string, Concept> = {
  reconciliation: {
    id: 'reconciliation',
    title: 'The Reconciliation Loop',
    icon: '🔄',
    summary: 'Kubernetes is a system that constantly compares desired state (what you asked for) against actual state (what exists) and takes actions to close the gap.',
    analogy: 'Think of a thermostat: you set 72°F (desired state). If the room is 68°F (actual state), it fires the heater until the gap closes. It doesn\'t give up — it keeps checking and acting.',
    deepDive: `Every Kubernetes controller runs an infinite loop:

1. **Observe** — Watch the API Server for changes to objects (Deployments, Pods, etc.)
2. **Diff** — Compare current state to desired state
3. **Act** — Take the minimum action needed to converge them
4. **Repeat**

This is called "level-triggered" logic (not "edge-triggered"). Controllers don't just react to events — they continuously reconcile, so if they miss an event or restart, they still converge correctly.

The beauty of this model: you never command Kubernetes to "create 3 pods." You declare "I desire 3 pods" and the ReplicaSet controller handles the rest — including recovery from failures you didn't anticipate.`,
    yamlExample: `# This is a declaration of DESIRED STATE
# Kubernetes reconciles toward this continuously
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: 3  # "I want 3 pods. Always."
  # If a pod dies, the ReplicaSet controller
  # will create a replacement — automatically.`,
    relatedConcepts: ['controllers', 'apiserver', 'etcd'],
  },

  controllers: {
    id: 'controllers',
    title: 'Controllers & the Controller Manager',
    icon: '⚙️',
    summary: 'Controllers are control loops that watch for a specific type of Kubernetes object and ensure the cluster matches the desired state for that object.',
    analogy: 'Controllers are like department managers in a company. The Deployment Manager handles deployments. The ReplicaSet Manager handles replica sets. Each manager has a specific domain and doesn\'t interfere with others.',
    deepDive: `The **kube-controller-manager** is a single binary that runs many controllers as goroutines:

- **Deployment Controller** — Creates/manages ReplicaSets
- **ReplicaSet Controller** — Creates/deletes Pods
- **Node Controller** — Monitors node health and handles evictions
- **Service Controller** — Manages cloud load balancers
- **HPA Controller** — Adjusts replica counts based on metrics

Each controller uses **informers** — a cache + watch mechanism that avoids hammering the API Server. The informer maintains a local in-memory store and only gets notified of changes via the API Server's watch stream.

**Key insight**: Controllers never talk to each other directly. Controller A creates object X, Controller B watches for X and creates object Y. This decoupling makes Kubernetes extensible — you can add custom controllers without touching existing ones.`,
    yamlExample: `# Deployment Controller creates this ReplicaSet:
# /registry/apps/v1/replicasets/default/my-app-7d9f4b
# ReplicaSet Controller then creates 3 Pods from it.
# Each controller only does its specific job.`,
    relatedConcepts: ['reconciliation', 'apiserver', 'pods'],
  },

  apiserver: {
    id: 'apiserver',
    title: 'The API Server',
    icon: '🏛',
    summary: 'The API Server is the central hub of Kubernetes — every component talks through it, never directly to each other.',
    analogy: 'The API Server is like a post office. You don\'t hand your letter directly to the recipient — you give it to the post office, which validates it, stores it, and notifies the recipient. Nobody bypasses the post office.',
    deepDive: `When you run \`kubectl apply\`, the request goes through a pipeline:

1. **Authentication** — Who are you? (certs, tokens, OIDC)
2. **Authorization** — Can you do this? (RBAC rules)
3. **Admission Control** — Should this be allowed? (Mutating webhooks add defaults; Validating webhooks reject invalid specs)
4. **persisted to etcd** — The source of truth is updated
5. **Watch notifications** — All watchers (controllers, kubelets) learn about the change

The API Server itself is **stateless** — it's just a gateway. All state lives in etcd. This means you can run multiple API Server replicas for HA without coordination.`,
    relatedConcepts: ['etcd', 'rbac', 'reconciliation'],
  },

  etcd: {
    id: 'etcd',
    title: 'etcd — Source of Truth',
    icon: '🗄',
    summary: 'etcd is the distributed key-value store where all Kubernetes state lives. It is the only stateful component in the control plane.',
    analogy: 'etcd is like a single shared whiteboard that all managers can read and write. Every Kubernetes object — every Deployment, Pod, Service — is stored here as a key-value pair.',
    deepDive: `etcd uses the **Raft consensus protocol** to maintain consistency across its cluster (typically 3 or 5 nodes). Key properties:

- **Linearizable reads** — Once written, all subsequent reads see the new value
- **Majority quorum** — Writes require acknowledgment from (N/2)+1 nodes
- **Watch** — Clients can watch for changes to any key prefix

Kubernetes stores objects at paths like:
- \`/registry/apps/v1/deployments/default/my-app\`
- \`/registry/v1/pods/default/my-pod-abc\`

**Critical insight**: No Kubernetes component except the API Server talks to etcd directly. All access is mediated through the API Server. This means etcd could theoretically be replaced with a different store — and projects like k3s use SQLite instead.`,
    yamlExample: `# etcd stores raw protobuf, but represented as:
/registry/apps/v1/deployments/default/nginx
→ {"apiVersion":"apps/v1","kind":"Deployment",...}

/registry/v1/pods/default/nginx-abc-123
→ {"phase":"Running","nodeName":"node-1",...}`,
    relatedConcepts: ['apiserver', 'reconciliation'],
  },

  pods: {
    id: 'pods',
    title: 'Pods vs Containers vs Workloads',
    icon: '📦',
    summary: 'A Pod is the smallest deployable unit in Kubernetes — a wrapper around one or more containers that share network and storage.',
    analogy: 'A container is like a process. A Pod is like a VM that runs those processes — containers in a pod share the same IP address and can talk via localhost. A Deployment is like a service description that says "I need N of these VMs always running."',
    deepDive: `**Never create naked Pods in production.** Here's why:

- If a Pod is deleted manually, nothing recreates it
- A Deployment creates a **ReplicaSet** which creates the Pods
- If a Pod dies, the ReplicaSet controller creates a replacement

The ownership chain: \`Deployment → ReplicaSet → Pods\`

**Containers in a Pod share:**
- Network namespace (same IP, same ports)
- IPC namespace (can use shared memory)
- Optionally: volumes (storage)

But NOT:
- Process namespace (by default)
- CPU/memory limits (each container has its own)

**Sidecar pattern**: Add a logging container to a pod. Both containers share the same log volume and network. The sidecar can read app logs and ship them to a remote system — without modifying the app container.`,
    yamlExample: `apiVersion: v1
kind: Pod
spec:
  containers:
  - name: app
    image: nginx:1.25
    # Containers in same pod share localhost
  - name: log-shipper
    image: fluentd:latest
    # Can reach app via localhost:80`,
    relatedConcepts: ['reconciliation', 'controllers', 'resources'],
  },

  resources: {
    id: 'resources',
    title: 'Resource Requests vs Limits',
    icon: '📊',
    summary: 'Requests determine scheduling (what the pod asks for), limits determine enforcement (the hard ceiling the kernel enforces).',
    analogy: 'Requests are like a hotel reservation — "I need a room with a king bed." The hotel (scheduler) looks for available rooms matching your requirement. Limits are like a noise curfew — even if the hotel is quiet at 3am, security will shut you down if you exceed it.',
    deepDive: `**Requests** — used by the Kubernetes **scheduler** to find a node with sufficient capacity. The scheduler looks at \`allocatable - used\` capacity on each node.

**Limits** — enforced by the **Linux kernel cgroups** at runtime:
- CPU limit: The container gets throttled (SIGSTOP/SIGCONT) to stay within its limit
- Memory limit: If exceeded, the **OOM Killer** sends SIGKILL (exit code 137)

**Common mistake**: Setting requests = limits (full Guaranteed QoS). This reserves resources even during idle time, wasting cluster capacity.

**Best practice**: Set requests conservatively (p50 usage), limits generously (p99 + buffer). Use VPA (Vertical Pod Autoscaler) to tune automatically.

**QoS Classes** (affects eviction priority):
1. **Guaranteed**: requests == limits for all containers
2. **Burstable**: requests < limits
3. **BestEffort**: no requests or limits (first to be evicted)`,
    yamlExample: `resources:
  requests:
    cpu: "100m"    # 0.1 CPU core — for scheduling
    memory: "128Mi" # 128MB — for scheduling
  limits:
    cpu: "500m"    # 0.5 CPU — kernel throttles at this
    memory: "256Mi" # 256MB — OOM killed if exceeded`,
    relatedConcepts: ['pods', 'scheduling'],
  },

  scheduling: {
    id: 'scheduling',
    title: 'The Scheduler — Filter & Score',
    icon: '📋',
    summary: 'The kube-scheduler assigns Pending pods to nodes using a two-phase process: Filter eliminates unfit nodes, Score ranks the remaining ones.',
    analogy: 'Hiring a candidate: First, filter for required skills (Python, AWS) — eliminating anyone who doesn\'t qualify. Then score the remaining candidates (years of experience, culture fit) and make an offer to the top scorer.',
    deepDive: `**Filter Phase** (predicates — any failure eliminates the node):
- \`PodFitsResources\` — node has enough CPU/memory
- \`PodToleratesNodeTaints\` — pod has tolerations for all node taints
- \`NodeSelector\` — pod's nodeSelector matches node labels
- \`VolumeBinding\` — required PVCs can be bound on this node
- \`NodeAffinity\` — pod's affinity rules are satisfied

**Score Phase** (plugins — higher score wins):
- \`LeastAllocated\` — prefer nodes with more free resources (40% weight)
- \`BalancedAllocation\` — prefer balanced CPU/memory usage
- \`ImageLocality\` — prefer nodes already having the container image
- \`InterPodAffinity\` — spread or pack pods based on affinity rules

If **no** node passes filters: pod remains \`Pending\`, scheduler emits a \`FailedScheduling\` event. This is the most common cause of stuck pods.`,
    yamlExample: `spec:
  # Node must have this label (Filter)
  nodeSelector:
    kubernetes.io/zone: us-east-1a
  
  # Priority among passing nodes (Score)
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100  # prefer spreading across nodes
        podAffinityTerm:
          topologyKey: kubernetes.io/hostname`,
    relatedConcepts: ['taints', 'resources', 'pods'],
  },

  taints: {
    id: 'taints',
    title: 'Taints & Tolerations',
    icon: '🔒',
    summary: 'Taints repel pods from nodes; tolerations grant pods the ability to land on tainted nodes. Together they form a node-side access control system.',
    analogy: 'Taints are like a "Staff Only" sign on a door. Tolerations are like a staff badge. Without the badge, you can\'t enter even if you want to.',
    deepDive: `A taint has 3 parts: \`key=value:effect\`

**Effects:**
- \`NoSchedule\` — New pods without toleration won't be scheduled here. Existing pods unaffected.
- \`PreferNoSchedule\` — Scheduler tries to avoid this node but won't refuse.
- \`NoExecute\` — New pods won't schedule AND existing pods are evicted unless they have a toleration (with optional \`tolerationSeconds\`).

**Common use cases:**
- Dedicated nodes for GPU workloads (\`gpu=true:NoSchedule\`)
- Master/control-plane nodes (\`node-role.kubernetes.io/control-plane:NoSchedule\`)
- Node going offline for maintenance (\`node.kubernetes.io/not-ready:NoExecute\`)

**Master toleration trick**: Control-plane pods (kube-apiserver, etcd) have tolerations for all control-plane taints — that's how they can run on master nodes.`,
    yamlExample: `# Node taint:
kubectl taint node gpu-node-1 gpu=true:NoSchedule

# Pod toleration to land on this node:
spec:
  tolerations:
  - key: "gpu"
    value: "true"
    effect: "NoSchedule"
    operator: "Equal"`,
    relatedConcepts: ['scheduling', 'pods'],
  },

  services: {
    id: 'services',
    title: 'Services & The Endpoints Controller',
    icon: '🌐',
    summary: 'A Service provides a stable IP and DNS name for a dynamic set of pods. It binds to pods purely via label selectors.',
    analogy: 'A Service is like a restaurant\'s phone number. The cooks (pods) change shifts, get sick, and are replaced — but the phone number stays the same. Callers don\'t know how many cooks are in the kitchen.',
    deepDive: `**How it works:**
1. You create a Service with \`selector: {app: frontend}\`
2. The **Endpoints Controller** watches pods — whenever a pod with \`app: frontend\` becomes Ready, the controller adds the pod's IP to the Service's **Endpoints** object
3. **kube-proxy** on each node watches Endpoints and programs **iptables** (or ipvs) rules to forward traffic to those IPs
4. DNS (CoreDNS) resolves \`service-name.namespace.svc.cluster.local\` to the Service's ClusterIP

**Debugging tip**: \`kubectl get endpoints <svc-name>\` — if it shows \`<none>\`, the selector matches zero ready pods. This is the #1 cause of "connection refused."

**Service Types:**
- \`ClusterIP\` — only reachable from within the cluster
- \`NodePort\` — also exposed on each node's IP at a random port (30000-32767)
- \`LoadBalancer\` — provisions a cloud load balancer (calls cloud provider API)`,
    yamlExample: `# The selector MUST exactly match pod labels
# One typo = zero endpoints = silent failure
kind: Service
spec:
  selector:
    app: frontend  # Must match pod's labels exactly
  ports:
  - port: 80
    targetPort: 8080`,
    relatedConcepts: ['pods', 'networkpolicy'],
  },

  rbac: {
    id: 'rbac',
    title: 'RBAC — Role-Based Access Control',
    icon: '🔐',
    summary: 'RBAC controls who can do what in Kubernetes. It uses three building blocks: Roles (what), RoleBindings (who gets what), and ServiceAccounts (identity).',
    analogy: 'RBAC is like an office key card system. A Role defines which doors exist (what permissions). A RoleBinding gives a person their key card (assigns the role). A ServiceAccount is the identity chip in the card.',
    deepDive: `**The 3-part model:**

1. **Role / ClusterRole** — Defines permissions (verbs on resources)
   - Namespaced: \`Role\` in one namespace
   - Cluster-wide: \`ClusterRole\` across all namespaces

2. **RoleBinding / ClusterRoleBinding** — Grants a role to subjects

3. **Subject** — \`User\`, \`Group\`, or \`ServiceAccount\`

**Default deny**: If no RoleBinding grants permission, access is denied. There are no "allow all" defaults (except cluster-admin).

**Debug with**:
\`kubectl auth can-i list pods --as=system:serviceaccount:default:my-sa\`

**Common gotcha**: A Role in namespace A cannot grant permissions in namespace B. Use ClusterRole + RoleBinding if you need cross-namespace reads.`,
    yamlExample: `# Step 1: Define permissions
kind: Role
rules:
- apiGroups: [""]
  resources: ["pods"]
  verbs: ["get", "list"]

# Step 2: Grant to a ServiceAccount (must do both!)
kind: RoleBinding
subjects:
- kind: ServiceAccount
  name: my-app-sa
roleRef:
  kind: Role
  name: pod-reader`,
    relatedConcepts: ['apiserver', 'services'],
  },

  networkpolicy: {
    id: 'networkpolicy',
    title: 'NetworkPolicies — Pod Firewall',
    icon: '🛡',
    summary: 'NetworkPolicies act as firewalls for pods, controlling which pods can talk to which other pods on specific ports.',
    analogy: 'NetworkPolicies are like an office network firewall. By default, all internal traffic flows freely. When you add a NetworkPolicy, you\'re installing a firewall that requires explicit "allow" rules.',
    deepDive: `**Critical behavior**: By default (no NetworkPolicies), all pods can talk to all other pods in the cluster. The moment you apply a NetworkPolicy that **selects** a pod, that pod enters "restricted mode" — all traffic not explicitly allowed is denied.

**NetworkPolicies are additive with OR logic**: If two policies select the same pod, the union of their rules is applied.

**Empty \`ingress: []\` is a deny-all**: An empty ingress array selects all pods and denies everything — it's the strictest possible rule.

**Requires a CNI plugin**: Only CNI plugins that support NetworkPolicy (Calico, Cilium, Weave) enforce these rules. Flannel does NOT enforce NetworkPolicies by default.

**Pattern — namespace isolation:**
\`podSelector: {}\` selects all pods in the namespace. Combine with \`ingress rules\` to allow specific traffic.`,
    yamlExample: `# 1. Deny all ingress to backend pods
kind: NetworkPolicy
spec:
  podSelector:
    matchLabels: {app: backend}
  policyTypes: ["Ingress"]
  ingress: []  # empty = deny all!

# 2. Allow only frontend → backend
kind: NetworkPolicy
spec:
  podSelector:
    matchLabels: {app: backend}
  ingress:
  - from:
    - podSelector:
        matchLabels: {app: frontend}`,
    relatedConcepts: ['services', 'pods'],
  },

  pvc: {
    id: 'pvc',
    title: 'PersistentVolumes & Claims',
    icon: '💾',
    summary: 'PersistentVolumes (PV) are storage resources. PersistentVolumeClaims (PVC) are requests for storage. Binding happens when their properties match.',
    analogy: 'A PV is like a parking spot. A PVC is a parking reservation request. The reservation is fulfilled when a spot matches your requirements (size, covered/outdoor). Dynamic provisioning is like a parking garage that auto-creates a new spot for your reservation.',
    deepDive: `**Static provisioning**: An admin creates PVs manually. Claims bind to matching PVs.

**Dynamic provisioning**: A **StorageClass** with a **provisioner** watches for unbound PVCs and calls a cloud API (AWS EBS, GCP Disk) to create a new volume automatically.

**Binding rules** — PVC and PV must match:
- \`storageClassName\` — exact match required
- \`accessModes\` — PV must support PVC's requested modes
- \`capacity\` — PV capacity must be >= PVC request

**Reclaim Policy** (what happens when PVC is deleted):
- \`Retain\` — PV stays (must be manually deleted). Safe for databases.
- \`Delete\` — PV and underlying storage are deleted. Risky if data is valuable.
- \`Recycle\` — Deprecated. Ran \`rm -rf\` on the volume.

**StatefulSets and storage**: StatefulSets use \`volumeClaimTemplates\` to create a unique PVC for each pod replica — pod-0 gets its own PVC, pod-1 gets its own, etc. The PVC persists even if the pod is deleted.`,
    yamlExample: `# PVC requests 10Gi of fast storage
kind: PersistentVolumeClaim
spec:
  storageClassName: "fast"  # must match PV
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 10Gi

# StorageClass with dynamic provisioner
kind: StorageClass
provisioner: kubernetes.io/aws-ebs
parameters:
  type: gp3`,
    relatedConcepts: ['pods', 'reconciliation'],
  },

  hpa: {
    id: 'hpa',
    title: 'HPA — Horizontal Pod Autoscaler',
    icon: '📈',
    summary: 'The HPA automatically scales pod replica counts up or down based on CPU/memory utilization or custom metrics from the Metrics API.',
    analogy: 'HPA is like an automatic staffing agency. When your call center gets busy (CPU high), the agency sends more agents. When it quiets down, agents go home. It needs a real-time headcount report (metrics-server) to know when to hire.',
    deepDive: `**The scaling algorithm:**
\`desiredReplicas = ceil(currentReplicas * (currentMetric / desiredMetric))\`

For example: 2 replicas at 85% CPU, target is 50%:
\`ceil(2 * (85/50)) = ceil(3.4) = 4 replicas\`

**HPA requires \`metrics-server\`** (or Prometheus Adapter for custom metrics). Without it:
- \`kubectl get hpa\` shows \`TARGETS: <unknown>/50%\`
- No scaling decisions are made
- Check: \`kubectl get apiservices v1beta1.metrics.k8s.io\`

**Cooldown periods** (prevent thrashing):
- Scale-up cooldown: 3 minutes (by default)
- Scale-down cooldown: 5 minutes (more conservative)

**VPA vs HPA**: HPA scales horizontally (more pods). VPA scales vertically (bigger pods). They can conflict if both target CPU — use only one for CPU-based scaling.`,
    yamlExample: `kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    kind: Deployment
    name: my-api
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        averageUtilization: 50  # target 50% CPU`,
    relatedConcepts: ['resources', 'scheduling'],
  },

  rollingupdate: {
    id: 'rollingupdate',
    title: 'Rolling Updates & Rollback',
    icon: '🔄',
    summary: 'Rolling updates gradually replace old pod replicas with new ones, ensuring continuous availability. The key controls are maxSurge and maxUnavailable.',
    analogy: 'Painting a bridge while keeping traffic flowing. You paint lane by lane — you never close the whole bridge at once (maxUnavailable=0). You can have temporary extra barriers on the side (maxSurge).',
    deepDive: `**The rollout algorithm:**
1. Create new ReplicaSet with new pod template
2. Scale up new RS by \`maxSurge\` pods (extra pods allowed above desired)
3. Wait for new pods to become Ready
4. Scale down old RS by \`maxUnavailable\` pods
5. Repeat until old RS has 0 pods

**Deadlock scenario**: \`maxUnavailable=0\` + failing readiness probe:
- New pods never become Ready (readiness probe fails)
- Old pods can't be removed (maxUnavailable=0 prevents it)
- Rollout hangs forever — \`kubectl rollout status\` hangs

**Fix options:**
1. \`kubectl rollout undo deployment/my-app\` — roll back to last revision
2. Fix the readiness probe in the new image/config
3. Temporarily set \`maxUnavailable=1\` to force progress

**History and rollback:**
\`kubectl rollout history deployment/my-app\`
\`kubectl rollout undo deployment/my-app --to-revision=2\``,
    yamlExample: `spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # allow 1 extra pod during rollout
      maxUnavailable: 0  # never go below desired count
      # With 3 replicas: max 4 pods exist at peak
      # 0 pods removed until new pod is Ready`,
    relatedConcepts: ['pods', 'reconciliation', 'controllers'],
  },
};
