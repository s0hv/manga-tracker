import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SaveButton from '@/components/notifications/SaveButton';


describe('SaveButton', () => {
  it('Is not disabled by default', () => {
    render(<SaveButton />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('Is disabled when hasValidationErrors', () => {
    render(<SaveButton hasValidationErrors />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('Is disabled when submitting', () => {
    render(<SaveButton submitting />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
