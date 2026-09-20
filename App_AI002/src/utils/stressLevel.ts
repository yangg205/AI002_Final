export type StressLevelLabel =
  | 'Rất thoải mái'
  | 'Khá thoải mái'
  | 'Bình thường'
  | 'Hơi căng thẳng'
  | 'Rất căng thẳng';

export function clampStressLevel(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function getStressLevelLabel(value: number): StressLevelLabel {
  const normalizedValue = clampStressLevel(value);

  if (normalizedValue < 0.2) {
    return 'Rất thoải mái';
  }
  
  if (normalizedValue < 0.4) {
    return 'Khá thoải mái';
  }

  if (normalizedValue < 0.6) {
    return 'Bình thường';
  }
  if (normalizedValue < 0.8) {
    return 'Hơi căng thẳng';
  }

  return 'Rất căng thẳng';
}

