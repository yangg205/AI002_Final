import { Platform } from 'react-native';

export type AssessmentQuestion = {
  item_id: number;
  text_vi: string;
  options: string[];
};

export type AssessmentResult = {
  total: number;
  maximum: number;
  level: string;
  explanation: string;
  skills: { id: string; title: string }[];
  needs_support: boolean;
};

export type HealthStatus = {
  status: 'ok';
  engine?: 'chatbot-demo';
  ai_available: boolean;
  rag_available: boolean;
};

export type HistoryMessage = { role: 'user' | 'assistant'; content: string };
export type ChatReply = {
  reply: string;
  risk: boolean;
  mode: 'ai' | 'scripted' | 'crisis' | 'rag' | 'unavailable';
  engine?: 'chatbot-demo';
  intent?: 'sharing' | 'advice' | 'meta';
  suggest_assessment: boolean;
  sources?: { title: string; pages: string }[];
};

export type AuthUser = {
  id: number;
  username: string;
  consent_at: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUser;
};

const webHostname = typeof window !== 'undefined' ? window.location?.hostname : undefined;
const defaultHost = Platform.OS === 'web' && webHostname
  ? webHostname
  : Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const defaultUrl = `http://${defaultHost.includes(':') ? `[${defaultHost}]` : defaultHost}:8000`;
let baseUrl = (process.env.EXPO_PUBLIC_API_URL || defaultUrl)
  .trim()
  .replace(/\/+$/, '')
  .replace(/\/api$/, '');

export const getApiBaseUrl = () => baseUrl;

export function isValidApiBaseUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return ['http:', 'https:'].includes(parsed.protocol) && !parsed.username &&
      !parsed.password && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

export function setApiBaseUrl(value: string): void {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Nhập địa chỉ đầy đủ, ví dụ http://192.168.1.10:8000');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Địa chỉ cần dùng http hoặc https, không kèm mật khẩu hay tham số.');
  }
  baseUrl = parsed.toString().replace(/\/+$/, '').replace(/\/api$/, '');
}

export class ApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, path === '/health' ? 8000 : 120000);
  try {
    const response = await fetch(`${baseUrl}/api${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? { Accept: 'application/json' } : {
        Accept: 'application/json', 'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    if (!response.ok) {
      let message = 'Chưa xử lý được yêu cầu. Bạn thử lại nhé.';
      try {
        const payload = await response.json() as { detail?: unknown };
        if (typeof payload.detail === 'string') message = payload.detail;
      } catch { /* Keep the friendly fallback for non-JSON errors. */ }
      if (response.status === 429 || response.status === 503) {
        message = 'Dịch vụ tài khoản tạm thời chưa sẵn sàng. Bạn thử lại sau nhé.';
      }
      throw new ApiError(message, response.status);
    }
    return await response.json() as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (signal?.aborted) throw new ApiError('Đã dừng chờ phản hồi.');
    if (controller.signal.aborted) throw new ApiError('Phản hồi mất nhiều thời gian hơn dự kiến. Bạn có thể thử gửi lại.');
    throw new ApiError('Chưa kết nối được với Joy. Kiểm tra mạng và địa chỉ máy chủ rồi thử lại nhé.');
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function authenticate(path: '/auth/register' | '/auth/login', username: string, password: string): Promise<AuthResponse> {
  const result = await request<AuthResponse>(path, { username, password });
  if (typeof result.access_token !== 'string' || result.token_type !== 'bearer' ||
      !Number.isInteger(result.expires_in) || !result.user ||
      !Number.isInteger(result.user.id) || typeof result.user.username !== 'string') {
    throw new ApiError('Phản hồi xác thực từ máy chủ chưa đầy đủ.');
  }
  return result;
}

export const registerAccount = (username: string, password: string) =>
  authenticate('/auth/register', username, password);

export const loginAccount = (username: string, password: string) =>
  authenticate('/auth/login', username, password);

export async function getHealth(signal?: AbortSignal): Promise<HealthStatus> {
  const result = await request<HealthStatus>('/health', undefined, signal);
  if (result.status !== 'ok' || typeof result.ai_available !== 'boolean' || typeof result.rag_available !== 'boolean') {
    throw new ApiError('Địa chỉ này chưa trả về đúng dịch vụ JoyfulMind.');
  }
  return result;
}

export async function sendChat(message: string, history: HistoryMessage[], signal?: AbortSignal): Promise<ChatReply> {
  const result = await request<ChatReply>('/chat', { message, history: history.slice(-12) }, signal);
  if (typeof result.reply !== 'string' || !result.reply.trim() || typeof result.risk !== 'boolean' ||
      !['ai', 'scripted', 'crisis', 'rag', 'unavailable'].includes(result.mode)) {
    throw new ApiError('Phản hồi từ Joy chưa đầy đủ. Bạn thử gửi lại nhé.');
  }
  return result;
}

export async function getAssessmentQuestions(): Promise<{ questions: AssessmentQuestion[] }> {
  const result = await request<{ questions: AssessmentQuestion[] }>('/assessment/questions');
  if (!Array.isArray(result.questions) || result.questions.length !== 10 ||
      result.questions.some((question, index) => question.item_id !== index + 1 ||
        typeof question.text_vi !== 'string' || !Array.isArray(question.options) ||
        question.options.length !== 5 || question.options.some(option => typeof option !== 'string'))) {
    throw new ApiError('Chưa tải được bộ câu hỏi đầy đủ. Bạn thử lại nhé.');
  }
  return result;
}

export async function scoreAssessment(answers: number[]): Promise<AssessmentResult> {
  const result = await request<AssessmentResult>('/assessment/score', { answers });
  if (!Number.isInteger(result.total) || result.total < 0 || result.total > 40 || result.maximum !== 40 ||
      typeof result.level !== 'string' || typeof result.explanation !== 'string' ||
      typeof result.needs_support !== 'boolean' || !Array.isArray(result.skills) ||
      result.skills.some(skill => typeof skill.id !== 'string' || typeof skill.title !== 'string')) {
    throw new ApiError('Kết quả chưa đầy đủ. Bạn thử gửi lại bài đánh giá nhé.');
  }
  return result;
}
