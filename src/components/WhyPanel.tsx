import React, { useState } from 'react';
import { useSimulator } from '../store/simulatorStore';
import type { ExplanationEntry } from '../types/k8s';

export function WhyPanel() {
  const { explanations } = useSimulator();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const visible = explanations.filter(e => !dismissed.has(e.id)).slice(0, 1);
  if (visible.length === 0) return null;

  const entry = visible[0];

  return (
    <div className="why-panel" role="dialog" aria-label="Why is this happening?">
      <div className="why-header">
        <div className="why-title">
          <span>🔍</span>
          <span>Why is this happening?</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="why-controller">{entry.controller}</span>
          <button
            onClick={() => setDismissed(d => new Set([...d, ...explanations.map(e => e.id)]))}
            style={{
              border: 'none', background: 'none',
              color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14,
              padding: 2, lineHeight: 1
            }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      </div>
      <div className="why-body">
        <div style={{
          fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
          marginBottom: 12, fontFamily: 'var(--font-mono)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 8,
            background: 'rgba(168, 85, 247, 0.1)', color: 'var(--k8s-purple)',
            fontWeight: 700, letterSpacing: '0.05em',
          }}>{entry.objectKind}</span>
          {entry.objectName}
        </div>

        <ExplanationSection label="What happened" text={entry.what} />
        <ExplanationSection label="Action taken" text={entry.action} cls="why-action" />
        <ExplanationSection label="Why (the real mechanics)" text={entry.why} cls="why-explanation" />

        {explanations.filter(e => !dismissed.has(e.id)).length > 1 && (
          <div style={{
            marginTop: 12, fontSize: 11, color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{explanations.filter(e => !dismissed.has(e.id)).length - 1} more events</span>
            <button
              onClick={() => setDismissed(d => new Set([...d, entry.id]))}
              style={{
                border: '1px solid var(--border-default)',
                background: 'transparent', color: 'var(--text-secondary)',
                padding: '4px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: 11,
              }}
            >Next →</button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExplanationSection({ label, text, cls = '' }: { label: string; text: string; cls?: string }) {
  return (
    <div className="why-section">
      <div className="why-section-label">{label}</div>
      <div className={`why-section-text ${cls}`}>{text}</div>
    </div>
  );
}
