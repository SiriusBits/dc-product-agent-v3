/**
 * Standardized Query Methods
 *
 * Provides standardized query methods with clear error messages and proper usage patterns.
 * Uses getBy for elements that should exist, queryBy for elements that may not exist,
 * and findBy for elements that appear asynchronously.
 *
 * Requirements: 5.5, 5.6
 */

import { screen, within } from '@testing-library/react';
import type {
  RenderResult,
  ByRoleMatcher,
  ByRoleOptions,
} from '@testing-library/react';
import { DEFAULT_ASYNC_CONFIG } from './async-test-utils';

// ============================================================================
// Query Configuration
// ============================================================================

export interface QueryConfig {
  // Timeout settings
  defaultTimeout: number;
  fastTimeout: number;
  slowTimeout: number;

  // Error handling
  enableDetailedErrors: boolean;
  enableSuggestions: boolean;
  enableDOMSnapshot: boolean;

  // Logging
  logFailedQueries: boolean;
  logSuccessfulQueries: boolean;
  logLevel: 'none' | 'error' | 'warn' | 'info' | 'debug';
}

export const DEFAULT_QUERY_CONFIG: QueryConfig = {
  defaultTimeout: 3000,
  fastTimeout: 1000,
  slowTimeout: 5000,

  enableDetailedErrors: true,
  enableSuggestions: true,
  enableDOMSnapshot: process.env.NODE_ENV !== 'test',

  logFailedQueries: process.env.NODE_ENV !== 'test',
  logSuccessfulQueries: false,
  logLevel: process.env.NODE_ENV === 'test' ? 'error' : 'info',
};

// ============================================================================
// Enhanced Query Error Types
// ============================================================================

export class QueryError extends Error {
  constructor(
    message: string,
    public queryType: string,
    public selector: string,
    public suggestions: string[] = [],
    public domSnapshot?: string
  ) {
    super(message);
    this.name = 'QueryError';
  }
}

export class ElementNotFoundError extends QueryError {
  constructor(
    queryType: string,
    selector: string,
    suggestions: string[] = [],
    domSnapshot?: string
  ) {
    const message = `${queryType}('${selector}') failed - element not found`;
    super(message, queryType, selector, suggestions, domSnapshot);
    this.name = 'ElementNotFoundError';
  }
}

export class ElementTimeoutError extends QueryError {
  constructor(
    queryType: string,
    selector: string,
    timeout: number,
    suggestions: string[] = [],
    domSnapshot?: string
  ) {
    const message = `${queryType}('${selector}') timed out after ${timeout}ms`;
    super(message, queryType, selector, suggestions, domSnapshot);
    this.name = 'ElementTimeoutError';
  }
}

// ============================================================================
// Query Context and Suggestions
// ============================================================================

interface QueryContext {
  container: HTMLElement;
  testName?: string;
  componentName?: string;
  userAction?: string;
}

class QuerySuggestionEngine {
  private config: QueryConfig;

  constructor(config: QueryConfig = DEFAULT_QUERY_CONFIG) {
    this.config = config;
  }

  /**
   * Generate suggestions for failed queries
   */
  generateSuggestions(
    queryType: string,
    selector: string,
    container: HTMLElement
  ): string[] {
    if (!this.config.enableSuggestions) {
      return [];
    }

    const suggestions: string[] = [];

    if (queryType.includes('ByTestId')) {
      suggestions.push(...this.suggestTestIdAlternatives(selector, container));
    } else if (queryType.includes('ByRole')) {
      suggestions.push(...this.suggestRoleAlternatives(selector, container));
    } else if (queryType.includes('ByText')) {
      suggestions.push(...this.suggestTextAlternatives(selector, container));
    } else if (queryType.includes('ByLabelText')) {
      suggestions.push(...this.suggestLabelAlternatives(selector, container));
    }

    // General suggestions
    suggestions.push(...this.suggestGeneralAlternatives(container));

    return suggestions.slice(0, 5); // Limit to 5 suggestions
  }

  private suggestTestIdAlternatives(
    testId: string,
    container: HTMLElement
  ): string[] {
    const suggestions: string[] = [];

    // Find similar test IDs
    const allTestIds = Array.from(container.querySelectorAll('[data-testid]'))
      .map((el) => el.getAttribute('data-testid'))
      .filter(Boolean) as string[];

    // Exact matches with different casing
    const exactMatches = allTestIds.filter(
      (id) => id.toLowerCase() === testId.toLowerCase() && id !== testId
    );
    if (exactMatches.length > 0) {
      suggestions.push(`Try exact case match: ${exactMatches.join(', ')}`);
    }

    // Partial matches
    const partialMatches = allTestIds.filter(
      (id) => id.includes(testId) || testId.includes(id)
    );
    if (partialMatches.length > 0) {
      suggestions.push(`Similar test IDs found: ${partialMatches.join(', ')}`);
    }

    // Suggest based on common patterns
    const baseId = testId.split('-')[0];
    const patternMatches = allTestIds.filter((id) => id.startsWith(baseId));
    if (patternMatches.length > 0) {
      suggestions.push(`IDs with same prefix: ${patternMatches.join(', ')}`);
    }

    return suggestions;
  }

  private suggestRoleAlternatives(
    role: string,
    container: HTMLElement
  ): string[] {
    const suggestions: string[] = [];

    // Find all available roles
    const allRoles = Array.from(container.querySelectorAll('[role]'))
      .map((el) => el.getAttribute('role'))
      .filter(Boolean) as string[];

    const uniqueRoles = [...new Set(allRoles)];
    if (uniqueRoles.length > 0) {
      suggestions.push(`Available roles: ${uniqueRoles.join(', ')}`);
    }

    // Suggest implicit roles
    const implicitRoles = this.findImplicitRoles(container);
    if (implicitRoles.length > 0) {
      suggestions.push(`Implicit roles available: ${implicitRoles.join(', ')}`);
    }

    // Suggest common role alternatives
    const roleAlternatives = this.getCommonRoleAlternatives(role);
    if (roleAlternatives.length > 0) {
      suggestions.push(`Try alternative roles: ${roleAlternatives.join(', ')}`);
    }

    return suggestions;
  }

  private suggestTextAlternatives(
    text: string,
    container: HTMLElement
  ): string[] {
    const suggestions: string[] = [];

    // Find partial text matches
    const allTextContent = Array.from(container.querySelectorAll('*'))
      .map((el) => el.textContent?.trim())
      .filter(Boolean) as string[];

    const partialMatches = allTextContent.filter(
      (content) =>
        content.toLowerCase().includes(text.toLowerCase()) ||
        text.toLowerCase().includes(content.toLowerCase())
    );

    if (partialMatches.length > 0) {
      suggestions.push(
        `Partial text matches: ${partialMatches.slice(0, 3).join(', ')}`
      );
    }

    // Suggest using regex for flexible matching
    suggestions.push(
      `Try regex pattern: /${text}/i for case-insensitive match`
    );

    return suggestions;
  }

  private suggestLabelAlternatives(
    labelText: string,
    container: HTMLElement
  ): string[] {
    const suggestions: string[] = [];

    // Find all labels
    const labels = Array.from(container.querySelectorAll('label'))
      .map((label) => label.textContent?.trim())
      .filter(Boolean) as string[];

    if (labels.length > 0) {
      suggestions.push(`Available labels: ${labels.join(', ')}`);
    }

    // Find aria-label attributes
    const ariaLabels = Array.from(container.querySelectorAll('[aria-label]'))
      .map((el) => el.getAttribute('aria-label'))
      .filter(Boolean) as string[];

    if (ariaLabels.length > 0) {
      suggestions.push(`Available aria-labels: ${ariaLabels.join(', ')}`);
    }

    return suggestions;
  }

  private suggestGeneralAlternatives(container: HTMLElement): string[] {
    const suggestions: string[] = [];

    // Count different types of elements
    const elementCounts = {
      buttons: container.querySelectorAll('button').length,
      inputs: container.querySelectorAll('input').length,
      links: container.querySelectorAll('a').length,
      headings: container.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
      testIds: container.querySelectorAll('[data-testid]').length,
    };

    Object.entries(elementCounts).forEach(([type, count]) => {
      if (count > 0) {
        suggestions.push(`${count} ${type} available`);
      }
    });

    return suggestions;
  }

  private findImplicitRoles(container: HTMLElement): string[] {
    const implicitRoles: string[] = [];

    const elementRoleMap = {
      button: 'button',
      a: 'link',
      input: 'textbox',
      textarea: 'textbox',
      select: 'combobox',
      h1: 'heading',
      h2: 'heading',
      h3: 'heading',
      h4: 'heading',
      h5: 'heading',
      h6: 'heading',
      img: 'img',
      ul: 'list',
      ol: 'list',
      li: 'listitem',
      table: 'table',
      form: 'form',
    };

    Object.entries(elementRoleMap).forEach(([tagName, role]) => {
      if (container.querySelector(tagName)) {
        implicitRoles.push(role);
      }
    });

    return [...new Set(implicitRoles)];
  }

  private getCommonRoleAlternatives(role: string): string[] {
    const alternatives: Record<string, string[]> = {
      button: ['link', 'menuitem', 'tab'],
      link: ['button', 'menuitem'],
      textbox: ['searchbox', 'combobox'],
      combobox: ['textbox', 'listbox'],
      heading: ['banner', 'group'],
      list: ['menu', 'listbox'],
      listitem: ['menuitem', 'option'],
    };

    return alternatives[role] || [];
  }

  /**
   * Create DOM snapshot for debugging
   */
  createDOMSnapshot(container: HTMLElement, maxDepth: number = 3): string {
    if (!this.config.enableDOMSnapshot) {
      return '';
    }

    const createElementSnapshot = (element: Element, depth: number): string => {
      if (depth > maxDepth) {
        return '...';
      }

      const tagName = element.tagName.toLowerCase();
      const attributes: string[] = [];

      // Include important attributes
      const importantAttrs = [
        'id',
        'class',
        'data-testid',
        'role',
        'aria-label',
        'type',
        'name',
      ];
      importantAttrs.forEach((attr) => {
        const value = element.getAttribute(attr);
        if (value) {
          attributes.push(`${attr}="${value}"`);
        }
      });

      const attrString =
        attributes.length > 0 ? ` ${attributes.join(' ')}` : '';
      const children = Array.from(element.children);

      if (children.length === 0) {
        const textContent = element.textContent?.trim();
        if (textContent && textContent.length < 50) {
          return `<${tagName}${attrString}>${textContent}</${tagName}>`;
        }
        return `<${tagName}${attrString} />`;
      }

      const childSnapshots = children
        .slice(0, 5) // Limit to first 5 children
        .map((child) => createElementSnapshot(child, depth + 1))
        .join('\n' + '  '.repeat(depth + 1));

      const moreChildren =
        children.length > 5
          ? `\n${'  '.repeat(depth + 1)}... ${children.length - 5} more`
          : '';

      return `<${tagName}${attrString}>\n${'  '.repeat(depth + 1)}${childSnapshots}${moreChildren}\n${'  '.repeat(depth)}</${tagName}>`;
    };

    return createElementSnapshot(container, 0);
  }
}

// ============================================================================
// Standardized Query Methods
// ============================================================================

export class StandardizedQueries {
  private config: QueryConfig;
  private suggestionEngine: QuerySuggestionEngine;
  private context: QueryContext;

  constructor(
    context: QueryContext,
    config: QueryConfig = DEFAULT_QUERY_CONFIG
  ) {
    this.config = config;
    this.suggestionEngine = new QuerySuggestionEngine(config);
    this.context = context;
  }

  // ========================================================================
  // getBy Methods - Elements that SHOULD exist
  // ========================================================================

  /**
   * Get element by test ID - throws if not found
   */
  getByTestId(testId: string, errorContext?: string): HTMLElement {
    this.log('debug', `getByTestId('${testId}')`);

    try {
      const element = within(this.context.container).getByTestId(testId);
      this.log('debug', `getByTestId('${testId}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'getByTestId',
        testId,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementNotFoundError(
        'getByTestId',
        testId,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('getByTestId', testId, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  /**
   * Get element by role - throws if not found
   */
  getByRole(
    role: ByRoleMatcher,
    options?: ByRoleOptions & { errorContext?: string }
  ): HTMLElement {
    const { errorContext, ...roleOptions } = options || {};
    const roleStr = typeof role === 'string' ? role : role.toString();

    this.log(
      'debug',
      `getByRole('${roleStr}', ${JSON.stringify(roleOptions)})`
    );

    try {
      const element = within(this.context.container).getByRole(
        role,
        roleOptions
      );
      this.log('debug', `getByRole('${roleStr}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'getByRole',
        roleStr,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementNotFoundError(
        'getByRole',
        `${roleStr} ${JSON.stringify(roleOptions || {})}`,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('getByRole', roleStr, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  /**
   * Get element by text - throws if not found
   */
  getByText(text: string | RegExp, errorContext?: string): HTMLElement {
    const textStr = typeof text === 'string' ? text : text.toString();
    this.log('debug', `getByText('${textStr}')`);

    try {
      const element = within(this.context.container).getByText(text);
      this.log('debug', `getByText('${textStr}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'getByText',
        textStr,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementNotFoundError(
        'getByText',
        textStr,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('getByText', textStr, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  /**
   * Get element by label text - throws if not found
   */
  getByLabelText(text: string | RegExp, errorContext?: string): HTMLElement {
    const textStr = typeof text === 'string' ? text : text.toString();
    this.log('debug', `getByLabelText('${textStr}')`);

    try {
      const element = within(this.context.container).getByLabelText(text);
      this.log('debug', `getByLabelText('${textStr}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'getByLabelText',
        textStr,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementNotFoundError(
        'getByLabelText',
        textStr,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('getByLabelText', textStr, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  // ========================================================================
  // queryBy Methods - Elements that MAY NOT exist
  // ========================================================================

  /**
   * Query element by test ID - returns null if not found
   */
  queryByTestId(testId: string): HTMLElement | null {
    this.log('debug', `queryByTestId('${testId}')`);

    const element = within(this.context.container).queryByTestId(testId);

    if (element) {
      this.log('debug', `queryByTestId('${testId}') - FOUND`);
    } else {
      this.log('debug', `queryByTestId('${testId}') - NOT FOUND`);
    }

    return element;
  }

  /**
   * Query element by role - returns null if not found
   */
  queryByRole(
    role: ByRoleMatcher,
    options?: ByRoleOptions
  ): HTMLElement | null {
    const roleStr = typeof role === 'string' ? role : role.toString();
    this.log(
      'debug',
      `queryByRole('${roleStr}', ${JSON.stringify(options || {})})`
    );

    const element = within(this.context.container).queryByRole(role, options);

    if (element) {
      this.log('debug', `queryByRole('${roleStr}') - FOUND`);
    } else {
      this.log('debug', `queryByRole('${roleStr}') - NOT FOUND`);
    }

    return element;
  }

  /**
   * Query element by text - returns null if not found
   */
  queryByText(text: string | RegExp): HTMLElement | null {
    const textStr = typeof text === 'string' ? text : text.toString();
    this.log('debug', `queryByText('${textStr}')`);

    const element = within(this.context.container).queryByText(text);

    if (element) {
      this.log('debug', `queryByText('${textStr}') - FOUND`);
    } else {
      this.log('debug', `queryByText('${textStr}') - NOT FOUND`);
    }

    return element;
  }

  /**
   * Query element by label text - returns null if not found
   */
  queryByLabelText(text: string | RegExp): HTMLElement | null {
    const textStr = typeof text === 'string' ? text : text.toString();
    this.log('debug', `queryByLabelText('${textStr}')`);

    const element = within(this.context.container).queryByLabelText(text);

    if (element) {
      this.log('debug', `queryByLabelText('${textStr}') - FOUND`);
    } else {
      this.log('debug', `queryByLabelText('${textStr}') - NOT FOUND`);
    }

    return element;
  }

  // ========================================================================
  // findBy Methods - Elements that appear asynchronously
  // ========================================================================

  /**
   * Find element by test ID - waits for element to appear
   */
  async findByTestId(
    testId: string,
    options: {
      timeout?: number;
      errorContext?: string;
    } = {}
  ): Promise<HTMLElement> {
    const { timeout = this.config.defaultTimeout, errorContext } = options;

    this.log('debug', `findByTestId('${testId}') with timeout ${timeout}ms`);

    try {
      const element = await within(this.context.container).findByTestId(
        testId,
        { timeout }
      );
      this.log('debug', `findByTestId('${testId}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'findByTestId',
        testId,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementTimeoutError(
        'findByTestId',
        testId,
        timeout,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('findByTestId', testId, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  /**
   * Find element by role - waits for element to appear
   */
  async findByRole(
    role: ByRoleMatcher,
    options: ByRoleOptions & {
      timeout?: number;
      errorContext?: string;
    } = {}
  ): Promise<HTMLElement> {
    const {
      timeout = this.config.defaultTimeout,
      errorContext,
      ...roleOptions
    } = options;

    const roleStr = typeof role === 'string' ? role : role.toString();
    this.log('debug', `findByRole('${roleStr}') with timeout ${timeout}ms`);

    try {
      const element = await within(this.context.container).findByRole(role, {
        ...roleOptions,
        timeout,
      });
      this.log('debug', `findByRole('${roleStr}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'findByRole',
        roleStr,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementTimeoutError(
        'findByRole',
        `${roleStr} ${JSON.stringify(roleOptions)}`,
        timeout,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('findByRole', roleStr, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  /**
   * Find element by text - waits for element to appear
   */
  async findByText(
    text: string | RegExp,
    options: {
      timeout?: number;
      errorContext?: string;
    } = {}
  ): Promise<HTMLElement> {
    const { timeout = this.config.defaultTimeout, errorContext } = options;

    const textStr = typeof text === 'string' ? text : text.toString();
    this.log('debug', `findByText('${textStr}') with timeout ${timeout}ms`);

    try {
      const element = await within(this.context.container).findByText(text, {
        timeout,
      });
      this.log('debug', `findByText('${textStr}') - SUCCESS`);
      return element;
    } catch (error) {
      const suggestions = this.suggestionEngine.generateSuggestions(
        'findByText',
        textStr,
        this.context.container
      );

      const domSnapshot = this.suggestionEngine.createDOMSnapshot(
        this.context.container
      );

      const enhancedError = new ElementTimeoutError(
        'findByText',
        textStr,
        timeout,
        suggestions,
        domSnapshot
      );

      if (errorContext) {
        enhancedError.message += ` in context: ${errorContext}`;
      }

      this.logError('findByText', textStr, enhancedError, suggestions);
      throw enhancedError;
    }
  }

  // ========================================================================
  // Utility Methods
  // ========================================================================

  /**
   * Check if element exists without throwing
   */
  exists(testId: string): boolean {
    return this.queryByTestId(testId) !== null;
  }

  /**
   * Get all elements by test ID pattern
   */
  getAllByTestIdPattern(pattern: RegExp): HTMLElement[] {
    const allElements = Array.from(
      this.context.container.querySelectorAll('[data-testid]')
    );
    return allElements.filter((el) => {
      const testId = el.getAttribute('data-testid');
      return testId && pattern.test(testId);
    }) as HTMLElement[];
  }

  /**
   * Wait for element to disappear
   */
  async waitForElementToDisappear(
    testId: string,
    timeout: number = this.config.defaultTimeout
  ): Promise<void> {
    this.log(
      'debug',
      `waitForElementToDisappear('${testId}') with timeout ${timeout}ms`
    );

    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (!this.queryByTestId(testId)) {
        this.log('debug', `waitForElementToDisappear('${testId}') - SUCCESS`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    throw new Error(
      `Element with testId '${testId}' did not disappear within ${timeout}ms`
    );
  }

  // ========================================================================
  // Private Methods
  // ========================================================================

  private log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string
  ): void {
    const levels = ['none', 'error', 'warn', 'info', 'debug'];
    const currentLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex <= currentLevelIndex) {
      const prefix = `[QUERY] [${this.context.testName || 'TEST'}]`;
      console[level](`${prefix} ${message}`);
    }
  }

  private logError(
    queryType: string,
    selector: string,
    error: QueryError,
    suggestions: string[]
  ): void {
    if (!this.config.logFailedQueries) {
      return;
    }

    console.error(`[QUERY ERROR] ${queryType}('${selector}') failed`);

    if (suggestions.length > 0) {
      console.error('Suggestions:');
      suggestions.forEach((suggestion) => {
        console.error(`  - ${suggestion}`);
      });
    }

    if (error.domSnapshot && this.config.enableDOMSnapshot) {
      console.error('DOM Snapshot:');
      console.error(error.domSnapshot);
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create standardized queries for a render result
 */
export function createStandardizedQueries(
  renderResult: RenderResult,
  context: {
    testName?: string;
    componentName?: string;
    userAction?: string;
  } = {},
  config?: Partial<QueryConfig>
): StandardizedQueries {
  const queryContext: QueryContext = {
    container: renderResult.container,
    ...context,
  };

  const mergedConfig = { ...DEFAULT_QUERY_CONFIG, ...config };

  return new StandardizedQueries(queryContext, mergedConfig);
}

/**
 * Create standardized queries for screen (global queries)
 */
export function createScreenQueries(
  context: {
    testName?: string;
    componentName?: string;
    userAction?: string;
  } = {},
  config?: Partial<QueryConfig>
): StandardizedQueries {
  const queryContext: QueryContext = {
    container: document.body,
    ...context,
  };

  const mergedConfig = { ...DEFAULT_QUERY_CONFIG, ...config };

  return new StandardizedQueries(queryContext, mergedConfig);
}

// ============================================================================
// Convenience Exports
// ============================================================================

export { type QueryConfig, QuerySuggestionEngine };

// Create default screen queries instance
export const screenQueries = createScreenQueries();
