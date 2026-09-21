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
    color: '#E7EFEA',
    iconColor: '#49645A',
  },
  {
    id: 'gloomy',
    label: 'Hơi u ám chút',
    icon: 'cloud-outline',
    color: '#F0E9E7',
    iconColor: '#875455',
  },
  {
    id: 'overloaded',
    label: 'Quá tải rồi',
    icon: 'flash',
    color: '#ECEEE9',
    iconColor: '#49645A',
  },
  {
    id: 'sleepy',
    label: 'Buồn ngủ rũ rượi',
    icon: 'moon-outline',
    color: '#E9ECE8',
    iconColor: '#414A45',
  },
] as const;
