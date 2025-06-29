import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';


import { normalUser, withUser } from '../utils';

import Follows from '../../src/views/Follows';

describe('Follows contains required components', () => {
  it('Contains RSS feed button', async () => {
    render(await withUser(normalUser, <Follows />));

    const rssIcon = screen.getByLabelText<HTMLLinkElement>(/follows rss feed/i);
    expect(rssIcon).toBeTruthy();
    expect(rssIcon).toHaveProperty('href');
    const uuid = normalUser.userUuid.replace(/-/g, '');
    expect(rssIcon.href).toMatch(new RegExp(uuid));
  });
});
