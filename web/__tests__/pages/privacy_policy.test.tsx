import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import PrivacyPolicy from '../../src/pages/privacy_policy';

describe('PrivacyPolicy page should render without errors', () => {
  it('Should match snapshot', () => {
    const { container } = render(<PrivacyPolicy />);

    // It should have many paragraphs
    expect(container.getElementsByTagName('p').length).toBeGreaterThan(10);
  });
});
