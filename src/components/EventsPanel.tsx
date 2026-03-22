import React from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { KubeEvent } from '../types/k8s';

function formatAge(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function EventsPanel() {
  const { cluster } = useSimulator();
  const events = cluster.events;

  const warnings = events.filter(e => e.type === 'Warning').length;
  const normals = events.filter(e => e.type === 'Normal').length;

  return (
    <aside className="events-panel" role="complementary" aria-label="Kubernetes Events">
      <div className="events-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>⚡ kubectl get events</span>
        </div>
        <div style={{ display: 'flex', gap: 8, fontFamily: 'var(--font-mono)' }}>
          {warnings > 0 && (
            <span style={{ color: 'var(--k8s-yellow)', fontSize: 10 }}>⚠ {warnings}</span>
          )}
          <span style={{ color: 'var(--k8s-green)', fontSize: 10 }}>✓ {normals}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{events.length} total</span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="empty-state" style={{ padding: 40 }}>
          <div style={{ fontSize: 32, opacity: 0.4 }}>📭</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No events yet</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Events appear when resources change</div>
        </div>
      ) : (
        <div className="events-body">
          {events.map(evt => (
            <EventRow key={evt.id} event={evt} />
          ))}
        </div>
      )}
    </aside>
  );
}

function EventRow({ event }: { event: KubeEvent }) {
  const typeClass = event.type === 'Warning' ? 'warning' : 'normal';

  return (
    <div className={`event-row ${typeClass}`} id={`event-${event.id}`}>
      <div className="event-type">{event.type}</div>
      <div className="event-reason">{event.reason}</div>
      <div className="event-object">
        <span style={{ color: 'var(--k8s-purple)' }}>{event.objectKind}</span>
        {' '}<span style={{ fontFamily: 'var(--font-mono)' }}>{event.objectName}</span>
        {event.count > 1 && (
          <span style={{
            marginLeft: 6, fontSize: 9, padding: '1px 5px',
            borderRadius: 8, background: 'rgba(255,255,255,0.05)',
            color: 'var(--text-muted)'
          }}>×{event.count}</span>
        )}
      </div>
      <div className="event-message">{event.message}</div>
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
        {event.source} · {formatAge(event.lastTimestamp)} ago
      </div>
    </div>
  );
}
