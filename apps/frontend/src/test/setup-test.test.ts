/**
 * Test to verify setupTest function properly initializes mocks
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { setupTest, mockApiClient } from './test-utils';

describe('setupTest Function', () => {
  beforeEach(() => {
    setupTest();
  });

  describe('Chat API Mocks', () => {
    it('should initialize sendMessage mock', async () => {
      const response = await mockApiClient.sendMessage({ query: 'test' });
      expect(response).toHaveProperty('answer');
      expect(response).toHaveProperty('sources');
      expect(response).toHaveProperty('conversation_id');
    });

    it('should initialize getConversation mock', async () => {
      const conversation = await mockApiClient.getConversation('conv-123');
      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('messages');
      expect(conversation).toHaveProperty('created_at');
      expect(conversation).toHaveProperty('updated_at');
    });

    it('should initialize createConversation mock', async () => {
      const conversation = await mockApiClient.createConversation();
      expect(conversation).toHaveProperty('id');
      expect(conversation).toHaveProperty('messages');
    });

    it('should initialize getConversationMessages mock', async () => {
      const messages = await mockApiClient.getConversationMessages('conv-123');
      expect(Array.isArray(messages)).toBe(true);
      if (messages.length > 0) {
        expect(messages[0]).toHaveProperty('id');
        expect(messages[0]).toHaveProperty('content');
        expect(messages[0]).toHaveProperty('role');
      }
    });
  });

  describe('Product API Mocks', () => {
    it('should initialize searchProducts mock', async () => {
      const response = await mockApiClient.searchProducts({});
      expect(response).toHaveProperty('products');
      expect(response).toHaveProperty('total_count');
      expect(response).toHaveProperty('facets');
      expect(response).toHaveProperty('query_info');
      expect(Array.isArray(response.products)).toBe(true);
    });

    it('should initialize getProduct mock', async () => {
      const product = await mockApiClient.getProduct('asa-150');
      expect(product).toHaveProperty('id');
      expect(product).toHaveProperty('name');
      expect(product).toHaveProperty('product_info');
      expect(product).toHaveProperty('properties');
      expect(product).toHaveProperty('documents');
    });

    it('should initialize getRelatedProducts mock', async () => {
      const products = await mockApiClient.getRelatedProducts('asa-150');
      expect(Array.isArray(products)).toBe(true);
    });

    it('should initialize compareProducts mock', async () => {
      const comparison = await mockApiClient.compareProducts({
        product_ids: ['asa-150', 'asa-155'],
      });
      expect(comparison).toHaveProperty('products');
      expect(comparison).toHaveProperty('comparison_matrix');
      expect(comparison).toHaveProperty('recommendations');
      expect(comparison).toHaveProperty('analysis_summary');
    });

    it('should initialize getProductFamilies mock', async () => {
      const families = await mockApiClient.getProductFamilies();
      expect(Array.isArray(families)).toBe(true);
      expect(families.length).toBeGreaterThan(0);
    });

    it('should initialize getProductApplications mock', async () => {
      const applications = await mockApiClient.getProductApplications();
      expect(Array.isArray(applications)).toBe(true);
      expect(applications.length).toBeGreaterThan(0);
    });
  });

  describe('Knowledge Graph API Mocks', () => {
    it('should initialize queryKnowledgeGraph mock', async () => {
      const response = await mockApiClient.queryKnowledgeGraph({
        entity_name: 'ASA 150',
      });
      expect(response).toHaveProperty('central_entity');
      expect(response).toHaveProperty('related_entities');
      expect(response).toHaveProperty('relationships');
      expect(response).toHaveProperty('graph_data');
      expect(response.central_entity).toHaveProperty('id');
      expect(response.central_entity).toHaveProperty('type');
    });

    it('should initialize getEntityNeighbors mock', async () => {
      const response = await mockApiClient.getEntityNeighbors('entity-1');
      expect(response).toHaveProperty('central_entity');
      expect(response).toHaveProperty('related_entities');
      expect(response).toHaveProperty('relationships');
      expect(response).toHaveProperty('graph_data');
    });
  });

  describe('System Health API Mocks', () => {
    it('should initialize getSystemStatus mock', async () => {
      const status = await mockApiClient.getSystemStatus();
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('services');
      expect(status).toHaveProperty('timestamp');
    });

    it('should initialize checkHealth mock', async () => {
      const isHealthy = await mockApiClient.checkHealth();
      expect(typeof isHealthy).toBe('boolean');
    });
  });
});
