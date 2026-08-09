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
    'src/pages/AIImageStudio/conversationMessages.ts',
  ],
  components: [
    'src/components/ai/ConversationAttachmentCard.tsx',
    'src/components/ai/ConversationComposer.tsx',
    'src/components/ai/ConversationMessage.tsx',
    'src/components/ai/ConversationMessageBubble.tsx',
    'src/components/ai-images/SketchCanvas.tsx',
    'src/components/ai-images/canvas/aiCanvasAdapter.ts',
    'src/components/ai-images/canvas/canvasDocument.ts',
    'src/components/ai-images/canvas/closedShape.ts',
    'src/components/blog/BatchMarkdownImportDialog.tsx',
    'src/components/workbench/AIAgentCreateDialog.tsx',
    'src/components/workflow/runSession.ts',
  ],
  workflow: [
    'src/api/workflow.ts',
    'src/components/workbench/workflowDraft.ts',
    'src/components/workflow/nodeConfig.ts',
    'src/components/workflow/subworkflowContract.ts',
    'src/components/workflow/TypedVariableValueEditor.tsx',
    'src/components/workflow/types.ts',
    'src/components/workflow/useWorkflowCapabilities.ts',
    'src/components/workflow/useWorkflowHistory.ts',
    'src/components/workflow/validateWorkflowConfig.ts',
    'src/components/workflow/workflowAlignment.ts',
    'src/components/workflow/workflowGraph.ts',
    'src/components/workflow/workflowLayout.ts',
    'src/components/workflow/workflowRunBranches.ts',
    'src/components/workflow/workflowSideEffects.ts',
    'src/components/workflow/workflowToolInputValidation.ts',
    'src/components/workflow/workflowVariables.ts',
    'src/components/workflow/WorkflowRunInputFields.tsx',
    'src/components/workflow/WorkflowRuntimeContext.tsx',
    'src/components/workflow/WorkflowValidationPanel.tsx',
    'src/components/workflow/WorkflowWorkspacePanel.tsx',
    'src/components/workflow/properties/ResultActionEditor.tsx',
    'src/pages/workflowTemplateGraphs.ts',
    'src/pages/workflowTemplates.ts',
  ],
  // TODO: keep in sync with test surface; add/remove paths together with *.test.ts/tsx.
} as const;

const TESTED_CORE_SOURCE_LIST = [
  ...TESTED_CORE_SOURCES.utils,
  ...TESTED_CORE_SOURCES.api,
  ...TESTED_CORE_SOURCES.pages,
  ...TESTED_CORE_SOURCES.components,
  ...TESTED_CORE_SOURCES.workflow,
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
