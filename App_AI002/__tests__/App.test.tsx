import {
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';

import App from '../App';

jest.mock('../src/services/api', () => ({
  getHealth: jest.fn().mockResolvedValue({ status: 'ok', ai_available: true, rag_available: false }),
  getApiBaseUrl: () => 'http://localhost:8000',
}));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: object }>(
    'react-native-safe-area-context/jest/mock',
  ).default,
);

describe('<App />', () => {
  test('starts on Stress and navigates through all four tabs', async () => {
    const user = userEvent.setup();
    await render(<App />);

    expect(
      screen.getByRole('tab', { name: 'Đo Stress', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Đo Stress' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Tâm sự' }));
    expect(
      screen.getByRole('tab', { name: 'Tâm sự', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Chào bạn!' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Bài tập' }));
    expect(
      screen.getByRole('tab', { name: 'Bài tập', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: /Gợi ý bài tập/ }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Cảnh báo' }));
    expect(
      screen.getByRole('tab', { name: 'Cảnh báo', selected: true }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Chúng mình đang ở đây' }),
    ).toBeOnTheScreen();

    await user.press(screen.getByRole('tab', { name: 'Đo Stress' }));
    expect(
      screen.getByRole('tab', { name: 'Đo Stress', selected: true }),
    ).toBeOnTheScreen();
    expect(screen.getAllByRole('tab', { selected: true })).toHaveLength(1);
    expect(
      screen.getByRole('header', { name: 'Đo Stress' }),
    ).toBeOnTheScreen();
  });

  test('preserves the selected mood after switching tabs', async () => {
    const user = userEvent.setup();
    await render(<App />);

    await user.press(screen.getByTestId('mood-great'));
    expect(screen.getByTestId('mood-great')).toBeSelected();

    await user.press(screen.getByRole('tab', { name: 'Tâm sự' }));
    await user.press(screen.getByRole('tab', { name: 'Đo Stress' }));

    expect(screen.getByTestId('mood-great')).toBeSelected();
    expect(screen.getByTestId('mood-gloomy')).not.toBeSelected();
  });

  test('opens support from the header action', async () => {
    const user = userEvent.setup();
    await render(<App />);
    await user.press(screen.getByRole('button', { name: 'Hỗ trợ ngay' }));
    expect(screen.getByRole('tab', { name: 'Cảnh báo', selected: true })).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Chúng mình đang ở đây' })).toBeOnTheScreen();
  });
});
