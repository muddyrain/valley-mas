import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  ConversationToolCard,
  type ConversationToolCardData,
  getArtifactAvailability,
} from './ConversationToolCard';

describe('ConversationToolCard', () => {
  it('renders a blocking clarification with suggestions and round limit', () => {
    const card: ConversationToolCardData = {
      type: 'clarification',
      id: 'target-format',
      question: '请选择目标格式',
      reason: '转换前需要确认输出格式',
      answerType: 'single_select',
      suggestions: [
        { label: 'PNG', value: 'png' },
        { label: 'JPG', value: 'jpg' },
      ],
      allowCustomAnswer: true,
      blocking: true,
      round: 1,
      maxRounds: 3,
      status: 'pending',
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} />);
    expect(markup).toContain('请选择目标格式');
    expect(markup).toContain('转换前需要确认输出格式');
    expect(markup).toContain('PNG');
    expect(markup).toContain('第 1/3 轮');
    expect(markup).toContain('回复消息补充');
    expect(markup).toContain('不提供');
  });

  it('allows a non-blocking clarification to use a safe default', () => {
    const card: ConversationToolCardData = {
      type: 'clarification',
      id: 'quality',
      question: '需要什么清晰度？',
      reason: '未填写时使用默认清晰度',
      answerType: 'single_select',
      suggestions: [],
      allowCustomAnswer: true,
      blocking: false,
      round: 1,
      maxRounds: 1,
      status: 'pending',
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} />);
    expect(markup).toContain('使用默认值');
    expect(markup).toContain('不提供');
  });

  it('keeps an answered clarification visible with its selected option locked', () => {
    const card: ConversationToolCardData = {
      type: 'clarification',
      id: 'destination',
      question: '你更想去哪个城市？',
      reason: '选择后继续规划',
      answerType: 'single_select',
      suggestions: [
        { label: '杭州', value: '杭州' },
        { label: '苏州', value: '苏州' },
        { label: '南京', value: '南京' },
      ],
      allowCustomAnswer: true,
      blocking: true,
      round: 1,
      maxRounds: 3,
      status: 'answered',
      decision: 'answer',
      answer: '南京',
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} />);
    expect(markup).toContain('已回答');
    expect(markup).toContain('已选择：南京');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('disabled=""');
    expect(markup).not.toContain('不提供');
  });

  it('renders generated plan details as selectable choices', () => {
    const card: ConversationToolCardData = {
      type: 'clarification',
      id: 'travel-plan',
      question: '请选择一个周末方案',
      reason: '选择后继续细化行程',
      answerType: 'single_select',
      suggestions: [
        { label: '古都文化线', value: '古都文化线', description: '中山陵、明孝陵和博物院' },
        { label: '城市漫游线', value: '城市漫游线', description: '老门东、城墙和秦淮河' },
        { label: '自然放松线', value: '自然放松线', description: '紫金山、玄武湖和汤山' },
      ],
      allowCustomAnswer: true,
      blocking: false,
      round: 1,
      maxRounds: 3,
      status: 'pending',
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} />);
    expect(markup).toContain('古都文化线');
    expect(markup).toContain('中山陵、明孝陵和博物院');
    expect(markup).toContain('城市漫游线');
    expect(markup).toContain('自然放松线');
  });

  it('renders a retryable structured tool error', () => {
    const card: ConversationToolCardData = {
      type: 'tool_error',
      title: '图片转换失败',
      message: '文件暂时无法读取，请稍后重试。',
      errorCode: 'ARTIFACT_STORAGE_UNAVAILABLE',
      retryable: true,
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} onRetry={() => {}} />);
    expect(markup).toContain('图片转换失败');
    expect(markup).toContain('文件暂时无法读取，请稍后重试。');
    expect(markup).toContain('重试');
  });

  it('marks an expired private artifact as unavailable', () => {
    const card: ConversationToolCardData = {
      type: 'file_artifact',
      artifactId: 'artifact-1',
      fileName: 'report.docx',
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      sizeBytes: 4096,
      expiresAt: '2026-08-08T12:00:00Z',
    };

    const now = new Date('2026-08-09T12:00:00Z');
    expect(getArtifactAvailability(card, now)).toBe('expired');
    const markup = renderToStaticMarkup(<ConversationToolCard card={card} now={now} />);
    expect(markup).toContain('已过期');
    expect(markup).not.toContain('下载文件');
  });

  it('keeps persisted artifacts available after their former expiry', () => {
    const card: ConversationToolCardData = {
      type: 'file_artifact',
      artifactId: 'artifact-2',
      fileName: 'saved.md',
      contentType: 'text/markdown',
      sizeBytes: 128,
      expiresAt: '2026-08-08T12:00:00Z',
      persistedAt: '2026-08-08T11:00:00Z',
      downloadUrl: '/download/artifact-2',
    };

    expect(getArtifactAvailability(card, new Date('2026-08-09T12:00:00Z'))).toBe('available');
  });

  it('renders a conversion result with its source and target formats', () => {
    const card: ConversationToolCardData = {
      type: 'conversion_result',
      sourceFormat: 'pdf',
      targetFormat: 'docx',
      summary: '转换完成',
      artifact: {
        type: 'file_artifact',
        artifactId: 'artifact-3',
        fileName: 'report.docx',
        contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 2048,
      },
    };

    const markup = renderToStaticMarkup(<ConversationToolCard card={card} />);
    expect(markup).toContain('PDF');
    expect(markup).toContain('DOCX');
    expect(markup).toContain('转换完成');
    expect(markup).toContain('report.docx');
  });
});
