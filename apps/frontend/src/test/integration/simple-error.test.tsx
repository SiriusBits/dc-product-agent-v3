/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import ChatInterface from '@/components/chat/ChatInterface';
import { render } from '@/test/enhanced-test-utils';
import {
  setupFixedLoadingMocks,
  cleanupFixedLoadingMocks,
} from '@/test/fixed-loading-mocks';
import { ApiError } from '@/lib/api-client';

describe('Simple Error Test', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

  beforeEach(() => {
    // Mock DOM APIs
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanupFixedLoadingMocks();
  });

  it('should display error when error is set in mock state', async () => {
    const networkError = new ApiError('Network error', 0);
    testHelpers = setupFixedLoadingMocks({
      simulateErrors: {
        sendMessage: networkError,
      },
    });

    render(<ChatInterface />);
    await testHelpers.waitForLoadingToComplete();

    // Debug: Check what's in the mock state
    console.log('Mock state:', testHelpers.mockState);

    // Check if error is in the DOM
    screen.debug();

    // Try to find error text
    const errorElement = screen.queryByText('Network error');
    console.log('Error element found:', errorElement);

    // Check if there's any alert or error-related element
    const alertElements = screen.queryAllByRole('alert');
    console.log('Alert elements:', alertElements);

    // Look for any text containing "error"
    const errorTexts = screen.queryAllByText(/error/i);
    console.log('Error texts:', errorTexts);

    expect(screen.getByText('Network error')).toBeInTheDocument();
  });
});
