import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it } from 'vitest';
import { ConversationDeletingOverlay } from './ConversationDeletingOverlay';

describe('ConversationDeletingOverlay', () => {
  it('shows an accessible loading status while deletion is pending', () => {
    const html = renderToStaticMarkup(<ConversationDeletingOverlay active />);
    assert.match(html, /role="status"/);
    assert.match(html, /正在删除/);
  });

  it('renders nothing when deletion is idle', () => {
    assert.equal(renderToStaticMarkup(<ConversationDeletingOverlay active={false} />), '');
  });
});
