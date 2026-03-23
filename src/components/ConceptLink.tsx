import React from 'react';
import { CONCEPTS } from '../data/concepts';
import { openConceptCard } from './ConceptCard';

interface ConceptLinkProps {
  id: string;
  label?: string;
}

export function ConceptLink({ id, label }: ConceptLinkProps) {
  const concept = CONCEPTS[id];
  if (!concept) return <span>{label || id}</span>;

  return (
    <button
      className="concept-link"
      onClick={(e) => { e.stopPropagation(); openConceptCard(id); }}
      title={`Learn more: ${concept.title}`}
    >
      {concept.icon} {label || concept.title}
    </button>
  );
}
