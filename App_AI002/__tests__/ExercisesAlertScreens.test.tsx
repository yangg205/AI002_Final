import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';

import { AlertScreen } from '../src/screens/AlertScreen';
import { ExercisesScreen } from '../src/screens/ExercisesScreen';

describe('<ExercisesScreen />', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });
  test('renders all three exercises', async () => {
    await render(<ExercisesScreen onNotify={jest.fn()} />);

    expect(
      screen.getByRole('header', { name: 'Hít thở sâu' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Nghe nhạc vui' }),
    ).toBeOnTheScreen();
    expect(
      screen.getByRole('header', { name: 'Nhảy theo nhạc' }),
    ).toBeOnTheScreen();
  });

  test('keeps only the latest exercise active and notifies each change', async () => {
    const onNotify = jest.fn();
    await render(<ExercisesScreen onNotify={onNotify} />);

    const breathing = screen.getByTestId('exercise-breathing');
    const music = screen.getByTestId('exercise-music');
    const dance = screen.getByTestId('exercise-dance');

    await fireEvent.press(breathing);

    expect(breathing).toBeSelected();
    expect(music).not.toBeSelected();
    expect(dance).not.toBeSelected();
    expect(onNotify).toHaveBeenNthCalledWith(
      1,
      'Bắt đầu bài tập Hít thở sâu trong 3 phút',
    );

    await fireEvent.press(music);

    expect(breathing).not.toBeSelected();
    expect(music).toBeSelected();
    expect(dance).not.toBeSelected();
    expect(onNotify).toHaveBeenNthCalledWith(
      2,
      'Bắt đầu bài tập Nghe nhạc vui trong 5 phút',
    );
  });

  test('keeps feedback single-select and reports the selected feeling', async () => {
    const onNotify = jest.fn();
    await render(<ExercisesScreen onNotify={onNotify} />);

    const relieved = screen.getByTestId('exercise-feedback-relieved');
    const calm = screen.getByTestId('exercise-feedback-calm');

    await fireEvent.press(relieved);
    expect(relieved).toBeSelected();
    expect(calm).not.toBeSelected();

    await fireEvent.press(calm);
    expect(relieved).not.toBeSelected();
    expect(calm).toBeSelected();
    expect(onNotify).toHaveBeenLastCalledWith(
      'Cảm ơn bạn đã chia sẻ: Bình tĩnh',
    );
  });

  test('counts down with breathing guidance, pauses, resumes and resets', async () => {
    await render(<ExercisesScreen onNotify={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('exercise-breathing'));
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('03:00');
    expect(screen.getByTestId('exercise-guidance-breathing')).toHaveTextContent(/Hít vào nhẹ nhàng/);

    await act(async () => { jest.advanceTimersByTime(6000); });
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('02:54');
    expect(screen.getByTestId('exercise-guidance-breathing')).toHaveTextContent(/Thở ra nhẹ nhàng/);
    await fireEvent.press(screen.getByRole('button', { name: 'Tạm dừng Hít thở sâu' }));
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('02:54');

    await fireEvent.press(screen.getByRole('button', { name: 'Tiếp tục Hít thở sâu' }));
    await act(async () => { jest.advanceTimersByTime(2000); });
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('02:52');
    await fireEvent.press(screen.getByRole('button', { name: 'Đặt lại Hít thở sâu' }));
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('03:00');
    expect(screen.getByTestId('exercise-breathing')).not.toBeSelected();
  });

  test('pauses when another tab is selected and requires an explicit resume', async () => {
    const onNotify = jest.fn();
    await render(<ExercisesScreen active onNotify={onNotify} />);
    await fireEvent.press(screen.getByTestId('exercise-breathing'));
    await act(async () => { jest.advanceTimersByTime(1000); });
    await screen.rerender(<ExercisesScreen active={false} onNotify={onNotify} />);
    await act(async () => { jest.advanceTimersByTime(10000); });
    await screen.rerender(<ExercisesScreen active onNotify={onNotify} />);
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('02:59');
    expect(screen.getByRole('button', { name: 'Tiếp tục Hít thở sâu' })).toBeOnTheScreen();
  });

  test('pauses when the app goes into the background', async () => {
    let onAppStateChange: ((state: 'background') => void) | undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      onAppStateChange = listener;
      return { remove: jest.fn() };
    });
    await render(<ExercisesScreen onNotify={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('exercise-music'));
    await act(async () => { jest.advanceTimersByTime(1000); });
    await act(async () => { onAppStateChange?.('background'); });
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(screen.getByTestId('exercise-timer-music')).toHaveTextContent('04:59');
    expect(screen.getByTestId('exercise-music')).not.toBeSelected();
    expect(screen.getByText(/JoyfulMind chỉ đếm thời gian, không phát nhạc/)).toBeOnTheScreen();
  });

  test('finishes once at zero and starts a fresh session on replay', async () => {
    const onNotify = jest.fn();
    await render(<ExercisesScreen onNotify={onNotify} />);
    await fireEvent.press(screen.getByTestId('exercise-breathing'));
    await act(async () => { jest.advanceTimersByTime(180000); });
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('00:00');
    expect(screen.getByText('Hoàn thành')).toBeOnTheScreen();
    expect(onNotify).toHaveBeenCalledTimes(2);
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(onNotify).toHaveBeenCalledTimes(2);
    await fireEvent.press(screen.getByRole('button', { name: 'Tập lại Hít thở sâu' }));
    expect(screen.getByTestId('exercise-timer-breathing')).toHaveTextContent('03:00');
  });
});

describe('<AlertScreen />', () => {
  afterEach(() => jest.restoreAllMocks());
  test('asks the user to configure a trusted contact before calling', async () => {
    const onNotify = jest.fn();
    await render(
      <AlertScreen onNavigate={jest.fn()} onNotify={onNotify} />,
    );

    await fireEvent.press(screen.getByTestId('alert-call-action'));

    expect(onNotify).toHaveBeenCalledWith(
      'Bạn cần cấu hình số điện thoại người thân trước khi gọi',
    );
  });

  test('navigates chat and breathing actions to the correct tabs', async () => {
    const onNavigate = jest.fn();
    await render(
      <AlertScreen onNavigate={onNavigate} onNotify={jest.fn()} />,
    );

    await fireEvent.press(screen.getByTestId('alert-chat-action'));
    expect(onNavigate).toHaveBeenNthCalledWith(1, 'chat');

    await fireEvent.press(screen.getByTestId('alert-breathing-action'));
    expect(onNavigate).toHaveBeenNthCalledWith(2, 'exercises');
  });

  test('validates a contact and only opens its normalized phone number on a call press', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<AlertScreen onNavigate={jest.fn()} onNotify={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu liên hệ tin cậy' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Nhập tên người bạn muốn liên hệ.');
    await fireEvent.changeText(screen.getByLabelText('Tên liên hệ tin cậy'), 'Chị Lan');
    await fireEvent.changeText(screen.getByLabelText('Số điện thoại liên hệ tin cậy'), 'tel:0912345678');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu liên hệ tin cậy' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/7–15 chữ số/);
    expect(openURL).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('Số điện thoại liên hệ tin cậy'), '+84 912 345 678');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu liên hệ tin cậy' }));
    expect(screen.getByText('+84912345678')).toBeOnTheScreen();
    expect(screen.getByText(/Liên hệ chỉ được giữ trong phiên này/)).toBeOnTheScreen();
    expect(openURL).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('alert-call-action'));
    expect(openURL).toHaveBeenCalledWith('tel:+84912345678');
  });

  test('allows editing a saved contact and cancelling without changing the call number', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<AlertScreen onNavigate={jest.fn()} onNotify={jest.fn()} />);
    await fireEvent.changeText(screen.getByLabelText('Tên liên hệ tin cậy'), 'Chị Lan');
    await fireEvent.changeText(screen.getByLabelText('Số điện thoại liên hệ tin cậy'), '0912345678');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu liên hệ tin cậy' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sửa liên hệ tin cậy' }));
    await fireEvent.changeText(screen.getByLabelText('Số điện thoại liên hệ tin cậy'), '0987654321');
    await fireEvent.press(screen.getByRole('button', { name: 'Hủy sửa liên hệ' }));
    await fireEvent.press(screen.getByTestId('alert-call-action'));
    expect(openURL).toHaveBeenLastCalledWith('tel:0912345678');

    await fireEvent.press(screen.getByRole('button', { name: 'Sửa liên hệ tin cậy' }));
    await fireEvent.changeText(screen.getByLabelText('Số điện thoại liên hệ tin cậy'), '0987654321');
    await fireEvent.press(screen.getByRole('button', { name: 'Lưu liên hệ tin cậy' }));
    await fireEvent.press(screen.getByTestId('alert-call-action'));
    expect(openURL).toHaveBeenLastCalledWith('tel:0987654321');
  });

  test('opens the Vietnam emergency number without needing a saved contact', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await render(<AlertScreen onNavigate={jest.fn()} onNotify={jest.fn()} />);
    await fireEvent.press(screen.getByTestId('alert-emergency-action'));
    expect(openURL).toHaveBeenCalledWith('tel:115');
  });

  test('shows the phone number as a fallback if the device cannot open a call', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No phone app'));
    const onNotify = jest.fn();
    await render(<AlertScreen onNavigate={jest.fn()} onNotify={onNotify} />);
    await fireEvent.press(screen.getByTestId('alert-emergency-action'));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Bạn có thể gọi trực tiếp số 115./);
    });
    expect(onNotify).toHaveBeenCalledWith(expect.stringContaining('115'));
  });
});
