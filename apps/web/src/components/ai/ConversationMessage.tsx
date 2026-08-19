import { UserRound } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import {
  ConversationAttachmentCard,
  type ConversationAttachmentStatus,
} from '@/components/ai/ConversationAttachmentCard';
import {
  ConversationMessageBubble,
  type ConversationMessageBubbleProps,
} from '@/components/ai/ConversationMessageBubble';
import ImagePreviewDialog from '@/components/ImagePreviewDialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type ConversationMessageParticipant = {
  name: string;
  avatarUrl?: string;
};

export type ConversationMessageAttachment = {
  id: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  previewUrl?: string;
  status?: ConversationAttachmentStatus;
  secondary?: string;
  onOpen?: () => void;
};

export type ConversationMessageProps = Omit<ConversationMessageBubbleProps, 'header' | 'role'> & {
  messageRole: ConversationMessageBubbleProps['role'];
  user?: ConversationMessageParticipant;
  assistant?: ConversationMessageParticipant;
  attachments?: ConversationMessageAttachment[];
  header?: ReactNode;
  rowClassName?: string;
};

export function ConversationMessage({
  messageRole,
  user = { name: '用户' },
  assistant = { name: '助手' },
  attachments = [],
  header,
  rowClassName,
  ...bubbleProps
}: ConversationMessageProps) {
  const isUser = messageRole === 'user';
  const [imagePreview, setImagePreview] = useState<{ src: string; title: string } | null>(null);
  const messageHeader =
    attachments.length > 0 ? (
      <div className={cn('flex flex-wrap gap-2', isUser && 'justify-end')}>
        {attachments.map((attachment) => {
          const canPreviewImage = Boolean(
            attachment.previewUrl &&
              (!attachment.mimeType || attachment.mimeType.startsWith('image/')),
          );
          return (
            <ConversationAttachmentCard
              key={attachment.id}
              {...attachment}
              onOpen={
                canPreviewImage
                  ? () =>
                      setImagePreview({
                        src: attachment.previewUrl as string,
                        title: attachment.name,
                      })
                  : attachment.onOpen
              }
            />
          );
        })}
        {header}
      </div>
    ) : (
      header
    );

  return (
    <>
      <div className={cn('flex items-start gap-3', isUser && 'flex-row-reverse', rowClassName)}>
        {isUser ? (
          <Avatar
            className="size-8 shrink-0 ring-1 ring-border/70"
            aria-label={`${user.name || '用户'}的头像`}
          >
            {user.avatarUrl ? (
              <AvatarImage src={user.avatarUrl} alt={`${user.name || '用户'}的头像`} />
            ) : null}
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              {Array.from(user.name.trim())[0] || <UserRound className="size-4" />}
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar
            className="size-8 shrink-0 ring-1 ring-border/70"
            aria-label={`${assistant.name || '助手'}的头像`}
          >
            {assistant.avatarUrl ? (
              <AvatarImage src={assistant.avatarUrl} alt={`${assistant.name || '助手'}的头像`} />
            ) : null}
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
              {Array.from(assistant.name.trim())[0] || <UserRound className="size-4" />}
            </AvatarFallback>
          </Avatar>
        )}
        <ConversationMessageBubble role={messageRole} header={messageHeader} {...bubbleProps} />
      </div>
      {imagePreview ? (
        <ImagePreviewDialog
          open
          src={imagePreview.src}
          title={imagePreview.title}
          onOpenChange={(open) => {
            if (!open) setImagePreview(null);
          }}
        />
      ) : null}
    </>
  );
}
