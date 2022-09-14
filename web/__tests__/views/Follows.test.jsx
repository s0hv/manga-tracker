import { render, screen } from '@testing-library/react';
import React from 'react';

import Follows from '../../src/views/Follows';
import { normalUser, withUser } from '../utils';

describe('Follows contains required components', () => {
  it('Contains RSS feed button', async () => {
    render(await withUser(normalUser, <Follows />));

    const rssIcon = screen.getByLabelText(/follows rss feed/i);
    expect(rssIcon).toBeTruthy();
    const uuid = normalUser.userUuid.replace(/-/g, '');
    expect(rssIcon.href).toMatch(new RegExp(uuid));
  });
});
