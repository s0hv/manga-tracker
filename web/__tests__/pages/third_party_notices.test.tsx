import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import ThirdPartyNotices from '../../src/pages/third_party_notices';

describe('ThirdPartyNotices page should render correctly', () => {
  it('Should match snapshot', () => {
    render(<ThirdPartyNotices />);

    expect(screen.getByRole('heading', { name: /^third party notices$/i })).toBeVisible();
    expect(screen.getByText('Some information shown on the site is gathered through the following services.')).toBeVisible();

    const mangadexLink = screen.getByRole<HTMLLinkElement>('link', { name: /mangadex api/i });
    expect(mangadexLink).toBeVisible();
    expect(mangadexLink.href).toMatchInlineSnapshot('"https://api.mangadex.org/docs/"');
    expect(mangadexLink.rel).toMatchInlineSnapshot('"noopener noreferrer"');
  });
});
