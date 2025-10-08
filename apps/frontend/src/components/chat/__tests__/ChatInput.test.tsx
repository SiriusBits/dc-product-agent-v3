import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChatInput from '../ChatInput';

describe('ChatInput', () => {
  it('renders with placeholder text', () => {
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    expect(screen.getByPlaceholderText(/Ask about chemical products/)).toBeInTheDocument();
  });

  it('calls onSendMessage when form is submitted', async () => {
    const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText(/Ask about chemical products/);
    const button = screen.getByRole('button');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('Test message');
    });
  });

  it('clears input after sending message', async () => {
    const mockOnSendMessage = vi.fn().mockResolvedValue(undefined);
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    
    const input = screen.getByPlaceholderText(/Ask about chemical products/) as HTMLInputElement;
    const button = screen.getByRole('button');
    
    fireEvent.change(input, { target: { value: 'Test message' } });
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(input.value).toBe('');
    });
  });

  it('shows loading state when isLoading is true', () => {
    const mockOnSendMessage = vi.fn();
    render(<ChatInput onSendMessage={mockOnSendMessage} isLoading={true} />);
    
    expect(screen.getByRole('button')).toBeDisabled();
  });
});