import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, vi, it } from 'vitest';

import userEvent from '@testing-library/user-event';
import MangaSourceList from '../../src/components/MangaSourceList';
import { normalUser, withUser, silenceConsole, restoreMocks } from '../utils';

const services = [
  {
    titleId: '100010',
    serviceId: 1,
    name: 'MANGA Plus',
    url: 'https://mangaplus.shueisha.co.jp/titles/{}',
  },
  {
    titleId: '20882',
    serviceId: 2,
    name: 'MangaDex',
    url: 'https://mangadex.org/title/{}',
  },
  {
    titleId: 'test_series_1',
    serviceId: 3,
    name: 'TestService',
    url: 'https://test.com/manga/{}',
  },
];

const follows = [1];


describe('Manga source list', () => {
  it('Should render correctly without input', () => {
    render(<MangaSourceList />);

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  it('Should render correctly with items without user', () => {
    render(
      <MangaSourceList
        items={services}
        classesProp={['test-class-1', 'test-class-2']}
        openByDefault
      />
    );

    expect(screen.queryAllByRole('listitem')).toHaveLength(services.length);
    expect(screen.queryByRole('button', { name: /follow /i })).not.toBeInTheDocument();
  });

  it('Should render correctly with items and user', async () => {
    render(
      await withUser(
        normalUser, (
          <MangaSourceList
            items={services}
            userFollows={follows}
            classesProp={['test-class-1', 'test-class-2']}
            openByDefault
          />
        )
      )
    );

    expect(screen.queryAllByRole('listitem')).toHaveLength(services.length);
    expect(screen.queryAllByRole('button', { name: /follow /i })).toHaveLength(services.length);
  });

  it('should fail to render with invalid services', () => {
    // At the moment missing name or service id don't throw errors
    const invalid = [{
      titleId: 'test_series_1',
      serviceId: 3,
    }];

    const spies = silenceConsole();
    expect(() => render(
      <MangaSourceList
        items={invalid}
        classesProp={['test-class-1', 'test-class-2']}
      />
    )).toThrow();
    restoreMocks(spies);
  });
});


describe('Manga source list should handle user input', () => {
  it('Should call follow function on click', async () => {
    const followUnfollow = vi.fn();
    const createEvent = vi.fn();
    createEvent.mockImplementation(() => followUnfollow);

    render(
      await withUser(
        normalUser, (
          <MangaSourceList
            items={services}
            userFollows={follows}
            classesProp={['test-class-1', 'test-class-2']}
            followUnfollow={createEvent}
            openByDefault
          />
        )
      )
    );

    expect(createEvent).toHaveBeenCalledTimes(services.length);
    expect(followUnfollow).toHaveBeenCalledTimes(0);

    const user = userEvent.setup();
    await user.click(
      screen.getByRole(
        'button',
        { name: new RegExp(`follow ${services[0].name}`, 'i') }
      )
    );
    expect(followUnfollow).toHaveBeenCalledTimes(1);
  });

  it('Should open and close collapsed list on clicks', async () => {
    render(
      await withUser(
        normalUser, (
          <MangaSourceList
            items={services}
            userFollows={follows}
            classesProp={['test-class-1', 'test-class-2']}
          />
        )
      )
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole('button', { name: /open follows/i })
    );

    expect(screen.queryAllByRole('button', { name: /follow /i })).toHaveLength(services.length);

    await user.click(
      screen.getByRole('button', { name: /close follows/i })
    );

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });
});
