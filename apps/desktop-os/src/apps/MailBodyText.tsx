type MailBodyTextProps = {
  text?: string | null;
  fallback?: string;
};

const urlPattern = /(https?:\/\/[^\s<>"'()]+[^\s<>"'().,;:!?])/g;

export default function MailBodyText({ text, fallback = '暂无正文预览' }: MailBodyTextProps) {
  const blocks = toMailBodyBlocks(text);

  if (blocks.length === 0) {
    return <div className="mail-body-text__empty">{fallback}</div>;
  }

  return (
    <div className="mail-body-text">
      {blocks.map((block, index) => {
        const key = `${block.kind}-${index}-${block.text.slice(0, 24)}`;
        if (block.kind === 'quote') {
          return (
            <blockquote className="mail-body-text__quote" key={key}>
              {renderLinkedText(block.text)}
            </blockquote>
          );
        }
        return (
          <p className="mail-body-text__paragraph" key={key}>
            {renderLinkedText(block.text)}
          </p>
        );
      })}
    </div>
  );
}

type MailBodyBlock = {
  kind: 'paragraph' | 'quote';
  text: string;
};

function toMailBodyBlocks(value?: string | null): MailBodyBlock[] {
  const normalized = value?.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() ?? '';
  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split('\n').map((line) => line.trim());
      const quoteLines = lines.filter((line) => line.startsWith('>'));
      if (quoteLines.length === lines.length) {
        return {
          kind: 'quote',
          text: quoteLines.map((line) => line.replace(/^>\s?/, '')).join('\n'),
        };
      }
      return { kind: 'paragraph', text: lines.join('\n') };
    });
}

function renderLinkedText(value: string) {
  const pieces = value.split(urlPattern);
  return pieces.map((piece, index) => {
    if (piece.match(urlPattern)) {
      return (
        <a href={piece} key={`${piece}-${index}`} target="_blank" rel="noreferrer">
          {piece}
        </a>
      );
    }
    return piece;
  });
}
