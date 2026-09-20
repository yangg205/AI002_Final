import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ChatScreen } from '../src/screens/ChatScreen';
import { getHealth, sendChat, type ChatReply } from '../src/services/api';

jest.mock('../src/services/api', () => ({
  getHealth: jest.fn(), sendChat: jest.fn(), getApiBaseUrl: () => 'http://localhost:8000', setApiBaseUrl: jest.fn(),
}));
const reply: ChatReply = { reply: 'Mình đang lắng nghe bạn.', risk: false, mode: 'ai', engine: 'chatbot-demo', intent: 'sharing', suggest_assessment: false };
const send = jest.mocked(sendChat);
async function typeAndSend(text: string) {
  await fireEvent.changeText(screen.getByLabelText('Tin nhắn cho Joy'), text);
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
}
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getHealth).mockResolvedValue({ status: 'ok', ai_available: true, rag_available: false });
  send.mockResolvedValue(reply);
});
test('sends real messages and only earlier conversation as context', async () => {
  await render(<ChatScreen onNotify={jest.fn()} />);
  expect(screen.queryByText(/Mình cảm thấy hơi mệt mỏi với công việc hiện tại/)).toBeNull();
  await typeAndSend('Hôm nay mình mệt.');
  expect(await screen.findByText(reply.reply)).toBeOnTheScreen();
  const greeting = 'Chào bạn, mình là Hệ thống hỗ trợ cảm xúc. Dạo này bạn thế nào? Bạn có thể kể bất cứ điều gì đang ở trong đầu, mình nghe.';
  expect(send).toHaveBeenNthCalledWith(1, 'Hôm nay mình mệt.', [
    { role: 'assistant', content: greeting },
  ], expect.anything());
  await typeAndSend('Mình muốn kể tiếp.');
  expect(send).toHaveBeenNthCalledWith(2, 'Mình muốn kể tiếp.', [
    { role: 'assistant', content: greeting },
    { role: 'user', content: 'Hôm nay mình mệt.' }, { role: 'assistant', content: reply.reply },
  ], expect.anything());
  expect(screen.getByLabelText('Tin nhắn cho Joy')).toHaveProp('value', '');
});
test('blocks duplicate sends while waiting and retries without duplicate user messages', async () => {
  let reject: (error: Error) => void = () => {};
  send.mockImplementationOnce(() => new Promise((_resolve, rejectPromise) => { reject = rejectPromise; }));
  await render(<ChatScreen onNotify={jest.fn()} />);
  await typeAndSend('Mình muốn nghỉ ngơi.');
  expect(screen.getByRole('button', { name: 'Gửi tin nhắn' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi tin nhắn' }));
  expect(send).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error('Mạng bị gián đoạn.')));
  expect(await screen.findByText('Mạng bị gián đoạn.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Gửi lại' }));
  expect(await screen.findByText(reply.reply)).toBeOnTheScreen();
  expect(screen.getAllByText('Mình muốn nghỉ ngơi.')).toHaveLength(1);
  expect(send).toHaveBeenNthCalledWith(2, 'Mình muốn nghỉ ngơi.', [
    { role: 'assistant', content: expect.stringContaining('Hệ thống hỗ trợ cảm xúc') },
  ], expect.anything());
});
test('routes crisis support and PSS suggestions to real screens', async () => {
  const onNavigate = jest.fn();
  const onRequestAssessment = jest.fn();
  send.mockResolvedValueOnce({ ...reply, risk: true, mode: 'crisis', suggest_assessment: true });
  await render(<ChatScreen onNotify={jest.fn()} onNavigate={onNavigate} onRequestAssessment={onRequestAssessment} />);
  await typeAndSend('Mình cần giúp đỡ.');
  await fireEvent.press(await screen.findByRole('button', { name: 'Mở các kênh hỗ trợ ngay' }));
  expect(onNavigate).toHaveBeenCalledWith('alerts');
  expect(screen.queryByText('Tìm hiểu bài đánh giá PSS-10')).toBeNull();
  send.mockResolvedValueOnce({ ...reply, suggest_assessment: true });
  await typeAndSend('Mình muốn làm đánh giá.');
  await fireEvent.press(await screen.findByRole('button', { name: 'Tìm hiểu bài đánh giá PSS-10' }));
  expect(onRequestAssessment).toHaveBeenCalledTimes(1);
});
test('discards a late response after starting a new conversation', async () => {
  let resolve: (value: ChatReply) => void = () => {};
  send.mockImplementationOnce(() => new Promise(resolvePromise => { resolve = resolvePromise; }));
  await render(<ChatScreen onNotify={jest.fn()} />);
  await typeAndSend('Câu chuyện trước.');
  await fireEvent.press(screen.getByRole('button', { name: 'Cuộc trò chuyện mới' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Bắt đầu mới' }));
  await act(async () => resolve(reply));
  expect(screen.queryByText('Câu chuyện trước.')).toBeNull();
  expect(screen.queryByText(reply.reply)).toBeNull();
});
test('labels fallback replies honestly', async () => {
  send.mockResolvedValueOnce({ ...reply, mode: 'scripted' });
  await render(<ChatScreen onNotify={jest.fn()} />);
  await typeAndSend('Chào Joy');
  expect(await screen.findByText('Backend chatbot-demo · Phản hồi có sẵn')).toBeOnTheScreen();
});

test('shows that replies come from the chatbot-demo backend', async () => {
  await render(<ChatScreen onNotify={jest.fn()} />);
  await typeAndSend('Chào backend');
  expect(await screen.findByText('Backend chatbot-demo · Phản hồi AI')).toBeOnTheScreen();
});
