import React, { useState, useEffect } from 'react';
import { sounds } from '../utils/audio';

export function WorkloadsMap() {
  const [pods, setPods] = useState([true, true, true]); // true = alive
  const [recovering, setRecovering] = useState<number | null>(null);

  const killPod = (index: number) => {
    if (!pods[index]) return;
    sounds.playError();
    const newPods = [...pods];
    newPods[index] = false;
    setPods(newPods);
    setRecovering(index);

    // ReplicaSet automatically recovers it after 1.5s
    setTimeout(() => {
      sounds.playPop();
      setPods(prev => {
        const p = [...prev];
        p[index] = true;
        return p;
      });
      setRecovering(null);
    }, 1500);
  };

  return (
    <div className="learning-visual">
      <div className="viz-box viz-blue" style={{ width: '100%', marginBottom: 8 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Deployment</div>
        <div>my-app</div>
      </div>
      <div className="viz-arrow">↓</div>
      <div className={`viz-box viz-purple ${recovering !== null ? 'viz-pulse-fast' : ''}`} style={{ width: '100%', marginBottom: 8, borderColor: recovering !== null ? 'var(--k8s-red)' : '' }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>ReplicaSet</div>
        <div>my-app-7b9c5</div>
        <div style={{ fontSize: 9, marginTop: 4, color: recovering !== null ? 'var(--k8s-red)' : '' }}>
          Desired: 3 | Current: {pods.filter(Boolean).length}
        </div>
      </div>
      <div className="viz-arrow">↓</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', width: '100%' }}>
        {[0, 1, 2].map(i => (
          <div 
            key={i}
            onClick={() => killPod(i)}
            className={`viz-box viz-cyan ${pods[i] ? 'viz-interactive viz-pulse' : 'viz-dead'}`} 
            style={{ flex: 1, padding: '12px 0', cursor: pods[i] ? 'crosshair' : 'wait', opacity: pods[i] ? 1 : 0.3 }}
          >
            <div style={{ fontSize: 9 }}>{pods[i] ? `Pod ${i+1}` : 'DEAD'}</div>
            {pods[i] && <div className="viz-kill-btn">KILL</div>}
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)' }}>
        🎯 Click a Pod to kill it.
      </div>
    </div>
  );
}

export function NetworkingMap() {
  const [traffic, setTraffic] = useState<number[]>([]);
  const [activePod, setActivePod] = useState<number | null>(null);

  const sendRequest = () => {
    sounds.playLightClick();
    const podId = Math.floor(Math.random() * 3);
    setTraffic(prev => [...prev, podId]);
    setTimeout(() => {
      setActivePod(podId);
      setTimeout(() => setActivePod(null), 800);
      setTraffic(prev => prev.slice(1));
    }, 1000); // matches CSS animation duration roughly
  };

  return (
    <div className="learning-visual">
      <button className="viz-action-btn" onClick={sendRequest}>+ Send Request</button>
      <div className="viz-traffic-line">
        {traffic.map((podId, i) => (
          <div key={i} className={`viz-dot routing-to-${podId}`} style={{ animation: 'trafficDrop 1s linear forwards' }}></div>
        ))}
      </div>
      <div className="viz-box viz-teal" style={{ width: '100%', zIndex: 2 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Service (Load Balancer)</div>
        <div>my-app-svc</div>
        <div style={{ fontSize: 9, marginTop: 4 }}>IP: 10.96.0.1 → Port 80</div>
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%', marginTop: 20, position: 'relative' }}>
        <div className="viz-split-line left"></div>
        <div className="viz-split-line center"></div>
        <div className="viz-split-line right"></div>
        {[0, 1, 2].map(i => (
          <div 
            key={i} 
            className={`viz-box viz-cyan ${activePod === i ? 'viz-flash' : ''}`} 
            style={{ flex: 1, padding: '6px', opacity: activePod === i ? 1 : 0.6 }}
          >
            <div style={{ fontSize: 9 }}>Pod {i+1}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StorageMap() {
  return (
    <div className="learning-visual">
      <div className="viz-box viz-cyan viz-pulse" style={{ width: '100%', zIndex: 2 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Pod (Database)</div>
        <div>mysql-0</div>
      </div>
      <div className="viz-cable">
        <div className="viz-data-flow"></div>
      </div>
      <div className="viz-box viz-yellow" style={{ width: '100%', borderRadius: '16px 16px 4px 4px' }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>PersistentVolume</div>
        <div>data-pv (10Gi)</div>
        <div style={{ fontSize: 9, marginTop: 4 }}>Bound to PVC</div>
      </div>
    </div>
  );
}

export function ScalingMap() {
  const [cpu, setCpu] = useState(30);

  return (
    <div className="learning-visual" style={{ width: '100%' }}>
      <div style={{ marginBottom: 16, width: '100%', textAlign: 'center' }}>
        <input 
          type="range" 
          min="10" 
          max="100" 
          value={cpu} 
          onChange={(e) => {
            const newCpu = Number(e.target.value);
            if (newCpu > 80 && cpu <= 80) sounds.playPop();
            setCpu(newCpu);
          }}
          className="viz-slider"
        />
        <div style={{ fontSize: 12, marginTop: 4, color: cpu > 80 ? 'var(--k8s-red)' : 'var(--k8s-green)' }}>
          Simulated CPU: {cpu}%
        </div>
      </div>
      
      <div className={`viz-box viz-green ${cpu > 80 ? 'viz-alert' : ''}`} style={{ width: '100%', zIndex: 2 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>HorizontalPodAutoscaler</div>
        <div>Target: 80% | Action: {cpu > 80 ? 'SCALE UP' : 'OK'}</div>
      </div>
      
      <div className="viz-arrow">↓</div>
      
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
        <div className="viz-box viz-cyan" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 1</div></div>
        <div className="viz-box viz-cyan" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 2</div></div>
        
        {cpu > 80 && (
          <>
            <div className="viz-box viz-cyan viz-ghost" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 3 (New)</div></div>
            <div className="viz-box viz-cyan viz-ghost" style={{ width: '45%', padding: '8px', animationDelay: '500ms' }}><div style={{ fontSize: 9 }}>Pod 4 (New)</div></div>
          </>
        )}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
        🎯 Drag the CPU slider past 80%
      </div>
    </div>
  );
}

export function ControlPlaneMap() {
  return (
    <div className="learning-visual control-plane-viz">
      <div className="viz-hub">
        <div className="viz-box viz-blue api-server viz-pulse">
          <div style={{ fontSize: 10, opacity: 0.7 }}>API Server</div>
          <div>kube-apiserver</div>
        </div>
        
        <div className="viz-spoke etcd">
          <div className="viz-beam reverse"></div>
          <div className="viz-box viz-orange" style={{ padding: '8px' }}>
            <div style={{ fontSize: 9 }}>etcd</div>
          </div>
        </div>
        
        <div className="viz-spoke scheduler">
          <div className="viz-beam"></div>
          <div className="viz-box viz-purple" style={{ padding: '8px' }}>
            <div style={{ fontSize: 9 }}>Scheduler</div>
          </div>
        </div>
        
        <div className="viz-spoke controller">
          <div className="viz-beam"></div>
          <div className="viz-box viz-teal" style={{ padding: '8px' }}>
            <div style={{ fontSize: 9 }}>Controller Mgr</div>
          </div>
        </div>
      </div>
    </div>
  );
}
