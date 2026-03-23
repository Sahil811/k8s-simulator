import { create } from 'zustand';
import type { ScenarioId } from '../types/k8s';
import { ACHIEVEMENTS, type AchievementId } from '../data/achievements';

const LEVELS = [
  { level: 1, title: 'Novice', minXP: 0 },
  { level: 2, title: 'Apprentice', minXP: 150 },
  { level: 3, title: 'Practitioner', minXP: 400 },
  { level: 4, title: 'Engineer', minXP: 800 },
  { level: 5, title: 'SRE', minXP: 1500 },
];

export function getLevel(xp: number) {
  let current = LEVELS[0];
  for (const lvl of LEVELS) {
    if (xp >= lvl.minXP) current = lvl;
  }
  const nextIdx = LEVELS.indexOf(current) + 1;
  const next = LEVELS[nextIdx] || null;
  const progressPct = next
    ? Math.round(((xp - current.minXP) / (next.minXP - current.minXP)) * 100)
    : 100;
  return { ...current, next, progressPct, xp };
}

interface ProgressState {
  xp: number;
  solvedScenarios: ScenarioId[];
  unlockedAchievements: AchievementId[];
  quizScores: Record<string, number>; // scenarioId → correct count
  noHintSolves: ScenarioId[];         // scenarios solved without opening hints
  yamlAppliedCount: number;
  chaosEngineerDone: boolean;
  timeLordDone: boolean;
  pendingAchievementToasts: AchievementId[]; // queue for toast display
  scenarioStartTime: number | null;

  // Actions
  awardXP: (amount: number) => void;
  markSolved: (id: ScenarioId, usedHints: boolean, startedAt: number | null) => AchievementId[];
  recordQuizScore: (id: string, correct: number, total: number) => AchievementId[];
  markChaosEngineer: () => AchievementId[];
  markTimeLord: () => AchievementId[];
  incrementYamlApplied: () => AchievementId[];
  dismissToast: (id: AchievementId) => void;
  setScenarioStartTime: (t: number | null) => void;
  reset: () => void;
}

const STORAGE_KEY = 'k8ssim_progress_v1';

function loadFromStorage(): Partial<ProgressState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveToStorage(state: Partial<ProgressState>) {
  try {
    const { xp, solvedScenarios, unlockedAchievements, quizScores, noHintSolves, yamlAppliedCount, chaosEngineerDone, timeLordDone } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ xp, solvedScenarios, unlockedAchievements, quizScores, noHintSolves, yamlAppliedCount, chaosEngineerDone, timeLordDone }));
  } catch {}
}

const saved = loadFromStorage();

function checkNewAchievements(state: ProgressState): AchievementId[] {
  const newOnes: AchievementId[] = [];
  const already = new Set(state.unlockedAchievements);

  function check(id: AchievementId, condition: boolean) {
    if (condition && !already.has(id)) newOnes.push(id);
  }

  const schedulingIds: ScenarioId[] = ['pending-resources', 'pending-taint'];
  const networkingIds: ScenarioId[] = ['service-selector-mismatch', 'network-policy-blocking'];

  check('first-fix', state.solvedScenarios.length >= 1);
  check('chaos-engineer', state.chaosEngineerDone);
  check('time-lord', state.timeLordDone);
  check('security-pro', state.solvedScenarios.includes('rbac-forbidden'));
  check('metrics-master', state.solvedScenarios.includes('hpa-not-scaling'));
  check('scheduler-master', schedulingIds.every(id => state.solvedScenarios.includes(id)));
  check('network-ninja', networkingIds.every(id => state.solvedScenarios.includes(id)));
  check('completionist', state.solvedScenarios.length >= 12);
  check('no-hints', state.noHintSolves.length >= 3);
  check('yaml-wizard', state.yamlAppliedCount >= 5);
  check('perfect-score', Object.values(state.quizScores).some(s => s === 3));

  return newOnes;
}

export const useProgress = create<ProgressState>((set, get) => ({
  xp: (saved.xp as number) ?? 0,
  solvedScenarios: (saved.solvedScenarios as ScenarioId[]) ?? [],
  unlockedAchievements: (saved.unlockedAchievements as AchievementId[]) ?? [],
  quizScores: (saved.quizScores as Record<string, number>) ?? {},
  noHintSolves: (saved.noHintSolves as ScenarioId[]) ?? [],
  yamlAppliedCount: (saved.yamlAppliedCount as number) ?? 0,
  chaosEngineerDone: (saved.chaosEngineerDone as boolean) ?? false,
  timeLordDone: (saved.timeLordDone as boolean) ?? false,
  pendingAchievementToasts: [],
  scenarioStartTime: null,

  awardXP: (amount) => {
    set(s => {
      const newState = { ...s, xp: s.xp + amount };
      saveToStorage(newState);
      return newState;
    });
  },

  markSolved: (id, usedHints, startedAt) => {
    let gained: AchievementId[] = [];
    set(s => {
      const already = s.solvedScenarios.includes(id);
      const elapsed = startedAt ? (Date.now() - startedAt) / 1000 : Infinity;
      let xpGain = already ? 0 : 100; // only award XP first time

      const newSolved = already ? s.solvedScenarios : [...s.solvedScenarios, id];
      const newNoHints = (!usedHints && !s.noHintSolves.includes(id)) ? [...s.noHintSolves, id] : s.noHintSolves;

      const draft: ProgressState = {
        ...s,
        xp: s.xp + xpGain,
        solvedScenarios: newSolved,
        noHintSolves: newNoHints,
      };

      // Check speed demon
      const speedCheck = elapsed < 90;
      const speedAlready = s.unlockedAchievements.includes('speed-demon');
      if (speedCheck && !speedAlready) {
        draft.xp += ACHIEVEMENTS.find(a => a.id === 'speed-demon')!.xpReward;
      }

      const newAchievements = checkNewAchievements(draft);
      const totalAchievementXP = newAchievements.reduce((sum, aid) => {
        const ach = ACHIEVEMENTS.find(a => a.id === aid);
        return sum + (ach?.xpReward ?? 0);
      }, 0);

      gained = newAchievements;
      const finalState: ProgressState = {
        ...draft,
        xp: draft.xp + totalAchievementXP,
        unlockedAchievements: [...s.unlockedAchievements, ...newAchievements],
        pendingAchievementToasts: [...s.pendingAchievementToasts, ...newAchievements],
      };
      saveToStorage(finalState);
      return finalState;
    });
    return gained;
  },

  recordQuizScore: (id, correct, _total) => {
    let gained: AchievementId[] = [];
    set(s => {
      const xpGain = correct * 25; // 25 XP per correct answer
      const newScores = { ...s.quizScores, [id]: Math.max(s.quizScores[id] ?? 0, correct) };
      const draft: ProgressState = { ...s, xp: s.xp + xpGain, quizScores: newScores };
      const newAchievements = checkNewAchievements(draft);
      const totalAchXP = newAchievements.reduce((sum, aid) => sum + (ACHIEVEMENTS.find(a => a.id === aid)?.xpReward ?? 0), 0);
      gained = newAchievements;
      const final: ProgressState = {
        ...draft,
        xp: draft.xp + totalAchXP,
        unlockedAchievements: [...s.unlockedAchievements, ...newAchievements],
        pendingAchievementToasts: [...s.pendingAchievementToasts, ...newAchievements],
      };
      saveToStorage(final);
      return final;
    });
    return gained;
  },

  markChaosEngineer: () => {
    let gained: AchievementId[] = [];
    set(s => {
      if (s.chaosEngineerDone) return s;
      const draft = { ...s, chaosEngineerDone: true };
      const newAch = checkNewAchievements(draft);
      const xp = newAch.reduce((sum, aid) => sum + (ACHIEVEMENTS.find(a => a.id === aid)?.xpReward ?? 0), 0);
      gained = newAch;
      const final = { ...draft, xp: draft.xp + xp, unlockedAchievements: [...s.unlockedAchievements, ...newAch], pendingAchievementToasts: [...s.pendingAchievementToasts, ...newAch] };
      saveToStorage(final);
      return final;
    });
    return gained;
  },

  markTimeLord: () => {
    let gained: AchievementId[] = [];
    set(s => {
      if (s.timeLordDone) return s;
      const draft = { ...s, timeLordDone: true };
      const newAch = checkNewAchievements(draft);
      const xp = newAch.reduce((sum, aid) => sum + (ACHIEVEMENTS.find(a => a.id === aid)?.xpReward ?? 0), 0);
      gained = newAch;
      const final = { ...draft, xp: draft.xp + xp, unlockedAchievements: [...s.unlockedAchievements, ...newAch], pendingAchievementToasts: [...s.pendingAchievementToasts, ...newAch] };
      saveToStorage(final);
      return final;
    });
    return gained;
  },

  incrementYamlApplied: () => {
    let gained: AchievementId[] = [];
    set(s => {
      const draft = { ...s, yamlAppliedCount: s.yamlAppliedCount + 1 };
      const newAch = checkNewAchievements(draft);
      const xp = newAch.reduce((sum, aid) => sum + (ACHIEVEMENTS.find(a => a.id === aid)?.xpReward ?? 0), 0);
      gained = newAch;
      const final = { ...draft, xp: draft.xp + xp, unlockedAchievements: [...s.unlockedAchievements, ...newAch], pendingAchievementToasts: [...s.pendingAchievementToasts, ...newAch] };
      saveToStorage(final);
      return final;
    });
    return gained;
  },

  dismissToast: (id) => {
    set(s => ({ ...s, pendingAchievementToasts: s.pendingAchievementToasts.filter(t => t !== id) }));
  },

  setScenarioStartTime: (t) => set({ scenarioStartTime: t }),

  reset: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({
      xp: 0, solvedScenarios: [], unlockedAchievements: [], quizScores: {},
      noHintSolves: [], yamlAppliedCount: 0, chaosEngineerDone: false,
      timeLordDone: false, pendingAchievementToasts: [], scenarioStartTime: null,
    });
  },
}));

export { LEVELS };
