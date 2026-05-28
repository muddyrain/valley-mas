import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  analyzeImage,
  deleteWeeklyReview,
  generateTodayAdvice,
  generateWeeklyReview,
  listWeeklyReviews,
} from '../src/api/advice';

const token = 'test-token';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('advice api', () => {
  it('generates today advice with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          summary: '今天先完成一件轻量计划。',
          list: [{ id: 'plan', title: '今日计划', detail: '先做最轻的一件', tone: 'alert' }],
          source: 'ark',
          model: 'ep-test',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await generateTodayAdvice(token);

    expect(data.summary).toContain('轻量计划');
    expect(data.list[0].id).toBe('plan');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/today-advice',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('generates weekly review with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          summary: '这周完成了主要生活计划。',
          wins: ['完成电影计划'],
          delays: ['阅读计划还没开始'],
          insights: ['晚上更适合轻量安排'],
          nextActions: ['下周先安排阅读'],
          source: 'ark',
          model: 'ep-test',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await generateWeeklyReview(token);

    expect(data.summary).toContain('生活计划');
    expect(data.nextActions[0]).toContain('阅读');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/weekly-review',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('lists persisted weekly reviews with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          list: [
            {
              id: 'review-1',
              weekStart: '2026-05-22',
              weekEnd: '2026-05-28',
              summary: '这周完成了主要生活计划。',
              wins: ['完成电影计划'],
              delays: ['阅读计划还没开始'],
              insights: ['晚上更适合轻量安排'],
              nextActions: ['下周先安排阅读'],
              source: 'ark',
              model: 'ep-test',
            },
          ],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await listWeeklyReviews(token);

    expect(data.list[0].id).toBe('review-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/weekly-reviews',
      expect.objectContaining({
        credentials: 'include',
        method: 'GET',
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
  });

  it('surfaces api error messages for weekly review failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        code: 503,
        message: 'AI 未配置：缺少 ARK_API_KEY',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(generateWeeklyReview(token)).rejects.toThrow('AI 未配置：缺少 ARK_API_KEY');
  });

  it('deletes weekly reviews with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: { id: 'review-1' },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await deleteWeeklyReview(token, 'review-1');

    expect(data.id).toBe('review-1');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/weekly-reviews/review-1',
      expect.objectContaining({
        credentials: 'include',
        method: 'DELETE',
        headers: expect.any(Headers),
      }),
    );
  });

  it('analyzes an image with bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        message: 'success',
        data: {
          title: '安排一次放松晚餐',
          summary: '图片里是一份适合周五晚上慢慢享用的晚餐。',
          planType: '吃饭',
          mood: '满足',
          tags: ['美食', '晚餐'],
          schedule: { dateOption: '周五', time: '19:30' },
          source: 'ark',
          model: 'ep-vision',
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await analyzeImage(token, {
      imageUrl: 'https://example.com/dinner.jpg',
      kind: '美食照片',
    });

    expect(data.planType).toBe('吃饭');
    expect(data.schedule.time).toBe('19:30');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/life-trace/ai/image-analysis',
      expect.objectContaining({
        credentials: 'include',
        method: 'POST',
        body: JSON.stringify({
          imageUrl: 'https://example.com/dinner.jpg',
          kind: '美食照片',
        }),
        headers: expect.any(Headers),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
    expect(headers.get('Content-Type')).toBe('application/json');
  });
});
