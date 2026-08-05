import path from 'node:path';
import { defineConfig } from 'vitest/config';

const TESTED_CORE_SOURCES = {
  utils: ['src/utils/blog.ts', 'src/utils/frontMatter.ts', 'src/utils/batchResourceUpload.ts'],
  api: ['src/api/workbenchCopilot.ts', 'src/api/workflowCollaboration.ts'],
  pages: [
    'src/pages/AIAppEditor/index.tsx',
    'src/pages/AIAppConversation/AssistantExecution.tsx',
    'src/pages/AIAppConversation/ConversationDeletingOverlay.tsx',
    'src/pages/AIAppConversation/AssistantFailureState.tsx',
    'src/pages/AIAppConversation/execution.ts',
    'src/pages/AIAppConversation/conversationView.ts',
    'src/pages/AIAppConversation/history.ts',
  ],
  components: [
    'src/components/ai/ConversationAttachmentCard.tsx',
    'src/components/ai/ConversationComposer.tsx',
    'src/components/ai/ConversationMessageBubble.tsx',
    'src/components/blog/BatchMarkdownImportDialog.tsx',
    'src/components/workbench/AIAgentCreateDialog.tsx',
    'src/components/workflow/runSession.ts',
  ],
  // TODO: keep in sync with test surface; add/remove paths together with *.test.ts/tsx.
} as const;

const TESTED_CORE_SOURCE_LIST = [
  ...TESTED_CORE_SOURCES.utils,
  ...TESTED_CORE_SOURCES.api,
  ...TESTED_CORE_SOURCES.pages,
  ...TESTED_CORE_SOURCES.components,
] as const;

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environmentMatchGlobs: [['**/*.test.jsx', 'jsdom']],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      // Keep coverage scoped to modules with existing test surface.
      all: false,
      include: TESTED_CORE_SOURCE_LIST,
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
      ],
      thresholds: {
        branches: 20,
        functions: 20,
        lines: 30,
        statements: 30,
      },
    },
  },
});
