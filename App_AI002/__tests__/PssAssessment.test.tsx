import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { PssAssessment } from '../src/components/PssAssessment';
import {
  getAssessmentQuestions,
  scoreAssessment,
  type AssessmentQuestion,
  type AssessmentResult,
} from '../src/services/api';

jest.mock('../src/services/api', () => ({
  getAssessmentQuestions: jest.fn(),
  scoreAssessment: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () =>
  jest.requireActual<{ default: object }>('react-native-safe-area-context/jest/mock').default,
);

const questions: AssessmentQuestion[] = Array.from({ length: 10 }, (_, index) => ({
  item_id: index + 1,
  text_vi: `Câu hỏi thử ${index + 1}`,
  options: ['Không bao giờ', 'Hầu như không', 'Đôi khi', 'Khá thường xuyên', 'Rất thường xuyên'],
}));
const result: AssessmentResult = {
  total: 28,
  maximum: 40,
  level: 'Cao',
  explanation: 'Đây là phần giải thích từ máy chủ.',
  skills: [{ id: 'grounding', title: 'Neo mình vào hiện tại' }],
  needs_support: true,
};
const mockQuestions = jest.mocked(getAssessmentQuestions);
const mockScore = jest.mocked(scoreAssessment);

async function start() {
  await fireEvent.press(screen.getByRole('button', { name: 'Đồng ý, bắt đầu' }));
  await screen.findByText('Câu hỏi thử 1');
}

async function answerAll() {
  for (let index = 0; index < 10; index += 1) {
    await fireEvent.press(screen.getByRole('radio', { name: 'Đôi khi' }));
    if (index < 9) await fireEvent.press(screen.getByRole('button', { name: 'Câu tiếp theo' }));
  }
}

describe('<PssAssessment />', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockQuestions.mockResolvedValue({ questions });
    mockScore.mockResolvedValue(result);
  });

  test('requires consent and retries loading without submitting partial answers', async () => {
    mockQuestions.mockRejectedValueOnce(new Error('Không kết nối được máy chủ.'));
    const onClose = jest.fn();
    await render(<PssAssessment onClose={onClose} />);
    expect(mockQuestions).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Đồng ý, bắt đầu' }));
    expect(await screen.findByText('Không kết nối được máy chủ.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Thử tải lại' }));
    await screen.findByText('Câu hỏi thử 1');
    expect(screen.getByRole('button', { name: 'Câu tiếp theo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Câu trước' })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Câu tiếp theo' }));
    expect(screen.getByText('Câu hỏi thử 1')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Dừng bài đánh giá' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockScore).not.toHaveBeenCalled();
  });

  test('rejects an incomplete questionnaire from the server', async () => {
    mockQuestions.mockResolvedValue({ questions: questions.slice(0, 9) });
    await render(<PssAssessment onClose={jest.fn()} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Đồng ý, bắt đầu' }));
    expect(await screen.findByText('Bộ câu hỏi chưa đầy đủ. Vui lòng thử lại.')).toBeOnTheScreen();
    expect(screen.queryByRole('radio')).not.toBeOnTheScreen();
    expect(mockScore).not.toHaveBeenCalled();
  });

  test('preserves edited answers and shows the backend result after all ten answers', async () => {
    const onNavigate = jest.fn();
    const onClose = jest.fn();
    await render(<PssAssessment onClose={onClose} onNavigate={onNavigate} />);
    await start();
    await fireEvent.press(screen.getByRole('radio', { name: 'Không bao giờ' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Câu tiếp theo' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Câu trước' }));
    expect(screen.getByRole('radio', { name: 'Không bao giờ' })).toBeSelected();

    await answerAll();
    expect(mockScore).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(await screen.findByRole('header', { name: 'Kết quả PSS-10' })).toBeOnTheScreen();
    expect(mockScore).toHaveBeenCalledWith(Array(10).fill(2));
    expect(screen.getByLabelText('28 trên 40 điểm')).toBeOnTheScreen();
    expect(screen.getByText(result.explanation)).toBeOnTheScreen();
    expect(screen.getByText('• Neo mình vào hiện tại')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Xem kênh hỗ trợ' }));
    expect(onNavigate).toHaveBeenCalledWith('alerts');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('retains answers for score retry and prevents duplicate submission', async () => {
    let finish: ((value: AssessmentResult) => void) | undefined;
    mockScore.mockRejectedValueOnce(new Error('Tạm mất kết nối.'));
    mockScore.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await render(<PssAssessment onClose={jest.fn()} />);
    await start();
    await answerAll();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(await screen.findByText('Tạm mất kết nối.')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'Đôi khi' })).toBeSelected();

    await fireEvent.press(screen.getByRole('button', { name: 'Thử gửi lại' }));
    expect(screen.getByRole('button', { name: 'Xem kết quả' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Xem kết quả' }));
    expect(mockScore).toHaveBeenCalledTimes(2);
    expect(mockScore).toHaveBeenLastCalledWith(Array(10).fill(2));
    await act(async () => { finish?.(result); });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Kết quả PSS-10' })).toBeOnTheScreen());
  });
});
