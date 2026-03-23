import React, { useEffect, useState } from 'react';
import { useProgress } from '../store/progressStore';
import { ACHIEVEMENTS } from '../data/achievements';
import type { AchievementId } from '../data/achievements';

export function AchievementToastContainer() {
  const { pendingAchievementToasts, dismissToast } = useProgress();

  return (
    <div className="achievement-toast-container">
      {pendingAchievementToasts.slice(0, 3).map(id => (
        <AchievementToast key={id} achievementId={id} onDismiss={() => dismissToast(id)} />
      ))}
    </div>
  );
}

function AchievementToast({ achievementId, onDismiss }: { achievementId: AchievementId; onDismiss: () => void }) {
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger slide-in animation
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400); // after slide-out
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  if (!achievement) return null;

  return (
    <div className={`achievement-toast ${visible ? 'achievement-toast-visible' : ''}`}>
      <div className="achievement-toast-shine" />
      <div style={{ fontSize: 28, flexShrink: 0 }}>{achievement.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 10, color: 'var(--k8s-yellow)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Achievement Unlocked!
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginTop: 2 }}>
          {achievement.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
          {achievement.description}
        </div>
      </div>
      <div style={{ fontSize: 11, color: 'var(--k8s-yellow)', fontWeight: 700, flexShrink: 0 }}>
        +{achievement.xpReward} XP
      </div>
    </div>
  );
}
