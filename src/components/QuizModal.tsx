import React, { useState, useRef, useEffect } from 'react';
import type { ScenarioId } from '../types/k8s';
import { QUIZZES } from '../data/quizzes';
import { useProgress } from '../store/progressStore';

interface QuizModalProps {
  scenarioId: ScenarioId;
  onClose: () => void;
}

export function QuizModal({ scenarioId, onClose }: QuizModalProps) {
  const questions = QUIZZES[scenarioId];
  const { recordQuizScore } = useProgress();

  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [done, setDone] = useState(false);

  // Use a ref to track correct count synchronously — avoids stale closure bug
  const correctRef = useRef(0);
  const [correctDisplay, setCorrectDisplay] = useState(0);

  if (!questions || questions.length === 0) {
    onClose();
    return null;
  }

  const q = questions[currentQ];
  const isLast = currentQ === questions.length - 1;

  function handleSelect(idx: number) {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === q.correctIndex) {
      correctRef.current += 1;
      setCorrectDisplay(correctRef.current);
    }
  }

  function handleNext() {
    if (isLast) {
      // correctRef.current is always up-to-date, no stale closure
      recordQuizScore(scenarioId, correctRef.current, questions.length);
      setCorrectDisplay(correctRef.current); // sync display
      setDone(true);
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  }

  const scoreColor = correctDisplay === questions.length
    ? 'var(--k8s-green)'
    : correctDisplay >= questions.length - 1
      ? 'var(--k8s-yellow)'
      : 'var(--k8s-red)';

  return (
    <div
      className="concept-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="quiz-modal">
        {/* Header */}
        <div className="quiz-modal-header">
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>🧠 Knowledge Check</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {done ? 'Complete!' : `Question ${currentQ + 1} of ${questions.length}`}
            </div>
          </div>
          <button onClick={onClose} className="concept-close-btn" aria-label="Close quiz">✕</button>
        </div>

        {!done ? (
          <>
            {/* Progress bar */}
            <div style={{ height: 3, background: 'var(--bg-elevated)', borderRadius: 2, margin: '0 0 20px' }}>
              <div style={{
                height: '100%',
                borderRadius: 2,
                background: 'var(--k8s-blue)',
                width: `${(currentQ / questions.length) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>

            {/* Question */}
            <div className="quiz-question">{q.question}</div>

            {/* Options */}
            <div className="quiz-options">
              {q.options.map((opt, i) => {
                let cls = 'quiz-option';
                if (answered) {
                  if (i === q.correctIndex) cls += ' quiz-correct';
                  else if (i === selected && selected !== q.correctIndex) cls += ' quiz-wrong';
                }
                return (
                  <button
                    key={i}
                    className={cls}
                    onClick={() => handleSelect(i)}
                    disabled={answered}
                  >
                    <span className="quiz-option-letter">{String.fromCharCode(65 + i)}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>

            {/* Explanation */}
            {answered && (
              <div className={`quiz-explanation ${selected === q.correctIndex ? 'quiz-explanation-correct' : 'quiz-explanation-wrong'}`}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  {selected === q.correctIndex ? '✅ Correct!' : '❌ Not quite.'}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.6 }}>{q.explanation}</div>
              </div>
            )}

            {answered && (
              <button className="btn btn-primary quiz-next-btn" onClick={handleNext}>
                {isLast ? 'See Results →' : 'Next Question →'}
              </button>
            )}
          </>
        ) : (
          /* Results screen */
          <div className="quiz-results">
            <div className="quiz-score-ring" style={{ borderColor: scoreColor }}>
              <span style={{ fontSize: 32, fontWeight: 800, color: scoreColor, fontFamily: 'var(--font-mono)' }}>
                {correctDisplay}/{questions.length}
              </span>
            </div>
            <div style={{ marginTop: 16, fontSize: 20, fontWeight: 700 }}>
              {correctDisplay === questions.length ? '🏆 Perfect Score!' : correctDisplay >= questions.length - 1 ? '👍 Good Work!' : '📚 Keep Studying'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6 }}>
              You earned <span style={{ color: 'var(--k8s-yellow)', fontWeight: 700 }}>+{correctDisplay * 25} XP</span> from this quiz
              {correctDisplay === questions.length && <span> and the <strong>🧠 Perfect Score</strong> achievement!</span>}
            </div>
            <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>
              Continue Learning →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
