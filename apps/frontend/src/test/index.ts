/**
 * Unified Test Utilities Index
 *
 * This file provides a single entry point for all test utilities,
 * consolidating the various utility files into a cohesive API.
 *
 * Usage:
 * ```typescript
 * import { setupTest, typeIntoInput, createMockMessage } from '@/test';
 * ```
 */

// ============================================================================
// Core Test Setup (Primary API)
// ============================================================================

export {
  setupTest,
  setupChatFlowTest,
  setupProductSearchTest,
  setupErrorTest,
  setupLoadingTest,
  type SetupOptions,
  type TestContext,
} from './enhanced-setup';

// ============================================================================
// Reactive Mock Infrastructure
// ============================================================================

export {
  ReactiveHookMock,
  mockRegistry,
  type MockRegistry,
} from './reactive-mocks';

// ============================================================================
// Input Utilities
// ============================================================================

export {
  typeIntoInput,
  submitForm,
  waitForDebounce,
  type TypeOptions,
  type SubmitOptions,
} from './input-utilities';

// ============================================================================
// Mock Data Factories (Keep from standardized-mocks)
// ============================================================================

export {
  // Hook return value factories
  createMockUseChatReturn,
  createMockUseProductsReturn,
  createMockUseConversationsReturn,
  createMockUseApiReturn,

  // Data builders
  createMockMessage,
  createMockProduct,
  createMockConversation,
  createMockApiError,
  createMockSource,
  createMockSearchFacets,

  // Batch builders
  createMockMessages,
  createMockProducts,
  createMockConversations,

  // Type exports
  type MockUseChatReturn,
  type MockUseProductsReturn,
  type MockUseConversationsReturn,
  type MockUseApiReturn,
} from './standardized-mocks';

// ============================================================================
// Test ID Validation
// ============================================================================

export {
  validateTestIds,
  findDuplicateTestIds,
  type TestIdValidationResult,
} from './test-id-validation';

// ============================================================================
// Re-exports from React Testing Library (for convenience)
// ============================================================================

export {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  act,
  fireEvent,
  within,
  getByRole,
  getByText,
  getByTestId,
  queryByRole,
  queryByText,
  queryByTestId,
  findByRole,
  findByText,
  findByTestId,
} from '@testing-library/react';

export { userEvent } from '@testing-library/user-event';

// ============================================================================
// Migration Notice
// ============================================================================

// Deprecated utilities have been removed.
// Use setupTest() from '@/test/enhanced-setup' for all new tests.
// See MIGRATION-EXAMPLES.md for migration guidance.

// ============================================================================
// Utility Types
// ============================================================================

export type {
  ChatMessage,
  Conversation,
  ProductSummary,
  SearchFacets,
  RetrievalResult,
} from '@repo/shared-types';

export type { ApiError } from '@/lib/api-client';

// ============================================================================
// Common Test Patterns (Examples)
// ============================================================================

/**
 * Example test patterns for common scenarios
 * These are not exported but serve as documentation
 */

/*
// Basic component test
const { updateChat, renderComponent } = setupTest();
const { getByTestId } = renderComponent(<ChatInterface />);

// Chat flow test
const { updateChat, renderComponent } = setupChatFlowTest();
await updateChat({ isLoading: true });

// Product search test
const { updateProducts, renderComponent } = setupProductSearchTest({
  initialProducts: [createMockProduct()]
});

// Error handling test
const { updateChat, renderComponent } = setupErrorTest();
await updateChat({ error: createMockApiError('Test error', 500) });

// Input simulation
await typeIntoInput(input, 'search query');
await submitForm(form, { viaEnterKey: true });
await waitForDebounce(() => expect(searchFn).toHaveBeenCalled());

// Mock data creation
const message = createMockMessage({ content: 'Hello' });
const product = createMockProduct({ name: 'ASA 150' });
const conversation = createMockConversation({ title: 'Test Chat' });
*/
