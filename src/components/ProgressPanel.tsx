import React, { useState } from 'react';
import { useProgress, getLevel, LEVELS } from '../store/progressStore';
import { ACHIEVEMENTS } from '../data/achievements';

export function ProgressPanel() {
  const { xp, solvedScenarios, unlockedAchievements } = useProgress();
  const [showBadges, setShowBadges] = useState(false);
  const lvlInfo = getLevel(xp);

  return (
    <div className="progress-panel">
      {/* Level Header */}
      <div className="progress-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="level-badge">
            <span style={{ fontSize: 9, fontWeight: 700 }}>LVL</span>
            <span style={{ fontSize: 14, fontWeight: 800, lineHeight: 1 }}>{lvlInfo.level}</span>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{lvlInfo.title}</div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>{xp} XP total</div>
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {solvedScenarios.length}/12 solved
        </div>
      </div>

      {/* XP Bar */}
      <div style={{ padding: '6px 12px 0' }}>
        <div className="xp-bar-track">
          <div
            className="xp-bar-fill"
            style={{ width: `${lvlInfo.progressPct}%` }}
          />
        </div>
        {lvlInfo.next ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
            <span>{lvlInfo.xp - lvlInfo.minXP} / {lvlInfo.next.minXP - lvlInfo.minXP} XP</span>
            <span>Next: {lvlInfo.next.title}</span>
          </div>
        ) : (
          <div style={{ fontSize: 9, color: 'var(--k8s-yellow)', marginTop: 3, textAlign: 'center' }}>
            🏆 Max Level Reached!
          </div>
        )}
      </div>

      {/* Scenario Progress Dots */}
      <div style={{ padding: '8px 12px 6px' }}>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {Array.from({ length: 12 }, (_, i) => (
            <div
              key={i}
              className={`scenario-dot ${i < solvedScenarios.length ? 'scenario-dot-solved' : ''}`}
              title={i < solvedScenarios.length ? `Scenario ${i + 1} solved` : `Scenario ${i + 1} not yet solved`}
            />
          ))}
        </div>
        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
          {solvedScenarios.length === 12 ? '🎉 All scenarios complete!' : `${12 - solvedScenarios.length} remaining`}
        </div>
      </div>

      {/* Achievements Toggle */}
      <button
        onClick={() => setShowBadges(v => !v)}
        className="progress-badges-toggle"
      >
        <span>🏅 Badges ({unlockedAchievements.length}/{ACHIEVEMENTS.length})</span>
        <span style={{ fontSize: 10 }}>{showBadges ? '▲' : '▼'}</span>
      </button>

      {showBadges && (
        <div className="badges-grid">
          {ACHIEVEMENTS.map(ach => {
            const unlocked = unlockedAchievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`badge-item ${unlocked ? 'badge-unlocked' : 'badge-locked'}`}
                title={`${ach.title}: ${ach.description}`}
              >
                <span style={{ fontSize: 18 }}>{ach.icon}</span>
                <span style={{ fontSize: 8, textAlign: 'center', lineHeight: 1.2 }}>{ach.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
