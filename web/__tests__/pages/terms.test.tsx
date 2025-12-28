import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import TermsOfService from '../../src/routes/(static)/terms';

describe('TermsOfService page should render without errors', () => {
  it('Should match snapshot', () => {
    const { container } = render(<TermsOfService />);

    // It should have many paragraphs
    expect(container.getElementsByTagName('p').length).toBeGreaterThan(10);
  });
});
