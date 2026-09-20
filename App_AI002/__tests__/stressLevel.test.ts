import {
  clampStressLevel,
  getStressLevelLabel,
} from '../src/utils/stressLevel';

describe('stress level helpers', () => {
  test.each([
    [-1, 0],
    [0, 0],
    [0.61, 0.61],
    [1, 1],
    [2, 1],
  ])('clamps %s to %s', (input, expected) => {
    expect(clampStressLevel(input)).toBe(expected);
  });

  test.each([
    [0, 'Rất thoải mái'],
    [0.199, 'Rất thoải mái'],
    [0.2, 'Khá thoải mái'],
    [0.399, 'Khá thoải mái'],
    [0.4, 'Bình thường'],
    [0.599, 'Bình thường'],
    [0.6, 'Hơi căng thẳng'],
    [0.799, 'Hơi căng thẳng'],
    [0.8, 'Rất căng thẳng'],
    [1, 'Rất căng thẳng'],
  ])('maps %s to "%s"', (value, expected) => {
    expect(getStressLevelLabel(value)).toBe(expected);
  });
});
