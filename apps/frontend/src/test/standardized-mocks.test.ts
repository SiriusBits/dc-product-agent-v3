/**
 * Tests for standardized mock factories
 */

import { describe, it, expect, vi } from 'vitest';
import {
  createMockUseChatReturn,
  createMockUseProductsReturn,
  createMockUseConversationsReturn,
  createMockUseApiReturn,
  createMockMessage,
  createMockProduct,
  createMockConversation,
  createMockApiError,
  createMockSource,
  createMockSearchFacets,
  createMockMessages,
  createMockProducts,
  createMockConversations,
} from './standardized-mocks';

describe('Hook Return Value Factories', () => {
  describe('createMockUseChatReturn', () => {
    it('creates a mock with default values', () => {
      const mock = createMockUseChatReturn();

      expect(mock.messages).toEqual([]);
      expect(mock.isLoading).toBe(false);
      expect(mock.error).toBeNull();
      expect(mock.conversationId).toBeNull();
      expect(mock.isRetryable).toBe(false);
      expect(vi.isMockFunction(mock.sendMessage)).toBe(true);
      expect(vi.isMockFunction(mock.clearMessages)).toBe(true);
      expect(vi.isMockFunction(mock.loadConversation)).toBe(true);
      expect(vi.isMockFunction(mock.retryLastMessage)).toBe(true);
    });

    it('allows overriding default values', () => {
      const messages = [createMockMessage()];
      const mock = createMockUseChatReturn({
        messages,
        isLoading: true,
        conversationId: 'test-conv-123',
      });

      expect(mock.messages).toBe(messages);
      expect(mock.isLoading).toBe(true);
      expect(mock.conversationId).toBe('test-conv-123');
    });
  });

  describe('createMockUseProductsReturn', () => {
    it('creates a mock with default values', () => {
      const mock = createMockUseProductsReturn();

      expect(mock.products).toEqual([]);
      expect(mock.totalCount).toBe(0);
      expect(mock.facets).toBeNull();
      expect(mock.loading).toBe(false);
      expect(mock.error).toBeNull();
      expect(mock.hasMore).toBe(false);
      expect(mock.isRetryable).toBe(false);
      expect(vi.isMockFunction(mock.searchProducts)).toBe(true);
      expect(vi.isMockFunction(mock.loadMore)).toBe(true);
      expect(vi.isMockFunction(mock.retry)).toBe(true);
    });

    it('allows overriding default values', () => {
      const products = [createMockProduct()];
      const mock = createMockUseProductsReturn({
        products,
        totalCount: 10,
        loading: true,
      });

      expect(mock.products).toBe(products);
      expect(mock.totalCount).toBe(10);
      expect(mock.loading).toBe(true);
    });
  });

  describe('createMockUseConversationsReturn', () => {
    it('creates a mock with default values', () => {
      const mock = createMockUseConversationsReturn();

      expect(mock.conversations).toEqual([]);
      expect(mock.isLoading).toBe(false);
      expect(mock.error).toBeNull();
      expect(mock.isRetryable).toBe(false);
      expect(vi.isMockFunction(mock.loadConversations)).toBe(true);
      expect(vi.isMockFunction(mock.createConversation)).toBe(true);
      expect(vi.isMockFunction(mock.deleteConversation)).toBe(true);
      expect(vi.isMockFunction(mock.updateConversationTitle)).toBe(true);
      expect(vi.isMockFunction(mock.retry)).toBe(true);
    });

    it('allows overriding default values', () => {
      const conversations = [createMockConversation()];
      const mock = createMockUseConversationsReturn({
        conversations,
        isLoading: true,
      });

      expect(mock.conversations).toBe(conversations);
      expect(mock.isLoading).toBe(true);
    });
  });

  describe('createMockUseApiReturn', () => {
    it('creates a mock with default values', () => {
      const mock = createMockUseApiReturn();

      expect(mock.data).toBeNull();
      expect(mock.isLoading).toBe(false);
      expect(mock.error).toBeNull();
      expect(mock.isRetryable).toBe(false);
      expect(vi.isMockFunction(mock.execute)).toBe(true);
      expect(vi.isMockFunction(mock.reset)).toBe(true);
      expect(vi.isMockFunction(mock.retry)).toBe(true);
    });

    it('allows overriding default values with typed data', () => {
      const data = { test: 'value' };
      const mock = createMockUseApiReturn<typeof data>({
        data,
        isLoading: true,
      });

      expect(mock.data).toBe(data);
      expect(mock.isLoading).toBe(true);
    });
  });
});

describe('Mock Data Builders', () => {
  describe('createMockMessage', () => {
    it('creates a message with default values', () => {
      const message = createMockMessage();

      expect(message.id).toBeDefined();
      expect(message.content).toBe('Test message content');
      expect(message.role).toBe('user');
      expect(message.timestamp).toBeInstanceOf(Date);
      expect(message.conversation_id).toBe('conv-test-123');
      expect(message.sources).toBeUndefined();
    });

    it('allows overriding default values', () => {
      const message = createMockMessage({
        content: 'Custom content',
        role: 'assistant',
      });

      expect(message.content).toBe('Custom content');
      expect(message.role).toBe('assistant');
    });
  });

  describe('createMockProduct', () => {
    it('creates a product with default values', () => {
      const product = createMockProduct();

      expect(product.id).toBeDefined();
      expect(product.name).toBe('Test Product');
      expect(product.short_name).toBe('TEST');
      expect(product.family).toBe('Test Family');
      expect(product.cas_number).toBe('12345-67-8');
      expect(product.applications).toEqual(['Testing', 'Development']);
      expect(product.key_properties).toEqual(['Property 1', 'Property 2']);
      expect(product.document_count).toBe(1);
    });

    it('allows overriding default values', () => {
      const product = createMockProduct({
        name: 'ASA 150',
        family: 'ASA',
      });

      expect(product.name).toBe('ASA 150');
      expect(product.family).toBe('ASA');
    });
  });

  describe('createMockConversation', () => {
    it('creates a conversation with default values', () => {
      const conversation = createMockConversation();

      expect(conversation.id).toBeDefined();
      expect(conversation.title).toBe('Test Conversation');
      expect(conversation.messages).toEqual([]);
      expect(conversation.created_at).toBeInstanceOf(Date);
      expect(conversation.updated_at).toBeInstanceOf(Date);
      expect(conversation.metadata).toEqual({});
    });

    it('allows overriding default values', () => {
      const messages = [createMockMessage()];
      const conversation = createMockConversation({
        title: 'Custom Title',
        messages,
      });

      expect(conversation.title).toBe('Custom Title');
      expect(conversation.messages).toBe(messages);
    });
  });

  describe('createMockApiError', () => {
    it('creates an error with default values', () => {
      const error = createMockApiError();

      expect(error.message).toBe('Test error message');
      expect(error.status).toBe(500);
      expect(error.name).toBe('ApiError');
    });

    it('allows custom error values', () => {
      const error = createMockApiError('Network error', 0);

      expect(error.message).toBe('Network error');
      expect(error.status).toBe(0);
    });

    it('supports error details and request ID', () => {
      const error = createMockApiError(
        'Server error',
        500,
        { code: 'INTERNAL_ERROR' },
        'req-123'
      );

      expect(error.details).toEqual({ code: 'INTERNAL_ERROR' });
      expect(error.requestId).toBe('req-123');
    });
  });

  describe('createMockSource', () => {
    it('creates a source with default values', () => {
      const source = createMockSource();

      expect(source.content).toBe('Test source content');
      expect(source.score).toBe(0.95);
      expect(source.source).toBe('vector');
      expect(source.metadata).toEqual({
        doc_id: 'test-doc-123',
        page: 1,
      });
      expect(source.provenance).toEqual({
        document: 'Test Document.pdf',
        page: 1,
      });
    });

    it('allows overriding default values', () => {
      const source = createMockSource({
        content: 'Custom content',
        source: 'kg',
      });

      expect(source.content).toBe('Custom content');
      expect(source.source).toBe('kg');
    });
  });

  describe('createMockSearchFacets', () => {
    it('creates facets with default values', () => {
      const facets = createMockSearchFacets();

      expect(facets.families).toHaveLength(2);
      expect(facets.applications).toHaveLength(2);
      expect(facets.manufacturers).toHaveLength(1);
      expect(facets.properties).toEqual([]);
    });

    it('allows overriding default values', () => {
      const facets = createMockSearchFacets({
        families: [{ value: 'Custom', count: 5 }],
      });

      expect(facets.families).toHaveLength(1);
      expect(facets.families[0].value).toBe('Custom');
    });
  });
});

describe('Batch Data Builders', () => {
  describe('createMockMessages', () => {
    it('creates multiple messages', () => {
      const messages = createMockMessages(3);

      expect(messages).toHaveLength(3);
      expect(messages[0].id).toBe('msg-1');
      expect(messages[0].role).toBe('user');
      expect(messages[1].role).toBe('assistant');
      expect(messages[2].role).toBe('user');
    });

    it('applies base overrides to all messages', () => {
      const messages = createMockMessages(2, {
        conversation_id: 'custom-conv',
      });

      expect(messages[0].conversation_id).toBe('custom-conv');
      expect(messages[1].conversation_id).toBe('custom-conv');
    });
  });

  describe('createMockProducts', () => {
    it('creates multiple products', () => {
      const products = createMockProducts(3);

      expect(products).toHaveLength(3);
      expect(products[0].id).toBe('prod-1');
      expect(products[1].id).toBe('prod-2');
      expect(products[2].id).toBe('prod-3');
    });

    it('applies base overrides to all products', () => {
      const products = createMockProducts(2, {
        family: 'ASA',
      });

      expect(products[0].family).toBe('ASA');
      expect(products[1].family).toBe('ASA');
    });
  });

  describe('createMockConversations', () => {
    it('creates multiple conversations', () => {
      const conversations = createMockConversations(3);

      expect(conversations).toHaveLength(3);
      expect(conversations[0].id).toBe('conv-1');
      expect(conversations[1].id).toBe('conv-2');
      expect(conversations[2].id).toBe('conv-3');
    });

    it('applies base overrides to all conversations', () => {
      const conversations = createMockConversations(2, {
        metadata: { test: true },
      });

      expect(conversations[0].metadata).toEqual({ test: true });
      expect(conversations[1].metadata).toEqual({ test: true });
    });
  });
});
