import React, { useState, useRef, useEffect } from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { Pod, ClusterState } from '../types/k8s';

// ─── Output Utilities ──────────────────────────────────────────────

function col(s: string | number, w: number) {
  const str = String(s ?? '');
  return str.length >= w ? str.slice(0, w - 1) + ' ' : str + ' '.repeat(w - str.length);
}

function age(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m${s % 60 > 0 ? `${s % 60}s` : ''}`;
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60) > 0 ? `${Math.floor((s % 3600) / 60)}m` : ''}`;
}

function podStatus(pod: Pod): string {
  const cs = pod.status.containerStatuses[0];
  if (cs?.reason) return cs.reason;
  if (pod.phase === 'Running' && !pod.readinessReady) return 'Running/NotReady';
  return pod.phase;
}

function podReady(pod: Pod): string {
  const total = pod.containers.length;
  const ready = pod.readinessReady && pod.phase === 'Running' ? total : 0;
  return `${ready}/${total}`;
}

// ─── Command Executor ──────────────────────────────────────────────

interface ExecContext {
  cluster: ClusterState;
  deleteResource: (kind: string, name: string, namespace: string) => void;
  setNodeStatus: (nodeId: string, status: 'Ready' | 'NotReady') => void;
  addTaint: (nodeId: string, key: string, value: string, effect: 'NoSchedule' | 'NoExecute') => void;
  removeTaint: (nodeId: string, key: string) => void;
  applyYAML: (yaml: string) => { success: boolean; message: string };
}

function execKubectl(rawCmd: string, store: ExecContext): { lines: OutputLine[] } {
  const { cluster, deleteResource, setNodeStatus, addTaint, removeTaint, applyYAML } = store;
  const tokens = rawCmd.trim().split(/\s+/);
  const cmd = tokens[0]?.toLowerCase();
  const sub = tokens[1]?.toLowerCase();

  if (cmd !== 'kubectl') {
    return { lines: [{ text: `bash: ${cmd}: command not found`, cls: 'err' }] };
  }

  const ns = (() => {
    const idx = tokens.indexOf('-n');
    if (idx !== -1) return tokens[idx + 1] ?? 'default';
    const nsFull = tokens.find(t => t.startsWith('--namespace='));
    if (nsFull) return nsFull.split('=')[1];
    const allIdx = tokens.indexOf('-A') !== -1 || tokens.indexOf('--all-namespaces') !== -1;
    return allIdx ? 'ALL' : 'default';
  })();

  const filterPods = (pods: Pod[]) => ns === 'ALL' ? pods : pods.filter(p => p.namespace === ns);
  const filterByNs = <T extends { namespace: string }>(items: T[]) =>
    ns === 'ALL' ? items : items.filter(i => i.namespace === ns);
  const lines: OutputLine[] = [];
  const out = (text: string, cls?: OutputLine['cls']) => lines.push({ text, cls });
  const header = (text: string) => lines.push({ text, cls: 'header' });

  if (sub === 'get') {
    const resource = tokens[2]?.toLowerCase();
    // target is tokens[3] — used for future: kubectl get pod <name>

    switch (resource) {
      case 'pods':
      case 'po': {
        const pods = filterPods(cluster.pods);
        const showNs = ns === 'ALL';
        header(
          (showNs ? col('NAMESPACE', 16) : '') +
          col('NAME', 36) + col('READY', 7) + col('STATUS', 22) + col('RESTARTS', 9) + 'AGE'
        );
        if (pods.length === 0) {
          out(`No resources found${ns !== 'ALL' ? ` in ${ns} namespace` : ''}.`, 'muted');
        }
        for (const pod of pods) {
          const status = podStatus(pod);
          const restarts = pod.status.containerStatuses[0]?.restartCount ?? 0;
          const isBad = ['Failed', 'ImagePullBackOff', 'ErrImagePull', 'CrashLoopBackOff', 'OOMKilled'].includes(status);
          out(
            (showNs ? col(pod.namespace, 16) : '') +
            col(pod.name, 36) + col(podReady(pod), 7) +
            col(status, 22) + col(restarts, 9) + age(pod.createdAt),
            isBad ? 'err' : status === 'Pending' || status === 'Running/NotReady' ? 'warn' : 'ok'
          );
        }
        break;
      }

      case 'nodes':
      case 'no': {
        header(col('NAME', 20) + col('STATUS', 14) + col('ROLES', 16) + col('AGE', 8) + col('VERSION', 12));
        for (const node of cluster.nodes) {
          out(
            col(node.name, 20) + col(node.status === 'Ready' ? 'Ready' : 'NotReady', 14) +
            col('worker', 16) + col(age(node.createdAt), 8) + col('v1.29.0', 12),
            node.status === 'Ready' ? 'ok' : 'err'
          );
        }
        break;
      }

      case 'deployments':
      case 'deploy':
      case 'deployment': {
        const items = filterByNs(cluster.deployments);
        const showNs = ns === 'ALL';
        header(
          (showNs ? col('NAMESPACE', 16) : '') +
          col('NAME', 28) + col('READY', 8) + col('UP-TO-DATE', 12) + col('AVAILABLE', 10) + 'AGE'
        );
        if (items.length === 0) out(`No resources found${ns !== 'ALL' ? ` in ${ns} namespace` : ''}.`, 'muted');
        for (const dep of items) {
          const ready = dep.status.readyReplicas;
          const desired = dep.replicas;
          out(
            (showNs ? col(dep.namespace, 16) : '') +
            col(dep.name, 28) + col(`${ready}/${desired}`, 8) +
            col(desired, 12) + col(ready, 10) + age(dep.createdAt),
            ready < desired ? 'warn' : 'ok'
          );
        }
        break;
      }

      case 'replicasets':
      case 'rs': {
        const items = filterByNs(cluster.replicaSets);
        header(col('NAME', 36) + col('DESIRED', 9) + col('CURRENT', 9) + col('READY', 7) + 'AGE');
        if (items.length === 0) out('No resources found.', 'muted');
        for (const rs of items) {
          out(col(rs.name, 36) + col(rs.replicas, 9) + col(rs.replicas, 9) + col(rs.readyReplicas, 7) + age(rs.createdAt));
        }
        break;
      }

      case 'services':
      case 'svc':
      case 'service': {
        const items = filterByNs(cluster.services);
        header(col('NAME', 24) + col('TYPE', 14) + col('CLUSTER-IP', 18) + col('PORT(S)', 20) + 'AGE');
        for (const svc of items) {
          const ports = svc.ports.map(p => `${p.port}/${p.protocol}`).join(',') || '<none>';
          out(col(svc.name, 24) + col(svc.type, 14) + col(svc.clusterIP, 18) + col(ports, 20) + age(svc.createdAt));
        }
        break;
      }

      case 'events':
      case 'ev': {
        const events = filterByNs(cluster.events.map(e => ({ ...e, namespace: e.namespace })));
        header(col('LAST SEEN', 10) + col('TYPE', 10) + col('REASON', 22) + col('OBJECT', 36) + 'MESSAGE');
        for (const ev of events.slice(0, 25)) {
          const objStr = `${ev.objectKind.toLowerCase()}/${ev.objectName}`;
          const shortMsg = ev.message.slice(0, 60);
          out(
            col(age(ev.lastTimestamp), 10) + col(ev.type, 10) +
            col(ev.reason, 22) + col(objStr, 36) + shortMsg,
            ev.type === 'Warning' ? 'warn' : undefined
          );
        }
        break;
      }

      case 'hpa':
      case 'horizontalpodautoscalers': {
        const items = filterByNs(cluster.hpas);
        header(col('NAME', 24) + col('REFERENCE', 32) + col('TARGETS', 14) + col('MINPODS', 9) + col('MAXPODS', 9) + col('REPLICAS', 10) + 'AGE');
        for (const hpa of items) {
          const target = hpa.metrics[0]?.resource.targetAverageUtilization;
          const current = hpa.metricsAvailable ? `${hpa.currentMetrics?.cpu ?? 0}%` : '<unknown>';
          out(
            col(hpa.name, 24) + col(`Deployment/${hpa.scaleTargetRef.name}`, 32) +
            col(`${current}/${target}%`, 14) + col(hpa.minReplicas, 9) +
            col(hpa.maxReplicas, 9) + col(hpa.currentReplicas, 10) + age(hpa.createdAt),
            !hpa.metricsAvailable ? 'warn' : undefined
          );
        }
        break;
      }

      case 'pvc':
      case 'persistentvolumeclaims': {
        const items = filterByNs(cluster.pvcs);
        header(col('NAME', 20) + col('STATUS', 10) + col('VOLUME', 24) + col('CAPACITY', 10) + col('ACCESS MODES', 14) + col('STORAGECLASS', 14) + 'AGE');
        for (const pvc of items) {
          const pv = cluster.pvs.find(p => p.id === pvc.boundTo);
          out(
            col(pvc.name, 20) + col(pvc.phase, 10) + col(pv?.name ?? '<none>', 24) +
            col(pv ? `${pv.capacity}Gi` : '<unset>', 10) + col(pvc.accessModes.join(','), 14) +
            col(pvc.storageClassName, 14) + age(pvc.createdAt),
            pvc.phase === 'Pending' ? 'warn' : pvc.phase === 'Bound' ? 'ok' : undefined
          );
        }
        break;
      }

      case 'pv':
      case 'persistentvolumes': {
        header(col('NAME', 24) + col('CAPACITY', 10) + col('ACCESS MODES', 14) + col('RECLAIM POLICY', 16) + col('STATUS', 10) + col('CLAIM', 24) + col('STORAGECLASS', 14) + 'AGE');
        for (const pv of cluster.pvs) {
          const pvc = cluster.pvcs.find(p => p.id === pv.boundTo);
          out(
            col(pv.name, 24) + col(`${pv.capacity}Gi`, 10) + col(pv.accessModes.join(','), 14) +
            col(pv.reclaimPolicy, 16) + col(pv.phase, 10) +
            col(pvc ? `${pvc.namespace}/${pvc.name}` : '', 24) +
            col(pv.storageClassName, 14) + age(pv.createdAt),
            pv.phase === 'Available' ? 'ok' : pv.phase === 'Bound' ? 'ok' : 'muted'
          );
        }
        break;
      }

      case 'networkpolicies':
      case 'netpol': {
        const items = filterByNs(cluster.networkPolicies);
        header(col('NAME', 28) + col('POD-SELECTOR', 28) + 'AGE');
        for (const np of items) {
          const sel = Object.keys(np.podSelector).length === 0 ? '<none>' : JSON.stringify(np.podSelector);
          out(col(np.name, 28) + col(sel, 28) + age(np.createdAt));
        }
        break;
      }

      case 'roles': {
        const items = filterByNs(cluster.roles);
        header(col('NAME', 28) + col('CREATED AT', 26));
        for (const r of items) out(col(r.name, 28) + new Date(r.createdAt).toISOString());
        break;
      }

      case 'rolebindings': {
        const items = filterByNs(cluster.roleBindings);
        header(col('NAME', 28) + col('ROLE', 28) + col('AGE', 8));
        for (const rb of items) {
          out(col(rb.name, 28) + col(`${rb.roleRef.kind}/${rb.roleRef.name}`, 28) + age(rb.createdAt));
        }
        break;
      }

      case 'serviceaccounts':
      case 'sa': {
        const items = filterByNs(cluster.serviceAccounts);
        header(col('NAME', 28) + col('SECRETS', 9) + 'AGE');
        for (const sa of items) out(col(sa.name, 28) + col(0, 9) + age(sa.createdAt));
        break;
      }

      case 'namespaces':
      case 'ns': {
        header(col('NAME', 24) + col('STATUS', 10) + 'AGE');
        for (const ns_ of cluster.namespaces) {
          out(col(ns_, 24) + col('Active', 10) + '1d', 'ok');
        }
        break;
      }

      case 'all': {
        // Recursively render pods, services, deployments
        lines.push(...execKubectl(`kubectl get pods -n ${ns === 'ALL' ? 'default' : ns}`, store).lines);
        lines.push({ text: '' });
        lines.push(...execKubectl(`kubectl get services -n ${ns === 'ALL' ? 'default' : ns}`, store).lines);
        lines.push({ text: '' });
        lines.push(...execKubectl(`kubectl get deployments -n ${ns === 'ALL' ? 'default' : ns}`, store).lines);
        break;
      }

      default:
        out(`error: the server doesn't have a resource type "${resource}"`, 'err');
    }
  }

  // ── describe ──────────────────────────────────────────────────────
  else if (sub === 'describe') {
    const resource = tokens[2]?.toLowerCase();
    const name = tokens[3];

    if (resource === 'pod' || resource === 'pods') {
      const pod = cluster.pods.find(p => p.name === name);
      if (!pod) { out(`Error from server (NotFound): pods "${name}" not found`, 'err'); }
      else {
        const node = cluster.nodes.find(n => n.id === pod.nodeName);
        const cs = pod.status.containerStatuses[0];
        out(`Name:         ${pod.name}`);
        out(`Namespace:    ${pod.namespace}`);
        out(`Node:         ${node ? `${node.name}/${node.id}` : '<none>'}`);
        out(`Labels:       ${Object.entries(pod.labels).map(([k, v]) => `${k}=${v}`).join(', ')}`);
        out(`Status:       ${pod.phase}`);
        out(`IP:           10.244.${Math.floor(Math.random() * 2)}.${Math.floor(Math.random() * 254) + 1}`);
        out(``);
        out(`Containers:`);
        for (const c of pod.containers) {
          out(`  ${c.name}:`);
          out(`    Image:         ${c.image}`);
          out(`    Ready:         ${pod.readinessReady ? 'True' : 'False'}`);
          out(`    Restart Count: ${cs?.restartCount ?? 0}`);
          if (c.resources?.requests) {
            out(`    Requests:`);
            out(`      cpu:     ${c.resources.requests.cpu}m`);
            out(`      memory:  ${c.resources.requests.memory}Mi`);
          }
          if (cs?.state === 'waiting' && cs.reason) {
            out(`    State: Waiting`, 'warn');
            out(`      Reason:  ${cs.reason}`, 'warn');
            if (cs.message) out(`      Message: ${cs.message}`, 'warn');
          } else if (cs?.state === 'running') {
            out(`    State: Running`, 'ok');
            out(`      Started: ${new Date(pod.startedAt ?? pod.createdAt).toISOString()}`);
          }
        }
        out(``);
        out(`Conditions:`);
        const ready = pod.readinessReady && pod.phase === 'Running';
        out(`  Ready         ${ready ? 'True' : 'False'}`, ready ? 'ok' : 'warn');
        out(`  PodScheduled  ${pod.nodeName ? 'True' : 'False'}`);
        out(``);
        out(`Events:`);
        const podEvents = cluster.events.filter(e => e.objectName === pod.name).slice(0, 8);
        if (podEvents.length === 0) out('  <none>');
        for (const ev of podEvents) {
          out(
            `  ${col(ev.type, 10)} ${col(ev.reason, 22)} ${ev.message}`,
            ev.type === 'Warning' ? 'warn' : undefined
          );
        }
      }
    }

    else if (resource === 'node' || resource === 'nodes') {
      const node = cluster.nodes.find(n => n.name === name || n.id === name);
      if (!node) { out(`Error from server (NotFound): nodes "${name}" not found`, 'err'); }
      else {
        const usage = { cpu: node.used.cpu, memory: node.used.memory };
        out(`Name: ${node.name}`);
        out(`Roles: worker`);
        out(`Labels:`);
        for (const [k, v] of Object.entries(node.labels)) out(`  ${k}=${v}`);
        out(`Taints: ${node.taints.length === 0 ? '<none>' : node.taints.map(t => `${t.key}=${t.value}:${t.effect}`).join(', ')}`,
          node.taints.length > 0 ? 'warn' : undefined);
        out(`Conditions:`);
        out(`  Ready: ${node.status === 'Ready' ? 'True' : 'False'}`, node.status === 'Ready' ? 'ok' : 'err');
        out(`Capacity:`);
        out(`  cpu:    ${node.capacity.cpu}m`);
        out(`  memory: ${node.capacity.memory}Mi`);
        out(`Allocatable:`);
        out(`  cpu:    ${node.allocatable.cpu}m`);
        out(`  memory: ${node.allocatable.memory}Mi`);
        out(`Allocated resources:`);
        const cpuPct = Math.round((usage.cpu / node.allocatable.cpu) * 100);
        const memPct = Math.round((usage.memory / node.allocatable.memory) * 100);
        out(`  cpu:    ${usage.cpu}m (${cpuPct}%)`, cpuPct > 85 ? 'warn' : undefined);
        out(`  memory: ${usage.memory}Mi (${memPct}%)`, memPct > 85 ? 'warn' : undefined);
        out(`Non-terminated Pods:`);
        const nodePods = cluster.pods.filter(p => p.nodeName === node.id);
        for (const p of nodePods) {
          out(`  ${col(p.namespace, 14)} ${col(p.name, 36)} ${col(p.resources.cpu + 'm', 10)} ${p.resources.memory}Mi`);
        }
      }
    }

    else if (resource === 'deployment' || resource === 'deployments') {
      const dep = cluster.deployments.find(d => d.name === name);
      if (!dep) { out(`Error from server (NotFound): deployments.apps "${name}" not found`, 'err'); }
      else {
        out(`Name:               ${dep.name}`);
        out(`Namespace:          ${dep.namespace}`);
        out(`Selector:           ${JSON.stringify(dep.selector.matchLabels)}`);
        out(`Replicas:           ${dep.status.readyReplicas} available, ${dep.replicas} desired`);
        out(`Strategy:           ${dep.strategy.type}`);
        if (dep.strategy.rollingUpdate) {
          out(`  Max Surge:        ${dep.strategy.rollingUpdate.maxSurge}`);
          out(`  Max Unavailable:  ${dep.strategy.rollingUpdate.maxUnavailable}`);
        }
        out(`Pod Template:`);
        for (const c of dep.template.spec.containers) {
          out(`  Containers:`);
          out(`   ${c.name}:`);
          out(`    Image:  ${c.image}`);
          if (c.resources?.requests) {
            out(`    Limits:   cpu=${c.resources.limits?.cpu ?? '—'}m, memory=${c.resources.limits?.memory ?? '—'}Mi`);
            out(`    Requests: cpu=${c.resources.requests.cpu}m, memory=${c.resources.requests.memory}Mi`);
          }
        }
        out(`Conditions:`);
        // rs is used only to check existence; ignore unused warning via void
        void cluster.replicaSets.find(r => r.ownerRef?.name === dep.name);
        out(`  Available: ${dep.status.readyReplicas > 0 ? 'True' : 'False'}`, dep.status.readyReplicas > 0 ? 'ok' : 'warn');
        out(`  Progressing: True`);
      }
    }

    else if (resource === 'service' || resource === 'svc') {
      const svc = cluster.services.find(s => s.name === name);
      if (!svc) { out(`Error from server (NotFound): services "${name}" not found`, 'err'); }
      else {
        out(`Name:              ${svc.name}`);
        out(`Namespace:         ${svc.namespace}`);
        out(`Selector:          ${JSON.stringify(svc.selector)}`);
        out(`Type:              ${svc.type}`);
        out(`IP:                ${svc.clusterIP}`);
        out(`Port:              ${svc.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}`);
        out(`Endpoints:         ${svc.endpoints.length === 0 ? '<none>' : svc.endpoints.join(', ')}`,
          svc.endpoints.length === 0 ? 'warn' : 'ok');
      }
    }

    else {
      out(`error: the server doesn't have a resource type "${resource}"`, 'err');
    }
  }

  // ── delete ────────────────────────────────────────────────────────
  else if (sub === 'delete') {
    const resource = tokens[2]?.toLowerCase();
    const name = tokens[3];
    if (!name) { out(`error: must specify type and name of resource to delete`, 'err'); }
    else {
      const ns_ = ns === 'ALL' ? 'default' : ns;
      if (resource === 'pod') {
        deleteResource('Pod', name, ns_);
        out(`pod "${name}" deleted`);
      } else if (resource === 'deployment' || resource === 'deploy') {
        deleteResource('Deployment', name, ns_);
        out(`deployment.apps "${name}" deleted`);
      } else if (resource === 'service' || resource === 'svc') {
        deleteResource('Service', name, ns_);
        out(`service "${name}" deleted`);
      } else {
        out(`error: the server doesn't have a resource type "${resource}"`, 'err');
      }
    }
  }

  // ── scale ─────────────────────────────────────────────────────────
  else if (sub === 'scale') {
    const resource = tokens[2]?.toLowerCase()?.replace('deployment/', '');
    const replicasArg = tokens.find(t => t.startsWith('--replicas='));
    const replicaCount = replicasArg ? parseInt(replicasArg.split('=')[1]) : NaN;

    if (isNaN(replicaCount)) { out(`error: --replicas is required`, 'err'); }
    else {
      const dep = cluster.deployments.find(d => d.name === resource || tokens[2]?.endsWith(d.name));
      if (!dep) { out(`Error from server (NotFound): deployments.apps "${resource}" not found`, 'err'); }
      else {
        applyYAML(`apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${dep.name}\n  namespace: ${dep.namespace}\nspec:\n  replicas: ${replicaCount}\n  selector:\n    matchLabels:\n      app: ${dep.name}\n  template:\n    metadata:\n      labels:\n        app: ${dep.name}\n    spec:\n      containers:\n        - name: ${dep.name}\n          image: ${dep.template.spec.containers[0]?.image || 'nginx:latest'}`);
        out(`deployment.apps/${dep.name} scaled`);
      }
    }
  }

  // ── rollout ───────────────────────────────────────────────────────
  else if (sub === 'rollout') {
    const action = tokens[2]?.toLowerCase();
    const target = tokens[3]?.replace('deployment/', '');
    const dep = cluster.deployments.find(d => d.name === target);

    if (action === 'status') {
      if (!dep) { out(`Error from server (NotFound): deployments.apps "${target}" not found`, 'err'); }
      else {
        const ready = dep.status.readyReplicas;
        const desired = dep.replicas;
        if (ready === desired) {
          out(`deployment "${dep.name}" successfully rolled out`, 'ok');
        } else {
          out(`Waiting for deployment "${dep.name}" rollout to finish: ${ready} of ${desired} updated replicas are available...`, 'warn');
        }
      }
    } else if (action === 'restart') {
      if (!dep) { out(`Error from server (NotFound): deployments.apps "${target}" not found`, 'err'); }
      else {
        out(`deployment.apps/${dep.name} restarted`);
        // Trigger pod recreation by deleting existing pods
        const rs = cluster.replicaSets.find(r => r.ownerRef?.name === dep.name);
        if (rs) {
          const pods = cluster.pods.filter(p => p.ownerRef?.name === rs.name);
          pods.forEach(p => deleteResource('Pod', p.name, p.namespace));
        }
      }
    } else if (action === 'history') {
      if (!dep) { out(`Error from server (NotFound): deployments.apps "${target}" not found`, 'err'); }
      else {
        header('REVISION  CHANGE-CAUSE');
        out(`${dep._revision}         <none>`);
      }
    } else {
      out(`error: unknown rollout action "${action}"`, 'err');
    }
  }

  // ── top ───────────────────────────────────────────────────────────
  else if (sub === 'top') {
    const resource = tokens[2]?.toLowerCase();
    if (resource === 'nodes') {
      header(col('NAME', 20) + col('CPU(cores)', 14) + col('CPU%', 8) + col('MEMORY(bytes)', 16) + 'MEMORY%');
      for (const node of cluster.nodes) {
        const cpuPct = Math.round((node.used.cpu / node.allocatable.cpu) * 100);
        const memPct = Math.round((node.used.memory / node.allocatable.memory) * 100);
        out(
          col(node.name, 20) + col(`${node.used.cpu}m`, 14) + col(`${cpuPct}%`, 8) +
          col(`${node.used.memory}Mi`, 16) + `${memPct}%`,
          cpuPct > 85 || memPct > 85 ? 'warn' : undefined
        );
      }
    } else if (resource === 'pods') {
      const pods = filterPods(cluster.pods).filter(p => p.phase === 'Running');
      header(col('NAME', 36) + col('CPU(cores)', 14) + 'MEMORY(bytes)');
      for (const pod of pods) {
        out(col(pod.name, 36) + col(`${pod.resources.cpu}m`, 14) + `${pod.resources.memory}Mi`);
      }
    }
  }

  // ── taint ──────────────────────────────────────────────────────────
  else if (sub === 'taint') {
    const resource = tokens[2]?.toLowerCase();
    const name = tokens[3];
    const taintStr = tokens[4];
    if (resource !== 'node' && resource !== 'nodes') {
      out(`error: the server doesn't have a resource type "${resource}"`, 'err');
    } else if (!name || !taintStr) {
      out('error: must specify node name and taint spec', 'err');
    } else if (taintStr.endsWith('-')) {
      // Remove taint
      const key = taintStr.slice(0, -1);
      const node = cluster.nodes.find(n => n.name === name);
      if (!node) { out(`Error from server (NotFound): nodes "${name}" not found`, 'err'); }
      else {
        removeTaint(node.id, key);
        out(`node/${name} untainted`);
      }
    } else {
      // Add taint (format: key=value:Effect)
      const [kvPart, effect] = taintStr.split(':');
      const [key, value] = kvPart.split('=');
      const node = cluster.nodes.find(n => n.name === name);
      if (!node) { out(`Error from server (NotFound): nodes "${name}" not found`, 'err'); }
      else if (!effect || (effect !== 'NoSchedule' && effect !== 'NoExecute' && effect !== 'PreferNoSchedule')) {
        out(`error: invalid taint effect "${effect}", must be NoSchedule, NoExecute or PreferNoSchedule`, 'err');
      } else {
        addTaint(node.id, key, value ?? '', effect as any);
        out(`node/${name} tainted`);
      }
    }
  }

  // ── cordon / uncordon ─────────────────────────────────────────────
  else if (sub === 'cordon' || sub === 'uncordon') {
    const name = tokens[2];
    const node = cluster.nodes.find(n => n.name === name);
    if (!node) { out(`Error from server (NotFound): nodes "${name}" not found`, 'err'); }
    else if (sub === 'cordon') {
      addTaint(node.id, 'node.kubernetes.io/unschedulable', '', 'NoSchedule');
      out(`node/${name} cordoned`);
    } else {
      removeTaint(node.id, 'node.kubernetes.io/unschedulable');
      out(`node/${name} uncordoned`);
    }
  }

  // ── drain ─────────────────────────────────────────────────────────
  else if (sub === 'drain') {
    const name = tokens[2];
    const node = cluster.nodes.find(n => n.name === name);
    if (!node) { out(`Error from server (NotFound): nodes "${name}" not found`, 'err'); }
    else {
      setNodeStatus(node.id, 'NotReady');
      const pods = cluster.pods.filter(p => p.nodeName === node.id);
      for (const p of pods) { out(`evicting pod ${p.namespace}/${p.name}`, 'warn'); }
      out(`node/${name} drained`);
    }
  }

  // ── auth can-i ────────────────────────────────────────────────────
  else if (sub === 'auth') {
    const action = tokens[2]?.toLowerCase();
    if (action === 'can-i') {
      const verb = tokens[3];
      const resource = tokens[4];
      const asFlag = tokens.indexOf('--as');
      const asUser = asFlag !== -1 ? tokens[asFlag + 1] : undefined;
      const saName = asUser?.split(':').pop();

      const binding = cluster.roleBindings.find(rb => rb.subjects.some(s => s.name === saName));
      const role = binding ? cluster.roles.find(r => r.name === binding.roleRef.name) : null;
      const allowed = role?.rules.some(r => r.resources.includes(resource) && r.verbs.includes(verb)) ?? false;

      out(allowed ? 'yes' : 'no', allowed ? 'ok' : 'err');
    }
  }

  // ── logs ─────────────────────────────────────────────────────────
  else if (sub === 'logs') {
    const name = tokens[2];
    const prev = tokens.includes('--previous') || tokens.includes('-p');
    const pod = cluster.pods.find(p => p.name === name);
    if (!pod) { out(`Error from server (NotFound): pods "${name}" not found`, 'err'); }
    else {
      const cs = pod.status.containerStatuses[0];
      if (cs?.reason === 'CrashLoopBackOff' || cs?.reason === 'Error' || prev) {
        out(`# Previous container logs:`, 'muted');
        out(`2024-01-01T00:00:00.000Z Starting application...`);
        out(`2024-01-01T00:00:00.100Z ERROR: panic: runtime error: index out of range`, 'err');
        out(`2024-01-01T00:00:00.100Z goroutine 1 [running]:`, 'err');
        out(`2024-01-01T00:00:00.101Z main.main() /app/main.go:42 +0x3a`, 'err');
        out(`exit code 1`, 'err');
      } else if (cs?.reason === 'ImagePullBackOff') {
        out(`Error from server: container "bad-image-app" in pod "${name}" is not running`, 'err');
      } else if (pod.phase === 'Running') {
        out(`${new Date().toISOString().replace('T', ' ').slice(0, 23)} Starting ${pod.containers[0]?.name}...`);
        out(`${new Date().toISOString().replace('T', ' ').slice(0, 23)} [INFO] Server listening on :8080`);
        out(`${new Date().toISOString().replace('T', ' ').slice(0, 23)} [INFO] Health check OK`);
      } else {
        out(`Error from server: container "${pod.containers[0]?.name}" is not running`, 'err');
      }
    }
  }

  // ── explain ──────────────────────────────────────────────────────
  else if (sub === 'explain') {
    const resource = tokens[2]?.toLowerCase().replace(/\..*/,'');
    const EXPLAIN: Record<string, string> = {
      pod: 'Pod is a collection of containers that can run on a host. This resource is created by clients and scheduled onto hosts.',
      deployment: 'Deployment enables declarative updates for Pods and ReplicaSets. You describe a desired state in a Deployment, and the Deployment Controller changes the actual state to the desired state at a controlled rate.',
      replicaset: 'ReplicaSet is the next-generation ReplicationController. The only difference between a ReplicaSet and a ReplicationController right now is the selector support.',
      service: 'Service is a named abstraction of software service (for example, mysql) consisting of local port (for example 3306) that the proxy listens on, and the selector that determines which pods will answer requests sent through the proxy.',
      hpa: 'HorizontalPodAutoscaler automatically scales the number of pods in a replication controller, deployment, replica set or stateful set based on observed CPU utilization.',
      pvc: 'PersistentVolumeClaim is a user\'s request for and claim to a persistent volume.',
      networkpolicy: 'NetworkPolicy describes what network traffic is allowed for a set of Pods.',
    };
    const desc = EXPLAIN[resource] || EXPLAIN[resource?.replace('s', '')] || `Unknown resource type "${resource}"`;
    out(`KIND:     ${resource}`);
    out(`VERSION:  v1 (or apps/v1)`);
    out(``);
    out(`DESCRIPTION:`);
    out(`   ${desc}`);
  }

  // ── version ──────────────────────────────────────────────────────
  else if (sub === 'version') {
    out(`Client Version: v1.29.0`);
    out(`Kustomize Version: v5.0.4-0`);
    out(`Server Version: v1.29.0`);
  }

  // ── cluster-info ──────────────────────────────────────────────────
  else if (sub === 'cluster-info') {
    out(`Kubernetes control plane is running at https://127.0.0.1:6443`, 'ok');
    out(`CoreDNS is running at https://127.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy`, 'ok');
  }

  // ── config ──────────────────────────────────────────────────────
  else if (sub === 'config') {
    const action = tokens[2];
    if (action === 'current-context' || action === 'get-contexts') {
      out(`k8s-simulator`);
    } else {
      out(`Current context: k8s-simulator`);
    }
  }

  // ── help ──────────────────────────────────────────────────────────
  else if (sub === 'help' || sub === '--help' || sub === '-h' || !sub) {
    out(`kubectl controls the Kubernetes cluster manager.`);
    out(``);
    out(`Basic Commands:`);
    out(`  get           Display one or many resources`);
    out(`  describe      Show details of a specific resource or group of resources`);
    out(`  delete        Delete resources by names and types`);
    out(`  logs          Print the logs for a container in a pod`);
    out(`  exec          Execute a command in a container`);
    out(`  apply         Apply a configuration to a resource by file name`);
    out(`  scale         Set a new size for a deployment`);
    out(`  rollout       Manage the rollout of a resource`);
    out(`  top           Display resource (CPU/memory) usage`);
    out(`  drain         Drain node in preparation for maintenance`);
    out(`  cordon        Mark node as unschedulable`);
    out(`  uncordon      Mark node as schedulable`);
    out(`  taint         Update the taints on one or more nodes`);
    out(`  explain       Get documentation for a resource`);
    out(`  auth          Inspect authorization`);
    out(`  version       Print the client and server version information`);
    out(`  cluster-info  Display cluster info`);
    out(``);
    out(`Use "kubectl <command> --help" for more information about a given command.`);
  }

  // ── unknown ──────────────────────────────────────────────────────
  else {
    out(`error: unknown command "${sub}" for "kubectl"`, 'err');
    out(`Run 'kubectl --help' for usage.`);
  }

  return { lines };
}

// ─── Types ───────────────────────────────────────────────────────────

interface OutputLine {
  text: string;
  cls?: 'header' | 'ok' | 'warn' | 'err' | 'muted' | 'cmd';
}

interface HistoryEntry {
  id: number;
  prompt: string;
  output: OutputLine[];
}

const HISTORY_MAX = 50;

const QUICK_CMDS = [
  'kubectl get pods',
  'kubectl get pods -A',
  'kubectl get nodes',
  'kubectl get deployments',
  'kubectl get events',
  'kubectl get all',
  'kubectl top nodes',
  'kubectl top pods',
];

// ─── Component ───────────────────────────────────────────────────────

export function KubectlTerminalModule() {
  const { cluster, deleteResource, setNodeStatus, addTaint, removeTaint, applyYAML } = useSimulator();
  const store: ExecContext = { cluster, deleteResource, setNodeStatus, addTaint, removeTaint, applyYAML };
  const [input, setInput] = useState('kubectl ');
  const [history, setHistory] = useState<HistoryEntry[]>([
    {
      id: 0,
      prompt: '# Welcome to the k8ssim kubectl terminal',
      output: [
        { text: '# Type real kubectl commands below. Tab-complete is not implemented.' },
        { text: '# Try: kubectl get pods, kubectl describe node node-1, kubectl get events' },
        { text: '# Mutating commands: kubectl delete pod <name>, kubectl scale, kubectl drain' },
        { text: '# Hint: use the Quick Commands panel on the right →' },
      ],
    },
  ]);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  let entryId = useRef(1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  function runCommand(cmd: string) {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const result = execKubectl(trimmed, store);
    const entry: HistoryEntry = {
      id: entryId.current++,
      prompt: trimmed,
      output: result.lines,
    };
    setHistory(h => [...h.slice(-(HISTORY_MAX - 1)), entry]);
    setCmdHistory(h => [trimmed, ...h].slice(0, 50));
    setHistoryIdx(-1);
    setInput('kubectl ');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      runCommand(input);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
      setHistoryIdx(nextIdx);
      if (cmdHistory[nextIdx]) setInput(cmdHistory[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(nextIdx);
      setInput(nextIdx === -1 ? 'kubectl ' : cmdHistory[nextIdx]);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Basic tab completion for kubectl subcommands
      const parts = input.trim().split(' ');
      if (parts.length === 2) {
        const cmds = ['get', 'describe', 'delete', 'logs', 'scale', 'rollout', 'top', 'drain', 'cordon', 'uncordon', 'taint', 'explain', 'auth', 'version', 'apply'];
        const match = cmds.find(c => c.startsWith(parts[1]));
        if (match) setInput(`kubectl ${match} `);
      } else if (parts.length === 3 && parts[1] === 'get') {
        const resources = ['pods', 'nodes', 'deployments', 'services', 'events', 'hpa', 'pvc', 'pv', 'namespaces', 'all'];
        const match = resources.find(r => r.startsWith(parts[2]));
        if (match) setInput(`kubectl get ${match} `);
      }
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setHistory([]);
    }
  }

  function lineColor(cls?: OutputLine['cls']) {
    switch (cls) {
      case 'header': return 'var(--text-muted)';
      case 'ok': return 'var(--k8s-green)';
      case 'warn': return 'var(--k8s-yellow)';
      case 'err': return 'var(--k8s-red)';
      case 'muted': return 'var(--text-muted)';
      case 'cmd': return 'var(--k8s-cyan)';
      default: return 'var(--text-primary)';
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Terminal area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-terminal)',
          overflow: 'hidden',
          cursor: 'text',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {/* Terminal header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#eab308' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#22c55e' }} />
          </div>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
            kubectl — k8s-simulator context
          </span>
          <span style={{
            marginLeft: 'auto', fontSize: 10, padding: '2px 8px',
            borderRadius: 10, background: 'rgba(79,128,255,0.12)',
            color: 'var(--k8s-blue)', fontFamily: 'var(--font-mono)',
          }}>
            Ctrl+L to clear · ↑↓ history · Tab to complete
          </span>
        </div>

        {/* Output area */}
        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {history.map(entry => (
            <div key={entry.id} style={{ marginBottom: 14 }}>
              {/* Prompt line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ color: 'var(--k8s-green)', userSelect: 'none' }}>
                  user@k8ssim:~$
                </span>
                <span style={{ color: 'var(--k8s-cyan)' }}>{entry.prompt}</span>
              </div>
              {/* Output lines */}
              {entry.output.map((line, i) => (
                <div key={i} style={{
                  color: lineColor(line.cls),
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre',
                  fontWeight: line.cls === 'header' ? 700 : 400,
                  paddingLeft: 2,
                }}>
                  {line.text || '\u00A0'}
                </div>
              ))}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input line */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
          flexShrink: 0,
        }}>
          <span style={{ color: 'var(--k8s-green)', fontFamily: 'var(--font-mono)', fontSize: 12, userSelect: 'none', flexShrink: 0 }}>
            user@k8ssim:~$
          </span>
          <input
            ref={inputRef}
            id="kubectl-input"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--k8s-cyan)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              caretColor: 'var(--k8s-cyan)',
            }}
          />
        </div>
      </div>

      {/* Quick Commands panel */}
      <div style={{
        width: 240,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '12px 14px',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          Quick Commands
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, padding: '0 4px' }}>
            Click to run instantly
          </div>
          {QUICK_CMDS.map(cmd => (
            <button
              key={cmd}
              onClick={() => runCommand(cmd)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 10px',
                marginBottom: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--k8s-cyan)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--k8s-blue)'; (e.currentTarget as HTMLElement).style.background = 'rgba(79,128,255,0.08)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)'; }}
            >
              {cmd}
            </button>
          ))}

          {/* Context-aware commands based on cluster state */}
          {store.cluster.pods.length > 0 && (
            <>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 12, marginBottom: 8, padding: '0 4px' }}>
                Context-aware
              </div>
              {store.cluster.pods.slice(0, 3).map(pod => (
                <button
                  key={pod.id}
                  onClick={() => runCommand(`kubectl describe pod ${pod.name}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 10px',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--k8s-blue)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  describe pod {pod.name.slice(0, 22)}
                </button>
              ))}
              {store.cluster.deployments.length > 0 && (
                <button
                  onClick={() => runCommand(`kubectl rollout status deployment/${store.cluster.deployments[0].name}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 10px',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--k8s-blue)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  rollout status deploy/{store.cluster.deployments[0].name}
                </button>
              )}
              {store.cluster.nodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => runCommand(`kubectl describe node ${node.name}`)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '6px 10px',
                    marginBottom: 6,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--k8s-blue)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  describe node {node.name}
                </button>
              ))}
            </>
          )}

          {/* Tip box */}
          <div style={{
            marginTop: 16,
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(79,128,255,0.06)',
            border: '1px solid rgba(79,128,255,0.15)',
            fontSize: 10,
            color: 'var(--text-muted)',
            lineHeight: 1.6,
          }}>
            <div style={{ color: 'var(--k8s-blue)', fontWeight: 700, marginBottom: 4 }}>💡 Tips</div>
            <div>· -n &lt;ns&gt; or -A for all-ns</div>
            <div>· kubectl logs &lt;pod&gt; -p for previous logs</div>
            <div>· kubectl auth can-i &lt;verb&gt; &lt;resource&gt;</div>
            <div>· kubectl explain &lt;resource&gt;</div>
          </div>
        </div>
      </div>
    </div>
  );
}
