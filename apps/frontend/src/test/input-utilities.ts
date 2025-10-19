/**
 * Enhanced user input utilities for reliable test interactions
 *
 * This module provides utilities that fix common issues with user input simulation:
 * - Prevents duplicate character issues in typeIntoInput
 * - Provides reliable form submission handling
 * - Handles debounced operations correctly
 */

import { userEvent } from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { vi } from 'vitest';

/**
 * Options for typeIntoInput utility
 */
export interface TypeOptions {
  /** Clear the input before typing (default: true) */
  clearFirst?: boolean;
  /** Delay between keystrokes in milliseconds (default: 0) */
  delay?: number;
  /** Skip the initial click on the element (default: false) */
  skipClick?: boolean;
}

/**
 * Enhanced typing utility that prevents duplicate characters
 *
 * This function addresses the common issue where userEvent.type() can produce
 * duplicate characters by clearing the input first (unless disabled).
 *
 * @param element - The input element to type into
 * @param text - The text to type
 * @param options - Typing options
 */
export async function typeIntoInput(
  element: HTMLElement,
  text: string,
  options: TypeOptions = {}
): Promise<void> {
  const { clearFirst = true, delay = 0, skipClick = false } = options;

  // Validate element is an input-like element
  if (!isInputElement(element)) {
    throw new Error(
      `typeIntoInput expects an input, textarea, or contenteditable element, ` +
        `but received: ${element.tagName.toLowerCase()}`
    );
  }

  // Create user event instance with delay if specified
  const user = userEvent.setup({ delay });

  try {
    // Click the element first unless skipped
    if (!skipClick) {
      await user.click(element);
    }

    // Clear existing content if requested
    if (clearFirst) {
      await user.clear(element);
    }

    // Type the new text (only if not empty)
    if (text.length > 0) {
      await user.type(element, text);
    }
  } catch (error) {
    throw new Error(
      `Failed to type "${text}" into element: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Options for submitForm utility
 */
export interface SubmitOptions {
  /** Submit via Enter key instead of button click (default: false) */
  viaEnterKey?: boolean;
  /** Submit via button click (default: true) */
  viaButton?: boolean;
}

/**
 * Enhanced form submission utility
 *
 * This function provides reliable form submission that works with both
 * Enter key presses and button clicks, ensuring the onSubmit handler
 * is called exactly once.
 *
 * @param form - The form element or an element within the form
 * @param options - Submission options
 */
export async function submitForm(
  form: HTMLElement,
  options: SubmitOptions = {}
): Promise<void> {
  const { viaEnterKey = false, viaButton = true } = options;

  // Find the actual form element
  const formElement = findFormElement(form);
  if (!formElement) {
    throw new Error(
      'submitForm could not find a form element. ' +
        'Ensure the element is a form or is contained within a form.'
    );
  }

  const user = userEvent.setup();

  try {
    if (viaEnterKey) {
      // Submit via Enter key - focus on a form element first
      const firstInput = formElement.querySelector(
        'input, textarea, select'
      ) as HTMLElement;
      if (firstInput) {
        await user.click(firstInput);
        await user.keyboard('{Enter}');
      } else {
        throw new Error(
          'No focusable form elements found for Enter key submission'
        );
      }
    } else if (viaButton) {
      // Submit via button click - find submit button
      const submitButton = findSubmitButton(formElement);
      if (!submitButton) {
        throw new Error('No submit button found in form');
      }
      await user.click(submitButton);
    } else {
      throw new Error('Either viaEnterKey or viaButton must be true');
    }
  } catch (error) {
    throw new Error(
      `Failed to submit form: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Wait for debounced operations to complete
 *
 * This function advances timers to skip the debounce period and then
 * waits for the callback to complete.
 *
 * @param callback - Function to execute after debounce
 * @param delay - Debounce delay in milliseconds (default: 500)
 */
export async function waitForDebounce(
  callback: () => void | Promise<void>,
  delay: number = 500
): Promise<void> {
  try {
    // Advance timers to skip the debounce period
    vi.advanceTimersByTime(delay);

    // Execute the callback
    const result = callback();

    // If callback returns a promise, wait for it
    if (result instanceof Promise) {
      await result;
    }

    // Flush any remaining timers
    vi.runAllTimers();
  } catch (error) {
    throw new Error(
      `waitForDebounce failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Helper function to check if an element can receive text input
 */
function isInputElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();

  // Standard input elements
  if (tagName === 'input' || tagName === 'textarea') {
    return true;
  }

  // Contenteditable elements
  if (element.hasAttribute('contenteditable')) {
    const contentEditable = element.getAttribute('contenteditable');
    return contentEditable === 'true' || contentEditable === '';
  }

  return false;
}

/**
 * Helper function to find the form element
 */
function findFormElement(element: HTMLElement): HTMLFormElement | null {
  // If the element is already a form, return it
  if (element.tagName.toLowerCase() === 'form') {
    return element as HTMLFormElement;
  }

  // Otherwise, find the closest form ancestor
  return element.closest('form');
}

/**
 * Helper function to find a submit button in a form
 */
function findSubmitButton(form: HTMLFormElement): HTMLElement | null {
  // Look for button with type="submit"
  const submitButton = form.querySelector(
    'button[type="submit"]'
  ) as HTMLElement;
  if (submitButton) {
    return submitButton;
  }

  // Look for input with type="submit"
  const submitInput = form.querySelector('input[type="submit"]') as HTMLElement;
  if (submitInput) {
    return submitInput;
  }

  // Look for button without explicit type (defaults to submit in forms)
  const defaultButton = form.querySelector('button:not([type])') as HTMLElement;
  if (defaultButton) {
    return defaultButton;
  }

  return null;
}
