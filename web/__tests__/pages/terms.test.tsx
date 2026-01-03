import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';


import { TermsOfService } from '#web/routes/(static)/terms';

vi.mock('@tanstack/react-router');

describe('TermsOfService page should render without errors', () => {
  it('Should contain many paragraphs', () => {
    const { container } = render(<TermsOfService />);

    // It should have many paragraphs
    expect(container.getElementsByTagName('p').length).toBeGreaterThan(10);
  });
});
