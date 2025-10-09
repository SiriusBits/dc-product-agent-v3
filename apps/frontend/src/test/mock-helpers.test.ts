/**
 * Test to verify mock helper functions work correctly
 */

import { describe, it, expect } from 'vitest';
import {
  createMockChatMessage,
  createMockConversation,
  createMockProduct,
  createMockProductDetail,
  createMockSearchResult,
  createMockChatResponse,
} from './test-utils';

describe('Mock Helper Functions', () => {
  it('createMockChatMessage should create a valid chat message', () => {
    const message = createMockChatMessage();

    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('content');
    expect(message).toHaveProperty('role');
    expect(message).toHaveProperty('timestamp');
    expect(message).toHaveProperty('conversation_id');
    expect(message).toHaveProperty('sources');
    expect(message.role).toBe('user');
  });

  it('createMockChatMessage should support overrides', () => {
    const message = createMockChatMessage({
      role: 'assistant',
      content: 'Custom content',
      sources: [createMockSearchResult()],
    });

    expect(message.role).toBe('assistant');
    expect(message.content).toBe('Custom content');
    expect(message.sources).toHaveLength(1);
  });

  it('createMockConversation should create a valid conversation', () => {
    const conversation = createMockConversation();

    expect(conversation).toHaveProperty('id');
    expect(conversation).toHaveProperty('messages');
    expect(conversation).toHaveProperty('created_at');
    expect(conversation).toHaveProperty('updated_at');
    expect(conversation).toHaveProperty('title');
    expect(conversation).toHaveProperty('metadata');
    expect(Array.isArray(conversation.messages)).toBe(true);
  });

  it('createMockConversation should support overrides', () => {
    const conversation = createMockConversation({
      id: 'custom-id',
      title: 'Custom Title',
      messages: [],
    });

    expect(conversation.id).toBe('custom-id');
    expect(conversation.title).toBe('Custom Title');
    expect(conversation.messages).toHaveLength(0);
  });

  it('createMockProduct should create a valid product', () => {
    const product = createMockProduct();

    expect(product).toHaveProperty('id');
    expect(product).toHaveProperty('name');
    expect(product).toHaveProperty('family');
    expect(product).toHaveProperty('applications');
    expect(product).toHaveProperty('properties');
  });

  it('createMockProductDetail should create a valid product detail', () => {
    const productDetail = createMockProductDetail();

    expect(productDetail).toHaveProperty('id');
    expect(productDetail).toHaveProperty('name');
    expect(productDetail).toHaveProperty('product_info');
    expect(productDetail).toHaveProperty('properties');
    expect(productDetail).toHaveProperty('related_products');
    expect(productDetail).toHaveProperty('knowledge_graph_entities');
    expect(productDetail).toHaveProperty('documents');
    expect(Array.isArray(productDetail.documents)).toBe(true);
  });

  it('createMockProductDetail should support overrides', () => {
    const productDetail = createMockProductDetail({
      id: 'custom-product',
      name: 'Custom Product',
      related_products: [createMockProduct()],
    });

    expect(productDetail.id).toBe('custom-product');
    expect(productDetail.name).toBe('Custom Product');
    expect(productDetail.related_products).toHaveLength(1);
  });

  it('createMockSearchResult should create a valid search result', () => {
    const result = createMockSearchResult();

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('score');
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('provenance');
  });

  it('createMockChatResponse should create a valid chat response', () => {
    const response = createMockChatResponse();

    expect(response).toHaveProperty('answer');
    expect(response).toHaveProperty('sources');
    expect(response).toHaveProperty('conversation_id');
    expect(response).toHaveProperty('query_analysis');
    expect(response).toHaveProperty('response_time_ms');
    expect(response).toHaveProperty('kg_enhanced');
    expect(Array.isArray(response.sources)).toBe(true);
  });
});
