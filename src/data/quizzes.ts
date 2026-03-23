import type { ScenarioId } from '../types/k8s';

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Quiz {
  scenarioId: ScenarioId;
  questions: QuizQuestion[];
}

export const QUIZZES: Record<ScenarioId, QuizQuestion[]> = {
  'image-pull-backoff': [
    {
      question: 'Why does ImagePullBackOff show "BackOff" in the name?',
      options: [
        'It means the image was backed up to a mirror registry',
        'Kubernetes applies exponential backoff — wait 10s, 20s, 40s... before each retry',
        'The node backed away from the registry due to rate limiting only',
        'BackOff means the kubelet gave up and will never retry',
      ],
      correctIndex: 1,
      explanation: 'BackOff describes exponential backoff: after each failed pull, the kubelet waits progressively longer (10s, 20s, 40s, up to 5 minutes) before retrying. This prevents hammering the registry. The pod will eventually retry — it never permanently gives up.',
    },
    {
      question: 'Which component is responsible for pulling container images?',
      options: ['kube-scheduler', 'kube-apiserver', 'kubelet (via container runtime)', 'Deployment Controller'],
      correctIndex: 2,
      explanation: 'The kubelet on the node calls the Container Runtime Interface (CRI) — typically containerd. The runtime then contacts the container registry. The scheduler only assigns the pod to a node; the kubelet does the actual work of pulling and running it.',
    },
    {
      question: 'What is the difference between ImagePullBackOff and ErrImagePull?',
      options: [
        'They are the same error with different names',
        'ErrImagePull is the initial error; ImagePullBackOff appears after the first retry cycle begins',
        'ErrImagePull means auth failure; ImagePullBackOff means image not found',
        'ImagePullBackOff only happens for private registries',
      ],
      correctIndex: 1,
      explanation: 'ErrImagePull is the raw failure reason on the first attempt. After a few failures, Kubernetes transitions the reason to ImagePullBackOff to communicate that it is now in retry-with-backoff mode. Both indicate an inability to pull the image.',
    },
  ],

  'crash-loop-backoff': [
    {
      question: 'What does exit code 137 mean for a container?',
      options: [
        'The application crashed with an unhandled exception',
        'The container was killed by the Linux OOM Killer (SIGKILL = 128 + 9)',
        'The process was stopped gracefully with SIGTERM',
        'A missing environment variable caused startup failure',
      ],
      correctIndex: 1,
      explanation: 'Exit code 137 = 128 + 9. Linux encodes signal-killed processes as 128 + signal_number. SIGKILL is signal 9. So 137 = OOM killed by the kernel. Exit code 1 is a general application error; exit code 143 (128+15) means SIGTERM (graceful shutdown).',
    },
    {
      question: 'Why does the backoff delay between restarts increase?',
      options: [
        'To punish developers for writing buggy code',
        'To prevent "thundering herd" — hundreds of crashing pods from overloading the node and registry',
        'Because the kubelet runs out of memory as it manages more restarts',
        'To give the application time to warm up on the next attempt',
      ],
      correctIndex: 1,
      explanation: 'Exponential backoff prevents resource exhaustion. If a Deployment has 20 replicas all crashing immediately, they would constantly hammer the image registry, the container runtime, and the node\'s resources. Backoff spreads out the retry load and prevents cascading failures.',
    },
    {
      question: 'How do you see logs from a previous (crashed) container instance?',
      options: [
        'kubectl logs <pod> --all-containers',
        'kubectl logs <pod> --previous',
        'kubectl describe pod <pod> --logs',
        'kubectl get events --for pod/<pod>',
      ],
      correctIndex: 1,
      explanation: 'The --previous flag retrieves logs from the last terminated container instance. Without it, kubectl logs shows the current (freshly started) container which usually has no logs yet if it crashes immediately. This is essential for crash debugging.',
    },
  ],

  'pending-resources': [
    {
      question: 'What determines whether a pod can be scheduled on a node?',
      options: [
        'The container image size and download speed',
        'Resource limits — the node checks if limits fit in available space',
        'Resource requests — the scheduler checks if requests fit in allocatable capacity',
        'The pod\'s priority class and QoS tier',
      ],
      correctIndex: 2,
      explanation: 'The scheduler uses resource **requests** (not limits) to decide placement. It computes: `node.allocatable - sum(running-pod.requests)` and checks if the new pod\'s requests fit. Limits are enforced at runtime by the kernel — the scheduler doesn\'t consider them for placement.',
    },
    {
      question: 'What is "allocatable" capacity on a node?',
      options: [
        'The total physical RAM and CPU installed in the server',
        'Total capacity minus what system daemons (kubelet, kube-proxy, OS) reserve',
        'The amount of resources currently unused by running pods',
        'The maximum resources a single pod can request',
      ],
      correctIndex: 1,
      explanation: 'Allocatable = Capacity - system reserved - kubelet eviction threshold. Kubernetes nodes need to reserve resources for the OS, kubelet, kube-proxy, and eviction buffers. A node with 4 CPU might only have 3.8 CPU allocatable. Real clusters typically reserve 10-15% of capacity.',
    },
    {
      question: 'A pod requests 500m CPU and a node shows 30% CPU utilization (3000m out of 4000m). Will the pod schedule?',
      options: [
        'Yes — 30% utilization means 70% is free for new pods',
        'It depends — scheduler uses requested (reserved) resources, not actual utilization',
        'No — the node must be below 20% utilization to accept new pods',
        'Yes — resource requests are only suggestions for small pods',
      ],
      correctIndex: 1,
      explanation: 'Actual utilization and scheduled capacity are different! A node could be at 10% actual CPU use but 95% scheduled capacity if many pods have high requests but low actual usage. The scheduler allocates against requests — this is why over-provisioning requests wastes cluster capacity.',
    },
  ],

  'pending-taint': [
    {
      question: 'What is the difference between NoSchedule and NoExecute taint effects?',
      options: [
        'NoSchedule affects new pods; NoExecute evicts existing pods too',
        'NoExecute only affects stateless pods; NoSchedule affects everything',
        'NoSchedule is softer — it only blocks pods without priority classes',
        'They are identical in behavior, just different naming conventions',
      ],
      correctIndex: 0,
      explanation: 'NoSchedule prevents new pods from being scheduled on the tainted node but leaves existing pods running. NoExecute does both — prevents new pods AND evicts existing pods that don\'t have a matching toleration. NoExecute supports tolerationSeconds to allow graceful eviction.',
    },
    {
      question: 'Which toleration operator means "match any value for this key"?',
      options: ['Equal', 'Exists', 'In', 'Contains'],
      correctIndex: 1,
      explanation: 'operator: Exists matches any value for the key. operator: Equal requires value to match exactly. Use Exists when you just want to allow pods on nodes with a specific key regardless of value — for example, allowing all GPU nodes without specifying GPU type.',
    },
    {
      question: 'Why do control-plane pods (etcd, kube-apiserver) run on master nodes despite the NoSchedule taint?',
      options: [
        'They use a special PriorityClass that overrides taints',
        'Static pods in /etc/kubernetes/manifests bypass the scheduler entirely',
        'They have a built-in toleration for control-plane taints in their pod spec',
        'Master nodes have a separate scheduling algorithm that allows system pods',
      ],
      correctIndex: 2,
      explanation: 'kube-apiserver, etcd, and other control-plane pods have tolerations for the node-role.kubernetes.io/control-plane:NoSchedule taint. They are also usually Static Pods (managed directly by kubelet from manifests), but the toleration is what allows them to land on tainted nodes.',
    },
  ],

  'node-failure': [
    {
      question: 'After a node goes NotReady, how does Kubernetes decide when to evict its pods?',
      options: [
        'Immediately — pods are evicted as soon as the node shows NotReady',
        'After node-monitor-grace-period (default: 40s) — pods enter Unknown phase first',
        'After 5 minutes — Kubernetes waits to confirm the failure is not transient',
        'Only after a human operator runs kubectl drain',
      ],
      correctIndex: 1,
      explanation: 'Kubernetes waits for node-monitor-grace-period (default 40s) before marking pods as Unknown. This prevents false evictions from temporary network blips. After enough grace time, the NodeLifecycleController adds NoExecute taints to the node, which evicts pods without matching tolerations.',
    },
    {
      question: 'What happens to a pod in "Unknown" phase?',
      options: [
        'It is immediately rescheduled on another node',
        'The kubelet lost contact — Kubernetes cannot confirm if the pod is running or dead',
        'The pod container crashed and is waiting for a restart',
        'The pod image is being pulled in the background',
      ],
      correctIndex: 1,
      explanation: 'Unknown phase means the API Server lost contact with the kubelet for this pod. The pod might still be running, crashed, or the node is down. Kubernetes can\'t know. This is why Unknown pods are eventually evicted — to allow rescheduling with confidence.',
    },
    {
      question: 'A Deployment with 1 replica runs on a failed node. How long is the service completely down?',
      options: [
        'Zero seconds — Kubernetes pre-schedules a standby pod on another node',
        'Until the node-monitor-grace-period + pod eviction + image pull + startup time',
        'Exactly 5 minutes by default',
        '30 seconds — the kube-proxy updates routes immediately',
      ],
      correctIndex: 1,
      explanation: 'With 1 replica, the service is down until the entire recovery chain completes: node-monitor-grace-period (~40s) + eviction processing + new pod scheduling + image pull + container start + readiness probe. This can easily be 2-5 minutes. Always run replicas > 1 for HA deployments.',
    },
  ],

  'oom-killed': [
    {
      question: 'Who kills the container when it exceeds its memory limit?',
      options: [
        'The kubelet detects the overuse and sends SIGKILL',
        'The Kubernetes controller manager monitors and kills the process',
        'The Linux kernel OOM Killer sends SIGKILL via cgroups',
        'The container runtime (containerd) monitors and restarts it',
      ],
      correctIndex: 2,
      explanation: 'The Linux kernel\'s cgroup memory controller enforces the memory limit. When a container process exceeds the limit, the kernel OOM Killer selects a process in that cgroup and sends SIGKILL (signal 9). Kubernetes doesn\'t do the killing — it just observes the exit code and reports OOMKilled.',
    },
    {
      question: 'A pod has a memory limit of 128Mi but its memory request is 512Mi. What happens?',
      options: [
        'Kubernetes rejects this — limits must be >= requests',
        'The scheduler uses the 512Mi request; at runtime the kernel enforces the 128Mi limit',
        'The 512Mi request overrides the limit at runtime',
        'The pod is automatically given 512Mi to match its request',
      ],
      correctIndex: 0,
      explanation: 'Kubernetes validates that limits >= requests. If you set a limit lower than the request, the API Server will reject the pod spec with a validation error. Always set limits >= requests. In practice, requests should reflect typical usage and limits should provide headroom for bursts.',
    },
    {
      question: 'What is the QoS class of a pod where requests equal limits for all containers?',
      options: ['BestEffort', 'Burstable', 'Guaranteed', 'Critical'],
      correctIndex: 2,
      explanation: 'When requests == limits for all containers in a pod, the QoS class is Guaranteed. This means the pod gets dedicated resources and is the last to be evicted under node pressure. BestEffort (no requests/limits) is evicted first, Burstable (requests < limits) is evicted second.',
    },
  ],

  'pvc-pending': [
    {
      question: 'What three properties must match between a PVC and PV for binding to occur?',
      options: [
        'name, namespace, and size',
        'storageClassName, accessModes, and capacity (PV >= PVC)',
        'storageClassName, namespace, and reclaimPolicy',
        'provisioner, size, and accessModes',
      ],
      correctIndex: 1,
      explanation: 'PVC and PV must agree on: (1) storageClassName — must be identical strings, (2) accessModes — the PV must support all the access modes the PVC requests, and (3) capacity — the PV must have >= storage than the PVC requests. Even a PV that is 1Gi larger than requested will bind to a 10Gi PVC if the other criteria match.',
    },
    {
      question: 'What is dynamic provisioning and what is required for it to work?',
      options: [
        'Kubernetes automatically resizes PVCs when pods need more space',
        'A StorageClass with a provisioner field that calls a cloud API to create volumes on-demand',
        'Pods dynamically mount volumes from other pods in the same namespace',
        'The kubelet pre-allocates storage on the node for all pending PVCs',
      ],
      correctIndex: 1,
      explanation: 'Dynamic provisioning requires a StorageClass with a provisioner field (e.g., kubernetes.io/aws-ebs or docker.io/hostpath). When a PVC is created referencing this StorageClass, the storage plugin calls the cloud API to create a physical disk, then creates a PV object and binds it — all automatically.',
    },
    {
      question: 'A PVC with reclaimPolicy: Delete is deleted. What happens to the underlying data?',
      options: [
        'Data is retained for 30 days before deletion',
        'Data is immediately deleted — the cloud disk is destroyed',
        'Data is moved to a released PV for reuse by other PVCs',
        'Data is snapshotted first, then the disk is deleted',
      ],
      correctIndex: 1,
      explanation: 'Retain keeps the PV and data after PVC deletion — an admin must manually clean up. Delete (the default for dynamically provisioned PVs) deletes both the PV object and the underlying cloud storage immediately. Be very careful with Delete for production databases.',
    },
  ],

  'service-selector-mismatch': [
    {
      question: 'Why is a Service selector mismatch called a "silent failure"?',
      options: [
        'Kubernetes suppresses the error because it is a common misconfiguration',
        'The Service still exists and returns a valid ClusterIP — traffic just goes nowhere',
        'The error only appears in audit logs, not in regular events',
        'It takes 30 minutes for Kubernetes to detect the mismatch',
      ],
      correctIndex: 1,
      explanation: 'The Service object is valid! It has a ClusterIP, DNS resolves it correctly, and kube-proxy sets up iptables rules. But the Endpoints object is empty because no pods match the selector. Traffic hits the iptables rule and drops silently. No error event is emitted — only kubectl get endpoints shows the problem.',
    },
    {
      question: 'What component automatically maintains the Endpoints object for a Service?',
      options: ['kube-scheduler', 'kube-proxy', 'EndpointSlice controller (Endpoints controller)', 'CoreDNS'],
      correctIndex: 2,
      explanation: 'The Endpoints Controller (now replaced by EndpointSlice Controller in modern Kubernetes) watches pods and services. Whenever a pod with matching labels becomes Ready, the controller adds it to the Endpoints object. kube-proxy then reads Endpoints to program iptables/ipvs rules for traffic routing.',
    },
    {
      question: 'A pod is Running but NOT Ready. Is it included in a Service\'s endpoints?',
      options: [
        'Yes — Running is enough for traffic routing',
        'No — only pods passing their readiness probe are added to endpoints',
        'Yes, but with lower priority than Ready pods',
        'It depends on the Service type (ClusterIP vs NodePort)',
      ],
      correctIndex: 1,
      explanation: 'Service endpoints only include pods that are both Running AND Ready (readiness probe passing). A pod that is Running but failing its readiness probe is intentionally excluded from traffic. This is the entire purpose of readiness probes — to protect Services from sending traffic to pods that aren\'t ready to handle it.',
    },
  ],

  'rolling-update-stuck': [
    {
      question: 'With maxUnavailable=0 and a failing readiness probe, why does the rollout deadlock?',
      options: [
        'The scheduler cannot find nodes for new pods',
        'New pods never become Ready, so old pods can\'t be removed, so rollout never progresses',
        'The Deployment controller hits a rate limit on pod operations',
        'maxUnavailable=0 is invalid and causes a crash loop',
      ],
      correctIndex: 1,
      explanation: 'maxUnavailable=0 means Kubernetes won\'t remove old pods until the same number of new pods are Ready. But if new pods can\'t become Ready (failing readiness probe), no old pods are ever removed. The rollout is stuck: can\'t progress forward, won\'t go backward automatically. This is the classic rolling update deadlock.',
    },
    {
      question: 'What is the difference between a readiness probe failure and a liveness probe failure?',
      options: [
        'They are identical — both cause the container to restart',
        'Readiness failure removes the pod from endpoints; liveness failure restarts the container',
        'Liveness failure removes the pod from endpoints; readiness failure restarts the container',
        'Readiness failure has a 10s grace period; liveness failure is immediate',
      ],
      correctIndex: 1,
      explanation: 'Readiness probe failure: pod stays Running but is removed from Service endpoints (no traffic sent). Container is NOT restarted. Liveness probe failure: kubelet restarts the container (the pod stays but the container process is killed and restarted). They serve different purposes — readiness blocks traffic, liveness triggers restarts.',
    },
    {
      question: 'How can you see the history of rollout revisions?',
      options: [
        'kubectl get deployment <name> -o yaml | grep revision',
        'kubectl rollout history deployment/<name>',
        'kubectl describe deployment <name> | grep Revision',
        'kubectl get replicasets --show-labels',
      ],
      correctIndex: 1,
      explanation: 'kubectl rollout history deployment/<name> shows the revision history. Each time you update the pod template, a new revision is created. Use --revision=<N> to see what changed in that revision. kubectl rollout undo --to-revision=<N> rolls back to a specific revision.',
    },
  ],

  'hpa-not-scaling': [
    {
      question: 'Why does HPA show TARGETS as <unknown> when metrics-server is missing?',
      options: [
        'The HPA controller cannot connect to the pods directly to measure CPU',
        'The Metrics API (served by metrics-server) is unavailable — HPA has no data to act on',
        'The pods are using less than 1% CPU which rounds down to unknown',
        'HPA requires custom metrics — the built-in CPU metric shows unknown by default',
      ],
      correctIndex: 1,
      explanation: 'HPA polls the Kubernetes Metrics API at v1beta1.metrics.k8s.io. This API is served by metrics-server (or Prometheus Adapter for custom metrics). Without metrics-server, the API doesn\'t exist, so HPA gets no metric data and shows <unknown>. No data = no scaling decisions.',
    },
    {
      question: 'If CPU is at 200% of the target, what does HPA do immediately?',
      options: [
        'Doubles the replica count immediately',
        'Scales up by at most maxSurge replicas per interval',
        'Applies the scaling formula: ceil(currentReplicas * currentMetric/targetMetric) but respects maxReplicas and cooldowns',
        'Alerts an administrator rather than auto-scaling',
      ],
      correctIndex: 2,
      explanation: 'HPA formula: desiredReplicas = ceil(currentReplicas * (currentMetric / desiredMetric)). With 2 replicas at 200% target: ceil(2 * 2.0) = 4. But HPA also respects maxReplicas ceiling and scale-up cooldown periods (default 3 minutes) to prevent thrashing.',
    },
    {
      question: 'What\'s the risk of using both HPA (CPU-based) and VPA simultaneously?',
      options: [
        'No risk — they complement each other perfectly',
        'They can conflict: VPA increases pod size (reducing per-pod CPU %), causing HPA to scale down',
        'VPA is deprecated and should never be used with HPA',
        'HPA takes priority and VPA recommendations are ignored',
      ],
      correctIndex: 1,
      explanation: 'HPA scales out (more pods). VPA scales up (bigger pods). They can conflict on CPU: VPA gives a pod more CPU, it uses less % of its limit, HPA sees lower utilization and scales down. The combined effect can be unstable. The Kubernetes recommendation is to not use both for the same resource metric.',
    },
  ],

  'rbac-forbidden': [
    {
      question: 'In Kubernetes RBAC, what is the default access policy?',
      options: [
        'Allow all — you must explicitly deny to restrict access',
        'Deny all — you must explicitly grant every permission',
        'Allow reads, deny writes — standard read-only by default',
        'Allow within the same namespace, deny across namespaces',
      ],
      correctIndex: 1,
      explanation: 'Kubernetes RBAC is deny-by-default. No permissions are granted unless explicitly defined in a RoleBinding or ClusterRoleBinding. This includes the default Service Account — it has no permissions by default. cluster-admin is the only built-in role that grants all permissions.',
    },
    {
      question: 'What is the difference between a Role and a ClusterRole?',
      options: [
        'Roles allow more permissions than ClusterRoles by default',
        'Roles are namespaced; ClusterRoles apply across all namespaces',
        'ClusterRoles only affect the kube-system namespace',
        'Roles can bind to Users; ClusterRoles can only bind to ServiceAccounts',
      ],
      correctIndex: 1,
      explanation: 'Role is namespaced — permissions only apply within that namespace. ClusterRole is cluster-wide and can grant access to cluster-scoped resources (Nodes, PVs) or cross-namespace resources. You can bind a ClusterRole with a namespaced RoleBinding to restrict its scope to one namespace.',
    },
    {
      question: 'How do you test if a ServiceAccount can perform an action?',
      options: [
        'kubectl get permissions --for sa/my-sa',
        'kubectl auth can-i list pods --as=system:serviceaccount:<namespace>:<sa-name>',
        'kubectl describe serviceaccount my-sa --show-permissions',
        'kubectl rbac check --serviceaccount=my-sa --verb=list --resource=pods',
      ],
      correctIndex: 1,
      explanation: 'kubectl auth can-i is the definitive RBAC debugging tool. The --as flag impersonates a user/serviceaccount. The ServiceAccount format is system:serviceaccount:<namespace>:<name>. This runs the actual authorization check against the API Server\'s RBAC engine.',
    },
  ],

  'network-policy-blocking': [
    {
      question: 'By default (no NetworkPolicies applied), can pods in different namespaces communicate?',
      options: [
        'No — namespaces are always network-isolated by default',
        'Yes — all pods in the cluster can communicate with all other pods by default',
        'Only if they share a Service account',
        'Only within the same node — cross-node pod communication is blocked by default',
      ],
      correctIndex: 1,
      explanation: 'By default, Kubernetes has no network isolation. All pods can talk to all other pods across any namespace. NetworkPolicies are purely additive restrictions — you must explicitly create them to restrict traffic. This is why a "deny-all" NetworkPolicy is a powerful security baseline.',
    },
    {
      question: 'A pod has two NetworkPolicies applied. One allows ingress from frontend, one denies all ingress. Which wins?',
      options: [
        'The deny policy always wins — security rules take priority',
        'The allow policy wins — NetworkPolicies are additive with OR logic',
        'The most recently created policy wins',
        'It depends on the policy priority field',
      ],
      correctIndex: 1,
      explanation: 'NetworkPolicies are additive with OR logic — if ANY policy allows the traffic, it is allowed. There are no explicit "deny" rules in standard NetworkPolicies (Cilium adds this). The only way to deny is to have no allow rule that covers the traffic. So the allow-from-frontend policy makes frontend traffic allowed, regardless of other policies.',
    },
    {
      question: 'Which CNI plugin does NOT enforce NetworkPolicies by default?',
      options: ['Calico', 'Cilium', 'Flannel', 'Weave Net'],
      correctIndex: 2,
      explanation: 'Flannel is a popular, simple overlay network that does NOT enforce NetworkPolicies. It provides connectivity but not isolation. To use NetworkPolicies with Flannel, you need to add a separate network policy engine on top. Calico, Cilium, and Weave Net enforce NetworkPolicies natively.',
    },
  ],
};
