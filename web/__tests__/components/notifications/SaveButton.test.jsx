import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import SaveButton from '../../../src/components/notifications/SaveButton';


describe('SaveButton', () => {
  it('Is not disabled by default', async () => {
    render(<SaveButton />);
    expect(screen.getByRole('button')).not.toBeDisabled();
  });

  it('Is disabled when hasValidationErrors', async () => {
    render(<SaveButton hasValidationErrors />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('Is disabled when submitting', async () => {
    render(<SaveButton submitting />);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
