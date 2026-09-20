import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export type AppTab = 'chat' | 'stress' | 'exercises' | 'alerts';

type AppTabItem = {
  readonly id: AppTab;
  readonly label: string;
  readonly icon: ComponentProps<typeof Ionicons>['name'];
};

export const APP_TABS = [
  { id: 'chat', label: 'Tâm sự', icon: 'chatbubbles-outline' },
  { id: 'stress', label: 'Đo Stress', icon: 'heart-outline' },
  { id: 'exercises', label: 'Bài tập', icon: 'bulb-outline' },
  { id: 'alerts', label: 'Cảnh báo', icon: 'alert-circle-outline' },
] as const satisfies readonly AppTabItem[];
