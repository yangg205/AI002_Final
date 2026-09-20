import { ApiError, getApiBaseUrl, getAssessmentQuestions, getHealth, scoreAssessment, sendChat, setApiBaseUrl } from '../src/services/api';
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();
beforeEach(() => { globalThis.fetch = fetchMock; fetchMock.mockReset(); setApiBaseUrl('http://localhost:8000'); });
afterEach(() => { globalThis.fetch = originalFetch; jest.useRealTimers(); });
const respond = (body: unknown, status = 200) => fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });

test('normalizes server URLs and rejects credential-bearing or invalid URLs', () => {
  setApiBaseUrl('https://example.test/api/');
  expect(getApiBaseUrl()).toBe('https://example.test');
  for (const value of ['javascript:alert(1)', 'http://user:password@example.test', 'http://example.test?key=private', 'not a url']) {
    expect(() => setApiBaseUrl(value)).toThrow();
  }
});
test('sends bounded history and parses the actual reply', async () => {
  const result = { reply: 'Xin chào', risk: false, mode: 'ai', suggest_assessment: false };
  respond(result);
  const history = Array.from({ length: 20 }, (_, i) => ({ role: 'user' as const, content: `Message ${i}` }));
  expect(await sendChat('Hôm nay', history)).toEqual(result);
  const [url, options] = fetchMock.mock.calls[0]!;
  expect(url).toBe('http://localhost:8000/api/chat');
  expect(JSON.parse(options.body)).toEqual({ message: 'Hôm nay', history: history.slice(-12) });
});
test('rejects malformed health and scoring data', async () => {
  respond({ status: 'ok' });
  await expect(getHealth()).rejects.toBeInstanceOf(ApiError);
  respond({ total: 42, maximum: 40, skills: [] });
  await expect(scoreAssessment(Array(10).fill(2))).rejects.toBeInstanceOf(ApiError);
  respond({ questions: [] });
  await expect(getAssessmentQuestions()).rejects.toBeInstanceOf(ApiError);
});
test('shows a safe message for server failures without exposing the raw error body', async () => {
  respond({ error: 'sensitive upstream detail' }, 503);
  await expect(sendChat('Chào', [])).rejects.toThrow('Joy đang bận');
});
test('cancels an in-flight request and clears its timer', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const controller = new AbortController();
  const pending = sendChat('Chào', [], controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow('Đã dừng chờ');
  expect(jest.getTimerCount()).toBe(0);
});
test('times out a health probe instead of waiting indefinitely', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')));
  }));
  const pending = getHealth();
  const rejected = expect(pending).rejects.toThrow('nhiều thời gian');
  await jest.advanceTimersByTimeAsync(8000);
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});
