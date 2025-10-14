/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '@/test/enhanced-test-utils';
import {
  setupFixedLoadingMocks,
  cleanupFixedLoadingMocks,
  createMockChatMessage,
} from '@/test/fixed-loading-mocks';
import ChatInterface from '@/components/chat/ChatInterface';

describe('Markdown Rendering Integration', () => {
  let testHelpers: ReturnType<typeof setupFixedLoadingMocks>;

  beforeEach(() => {
    testHelpers = setupFixedLoadingMocks();
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    cleanupFixedLoadingMocks();
  });

  it('renders markdown content with bold text', async () => {
    // Create a mock message with markdown content
    const mockMessage = createMockChatMessage({
      content: 'This is **bold text** and this is normal text.',
      role: 'assistant',
    });

    // Set up with initial message containing markdown
    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check if the markdown container exists
    const markdownContainer = document.querySelector('.markdown-content');
    expect(markdownContainer).toBeInTheDocument();

    // Check if bold text is rendered as a strong element
    const boldElement = screen.getByText('bold text');
    expect(boldElement).toBeInTheDocument();
    expect(boldElement.tagName.toLowerCase()).toBe('strong');

    // Check if normal text is also present using flexible text matching
    const thisIsElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('This is') || false;
    });
    expect(thisIsElements.length).toBeGreaterThan(0);

    const normalTextElements = screen.getAllByText((content, element) => {
      return (
        element?.textContent?.includes('and this is normal text.') || false
      );
    });
    expect(normalTextElements.length).toBeGreaterThan(0);
  });

  it('renders markdown content with code formatting', async () => {
    const mockMessage = createMockChatMessage({
      content: 'Use the `ASTM D445` test method for viscosity.',
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check if code element is rendered
    const codeElement = screen.getByText('ASTM D445');
    expect(codeElement).toBeInTheDocument();
    expect(codeElement.tagName.toLowerCase()).toBe('code');

    // Check if surrounding text is present using flexible matching
    const useTheElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('Use the') || false;
    });
    expect(useTheElements.length).toBeGreaterThan(0);

    const testMethodElements = screen.getAllByText((content, element) => {
      return (
        element?.textContent?.includes('test method for viscosity.') || false
      );
    });
    expect(testMethodElements.length).toBeGreaterThan(0);
  });

  it('renders markdown content with lists', async () => {
    const mockMessage = createMockChatMessage({
      content: `Properties of ASA 150:
1. Viscosity: 150 cP
2. Temperature: 25°C
- Used in coatings
- Chemical resistant`,
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check if list items are rendered
    expect(screen.getByText('Viscosity: 150 cP')).toBeInTheDocument();
    expect(screen.getByText('Temperature: 25°C')).toBeInTheDocument();
    expect(screen.getByText('Used in coatings')).toBeInTheDocument();
    expect(screen.getByText('Chemical resistant')).toBeInTheDocument();

    // Check if ordered and unordered lists are created
    const orderedList = document.querySelector('ol');
    const unorderedList = document.querySelector('ul');
    expect(orderedList).toBeInTheDocument();
    expect(unorderedList).toBeInTheDocument();
  });

  it('handles complex markdown with mixed formatting', async () => {
    const mockMessage = createMockChatMessage({
      content: `**ASA 150** specifications:
- Viscosity: \`150 cP\` at **25°C**
- Test method: *ASTM D445*`,
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check if various markdown elements are rendered correctly
    const boldASA = screen.getByText('ASA 150');
    expect(boldASA.tagName.toLowerCase()).toBe('strong');

    const codeViscosity = screen.getByText('150 cP');
    expect(codeViscosity.tagName.toLowerCase()).toBe('code');

    const boldTemp = screen.getByText('25°C');
    expect(boldTemp.tagName.toLowerCase()).toBe('strong');

    const italicMethod = screen.getByText('ASTM D445');
    expect(italicMethod.tagName.toLowerCase()).toBe('em');

    // Check if text content is accessible using flexible matching
    const specificationsElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('specifications:') || false;
    });
    expect(specificationsElements.length).toBeGreaterThan(0);

    const viscosityElements = screen.getAllByText((content, element) => {
      return element?.textContent?.includes('Viscosity:') || false;
    });
    expect(viscosityElements.length).toBeGreaterThan(0);
  });

  it('handles text queries with flexible matchers for split content', async () => {
    const mockMessage = createMockChatMessage({
      content: 'The **viscosity** of ASA 150 is `150 cP` at **25°C**.',
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Use getAllByText for content that might be split across multiple elements
    const matchingElements = screen.getAllByText((content, element) => {
      return (
        element?.textContent === 'The viscosity of ASA 150 is 150 cP at 25°C.'
      );
    });
    expect(matchingElements.length).toBeGreaterThan(0);

    // Check for individual formatted parts
    expect(screen.getByText('viscosity')).toBeInTheDocument();
    expect(screen.getByText('150 cP')).toBeInTheDocument();
    expect(screen.getByText('25°C')).toBeInTheDocument();

    // Verify the formatting is applied correctly
    const viscosityElement = screen.getByText('viscosity');
    expect(viscosityElement.tagName.toLowerCase()).toBe('strong');

    const codeElement = screen.getByText('150 cP');
    expect(codeElement.tagName.toLowerCase()).toBe('code');

    const tempElement = screen.getByText('25°C');
    expect(tempElement.tagName.toLowerCase()).toBe('strong');
  });

  it('ensures markdown content is accessible via proper queries', async () => {
    const mockMessage = createMockChatMessage({
      content:
        'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.',
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check for the assistant response
    await waitFor(() => {
      expect(
        screen.getByText(
          'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
        )
      ).toBeInTheDocument();
    });

    // Verify the markdown container exists
    const markdownContainer = document.querySelector('.markdown-content');
    expect(markdownContainer).toBeInTheDocument();

    // Verify the content is within the markdown container
    const responseText = screen.getByText(
      'ASA 150 has a viscosity of 150 cP at 25°C according to ASTM D445 test method.'
    );
    expect(responseText.closest('.markdown-content')).toBeInTheDocument();
  });

  it('handles user messages without markdown rendering', async () => {
    const userMessage = createMockChatMessage({
      content: 'This is a **user message** with `code`',
      role: 'user',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [userMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // User messages should not have markdown rendering
    await waitFor(() => {
      const userMessageElement = screen.getByText(
        'This is a **user message** with `code`'
      );
      expect(userMessageElement).toBeInTheDocument();

      // User message should not be in a markdown container
      expect(
        userMessageElement.closest('.markdown-content')
      ).not.toBeInTheDocument();

      // The raw markdown should be visible (not processed)
      expect(userMessageElement.textContent).toBe(
        'This is a **user message** with `code`'
      );
    });
  });

  it('renders plain text without markdown processing', async () => {
    const mockMessage = createMockChatMessage({
      content: 'This is plain text without any formatting.',
      role: 'assistant',
    });

    testHelpers = setupFixedLoadingMocks({
      initialMessages: [mockMessage],
    });

    render(<ChatInterface />);

    await testHelpers.waitForLoadingToComplete();

    // Check if plain text is rendered correctly
    expect(
      screen.getByText('This is plain text without any formatting.')
    ).toBeInTheDocument();

    // Verify it's still in a markdown container (for consistency)
    const markdownContainer = document.querySelector('.markdown-content');
    expect(markdownContainer).toBeInTheDocument();

    // Verify the content is within the markdown container
    const responseText = screen.getByText(
      'This is plain text without any formatting.'
    );
    expect(responseText.closest('.markdown-content')).toBeInTheDocument();
  });
});
