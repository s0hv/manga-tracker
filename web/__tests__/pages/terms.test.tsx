import React from 'react';
import { render } from '@testing-library/react';
import TermsOfService from '../../src/pages/terms';

describe('TermsOfService page should render without errors', () => {
  it('Should match snapshot', () => {
    const { container } = render(<TermsOfService />);

    // It should have many paragraphs
    expect(container.getElementsByTagName('p').length).toBeGreaterThan(10);
  });
});
