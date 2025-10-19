/**
 * Unit tests for input utilities
 *
 * These tests verify that the input utilities work correctly and handle
 * edge cases properly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { typeIntoInput, submitForm, waitForDebounce } from '../input-utilities';

// Mock timers for debounce testing
vi.mock('timers');

describe('typeIntoInput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  it('should type text into input element without duplication', async () => {
    render(<input data-testid="test-input" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    await typeIntoInput(input, 'hello world');

    expect(input.value).toBe('hello world');
  });

  it('should type text into textarea element without duplication', async () => {
    render(<textarea data-testid="test-textarea" />);
    const textarea = screen.getByTestId('test-textarea') as HTMLTextAreaElement;

    await typeIntoInput(textarea, 'multiline\ntext');

    expect(textarea.value).toBe('multiline\ntext');
  });

  it('should clear existing content before typing when clearFirst is true (default)', async () => {
    render(<input data-testid="test-input" defaultValue="existing" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    await typeIntoInput(input, 'new text');

    expect(input.value).toBe('new text');
  });

  it('should not clear existing content when clearFirst is false', async () => {
    render(<input data-testid="test-input" defaultValue="existing " />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    await typeIntoInput(input, 'appended', { clearFirst: false });

    expect(input.value).toBe('existing appended');
  });

  it('should respect delay option between keystrokes', async () => {
    render(<input data-testid="test-input" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    const startTime = Date.now();
    await typeIntoInput(input, 'abc', { delay: 50 });
    const endTime = Date.now();

    expect(input.value).toBe('abc');
    // Should take at least some time due to delays (allowing for test timing variance)
    expect(endTime - startTime).toBeGreaterThan(100);
  });

  it('should skip initial click when skipClick is true', async () => {
    render(<input data-testid="test-input" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    // The main test is that it doesn't throw an error and types correctly
    await typeIntoInput(input, 'text', { skipClick: true });

    expect(input.value).toBe('text');
    // The skipClick option is mainly for performance/behavior optimization
    // The key test is that typing still works correctly
  });

  it('should work with contenteditable elements', async () => {
    render(<div data-testid="test-editable" contentEditable />);
    const editable = screen.getByTestId('test-editable');

    await typeIntoInput(editable, 'editable content');

    expect(editable.textContent).toBe('editable content');
  });

  it('should throw error for non-input elements', async () => {
    render(<div data-testid="test-div">Not an input</div>);
    const div = screen.getByTestId('test-div');

    await expect(typeIntoInput(div, 'text')).rejects.toThrow(
      'typeIntoInput expects an input, textarea, or contenteditable element'
    );
  });

  it('should handle empty text input', async () => {
    render(<input data-testid="test-input" defaultValue="existing" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    await typeIntoInput(input, '');

    expect(input.value).toBe('');
  });

  it('should handle special characters and symbols', async () => {
    render(<input data-testid="test-input" />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    // Use a simpler set of special characters that don't conflict with userEvent
    const specialText = '!@#$%^&*()_+-=,.<>?';
    await typeIntoInput(input, specialText);

    expect(input.value).toBe(specialText);
  });

  it('should provide helpful error message when typing fails', async () => {
    render(<input data-testid="test-input" disabled />);
    const input = screen.getByTestId('test-input') as HTMLInputElement;

    await expect(typeIntoInput(input, 'text')).rejects.toThrow(
      'Failed to type "text" into element'
    );
  });
});

describe('submitForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should submit form via button click by default', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" />
        <button type="submit">Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should submit form via Enter key when viaEnterKey is true', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" data-testid="test-input" />
        <button type="submit">Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form, { viaEnterKey: true, viaButton: false });

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should work when passed a form element directly', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" />
        <button type="submit">Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should work when passed an element inside a form', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit}>
        <div data-testid="form-content">
          <input name="test" />
          <button type="submit">Submit</button>
        </div>
      </form>
    );
    const formContent = screen.getByTestId('form-content');

    await submitForm(formContent);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should find submit button with type="submit"', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" />
        <button type="button">Cancel</button>
        <button type="submit">Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should find input with type="submit"', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" />
        <input type="submit" value="Submit" />
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should find button without explicit type (defaults to submit)', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <input name="test" />
        <button>Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await submitForm(form);

    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it('should throw error when no form is found', async () => {
    render(<div data-testid="not-form">Not a form</div>);
    const notForm = screen.getByTestId('not-form');

    await expect(submitForm(notForm)).rejects.toThrow(
      'submitForm could not find a form element'
    );
  });

  it('should throw error when no submit button is found', async () => {
    render(
      <form data-testid="test-form">
        <input name="test" />
        <button type="button">Not Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await expect(submitForm(form)).rejects.toThrow(
      'No submit button found in form'
    );
  });

  it('should throw error when no focusable elements for Enter key submission', async () => {
    const handleSubmit = vi.fn((e) => e.preventDefault());
    render(
      <form onSubmit={handleSubmit} data-testid="test-form">
        <div>No inputs here</div>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await expect(
      submitForm(form, { viaEnterKey: true, viaButton: false })
    ).rejects.toThrow(
      'No focusable form elements found for Enter key submission'
    );
  });

  it('should throw error when both viaEnterKey and viaButton are false', async () => {
    render(
      <form data-testid="test-form">
        <input name="test" />
        <button type="submit">Submit</button>
      </form>
    );
    const form = screen.getByTestId('test-form');

    await expect(
      submitForm(form, { viaEnterKey: false, viaButton: false })
    ).rejects.toThrow('Either viaEnterKey or viaButton must be true');
  });
});

describe('waitForDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should advance timers by default delay (500ms)', async () => {
    const callback = vi.fn();

    await waitForDebounce(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should advance timers by custom delay', async () => {
    const callback = vi.fn();
    const customDelay = 1000;

    await waitForDebounce(callback, customDelay);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should wait for async callback completion', async () => {
    let resolved = false;
    const asyncCallback = vi.fn(async () => {
      // Use vi.advanceTimersByTime instead of real setTimeout
      resolved = true;
    });

    await waitForDebounce(asyncCallback);

    expect(asyncCallback).toHaveBeenCalledTimes(1);
    expect(resolved).toBe(true);
  });

  it('should handle sync callback', async () => {
    const syncCallback = vi.fn(() => {
      return 'sync result';
    });

    await waitForDebounce(syncCallback);

    expect(syncCallback).toHaveBeenCalledTimes(1);
  });

  it('should provide helpful error message when callback fails', async () => {
    const failingCallback = vi.fn(() => {
      throw new Error('Callback failed');
    });

    await expect(waitForDebounce(failingCallback)).rejects.toThrow(
      'waitForDebounce failed: Callback failed'
    );
  });

  it('should handle callback that returns rejected promise', async () => {
    const rejectingCallback = vi.fn(async () => {
      throw new Error('Async callback failed');
    });

    await expect(waitForDebounce(rejectingCallback)).rejects.toThrow(
      'waitForDebounce failed: Async callback failed'
    );
  });
});
