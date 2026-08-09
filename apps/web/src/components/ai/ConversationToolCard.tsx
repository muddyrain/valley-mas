import { AlertCircle, CheckCircle2, Clock3, Download, LoaderCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { ConversationAttachmentCard, formatAttachmentSize } from './ConversationAttachmentCard';

export type ClarificationAnswerType = 'single_select' | 'multi_select' | 'text' | 'file';

export type ClarificationToolCard = {
  type: 'clarification';
  id: string;
  question: string;
  reason: string;
  answerType: ClarificationAnswerType;
  suggestions: Array<{ label: string; value: string; description?: string }>;
  allowCustomAnswer: boolean;
  blocking: boolean;
  round: number;
  maxRounds: number;
  status: 'pending' | 'answered' | 'skipped' | 'declined';
  decision?: 'answer' | 'skip' | 'decline';
  answer?: string;
};

export type ToolProgressCard = {
  type: 'tool_progress';
  toolName: string;
  title: string;
  statusMessage: string;
  progress: number;
  cancellable?: boolean;
};

export type FileArtifactToolCard = {
  type: 'file_artifact';
  artifactId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  downloadUrl?: string;
  expiresAt?: string;
  persistedAt?: string;
};

export type ConversionResultToolCard = {
  type: 'conversion_result';
  sourceFormat: string;
  targetFormat: string;
  summary: string;
  artifact: FileArtifactToolCard;
};

export type ToolErrorCard = {
  type: 'tool_error';
  title: string;
  message: string;
  errorCode?: string;
  retryable?: boolean;
};

export type ConversationToolCardData =
  | ClarificationToolCard
  | ToolProgressCard
  | FileArtifactToolCard
  | ConversionResultToolCard
  | ToolErrorCard;

export type ArtifactAvailability = 'available' | 'expired';

export function getArtifactAvailability(
  artifact: FileArtifactToolCard,
  now = new Date(),
): ArtifactAvailability {
  if (artifact.persistedAt || !artifact.expiresAt) return 'available';
  const expiresAt = new Date(artifact.expiresAt);
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() > now.getTime()
    ? 'available'
    : 'expired';
}

function formatExpiry(artifact: FileArtifactToolCard, now: Date) {
  if (artifact.persistedAt) return '已保存';
  if (!artifact.expiresAt) return '';
  const expiresAt = new Date(artifact.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) return '';
  const remainingHours = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 3_600_000));
  if (remainingHours === 0) return '已过期';
  if (remainingHours < 24) return `剩余 ${remainingHours} 小时`;
  return `剩余 ${Math.ceil(remainingHours / 24)} 天`;
}

function ArtifactCard({
  artifact,
  now,
  onOpen,
}: {
  artifact: FileArtifactToolCard;
  now: Date;
  onOpen?: (artifact: FileArtifactToolCard) => void;
}) {
  const availability = getArtifactAvailability(artifact, now);
  const expiry = formatExpiry(artifact, now);
  return (
    <Card size="sm" className="w-full max-w-xl border border-border/70 bg-card/90 shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {availability === 'expired' ? (
            <Clock3 className="size-4 text-muted-foreground" />
          ) : (
            <CheckCircle2 className="size-4 text-primary" />
          )}
          文件已生成
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ConversationAttachmentCard
          name={artifact.fileName}
          mimeType={artifact.contentType}
          sizeBytes={artifact.sizeBytes}
          secondary={[formatAttachmentSize(artifact.sizeBytes), expiry].filter(Boolean).join(' · ')}
          onOpen={availability === 'available' && onOpen ? () => onOpen(artifact) : undefined}
          className="w-full"
        />
      </CardContent>
      {availability === 'expired' ? (
        <CardFooter className="text-xs text-muted-foreground">已过期</CardFooter>
      ) : onOpen ? (
        <CardFooter>
          <Button size="sm" variant="outline" onClick={() => onOpen(artifact)}>
            <Download data-icon="inline-start" />
            下载文件
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function ConversationToolCard({
  card,
  now = new Date(),
  onSuggestion,
  onClarificationDecision,
  onOpenArtifact,
  onCancel,
  onRetry,
}: {
  card: ConversationToolCardData;
  now?: Date;
  onSuggestion?: (requestId: string, value: string) => void;
  onClarificationDecision?: (requestId: string, decision: 'skip' | 'decline') => void;
  onOpenArtifact?: (artifact: FileArtifactToolCard) => void;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  if (card.type === 'file_artifact') {
    return <ArtifactCard artifact={card} now={now} onOpen={onOpenArtifact} />;
  }

  if (card.type === 'conversion_result') {
    return (
      <div className="w-full max-w-xl space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary">{card.sourceFormat.toUpperCase()}</Badge>
          <span aria-hidden="true">→</span>
          <Badge variant="secondary">{card.targetFormat.toUpperCase()}</Badge>
          <span>{card.summary}</span>
        </div>
        <ArtifactCard artifact={card.artifact} now={now} onOpen={onOpenArtifact} />
      </div>
    );
  }

  if (card.type === 'clarification') {
    const pending = card.status === 'pending';
    const selectedSuggestion = card.suggestions.find(
      (suggestion) => suggestion.value === card.answer || suggestion.label === card.answer,
    );
    const answerLabel = selectedSuggestion?.label || card.answer || '';
    const statusLabel =
      card.status === 'answered'
        ? '已回答'
        : card.status === 'skipped'
          ? '已跳过'
          : card.status === 'declined'
            ? '未提供'
            : card.blocking
              ? '需要回答'
              : '可选';
    const resolvedSummary =
      card.status === 'answered'
        ? answerLabel
          ? `已选择：${answerLabel}`
          : '已回答'
        : card.status === 'skipped'
          ? '已使用默认值'
          : card.status === 'declined'
            ? '未提供'
            : '';
    const detailedSuggestions = card.suggestions.some((suggestion) => suggestion.description);
    return (
      <Card size="sm" className="w-full max-w-xl border border-border/70 bg-card/90 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <Badge variant={pending && card.blocking ? 'default' : 'secondary'}>
              {statusLabel}
            </Badge>
            <span className="text-xs text-muted-foreground">
              第 {card.round}/{card.maxRounds} 轮
            </span>
          </div>
          <CardTitle>{card.question}</CardTitle>
          <p className="text-sm text-muted-foreground">{card.reason}</p>
        </CardHeader>
        {card.suggestions.length > 0 ? (
          <CardContent className={detailedSuggestions ? 'grid gap-2' : 'flex flex-wrap gap-2'}>
            {card.suggestions.map((suggestion) => (
              <Button
                key={suggestion.value}
                size="sm"
                variant={selectedSuggestion?.value === suggestion.value ? 'secondary' : 'outline'}
                className={cn(
                  detailedSuggestions && 'h-auto w-full justify-start px-3 py-2.5 text-left',
                  selectedSuggestion?.value === suggestion.value && 'ring-1 ring-primary/30',
                )}
                disabled={!pending || !onSuggestion}
                aria-pressed={selectedSuggestion?.value === suggestion.value}
                onClick={() => onSuggestion?.(card.id, suggestion.value)}
              >
                {suggestion.description ? (
                  <span className="grid min-w-0 gap-0.5 whitespace-normal">
                    <span className="font-medium">{suggestion.label}</span>
                    <span className="text-xs font-normal leading-5 text-muted-foreground">
                      {suggestion.description}
                    </span>
                  </span>
                ) : (
                  suggestion.label
                )}
              </Button>
            ))}
          </CardContent>
        ) : null}
        <CardFooter className="flex flex-wrap justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {pending
              ? card.allowCustomAnswer
                ? '回复消息补充'
                : '请选择一个答案'
              : resolvedSummary}
          </span>
          {pending ? (
            <div className="flex flex-wrap gap-2">
              {!card.blocking ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!onClarificationDecision}
                  onClick={() => onClarificationDecision?.(card.id, 'skip')}
                >
                  使用默认值
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                disabled={!onClarificationDecision}
                onClick={() => onClarificationDecision?.(card.id, 'decline')}
              >
                不提供
              </Button>
            </div>
          ) : null}
        </CardFooter>
      </Card>
    );
  }

  if (card.type === 'tool_progress') {
    return (
      <Card size="sm" className="w-full max-w-xl border border-border/70 bg-card/90 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LoaderCircle className="size-4 animate-spin text-primary" />
            {card.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{card.statusMessage}</p>
        </CardHeader>
        <CardContent>
          <Progress value={Math.min(100, Math.max(0, card.progress))} />
        </CardContent>
        {card.cancellable && onCancel ? (
          <CardFooter>
            <Button size="sm" variant="outline" onClick={onCancel}>
              停止
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    );
  }

  return (
    <Card size="sm" className="w-full max-w-xl border border-border/70 bg-card/90 shadow-xs">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="size-4" />
          {card.title}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{card.message}</p>
      </CardHeader>
      {card.retryable && onRetry ? (
        <CardFooter>
          <Button size="sm" variant="outline" onClick={onRetry}>
            重试
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
