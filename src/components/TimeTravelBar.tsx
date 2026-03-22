import { useSimulator } from '../store/simulatorStore';

export function TimeTravelBar() {
  const { history, historyIndex, setTimeTravel, cluster } = useSimulator();
  
  if (history.length < 2) return null; // Not enough history to scrub yet

  const isLive = historyIndex === null;
  const currentIndex = isLive ? history.length - 1 : historyIndex;

  return (
    <div 
      style={{
        position: 'fixed', bottom: 20, right: 340, left: 'auto', transform: 'none',
        background: 'var(--bg-elevated)', border: `1px solid ${isLive ? 'var(--border-default)' : 'var(--k8s-yellow)'}`,
        borderRadius: 'var(--radius-lg)', padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 16, zIndex: 9999,
        boxShadow: isLive ? '0 4px 24px rgba(0,0,0,0.6)' : '0 0 20px rgba(234, 179, 8, 0.2)',
        minWidth: 350,
        backdropFilter: 'blur(10px)',
        animation: 'fadeInUp 0.3s ease',
        opacity: isLive ? 0.25 : 1,
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '1'}
      onMouseLeave={e => e.currentTarget.style.opacity = isLive ? '0.25' : '1'}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button 
          className={`btn ${isLive ? '' : 'btn-primary'}`}
          onClick={() => setTimeTravel(null)}
          style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, width: 120, justifyContent: 'center' }}
        >
          {isLive ? '🟢 LIVE' : '▶️ RESUME LIVE'}
        </button>
      </div>

      <input 
        type="range" 
        min={0} 
        max={history.length - 1} 
        value={currentIndex}
        onChange={(e) => {
          const val = Number(e.target.value);
          if (val === history.length - 1) {
            setTimeTravel(null);
          } else {
            setTimeTravel(val);
          }
        }}
        style={{ flex: 1, cursor: 'ew-resize' }}
      />

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: isLive ? 'var(--text-muted)' : 'var(--k8s-yellow)', minWidth: 100, textAlign: 'right' }}>
        Tick {cluster.tick}
        {!isLive && <div style={{ fontSize: 9, marginTop: 2, letterSpacing: '1px' }}>TIME TRAVELING</div>}
      </div>
    </div>
  );
}
