export interface Achievement {
  id: string;
  title: string;
  icon: string;
  description: string;
  xpReward: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first-fix',
    title: 'First Fix',
    icon: '🎓',
    description: 'Solve your very first scenario',
    xpReward: 50,
  },
  {
    id: 'speed-demon',
    title: 'Speed Demon',
    icon: '⚡',
    description: 'Solve any scenario in under 90 seconds',
    xpReward: 100,
  },
  {
    id: 'perfect-score',
    title: 'Perfect Score',
    icon: '🧠',
    description: 'Score 3/3 on any knowledge check quiz',
    xpReward: 75,
  },
  {
    id: 'no-hints',
    title: 'No Peeking',
    icon: '🙈',
    description: 'Solve 3 scenarios without opening the hints section',
    xpReward: 150,
  },
  {
    id: 'chaos-engineer',
    title: 'Chaos Engineer',
    icon: '💀',
    description: 'Kill a node and watch the cluster recover',
    xpReward: 75,
  },
  {
    id: 'time-lord',
    title: 'Time Lord',
    icon: '⏪',
    description: 'Use the time travel debugger to replay cluster history',
    xpReward: 50,
  },
  {
    id: 'scheduler-master',
    title: 'Scheduler Master',
    icon: '📋',
    description: 'Solve all Scheduling category scenarios',
    xpReward: 125,
  },
  {
    id: 'network-ninja',
    title: 'Network Ninja',
    icon: '🕸',
    description: 'Solve all Networking category scenarios',
    xpReward: 125,
  },
  {
    id: 'security-pro',
    title: 'Security Pro',
    icon: '🔐',
    description: 'Solve the RBAC Forbidden scenario',
    xpReward: 100,
  },
  {
    id: 'metrics-master',
    title: 'Metrics Master',
    icon: '📊',
    description: 'Fix the HPA Not Scaling scenario',
    xpReward: 100,
  },
  {
    id: 'yaml-wizard',
    title: 'YAML Wizard',
    icon: '🏗️',
    description: 'Apply 5 resources using the YAML Editor',
    xpReward: 75,
  },
  {
    id: 'completionist',
    title: 'Completionist',
    icon: '🏆',
    description: 'Solve all 12 failure scenarios',
    xpReward: 500,
  },
];

export type AchievementId = typeof ACHIEVEMENTS[number]['id'];
