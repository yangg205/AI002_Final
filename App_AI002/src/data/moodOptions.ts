export type MoodOption = {
  readonly id: string;
  readonly label: string;
  readonly icon: 'sunny-outline' | 'cloud-outline' | 'flash' | 'moon-outline';
  readonly color: string;
  readonly iconColor: string;
};

export const moodOptions: readonly MoodOption[] = [
  {
    id: 'great',
    label: 'Rất tuyệt vời',
    icon: 'sunny-outline',
    color: '#7DF19D',
    iconColor: '#08793D',
  },
  {
    id: 'gloomy',
    label: 'Hơi u ám chút',
    icon: 'cloud-outline',
    color: '#A42D58',
    iconColor: '#FFFFFF',
  },
  {
    id: 'overloaded',
    label: 'Quá tải rồi',
    icon: 'flash',
    color: '#FFD426',
    iconColor: '#685200',
  },
  {
    id: 'sleepy',
    label: 'Buồn ngủ rũ rượi',
    icon: 'moon-outline',
    color: '#E9E6DE',
    iconColor: '#554F3E',
  },
] as const;
