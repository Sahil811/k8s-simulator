import { v4 as uuidv4 } from 'uuid';
import { produce } from 'immer';
import type { ClusterState, Pod, K8sNode, ReplicaSet, ExplanationEntry } from '../types/k8s';

export type { ClusterState };

// ===== INITIAL STATE =====
export function createInitialClusterState(): ClusterState {
  const now = Date.now();
  const node1: K8sNode = {
    id: 'node-1',
    name: 'node-1',
    status: 'Ready',
    labels: { 'kubernetes.io/hostname': 'node-1', 'node-role': 'worker' },
    taints: [],
    capacity: { cpu: 4000, memory: 8192 },
    allocatable: { cpu: 3800, memory: 7680 },
    used: { cpu: 0, memory: 0 },
    createdAt: now,
    lastHeartbeat: now,
    conditions: [{ type: 'Ready', status: 'True' }],
  };
  const node2: K8sNode = {
    id: 'node-2',
    name: 'node-2',
    status: 'Ready',
    labels: { 'kubernetes.io/hostname': 'node-2', 'node-role': 'worker' },
    taints: [],
    capacity: { cpu: 4000, memory: 8192 },
    allocatable: { cpu: 3800, memory: 7680 },
    used: { cpu: 0, memory: 0 },
    createdAt: now,
    lastHeartbeat: now,
    conditions: [{ type: 'Ready', status: 'True' }],
  };

  return {
    nodes: [node1, node2],
    pods: [],
    replicaSets: [],
    deployments: [],
    statefulSets: [],
    daemonSets: [],
    services: [],
    ingresses: [],
    pvs: [
      {
        id: uuidv4(),
        name: 'pv-fast-10g',
        capacity: 10,
        accessModes: ['ReadWriteOnce'],
        reclaimPolicy: 'Retain',
        storageClassName: 'fast',
        phase: 'Available',
        createdAt: now,
      }
    ],
    pvcs: [],
    networkPolicies: [],
    roles: [],
    roleBindings: [],
    serviceAccounts: [
      { id: uuidv4(), name: 'default', namespace: 'default', createdAt: now },
    ],
    hpas: [],
    namespaces: ['default', 'kube-system', 'monitoring'],
    events: [],
    tick: 0,
    time: now,
    badImages: [],
    crashingDeployments: [],
  };
}

// ===== HELPER =====
function emitEvent(
  state: ClusterState,
  type: 'Normal' | 'Warning',
  reason: string,
  message: string,
  objectKind: string,
  objectName: string,
  namespace: string,
  source: string
) {
  // Deduplicate: increment count if same recent event
  const existing = state.events.find(
    e => e.reason === reason && e.objectName === objectName && e.message === message
      && Date.now() - e.lastTimestamp < 60000
  );
  if (existing) {
    existing.count++;
    existing.lastTimestamp = Date.now();
    return;
  }
  const now = Date.now();
  state.events.unshift({
    id: uuidv4(),
    type,
    reason,
    message,
    objectKind,
    objectName,
    namespace,
    count: 1,
    firstTimestamp: now,
    lastTimestamp: now,
    source,
  });
  // Keep only last 200 events
  if (state.events.length > 200) state.events.length = 200;
}

function getNodeUsage(state: ClusterState, nodeId: string) {
  let cpu = 0;
  let memory = 0;
  for (const pod of state.pods) {
    if (pod.nodeName === nodeId && pod.phase === 'Running') {
      cpu += pod.resources.cpu;
      memory += pod.resources.memory;
    }
  }
  return { cpu, memory };
}

function podMatchesSelector(pod: Pod, selector: Record<string, string>) {
  return Object.entries(selector).every(([k, v]) => pod.labels[k] === v);
}

function podSpreadScore(pod: Pod, node: K8sNode, state: ClusterState): number {
  if (!pod.ownerRef) return 1.0;
  
  // Count how many pods of the SAME owner are on THIS node vs other nodes
  const siblingPods = state.pods.filter(p => 
    p.ownerRef?.uid === pod.ownerRef?.uid && p.phase !== 'Terminating' && p.nodeName
  );
  
  if (siblingPods.length === 0) return 1.0;
  
  const podsOnThisNode = siblingPods.filter(p => p.nodeName === node.id).length;
  // If all siblings are on this node, score is 0. If 0 siblings on this node, score is 1.
  return Math.max(0, 1.0 - (podsOnThisNode / siblingPods.length));
}

function selectNode(pod: Pod, state: ClusterState): { node: K8sNode | null, reason?: string } {
  const failureReasons: Record<string, number> = {};
  const candidates: K8sNode[] = [];

  for (const node of state.nodes) {
    if (node.status !== 'Ready') {
      failureReasons['node(s) were not ready'] = (failureReasons['node(s) were not ready'] || 0) + 1;
      continue;
    }
    
    // Check taints
    let taintFailed = false;
    for (const taint of node.taints) {
      if (taint.effect === 'NoSchedule' || taint.effect === 'NoExecute') {
        const tolerated = pod.tolerations.some(t => {
          if (t.operator === 'Exists') return t.key === undefined || t.key === taint.key;
          return t.key === taint.key && t.value === taint.value;
        });
        if (!tolerated) {
          taintFailed = true;
          break;
        }
      }
    }
    if (taintFailed) {
      failureReasons["node(s) had taint that the pod didn't tolerate"] = (failureReasons["node(s) had taint that the pod didn't tolerate"] || 0) + 1;
      continue;
    }

    // Node selector
    let selectorFailed = false;
    if (pod.nodeSelector) {
      for (const [k, v] of Object.entries(pod.nodeSelector)) {
        if (node.labels[k] !== v) {
          selectorFailed = true;
          break;
        }
      }
    }
    if (selectorFailed) {
      failureReasons["node(s) didn't match Pod's node affinity/selector"] = (failureReasons["node(s) didn't match Pod's node affinity/selector"] || 0) + 1;
      continue;
    }

    // Resource fit
    const usage = getNodeUsage(state, node.id);
    if ((usage.cpu + pod.resources.cpu) > node.allocatable.cpu) {
      failureReasons["Insufficient cpu"] = (failureReasons["Insufficient cpu"] || 0) + 1;
      continue;
    }
    if ((usage.memory + pod.resources.memory) > node.allocatable.memory) {
      failureReasons["Insufficient memory"] = (failureReasons["Insufficient memory"] || 0) + 1;
      continue;
    }

    candidates.push(node);
  }

  // If no node passes filter
  if (candidates.length === 0) {
    const total = state.nodes.length;
    const parts = Object.entries(failureReasons).map(([msg, count]) => `${count} ${msg}`);
    return { node: null, reason: `0/${total} nodes are available: ${parts.join(', ')}.` };
  }

  // SCORE
  const scored = candidates.map(node => {
    const usage = getNodeUsage(state, node.id);
    const cpuHeadroom = (node.allocatable.cpu - usage.cpu) / node.allocatable.cpu; // 0.0 to 1.0
    const memHeadroom = (node.allocatable.memory - usage.memory) / node.allocatable.memory; // 0.0 to 1.0
    const spreadScore = podSpreadScore(pod, node, state);

    const finalScore = (cpuHeadroom * 0.4) + (memHeadroom * 0.4) + (spreadScore * 0.2);
    return { node, score: finalScore };
  });

  // BIND (highest scoring)
  scored.sort((a, b) => b.score - a.score);
  return { node: scored[0].node };
}

// ===== CONTROLLERS =====

function reconcileDeployments(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const dep of state.deployments) {
    const currentRS = state.replicaSets.find(rs => rs.ownerRef?.name === dep.name
      && rs.namespace === dep.namespace
      && rs.ownerRef?.kind === 'Deployment');

    if (!currentRS) {
      // Create a new ReplicaSet
      const rsName = `${dep.name}-${Math.random().toString(36).slice(2, 7)}`;
      const newRS: ReplicaSet = {
        id: uuidv4(),
        name: rsName,
        namespace: dep.namespace,
        labels: { ...dep.template.metadata.labels },
        selector: dep.selector,
        replicas: dep.replicas,
        readyReplicas: 0,
        availableReplicas: 0,
        podTemplate: {
          namespace: dep.namespace,
          labels: { ...dep.template.metadata.labels },
          containers: dep.template.spec.containers,
          tolerations: dep.template.spec.tolerations || [],
          nodeSelector: dep.template.spec.nodeSelector,
          resources: dep.template.spec.resources || { cpu: 100, memory: 128 },
          readinessReady: false,
          _crashCount: 0,
          _imagePullFailing: false,
          _schedulingAttempts: 0,
        },
        ownerRef: { kind: 'Deployment', name: dep.name, uid: dep.id },
        createdAt: Date.now(),
      };
      state.replicaSets.push(newRS);
      dep._currentRSName = rsName;
      emitEvent(state, 'Normal', 'ScalingReplicaSet', `Scaled up replica set ${rsName} to ${dep.replicas}`,
        'Deployment', dep.name, dep.namespace, 'deployment-controller');
      explanations.push({
        id: uuidv4(),
        timestamp: Date.now(),
        title: `Deployment "${dep.name}" created ReplicaSet`,
        what: `The Deployment controller detected no existing ReplicaSet for this deployment.`,
        controller: 'DeploymentController',
        action: `Created ReplicaSet "${rsName}" with ${dep.replicas} replicas`,
        why: `Every Deployment manages one or more ReplicaSets. The ReplicaSet is the actual mechanism that creates and counts Pods. The Deployment delegates Pod-count management to the ReplicaSet so it can do rolling updates by swapping RSes.`,
        objectKind: 'Deployment',
        objectName: dep.name,
      });
    } else {
      // Sync desired replicas
      if (currentRS.replicas !== dep.replicas) {
        const oldCount = currentRS.replicas;
        currentRS.replicas = dep.replicas;
        emitEvent(state, 'Normal', 'ScalingReplicaSet',
          `Scaled replica set ${currentRS.name} from ${oldCount} to ${dep.replicas}`,
          'Deployment', dep.name, dep.namespace, 'deployment-controller');
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `Deployment "${dep.name}" scaled replicas`,
          what: `Desired replicas changed from ${oldCount} to ${dep.replicas}`,
          controller: 'DeploymentController',
          action: `Updated ReplicaSet "${currentRS.name}" desired count to ${dep.replicas}`,
          why: `The DeploymentController compares spec.replicas to the owning ReplicaSet's replicas each reconcile loop. When they differ, it patches the RS, which then adds/removes Pods.`,
          objectKind: 'Deployment',
          objectName: dep.name,
        });
      }
      // Update deployment status
      dep.status.replicas = currentRS.replicas;
      dep.status.readyReplicas = currentRS.readyReplicas;
    }
  }
}

function reconcileReplicaSets(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const rs of state.replicaSets) {
    const owned = state.pods.filter(p => p.ownerRef?.name === rs.name && p.namespace === rs.namespace);
    // Count active = not in a terminal state
    const activeCount = owned.filter(p =>
      p.phase !== 'Failed' && p.phase !== 'Succeeded' && p.phase !== 'Terminating'
    ).length;
    const diff = rs.replicas - activeCount;

    // Is any pod image in the bad images list?
    const podImage = rs.podTemplate.containers[0]?.image ?? '';
    const isImageBad = state.badImages.includes(podImage);

    if (diff > 0) {
      // Create missing pods
      for (let i = 0; i < diff; i++) {
        const podName = `${rs.name}-${Math.random().toString(36).slice(2, 7)}`;
        const newPod: Pod = {
          id: uuidv4(),
          name: podName,
          namespace: rs.namespace,
          labels: { ...rs.podTemplate.labels },
          phase: 'Pending',
          containers: rs.podTemplate.containers.map(c => ({ ...c })),
          ownerRef: { kind: 'ReplicaSet', name: rs.name, uid: rs.id },
          status: {
            containerStatuses: rs.podTemplate.containers.map(c => ({
              name: c.name,
              ready: false,
              restartCount: 0,
              state: 'waiting' as const,
              reason: 'ContainerCreating',
            })),
            conditions: [],
          },
          resources: rs.podTemplate.resources || { cpu: 100, memory: 128 },
          tolerations: rs.podTemplate.tolerations || [],
          nodeSelector: rs.podTemplate.nodeSelector,
          createdAt: Date.now(),
          readinessReady: false,
          _crashCount: 0,
          _imagePullFailing: isImageBad,
          _schedulingAttempts: 0,
        };
        state.pods.push(newPod);
        emitEvent(state, 'Normal', 'SuccessfulCreate', `Created pod: ${podName}`,
          'ReplicaSet', rs.name, rs.namespace, 'replicaset-controller');
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `ReplicaSet "${rs.name}" created Pod`,
          what: `Only ${activeCount} Pods exist, but ${rs.replicas} are desired.`,
          controller: 'ReplicaSetController',
          action: `Created Pod "${podName}" in Pending state`,
          why: `The ReplicaSetController sees a deficit of ${diff} Pod(s). It creates new Pod objects with Pending phase. The Scheduler will then pick them up and assign them to nodes.`,
          objectKind: 'ReplicaSet',
          objectName: rs.name,
        });
      }
    } else if (diff < 0) {
      // Delete excess pods (newest first)
      const toDelete = owned
        .filter(p => p.phase !== 'Terminating')
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, -diff);
      for (const pod of toDelete) {
        pod.phase = 'Terminating';
        pod.deletionTimestamp = state.time;
        emitEvent(state, 'Normal', 'SuccessfulDelete', `Deleted pod: ${pod.name}`,
          'ReplicaSet', rs.name, rs.namespace, 'replicaset-controller');
      }
    }

    // Update ready counts
    rs.readyReplicas = owned.filter(p => p.readinessReady && p.phase === 'Running').length;
    rs.availableReplicas = rs.readyReplicas;
  }
}

function reconcileScheduler(state: ClusterState, explanations: ExplanationEntry[]) {
  const pendingPods = state.pods.filter(p => p.phase === 'Pending' && !p.nodeName);

  for (const pod of pendingPods) {
    pod._schedulingAttempts++;

    // Check if this pod's image is in the bad images list
    const podImage = pod.containers[0]?.image ?? '';
    if (state.badImages.includes(podImage) || pod._imagePullFailing) {
      pod._imagePullFailing = true;
      pod.status.containerStatuses.forEach(cs => {
        cs.state = 'waiting';
        cs.reason = pod._schedulingAttempts > 3 ? 'ImagePullBackOff' : 'ErrImagePull';
        cs.message = `Failed to pull image "${podImage}": rpc error: code = NotFound`;
      });
      if (pod._schedulingAttempts === 1) {
        emitEvent(state, 'Warning', 'Failed',
          `Failed to pull image "${podImage}": rpc error: code = NotFound desc = failed to pull and unpack image: not found`,
          'Pod', pod.name, pod.namespace, 'kubelet');
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `Pod "${pod.name}" cannot pull image`,
          what: `The container image "${podImage}" cannot be pulled from the registry.`,
          controller: 'Kubelet (image pull)',
          action: `Pod container status set to ErrImagePull → ImagePullBackOff`,
          why: `The kubelet on each node is responsible for pulling container images. When the image doesn't exist, has a wrong tag, or requires registry credentials, the pull fails. After repeated failures, Kubernetes applies exponential backoff — hence "BackOff". Check: 1) Image name/tag is correct 2) Registry credentials (imagePullSecrets) 3) Registry is reachable from the node.`,
          objectKind: 'Pod',
          objectName: pod.name,
        });
      } else if (pod._schedulingAttempts % 6 === 0) {
        emitEvent(state, 'Warning', 'BackOff',
          `Back-off pulling image "${podImage}"`,
          'Pod', pod.name, pod.namespace, 'kubelet');
      }
      continue;
    }

    const { node, reason } = selectNode(pod, state);
    if (!node) {
      pod.phase = 'Pending';
      if (pod._schedulingAttempts === 1 || pod._schedulingAttempts % 10 === 0) {
        emitEvent(state, 'Warning', 'FailedScheduling', reason || 'Unschedulable', 'Pod', pod.name, pod.namespace, 'default-scheduler');
        if (pod._schedulingAttempts === 1) {
          explanations.push({
            id: uuidv4(),
            timestamp: Date.now(),
            title: `Pod "${pod.name}" cannot be scheduled`,
            what: reason || 'Unschedulable',
            controller: 'Scheduler',
            action: `Pod remains in Pending phase`,
            why: `The Schedule algorithm filtered out all nodes. Reason: ${reason}. You must adjust the pod's resources, tolerations, or node selectors to fit the constraints, or add a matching node.`,
            objectKind: 'Pod',
            objectName: pod.name,
          });
        }
      }
      continue;
    }

    pod.nodeName = node.id;
    pod.phase = 'Pending';
    pod.startedAt = Date.now();
    emitEvent(state, 'Normal', 'Scheduled', `Successfully assigned ${pod.namespace}/${pod.name} to ${node.name}`,
      'Pod', pod.name, pod.namespace, 'default-scheduler');
    explanations.push({
      id: uuidv4(),
      timestamp: Date.now(),
      title: `Scheduler assigned Pod "${pod.name}" → ${node.name}`,
      what: `A Pending pod was found without a node assignment.`,
      controller: 'Scheduler',
      action: `Assigned pod to node "${node.name}"`,
      why: `The Scheduler filters all nodes through predicates (resource fit, taint tolerations, affinity rules) to get feasible nodes, then scores them to pick the best fit. "${node.name}" had the most available capacity. The scheduler writes nodeName to the Pod spec — after this, the kubelet on that node takes over.`,
      objectKind: 'Pod',
      objectName: pod.name,
    });
  }
}

function reconcileKubelet(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const pod of state.pods) {
    if (pod.phase === 'Terminating' || pod.phase === 'Succeeded') continue;

    // Pods that haven't been scheduled yet but have a bad image stay Pending with error
    if (!pod.nodeName && pod._imagePullFailing) {
      pod._schedulingAttempts++;
      pod.status.containerStatuses.forEach(cs => {
        cs.state = 'waiting';
        cs.reason = pod._schedulingAttempts > 3 ? 'ImagePullBackOff' : 'ErrImagePull';
      });
      continue;
    }

    if (!pod.nodeName) continue;

    const node = state.nodes.find(n => n.id === pod.nodeName);
    if (!node || node.status === 'NotReady') continue;

    // Image pull failure (after scheduling, kubelet tries to pull)
    if (pod._imagePullFailing) {
      pod._crashCount++;
      pod.status.containerStatuses.forEach(cs => {
        cs.restartCount = pod._crashCount;
        cs.state = 'waiting';
        cs.reason = pod._crashCount > 1 ? 'ImagePullBackOff' : 'ErrImagePull';
        cs.message = `Failed to pull image "${pod.containers[0]?.image}": not found`;
      });
      if (pod._crashCount === 1) {
        emitEvent(state, 'Warning', 'BackOff',
          `Back-off pulling image "${pod.containers[0]?.image}"`,
          'Pod', pod.name, pod.namespace, 'kubelet');
      }
      continue;
    }

    // Check if this deployment is in crashingDeployments
    const rsName = pod.ownerRef?.name;
    const rs = state.replicaSets.find(r => r.name === rsName);
    const depName = rs?.ownerRef?.name;
    const isCrashLooping = depName ? state.crashingDeployments.includes(depName) : false;

    if (pod.phase === 'Pending' && pod.nodeName) {
      // Simulate image pull + container start (~2 ticks = 1 second)
      if (!pod.startedAt) pod.startedAt = Date.now();
      const elapsed = (Date.now() - pod.startedAt) / 1000;
      if (elapsed > 1.0) {
        if (isCrashLooping) {
          // Container starts then immediately exits
          pod.phase = 'Running';
          pod.status.containerStatuses.forEach(cs => {
            cs.state = 'running';
            cs.reason = undefined;
          });
          // Schedule immediate crash after 1 more tick
          pod.startedAt = Date.now() - 1500;
        } else {
          pod.phase = 'Running';
          pod.status.containerStatuses.forEach(cs => {
            cs.state = 'running';
            cs.reason = undefined;
          });
          emitEvent(state, 'Normal', 'Started', `Started container ${pod.containers[0]?.name}`,
            'Pod', pod.name, pod.namespace, 'kubelet');
        }
      }
      continue;
    }

    if (pod.phase === 'Running') {
      // CrashLoop simulation: if this deployment is set to crash, kill the container
      if (isCrashLooping) {
        const runTime = pod.startedAt ? (Date.now() - pod.startedAt) / 1000 : 0;
        if (runTime > 1.5) {
          pod.phase = 'Running'; // stays Running but container terminates
          pod._crashCount++;
          const BACKOFF_SECONDS = [10, 20, 40, 80, 160, 300];
          const backoff = BACKOFF_SECONDS[Math.min(pod._crashCount - 1, BACKOFF_SECONDS.length - 1)];
          pod.status.containerStatuses.forEach(cs => {
            cs.state = 'waiting';
            cs.reason = pod._crashCount >= 2 ? 'CrashLoopBackOff' : 'Error';
            cs.restartCount = pod._crashCount;
            cs.message = `Back-off ${backoff}s restarting failed container`;
          });
          pod.readinessReady = false;
          pod.startedAt = Date.now() + backoff * 1000; // delay next start

          if (pod._crashCount === 1) {
            emitEvent(state, 'Warning', 'BackOff',
              `Back-off restarting failed container`,
              'Pod', pod.name, pod.namespace, 'kubelet');
            emitEvent(state, 'Warning', 'Failed',
              `Error: container exited with code 1`,
              'Pod', pod.name, pod.namespace, 'kubelet');
            explanations.push({
              id: uuidv4(),
              timestamp: Date.now(),
              title: `Pod "${pod.name}" is CrashLoopBackOff`,
              what: `The container started but exited immediately with exit code 1.`,
              controller: 'Kubelet',
              action: `Container restarted; applying exponential backoff (next: ${backoff}s)`,
              why: `CrashLoopBackOff means the container is repeatedly crashing. Kubernetes applies exponential backoff (10s → 20s → 40s → ... → 5min) before each restart. Each restart increments the RESTARTS counter. Use 'kubectl logs <pod> --previous' to see what crashed. Common causes: bad entrypoint, missing config, failing liveness probe.`,
              objectKind: 'Pod',
              objectName: pod.name,
            });
          }
        }
        continue;
      }

      // Check for OOM
      const limit = pod.containers[0]?.resources?.limits?.memory;
      const usage = getNodeUsage(state, node.id);
      if (limit && usage.memory > node.allocatable.memory * 0.95) {
        pod.phase = 'Failed';
        pod.status.containerStatuses.forEach(cs => {
          cs.state = 'terminated';
          cs.reason = 'OOMKilled';
          cs.restartCount++;
        });
        emitEvent(state, 'Warning', 'OOMKilling',
          `Memory cgroup out of memory: Kill process in container ${pod.containers[0]?.name}`,
          'Pod', pod.name, pod.namespace, 'kubelet');
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `Pod "${pod.name}" OOMKilled`,
          what: `Container exceeded its memory limit and was killed by the kernel OOM killer.`,
          controller: 'Kubelet / Linux Kernel',
          action: `Terminated container with exit code 137 (OOMKilled)`,
          why: `Kubernetes enforces memory limits via Linux cgroups. When a container exceeds its memory limit, the kernel OOM killer terminates it. This pod will restart (CrashLoopBackOff if it keeps dying). Fix: increase memory limits, or fix a memory leak in the application.`,
          objectKind: 'Pod',
          objectName: pod.name,
        });
        continue;
      }

      // Readiness probe logic
      const container = pod.containers[0];
      if (container?.readinessProbe) {
        const probe = container.readinessProbe;
        if (probe._failCount !== undefined && probe._failCount >= (probe.failureThreshold || 3)) {
          pod.readinessReady = false;
          pod.status.containerStatuses.forEach(cs => cs.ready = false);
        } else {
          pod.readinessReady = true;
          pod.status.containerStatuses.forEach(cs => cs.ready = true);
        }
      } else {
        pod.readinessReady = true;
        pod.status.containerStatuses.forEach(cs => cs.ready = true);
      }
    }
  }
}

function reconcileServices(state: ClusterState) {
  for (const svc of state.services) {
    const readyPods = state.pods.filter(p =>
      p.namespace === svc.namespace
      && p.phase === 'Running'
      && p.readinessReady
      && podMatchesSelector(p, svc.selector)
    );
    svc.endpoints = readyPods.map(p => p.id);
  }
}

function reconcileStatefulSets(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const sts of state.statefulSets) {
    const owned = state.pods.filter(p => p.ownerRef?.name === sts.name && p.namespace === sts.namespace);
    const active = owned.filter(p => p.phase !== 'Failed' && p.phase !== 'Succeeded' && p.phase !== 'Terminating');
    
    // Sort active by index
    active.sort((a, b) => {
      const idxA = parseInt(a.name.split('-').pop() || '0');
      const idxB = parseInt(b.name.split('-').pop() || '0');
      return idxA - idxB;
    });

    const isImageBad = state.badImages.includes(sts.template.spec.containers[0]?.image ?? '');

    // Check if we need to scale up
    if (active.length < sts.replicas) {
      // Create ONE pod at a time, strictly ordered
      let creatingOrWaiting = false;
      for (let i = 0; i < sts.replicas; i++) {
        const podName = `${sts.name}-${i}`;
        const existing = state.pods.find(p => p.name === podName && p.namespace === sts.namespace && p.phase !== 'Terminating');
        
        if (!existing) {
          if (creatingOrWaiting) break; // Strict ordering: wait for previous to be ready or created
          
          const newPod: Pod = {
            id: uuidv4(),
            name: podName,
            namespace: sts.namespace,
            labels: { ...sts.template.metadata.labels },
            phase: 'Pending',
            containers: sts.template.spec.containers.map(c => ({ ...c })),
            ownerRef: { kind: 'StatefulSet', name: sts.name, uid: sts.id },
            status: {
              containerStatuses: sts.template.spec.containers.map(c => ({
                name: c.name, ready: false, restartCount: 0, state: 'waiting' as const, reason: 'ContainerCreating'
              })),
              conditions: [],
            },
            resources: sts.template.spec.resources || { cpu: 100, memory: 128 },
            tolerations: sts.template.spec.tolerations || [],
            nodeSelector: sts.template.spec.nodeSelector,
            createdAt: Date.now(),
            readinessReady: false,
            _crashCount: 0,
            _imagePullFailing: isImageBad,
            _schedulingAttempts: 0,
          };

          // Also create PVC if volumeClaimTemplates exist
          if (sts.volumeClaimTemplates) {
            for (const vct of sts.volumeClaimTemplates) {
              const pvcName = `${vct.metadata.name}-${podName}`;
              const exists = state.pvcs.find(p => p.name === pvcName && p.namespace === sts.namespace);
              if (!exists) {
                state.pvcs.push({
                  id: uuidv4(),
                  name: pvcName,
                  namespace: sts.namespace,
                  accessModes: vct.spec.accessModes as any,
                  requestedStorage: parseInt(vct.spec.resources.requests.storage.replace(/\\D/g, '')) * 1024 || 1024,
                  phase: 'Pending',
                  storageClassName: 'standard',
                  createdAt: Date.now(),
                });
              }
            }
          }

          state.pods.push(newPod);
          explanations.push({
            id: uuidv4(),
            timestamp: Date.now(),
            title: `StatefulSet "${sts.name}" created Pod`,
            what: `Created Pod "${podName}"`,
            controller: 'StatefulSet',
            action: `Created Pod "${podName}" in sequence`,
            why: `StatefulSets create pods in strict sequential order. This ensures predictable identities and data attachment.`,
            objectKind: 'StatefulSet',
            objectName: sts.name,
          });
          creatingOrWaiting = true;
          break; // only create one
        } else if (!existing.readinessReady) {
          creatingOrWaiting = true;
          break; // Strict ordering: wait for it to be ready before creating next
        }
      }
    } else if (active.length > sts.replicas) {
      // Delete highest index first
      let highestIdx = -1;
      let podToDelete: Pod | null = null;
      for (const p of active) {
        const idx = parseInt(p.name.split('-').pop() || '0');
        if (idx > highestIdx) {
          highestIdx = idx;
          podToDelete = p;
        }
      }
      if (podToDelete && podToDelete.phase !== 'Terminating') {
        podToDelete.phase = 'Terminating';
        podToDelete.deletionTimestamp = state.time;
      }
    }

    sts.status.replicas = active.length;
    sts.status.readyReplicas = active.filter(p => p.readinessReady).length;
    sts.status.currentReplicas = sts.status.readyReplicas;
  }
}

function reconcileDaemonSets(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const ds of state.daemonSets) {
    let desired = 0;
    let ready = 0;
    const isImageBad = state.badImages.includes(ds.template.spec.containers[0]?.image ?? '');

    for (const node of state.nodes) {
      if (node.status === 'NotReady') continue;

      let selectorMatch = true;
      if (ds.template.spec.nodeSelector) {
        for (const [k, v] of Object.entries(ds.template.spec.nodeSelector)) {
          if (node.labels[k] !== v) {
            selectorMatch = false;
            break;
          }
        }
      }
      if (!selectorMatch) continue;
      
      let taintMatch = true;
      for (const taint of node.taints) {
        if (taint.effect === 'NoSchedule' || taint.effect === 'NoExecute') {
          const tolerated = ds.template.spec.tolerations?.some(t => {
            if (t.operator === 'Exists') return t.key === undefined || t.key === taint.key;
            return t.key === taint.key && t.value === taint.value;
          });
          if (!tolerated) {
            taintMatch = false;
            break;
          }
        }
      }
      if (!taintMatch) continue;

      desired++;

      const podName = `${ds.name}-${node.name}`;
      const existing = state.pods.find(p => p.name === podName && p.namespace === ds.namespace && p.phase !== 'Terminating');

      if (!existing) {
        const newPod: Pod = {
          id: uuidv4(),
          name: podName,
          namespace: ds.namespace,
          labels: { ...ds.template.metadata.labels },
          phase: 'Pending',
          nodeName: node.id, // Bypass scheduler!
          containers: ds.template.spec.containers.map(c => ({ ...c })),
          ownerRef: { kind: 'DaemonSet', name: ds.name, uid: ds.id },
          status: {
            containerStatuses: ds.template.spec.containers.map(c => ({
              name: c.name, ready: false, restartCount: 0, state: 'waiting' as const, reason: 'ContainerCreating'
            })),
            conditions: [],
          },
          resources: ds.template.spec.resources || { cpu: 50, memory: 64 },
          tolerations: ds.template.spec.tolerations || [],
          createdAt: Date.now(),
          readinessReady: false,
          _crashCount: 0,
          _imagePullFailing: isImageBad,
          _schedulingAttempts: 1, // Skip scheduler
        };
        state.pods.push(newPod);
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `DaemonSet "${ds.name}" scheduled Pod`,
          what: `Created Pod "${podName}" on node "${node.name}"`,
          controller: 'DaemonSet',
          action: `Bypassed scheduler to assign Pod to Node`,
          why: `DaemonSets ensure a copy of a pod runs on all matching nodes, useful for log aggregators or monitoring agents.`,
          objectKind: 'DaemonSet',
          objectName: ds.name,
        });
        explanations.push({
          id: uuidv4(),
          timestamp: Date.now(),
          title: `DaemonSet "${ds.name}" scheduled Pod`,
          what: `Created Pod "${podName}" on node "${node.name}"`,
          controller: 'DaemonSet',
          action: `Bypassed scheduler to assign Pod to Node`,
          why: `DaemonSets ensure a copy of a pod runs on all matching nodes, useful for log aggregators or monitoring agents.`,
          objectKind: 'DaemonSet',
          objectName: ds.name,
        });
      } else if (existing.readinessReady) {
        ready++;
      }
    }

    const owned = state.pods.filter(p => p.ownerRef?.name === ds.name && p.namespace === ds.namespace && p.phase !== 'Terminating');
    for (const pod of owned) {
      if (!pod.nodeName) continue;
      const node = state.nodes.find(n => n.id === pod.nodeName);
      let shouldDelete = false;

      if (!node) {
        shouldDelete = true;
      } else if (node.status === 'NotReady') {
        shouldDelete = true;
      } else {
        if (ds.template.spec.nodeSelector) {
          for (const [k, v] of Object.entries(ds.template.spec.nodeSelector)) {
            if (node.labels[k] !== v) shouldDelete = true;
          }
        }
        for (const taint of node.taints) {
          if (taint.effect === 'NoSchedule' || taint.effect === 'NoExecute') {
            const tolerated = ds.template.spec.tolerations?.some(t => {
              if (t.operator === 'Exists') return t.key === undefined || t.key === taint.key;
              return t.key === taint.key && t.value === taint.value;
            });
            if (!tolerated) shouldDelete = true;
          }
        }
      }

      if (shouldDelete) {
        pod.phase = 'Terminating';
        pod.deletionTimestamp = state.time;
      }
    }

    ds.status.desiredNumberScheduled = desired;
    ds.status.currentNumberScheduled = owned.filter(p => p.phase !== 'Terminating').length;
    ds.status.numberReady = ready;
  }
}

function reconcilePVCs(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const pvc of state.pvcs) {
    if (pvc.phase !== 'Pending') continue;
    // Find matching PV
    const matchingPV = state.pvs.find(pv =>
      pv.phase === 'Available'
      && pv.storageClassName === pvc.storageClassName
      && pv.capacity >= pvc.requestedStorage
      && pv.accessModes.some(m => pvc.accessModes.includes(m))
    );
    if (matchingPV) {
      pvc.phase = 'Bound';
      pvc.boundTo = matchingPV.id;
      matchingPV.phase = 'Bound';
      matchingPV.boundTo = pvc.id;
      emitEvent(state, 'Normal', 'Provisioning', `Bound claim ${pvc.name} to volume ${matchingPV.name}`,
        'PersistentVolumeClaim', pvc.name, pvc.namespace, 'persistentvolume-controller');
      explanations.push({
        id: uuidv4(),
        timestamp: Date.now(),
        title: `PVC "${pvc.name}" bound to PV "${matchingPV.name}"`,
        what: `A PersistentVolumeClaim was successfully matched to an available PersistentVolume.`,
        controller: 'PersistentVolumeController',
        action: `PVC phase changed Pending → Bound; PV phase changed Available → Bound`,
        why: `The PV controller finds PVs matching the PVC's storageClassName, access modes, and size. Once bound, the storage is exclusively reserved for this PVC. Pods referencing this PVC can now mount the volume.`,
        objectKind: 'PersistentVolumeClaim',
        objectName: pvc.name,
      });
    } else if (pvc.storageClassName === 'standard') {
      // Dynamic provisioning for standard built-in storage class
      const newPVId = uuidv4();
      const pvName = `pvc-${newPVId.substring(0, 8)}`;
      state.pvs.push({
        id: newPVId,
        name: pvName,
        capacity: pvc.requestedStorage,
        accessModes: pvc.accessModes,
        reclaimPolicy: 'Delete', // default for dynamically provisioned
        storageClassName: pvc.storageClassName,
        phase: 'Bound',
        boundTo: pvc.id,
        createdAt: Date.now(),
      });
      pvc.phase = 'Bound';
      pvc.boundTo = newPVId;
      emitEvent(state, 'Normal', 'ProvisioningSucceeded', `Successfully provisioned volume ${pvName} for ${pvc.name}`,
        'PersistentVolumeClaim', pvc.name, pvc.namespace, 'persistentvolume-controller');
      explanations.push({
        id: uuidv4(),
        timestamp: Date.now(),
        title: `Dynamic PV Provisioned for "${pvc.name}"`,
        what: `A new PersistentVolume "${pvName}" was dynamically created to satisfy the claim.`,
        controller: 'PersistentVolumeController',
        action: `Provisioned PV and bound PVC`,
        why: `Because the PVC requested the 'standard' StorageClass and no statically provisioned matching PV was found, the cluster's provisioner created a new PV on the fly. This happens in cloud providers like AWS (EBS), GCP (PD), or local provisioners.`,
        objectKind: 'PersistentVolumeClaim',
        objectName: pvc.name,
      });
    } else {
      // Failed to match or provision
      emitEvent(state, 'Warning', 'ProvisioningFailed',
        `storageclass "${pvc.storageClassName}": no matching PersistentVolume found`,
        'PersistentVolumeClaim', pvc.name, pvc.namespace, 'persistentvolume-controller');
    }
  }

  // Handle PV reclaiming
  for (const pv of state.pvs) {
    if (pv.phase === 'Bound' && pv.boundTo) {
      // Is the PVC deleted?
      const pvc = state.pvcs.find(p => p.id === pv.boundTo);
      if (!pvc) {
        // PVC is gone, release PV
        pv.phase = 'Released';
        
        if (pv.reclaimPolicy === 'Delete') {
          pv.phase = 'Failed'; // Mark it dynamically so we can clean it up
          emitEvent(state, 'Normal', 'VolumeDeleted', `Successfully deleted volume ${pv.name} (reclaim policy Delete)`,
            'PersistentVolume', pv.name, 'default', 'persistentvolume-controller');
        } else if (pv.reclaimPolicy === 'Retain') {
          emitEvent(state, 'Normal', 'VolumeRetained', `Volume ${pv.name} retained (reclaim policy Retain)`,
            'PersistentVolume', pv.name, 'default', 'persistentvolume-controller');
        }
      }
    }
  }

  // Cleanup PVs marked for Delete
  state.pvs = state.pvs.filter(pv => pv.phase !== 'Failed');
}

function reconcileHPA(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const hpa of state.hpas) {
    if (!hpa.metricsAvailable) {
      emitEvent(state, 'Warning', 'FailedGetResourceMetric',
        'unable to get metrics for resource cpu: unable to fetch metrics from resource metrics API',
        'HorizontalPodAutoscaler', hpa.name, hpa.namespace, 'horizontal-pod-autoscaler');
      continue;
    }

    const dep = state.deployments.find(d =>
      d.name === hpa.scaleTargetRef.name && d.namespace === hpa.namespace
    );
    if (!dep) continue;

    const cpuUtil = hpa.currentMetrics?.cpu ?? 0;
    const targetUtil = hpa.metrics[0]?.resource.targetAverageUtilization ?? 80;
    const ratio = cpuUtil / targetUtil;
    const desired = Math.max(hpa.minReplicas, Math.min(hpa.maxReplicas, Math.ceil(dep.replicas * ratio)));

    hpa.currentReplicas = dep.replicas;
    hpa.desiredReplicas = desired;

    const cooldown = 60000; // 60s
    const sinceLast = hpa.lastScaleTime ? Date.now() - hpa.lastScaleTime : Infinity;

    if (desired !== dep.replicas && sinceLast > cooldown) {
      const oldReplicas = dep.replicas;
      dep.replicas = desired;
      hpa.lastScaleTime = Date.now();
      emitEvent(state, 'Normal', 'SuccessfulRescale',
        `New size: ${desired}; reason: cpu resource utilization (percentage of request) above target`,
        'HorizontalPodAutoscaler', hpa.name, hpa.namespace, 'horizontal-pod-autoscaler');
      explanations.push({
        id: uuidv4(),
        timestamp: Date.now(),
        title: `HPA "${hpa.name}" scaled Deployment`,
        what: `CPU utilization is ${cpuUtil}%, target is ${targetUtil}%`,
        controller: 'HPAController',
        action: `Scaled "${dep.name}" from ${oldReplicas} → ${desired} replicas`,
        why: `The HPA controller computes desired replicas = ceil(currentReplicas × currentMetric / targetMetric). A 60-second scale-down cooldown prevents thrashing. The HPA then patches the Deployment's replicas field, which propagates to the ReplicaSet and creates/deletes Pods.`,
        objectKind: 'HorizontalPodAutoscaler',
        objectName: hpa.name,
      });
    }
  }
}

function reconcileNodes(state: ClusterState, explanations: ExplanationEntry[]) {
  for (const node of state.nodes) {
    node.used = getNodeUsage(state, node.id);
    // Update heartbeat for ready nodes
    if (node.status === 'Ready') {
      node.lastHeartbeat = Date.now();
    }
    // Evict pods from NotReady nodes
    if (node.status === 'NotReady') {
      const elapsed = Date.now() - node.lastHeartbeat;
      if (elapsed > 5000) { // 5s threshold (real k8s = 5min)
        const nodePods = state.pods.filter(p => p.nodeName === node.id && p.phase !== 'Terminating');
        for (const pod of nodePods) {
          if (pod.phase === 'Running' || pod.phase === 'Pending') {
            pod.phase = 'Failed';
            pod.status.containerStatuses.forEach(cs => cs.reason = 'NodeLost');
            emitEvent(state, 'Warning', 'NodeNotReady',
              `Node ${node.name} is not ready`,
              'Pod', pod.name, pod.namespace, 'node-lifecycle-controller');
          }
        }
        if (nodePods.length > 0) {
          explanations.push({
            id: uuidv4(),
            timestamp: Date.now(),
            title: `Node "${node.name}" evicting pods`,
            what: `Node has been NotReady for >5 seconds, triggering pod eviction.`,
            controller: 'NodeLifecycleController',
            action: `${nodePods.length} pods evicted, will be rescheduled on healthy nodes`,
            why: `The NodeLifecycleController monitors node heartbeats (updated by kubelet). After node-monitor-grace-period (default 40s, here 5s for simulation), pods are marked Unknown and eventually evicted. The ReplicaSet controller then creates replacement pods on healthy nodes.`,
            objectKind: 'Node',
            objectName: node.name,
          });
        }
      }
    }
  }
}

// ===== MAIN RECONCILE LOOP =====
export function reconcile(
  state: ClusterState,
  explanations: ExplanationEntry[]
): ClusterState {
  return produce(state, draft => {
    draft.tick += 1;
    draft.time = Date.now();

    // Cleanup terminated pods based on grace period
    draft.pods = draft.pods.filter(p => {
      if (p.deletionTimestamp && draft.time >= p.deletionTimestamp + 5000) {
        return false;
      }
      return true;
    });

    reconcileDeployments(draft, explanations);
    reconcileReplicaSets(draft, explanations);
    reconcileStatefulSets(draft, explanations);
    reconcileDaemonSets(draft, explanations);
    reconcileScheduler(draft, explanations);
    reconcileKubelet(draft, explanations);
    reconcileServices(draft);
    reconcilePVCs(draft, explanations);
    reconcileHPA(draft, explanations);
    reconcileNodes(draft, explanations);
  });
}
