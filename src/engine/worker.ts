import { reconcile } from './reconciler';
import type { ClusterState, ExplanationEntry } from '../types/k8s';

self.onmessage = (e: MessageEvent<{ state: ClusterState; cpuSimulation: Record<string, number> }>) => {
  const { state, cpuSimulation } = e.data;
  
  try {
    const newExplanations: ExplanationEntry[] = [];
    
    // Inject CPU metrics to HPA before reconcile
    for (const hpa of state.hpas) {
      const depName = hpa.scaleTargetRef.name;
      if (cpuSimulation[depName] !== undefined) {
        hpa.currentMetrics = { cpu: cpuSimulation[depName] };
      }
    }

    const nextState = reconcile(state, newExplanations);
    
    // Return the updated state
    self.postMessage({ type: 'TICK_RESULT', nextState, newExplanations });
  } catch (error) {
    console.error('Reconciliation worker error:', error);
  }
};
