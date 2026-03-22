import type { Scenario, ClusterState } from '../types/k8s';

export const SCENARIOS: Scenario[] = [
  {
    id: 'image-pull-backoff',
    title: 'ImagePullBackOff',
    description: 'A deployment references a non-existent container image tag. Pods loop in pull failure.',
    difficulty: 'beginner',
    category: 'Workload',
    trigger: 'Deployment uses image tag that does not exist in the registry',
    symptoms: [
      'Pods stuck in "Pending" with reason "ImagePullBackOff"',
      'Events show "Failed to pull image: not found"',
      'kubectl get pods shows 0/1 READY after minutes'
    ],
    rootCause: 'The image "nginx:nonexistent-tag-xyz" does not exist. The kubelet cannot pull it from the registry.',
    resolution: [
      'kubectl describe pod <pod-name> to see the image pull error',
      'Fix the image tag in the Deployment spec (e.g., nginx:1.25)',
      'kubectl edit deployment bad-image-app OR apply corrected YAML',
    ],
    hints: [
      'Check the Events section in kubectl describe pod',
      'The reason field in pod status tells you the exact failure mode',
      'ImagePullBackOff means Kubernetes is applying exponential backoff between retries',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'bad-image-app');
      if (!dep) return false;
      const pods = state.pods.filter(p => p.ownerRef?.name === 'bad-image-app' && p.phase !== 'Terminating');
      return pods.length > 0 && pods.every(p => p.phase === 'Running' && p.readinessReady) && !state.badImages.includes(dep.template.spec.containers[0]?.image);
    },
  },
  {
    id: 'crash-loop-backoff',
    title: 'CrashLoopBackOff',
    description: 'A container starts but immediately exits with a non-zero exit code.',
    difficulty: 'beginner',
    category: 'Workload',
    trigger: 'Container process exits immediately (liveness probe failure or bad entrypoint)',
    symptoms: [
      'Pod shows RESTARTS count increasing rapidly',
      'Phase oscillates between Running and Error',
      'CrashLoopBackOff in container status reason',
    ],
    rootCause: 'The container exits with a non-zero exit code. After repeated failures, kubelet applies exponential backoff before restarting.',
    resolution: [
      'kubectl logs <pod-name> --previous to see crash logs',
      'Check exit code in kubectl describe pod',
      'Fix the application crash, bad entrypoint, or misconfigured liveness probe',
    ],
    hints: [
      'Exit code 1 = application error, 137 = OOMKilled, 143 = terminated',
      '"CrashLoopBackOff" means the backoff reached maximum — pod will restart every ~5min',
      'Use --previous flag to see logs of the crashed container',
    ],
    validate: (state: ClusterState) => {
      const hasCrasher = state.pods.some(p => p.ownerRef?.name === 'crasher' && p.phase !== 'Terminating');
      const hasRunning = state.pods.some(p => p.phase === 'Running' && p.readinessReady);
      return !hasCrasher && hasRunning;
    },
  },
  {
    id: 'pending-resources',
    title: 'Pending Pod — Insufficient Resources',
    description: 'Pods cannot be scheduled because no node has enough CPU or memory.',
    difficulty: 'beginner',
    category: 'Scheduling',
    trigger: 'Pod requests more resources than any single node can provide',
    symptoms: [
      'Pods stuck in Pending indefinitely',
      'Events show "0/2 nodes are available: Insufficient cpu"',
      'No node is highlighted in scheduler view',
    ],
    rootCause: 'Each pod requests 2000m CPU and 6000Mi memory, but nodes only have 3800m allocatable CPU and 7680Mi memory. Multiple pods overflow any node.',
    resolution: [
      'kubectl describe pod <name> to see scheduler events',
      'Either: reduce resource requests in the pod spec',
      'Or: add more nodes to the cluster',
      'Or: remove other workloads to free capacity',
    ],
    hints: [
      'Resource requests determine scheduling, not limits',
      'Use kubectl top nodes to see current utilization (here simulated in the Nodes panel)',
      'fractional CPU is fine: 100m = 0.1 core',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'memory-hog');
      if (!dep) return false;
      const pods = state.pods.filter(p => p.ownerRef?.name === 'memory-hog' && p.phase !== 'Terminating');
      return pods.length > 0 && pods.every(p => p.phase === 'Running');
    },
  },
  {
    id: 'pending-taint',
    title: 'Pending Pod — Taint/Toleration Mismatch',
    description: 'All nodes are tainted with gpu=true:NoSchedule, but pods have no matching toleration.',
    difficulty: 'intermediate',
    category: 'Scheduling',
    trigger: 'Nodes tainted, pods have no matching tolerations',
    symptoms: [
      'Pods stuck in Pending',
      'Events: "0/2 nodes available: 2 node(s) had untolerated taint {gpu: true}"',
    ],
    rootCause: 'The gpu:NoSchedule taint on every node prevents pods without a matching toleration from being scheduled there.',
    resolution: [
      'Add a toleration to the deployment pod spec:',
      'tolerations: [{key: "gpu", value: "true", effect: "NoSchedule"}]',
      'Or remove the taint from nodes if pods should be schedulable',
    ],
    hints: [
      'Taints are node-side repellents; tolerations are pod-side exceptions',
      'operator: Exists means match any value for key',
      'NoExecute taints also evict already-running pods',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'no-toleration-app');
      if (!dep) return false;
      const pods = state.pods.filter(p => p.ownerRef?.name === 'no-toleration-app' && p.phase !== 'Terminating');
      return pods.length > 0 && pods.every(p => p.phase === 'Running');
    },
  },
  {
    id: 'node-failure',
    title: 'Node Failure & Pod Eviction',
    description: 'A worker node goes NotReady. Kubernetes must detect and reschedule its pods.',
    difficulty: 'intermediate',
    category: 'Reliability',
    trigger: 'Click "Kill Node" in the Nodes panel to simulate node failure',
    symptoms: [
      'Node status changes to NotReady',
      'Pods enter Unknown phase after node-monitor-grace-period',
      'NodeNotReady events emitted',
      'Pods are eventually rescheduled on surviving nodes',
    ],
    rootCause: 'When a node fails, kubelet stops sending heartbeats. After the grace period, NodeLifecycleController evicts pods and they are rescheduled.',
    resolution: [
      'Investigate node: kubectl describe node <name>',
      'Check node conditions and events',
      'If node is unrecoverable, drain and delete it',
      'Ensure replicas > 1 for HA (single-replica deployments have downtime)',
    ],
    hints: [
      'Real k8s grace period is 40s by default (node-monitor-grace-period)',
      'Simulation uses 5s for visibility',
      'Pod Disruption Budgets can control eviction rates',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'resilient-app');
      if (!dep) return false;
      return dep.status.readyReplicas === dep.replicas && dep.replicas > 0;
    },
  },
  {
    id: 'oom-killed',
    title: 'OOMKilled',
    description: 'Container is killed by the Linux kernel OOM killer for exceeding memory limits.',
    difficulty: 'intermediate',
    category: 'Resources',
    trigger: 'Memory limit set too low; container exceeds limit',
    symptoms: [
      'Pod container shows exit code 137',
      'ContainersNotReady reason: OOMKilled',
      'Restart count climbs, may lead to CrashLoopBackOff',
    ],
    rootCause: 'Linux cgroups enforce the memory limit. The kernel OOM killer sends SIGKILL (signal 9) to the container process when it exceeds the limit.',
    resolution: [
      'kubectl describe pod shows OOMKilled in lastState',
      'Increase the memory limit in the container spec',
      'Or profile and fix the memory leak in the application',
    ],
    hints: [
      'Exit code 137 = 128 + 9 (SIGKILL)',
      'Limits are enforced by cgroups; requests are for scheduling',
      'Use kubectl top pods to see current memory usage',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'memory-eater');
      if (!dep) return false;
      const lim = dep.template.spec.containers[0]?.resources?.limits?.memory;
      const limNum = typeof lim === 'number' ? lim : 0;
      return limNum >= 128 && dep.status.readyReplicas === dep.replicas && dep.replicas > 0;
    },
  },
  {
    id: 'pvc-pending',
    title: 'PVC Stuck in Pending',
    description: 'A PersistentVolumeClaim cannot bind because no matching PersistentVolume exists.',
    difficulty: 'intermediate',
    category: 'Storage',
    trigger: 'PVC requests storageClass "premium-ssd" but no PV with that class exists',
    symptoms: [
      'PVC remains in Pending phase indefinitely',
      'Events: "storageclass premium-ssd: no matching PersistentVolume found"',
      'Pods referencing the PVC also stuck in Pending',
    ],
    rootCause: 'The PVC requests a storageClassName that either has no available PVs or no dynamic provisioner.',
    resolution: [
      'Apply a PV with matching storageClassName, accessModes, and sufficient size',
      'Or install a StorageClass with a dynamic provisioner',
      'Or change the PVC storageClassName to "fast" (the available one)',
    ],
    hints: [
      'PVC and PV must match on: storageClassName, accessModes, and size (PV >= PVC)',
      'Dynamic provisioning requires a StorageClass with a provisioner field',
      'kubectl describe pvc shows the exact mismatch reason',
    ],
    validate: (state: ClusterState) => {
      const pvc = state.pvcs.find(p => p.name === 'data-pvc');
      if (!pvc) return false;
      return pvc.phase === 'Bound';
    },
  },
  {
    id: 'service-selector-mismatch',
    title: 'Service Selector Mismatch — 0 Endpoints',
    description: 'A Service has a selector that matches no pods — traffic is silently dropped.',
    difficulty: 'intermediate',
    category: 'Networking',
    trigger: 'Service selector is "app: web-application" but pods have label "app: web-app"',
    symptoms: [
      'curl to ClusterIP hangs or returns "connection refused"',
      'kubectl get endpoints web-app-svc shows: <none>',
      'No events — this is a silent failure',
    ],
    rootCause: 'The Service selector must exactly match pod labels. A typo means zero endpoints — the Service exists but routes to nothing.',
    resolution: [
      'kubectl get endpoints web-app-svc — verify it shows pod IPs',
      'kubectl describe service web-app-svc to see selector',
      'Fix the selector to match actual pod labels: app: web-app',
    ],
    hints: [
      'Services are purely label-selector based — no automatic name matching',
      'Endpoints object is auto-updated by the endpoints controller',
      'Test with: kubectl exec -it <pod> -- curl <service-ip>',
    ],
    validate: (state: ClusterState) => {
      const svc = state.services.find(s => s.name === 'web-app-svc');
      if (!svc) return false;
      return svc.endpoints.length > 0;
    },
  },
  {
    id: 'rolling-update-stuck',
    title: 'Rolling Update Stuck',
    description: 'A deployment update stalls because new pods fail the readiness probe.',
    difficulty: 'advanced',
    category: 'Workload',
    trigger: 'New pod template has failing readiness probe; maxUnavailable=0 blocks progress',
    symptoms: [
      'kubectl rollout status deployment/web-frontend hangs',
      'Deployment shows updatedReplicas < replicas',
      'New pods are Running but not Ready (readiness probe failing)',
      'Old pods not terminated (maxUnavailable=0 protects availability)',
    ],
    rootCause: 'With maxUnavailable=0, the rolling update only terminates old pods after new ones are Ready. Failing readiness probe means new pods never become Ready — deadlock.',
    resolution: [
      'kubectl rollout undo deployment/web-frontend to roll back',
      'Or fix the readiness probe in the deployment spec',
      'Check pod logs for the health endpoint error',
    ],
    hints: [
      'maxSurge allows extra pods; maxUnavailable protects existing capacity',
      'Readiness probe failure ≠ pod crash — pod stays Running but gets no traffic',
      'kubectl rollout history shows revision history',
    ],
    validate: (state: ClusterState) => {
      const dep = state.deployments.find(d => d.name === 'web-frontend');
      if (!dep) return false;
      return dep.status.readyReplicas === dep.replicas && dep.status.updatedReplicas === dep.replicas && dep.replicas > 0 && state.pods.filter(p => p.ownerRef?.name === 'web-frontend').every(p => p.readinessReady);
    },
  },
  {
    id: 'hpa-not-scaling',
    title: 'HPA Not Scaling',
    description: 'High CPU load exists but HPA does not scale out — metrics-server is missing.',
    difficulty: 'advanced',
    category: 'Scaling',
    trigger: 'HPA configured but metrics-server not available',
    symptoms: [
      'CPU load is 85% but replica count stays at 2',
      'HPA events: "unable to get metrics from resource metrics API"',
      'kubectl get hpa shows TARGETS as <unknown>/50%',
    ],
    rootCause: 'The HPA controller polls the Metrics API (served by metrics-server) to get pod CPU/memory usage. Without metrics-server, it cannot make scaling decisions.',
    resolution: [
      'Install metrics-server: kubectl apply -f metrics-server.yaml',
      'Toggle "Metrics Server" in the Scaling module',
      'HPA will start scaling within one polling interval (15s)',
    ],
    hints: [
      'Prometheus Adapter can be used instead of metrics-server for custom metrics',
      'kubectl top pods fails for the same reason',
      'Check: kubectl get apiservices v1beta1.metrics.k8s.io',
    ],
    validate: (state: ClusterState) => {
      const hpa = state.hpas.find(h => h.name === 'api-server-hpa');
      if (!hpa) return false;
      return hpa.metricsAvailable && hpa.currentReplicas > hpa.minReplicas;
    },
  },
  {
    id: 'rbac-forbidden',
    title: 'RBAC 403 Forbidden',
    description: 'A ServiceAccount lacks a RoleBinding — all API calls return Forbidden.',
    difficulty: 'advanced',
    category: 'Security',
    trigger: 'ServiceAccount "restricted-sa" exists with Role "pod-reader" but no RoleBinding linking them',
    symptoms: [
      'kubectl logs shows "Error from server (Forbidden): pods is forbidden"',
      'Application cannot list pods despite a Role existing',
    ],
    rootCause: 'RBAC works in three parts: Role (defines permissions), RoleBinding (grants role to subject), ServiceAccount (the identity). All three must be connected.',
    resolution: [
      'Create a RoleBinding linking restricted-sa to pod-reader Role',
      'Use the RBAC Sandbox to apply the RoleBinding YAML',
      'Verify: kubectl auth can-i list pods --as=system:serviceaccount:default:restricted-sa',
    ],
    hints: [
      'Roles are namespaced; ClusterRoles are cluster-wide',
      'Default deny: no permissions unless explicitly granted',
      'kubectl auth can-i is your best debug tool for RBAC',
    ],
    validate: (state: ClusterState) => {
      return state.roleBindings.some(rb => 
        rb.roleRef.name === 'pod-reader' && 
        rb.subjects.some(s => s.name === 'restricted-sa')
      );
    },
  },
  {
    id: 'network-policy-blocking',
    title: 'NetworkPolicy Blocking Traffic',
    description: 'A deny-all ingress NetworkPolicy silently drops requests to the backend.',
    difficulty: 'advanced',
    category: 'Networking',
    trigger: 'NetworkPolicy "deny-all-ingress" applied with empty ingress rules',
    symptoms: [
      'HTTP requests from frontend to backend time out',
      'Pod-to-pod ping fails within the same namespace',
      'No Service errors — traffic is dropped at pod level',
    ],
    rootCause: 'A NetworkPolicy with empty ingress: [] selects all pods and denies all ingress. Traffic must be explicitly allowed.',
    resolution: [
      'Apply an allow-ingress NetworkPolicy permitting frontend → backend traffic',
      'Or delete the deny-all policy (emergency fix)',
      'Selector tip: use podSelector to target only the backend, not all pods',
    ],
    hints: [
      'NetworkPolicies are additive: multiple policies combine with OR logic',
      'Empty podSelector {} matches all pods in the namespace',
      'Test with: kubectl exec <frontend-pod> -- curl <backend-pod-ip>:8080',
    ],
    validate: (state: ClusterState) => {
      const denyPol = state.networkPolicies.find(np => np.name === 'deny-all-ingress');
      if (!denyPol) return true; // user deleted it
      const allowPol = state.networkPolicies.find(np => np.name !== 'deny-all-ingress' && np.ingress?.length);
      return !!allowPol;
    },
  },
];
