import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InputSelector } from './InputSelector';

describe('InputSelector', () => {
  it('disables every input while an input command is pending', () => {
    const onChange = vi.fn();
    render(
      <InputSelector
        value="net"
        disabled={false}
        pendingCommand="input:net"
        onChange={onChange}
      />,
    );

    const inputs = screen.getAllByRole('gridcell');
    expect(inputs).toHaveLength(6);
    for (const input of inputs) {
      expect(input).toBeDisabled();
    }

    fireEvent.click(screen.getByRole('gridcell', { name: 'USB' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
