import React, { useState, useCallback } from 'react';
import { CONCEPTS, type Concept } from '../data/concepts';

interface ConceptCardProps {
  conceptId: string;
  onClose: () => void;
}

export function ConceptCard({ conceptId, onClose }: ConceptCardProps) {
  const [currentId, setCurrentId] = useState(conceptId);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const concept = CONCEPTS[currentId];

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  if (!concept) return null;

  return (
    <div
      className="concept-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={`Concept: ${concept.title}`}
      aria-modal="true"
    >
      <div className="concept-card-modal">
        {/* Header */}
        <div className="concept-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>{concept.icon}</span>
            <div>
              <div className="concept-card-title">{concept.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Kubernetes Concept</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="concept-close-btn"
            aria-label="Close concept card"
          >✕</button>
        </div>

        {/* Summary */}
        <div className="concept-card-section">
          <div className="concept-section-label">Summary</div>
          <div className="concept-summary-text">{concept.summary}</div>
        </div>

        {/* Analogy */}
        <div className="concept-card-section concept-analogy">
          <div className="concept-section-label">💡 Real-World Analogy</div>
          <div className="concept-analogy-text">"{concept.analogy}"</div>
        </div>

        {/* Deep Dive */}
        <div className="concept-card-section">
          <button
            className="concept-deepdive-toggle"
            onClick={() => setShowDeepDive(v => !v)}
          >
            <span>🔬 Deep Mechanics</span>
            <span style={{ fontSize: 12, marginLeft: 'auto' }}>{showDeepDive ? '▲' : '▼'}</span>
          </button>
          {showDeepDive && (
            <div className="concept-deepdive-content">
              {concept.deepDive}
            </div>
          )}
        </div>

        {/* YAML Example */}
        {concept.yamlExample && (
          <div className="concept-card-section">
            <div className="concept-section-label">📄 YAML Example</div>
            <pre className="concept-yaml-block">{concept.yamlExample}</pre>
          </div>
        )}

        {/* Related Concepts */}
        {concept.relatedConcepts.length > 0 && (
          <div className="concept-card-section">
            <div className="concept-section-label">Related Concepts</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {concept.relatedConcepts.map(relId => {
                const rel = CONCEPTS[relId];
                if (!rel) return null;
                return (
                  <button
                    key={relId}
                    onClick={() => { setCurrentId(relId); setShowDeepDive(false); }}
                    className="concept-related-btn"
                  >
                    {rel.icon} {rel.title}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Global concept card state — simple singleton
let _openConceptCard: ((id: string) => void) | null = null;

export function registerConceptCardOpener(fn: (id: string) => void) {
  _openConceptCard = fn;
}

export function openConceptCard(id: string) {
  _openConceptCard?.(id);
}
