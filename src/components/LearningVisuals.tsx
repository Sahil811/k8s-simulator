import React from 'react';

export function WorkloadsMap() {
  return (
    <div className="learning-visual">
      <div className="viz-box viz-blue" style={{ width: '100%' }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>Deployment</div>
        <div>my-app</div>
      </div>
      <div className="viz-arrow">↓</div>
      <div className="viz-box viz-purple" style={{ width: '100%' }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>ReplicaSet</div>
        <div>my-app-7b9c5</div>
        <div style={{ fontSize: 9, marginTop: 4 }}>Desired: 3 | Current: 3</div>
      </div>
      <div className="viz-arrow">↓</div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between', width: '100%' }}>
        <div className="viz-box viz-cyan viz-pulse" style={{ flex: 1, padding: '12px 8px' }}>Pod 1</div>
        <div className="viz-box viz-cyan viz-pulse" style={{ flex: 1, padding: '12px 8px', animationDelay: '300ms' }}>Pod 2</div>
        <div className="viz-box viz-cyan viz-pulse" style={{ flex: 1, padding: '12px 8px', animationDelay: '600ms' }}>Pod 3</div>
      </div>
    </div>
  );
}

export function NetworkingMap() {
  return (
    <div className="learning-visual">
      <div className="viz-user">👤 User</div>
      <div className="viz-traffic-line">
        <div className="viz-dot"></div>
        <div className="viz-dot" style={{ animationDelay: '1s' }}></div>
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
        <div className="viz-box viz-cyan" style={{ flex: 1, opacity: 0.8, padding: '6px' }}><div style={{ fontSize: 9 }}>Pod 1</div></div>
        <div className="viz-box viz-cyan" style={{ flex: 1, opacity: 0.8, padding: '6px' }}><div style={{ fontSize: 9 }}>Pod 2</div></div>
        <div className="viz-box viz-cyan" style={{ flex: 1, opacity: 0.8, padding: '6px' }}><div style={{ fontSize: 9 }}>Pod 3</div></div>
      </div>
    </div>
  );
}

export function StorageMap() {
  return (
    <div className="learning-visual">
      <div className="viz-box viz-cyan" style={{ width: '100%', zIndex: 2 }}>
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
  return (
    <div className="learning-visual">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
        <div className="viz-cpu-chart">
          <div className="viz-cpu-bar bar-1"></div>
          <div className="viz-cpu-bar bar-2"></div>
          <div className="viz-cpu-bar bar-3"></div>
          <div className="viz-cpu-bar bar-4"></div>
          <div className="viz-cpu-bar bar-5"></div>
        </div>
      </div>
      
      <div className="viz-box viz-green" style={{ width: '100%', zIndex: 2 }}>
        <div style={{ fontSize: 10, opacity: 0.7 }}>HorizontalPodAutoscaler</div>
        <div>CPU &gt; 80% → Scale Up</div>
      </div>
      
      <div className="viz-arrow">↓</div>
      
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
        <div className="viz-box viz-cyan" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 1</div></div>
        <div className="viz-box viz-cyan" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 2</div></div>
        <div className="viz-box viz-cyan viz-ghost" style={{ width: '45%', padding: '8px' }}><div style={{ fontSize: 9 }}>Pod 3 (New)</div></div>
        <div className="viz-box viz-cyan viz-ghost" style={{ width: '45%', padding: '8px', animationDelay: '500ms' }}><div style={{ fontSize: 9 }}>Pod 4 (New)</div></div>
      </div>
    </div>
  );
}

export function ControlPlaneMap() {
  return (
    <div className="learning-visual control-plane-viz">
      <div className="viz-hub">
        <div className="viz-box viz-blue api-server">
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
