import { fireEvent, render, screen } from '@testing-library/react-native';

import { StressCheckScreen } from '../src/screens/StressCheckScreen';
import { getAssessmentQuestions } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  getAssessmentQuestions: jest.fn(),
  scoreAssessment: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

describe('<StressCheckScreen />', () => {
  beforeEach(() => jest.clearAllMocks());
  test('renders the stress check content and default mood', async () => {
    await render(<StressCheckScreen onNotify={jest.fn()} />);

    expect(screen.getByRole('header', { name: 'Đo Stress' })).toBeOnTheScreen();
    expect(screen.getByText('Khá thoải mái')).toBeOnTheScreen();
    expect(screen.getByTestId('mood-gloomy')).toBeSelected();
  });

  test('selects a mood and reports the saved result to the app shell', async () => {
    const onNotify = jest.fn();
    await render(<StressCheckScreen onNotify={onNotify} />);

    await fireEvent.press(screen.getByTestId('mood-great'));
    expect(screen.getByTestId('mood-great')).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Lưu Kết Quả' }));

    expect(onNotify).toHaveBeenCalledWith(
      'Đã lưu trong phiên: Rất tuyệt vời • Khá thoải mái',
    );
    expect(screen.getAllByTestId('mood-history-entry')).toHaveLength(1);
    expect(screen.getByRole('header', { name: 'Nhật ký trong phiên' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId('mood-overloaded'));
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu Kết Quả' }));
    expect(screen.getAllByTestId('mood-history-entry')).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: 'Xóa nhật ký trong phiên' }));
    expect(screen.queryByTestId('mood-history-entry')).not.toBeOnTheScreen();
  });

  test('opens consent from a chat request without starting or sending answers', async () => {
    const onNotify = jest.fn();
    const view = await render(<StressCheckScreen assessmentRequest={0} onNotify={onNotify} />);
    expect(screen.queryByText('Đồng ý, bắt đầu')).not.toBeOnTheScreen();

    await view.rerender(<StressCheckScreen assessmentRequest={1} onNotify={onNotify} />);
    expect(screen.getByRole('button', { name: 'Đồng ý, bắt đầu' })).toBeOnTheScreen();
    expect(getAssessmentQuestions).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Để lúc khác' }));
    expect(screen.queryByText('Đồng ý, bắt đầu')).not.toBeOnTheScreen();

    await view.rerender(<StressCheckScreen assessmentRequest={2} onNotify={onNotify} />);
    expect(screen.getByRole('button', { name: 'Đồng ý, bắt đầu' })).toBeOnTheScreen();
    expect(getAssessmentQuestions).not.toHaveBeenCalled();
  });
});
