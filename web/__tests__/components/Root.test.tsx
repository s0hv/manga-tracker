import React from 'react';
import { render, screen } from '@testing-library/react';

import Root from '@/components/Root';

const dummyLabel = 'test label';
const DummyComponent = () => <div aria-label={dummyLabel} />;

describe('Root component should render correctly', () => {
  it('Should render with empty input', () => {
    render(<Root><DummyComponent /></Root>);

    expect(screen.getByLabelText(dummyLabel)).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });

  it('Should render with empty input and correct status code', () => {
    render(<Root statusCode={200}><DummyComponent /></Root>);

    const currentYear = new Date().getFullYear();

    expect(screen.getByLabelText(dummyLabel)).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    const copyrightPattern = new RegExp(`^copyright . s0hv ${currentYear}.?$`, 'i');
    expect(screen.getByText((_, node) => copyrightPattern.test(node?.textContent || ''))).toBeInTheDocument();
    expect(screen.getByLabelText('license')).toBeInTheDocument();
    expect(screen.getByLabelText('github repository')).toBeInTheDocument();

    const terms = screen.getByRole<HTMLLinkElement>('link', { name: /^terms$/i });
    expect(terms).toBeVisible();
    expect(terms.href).toEndWith('/terms');

    const privacy = screen.getByRole<HTMLLinkElement>('link', { name: /^privacy policy$/i });
    expect(privacy).toBeVisible();
    expect(privacy.href).toEndWith('/privacy_policy');
  });

  it('Should only return children on non 200 status code', () => {
    render(
      <Root statusCode={400}>
        <DummyComponent />
      </Root>
    );

    expect(screen.getByLabelText(dummyLabel)).toBeInTheDocument();
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument();
  });
});
