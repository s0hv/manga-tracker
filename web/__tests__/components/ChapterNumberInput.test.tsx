import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ChapterNumberInput } from '@/components/chapter/ChapterNumberInput';

const renderInput = (defaultValue = '1') => {
  const onChange = vi.fn();
  render(<ChapterNumberInput defaultValue={defaultValue} onChange={onChange} />);

  return {
    onChange,
    input: screen.getByRole('textbox', { name: /chapter number/i }),
    user: userEvent.setup(),
  };
};

describe('ChapterNumberInput', () => {
  it('Shows the default value without an error', () => {
    const { input } = renderInput('12.5');

    expect(input).toHaveValue('12.5');
    expect(input).not.toBeInvalid();
    expect(screen.queryByText(/invalid chapter number/i)).not.toBeInTheDocument();
  });

  it('Passes the parsed chapter number to onChange', async () => {
    const { input, onChange, user } = renderInput();

    await user.clear(input);
    await user.type(input, '12.5');

    expect(onChange).toHaveBeenLastCalledWith({ chapterNumber: 12, chapterDecimal: 5 });
    expect(input).not.toBeInvalid();
  });

  it('Passes null to onChange and shows an error for invalid input', async () => {
    const { input, onChange, user } = renderInput();

    await user.clear(input);
    await user.type(input, '12abc');

    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toBeInvalid();
    expect(screen.getByText(/invalid chapter number/i)).toBeInTheDocument();
  });

  it('Clears the error once the input becomes valid again', async () => {
    const { input, onChange, user } = renderInput();

    await user.type(input, '.');
    expect(input).toBeInvalid();

    await user.type(input, '5');

    expect(onChange).toHaveBeenLastCalledWith({ chapterNumber: 1, chapterDecimal: 5 });
    expect(input).not.toBeInvalid();
    expect(screen.queryByText(/invalid chapter number/i)).not.toBeInTheDocument();
  });
});
