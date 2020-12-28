import React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import fetchMock from 'fetch-mock';
import { create } from 'react-test-renderer';

import MangaAliases from '../../src/components/MangaAliases';
import { adminUser, withUser } from '../utils';

describe('MangaAliases renders correctly', () => {
  it('Should render correctly without aliases', () => {
    expect(create(<MangaAliases />)).toMatchSnapshot();
    expect(create(<MangaAliases aliases={[]} />)).toMatchSnapshot();
  });

  it('Should render correctly with aliases', () => {
    expect(create(<MangaAliases aliases={['a', 'b', 'c']} />)).toMatchSnapshot();
  });

  it('Should render correctly with editing allowed', async () => {
    expect(create(
      await withUser(adminUser,
        <MangaAliases aliases={['a', 'b', 'c']} allowEdits />)
    )).toMatchSnapshot();
  });
});

describe('MangaAliases should promote alias correctly', () => {
  it('Should call correct network path on alias promotion', async () => {
    const aliases = ['Test alias 1', 'Test alias 2'];
    const mangaId = 1;
    const onTitleUpdate = jest.fn();
    const confirm = jest.fn(() => Promise.resolve());
    const enqueueSnackbar = jest.fn();

    const mockRoute = jest.fn(() => Promise.resolve({}));
    fetchMock.post(
      `path:/api/admin/manga/${mangaId}/title`,
      mockRoute,
      { body: { title: aliases[0] }}
    );

    render(
      await withUser(adminUser,
        <MangaAliases
          aliases={aliases}
          allowEdits
          mangaId={mangaId}
          onTitleUpdate={onTitleUpdate}
          confirm={confirm}
          enqueueSnackbar={enqueueSnackbar}
        />)
    );

    expect(screen.getByText(aliases[0])).toBeTruthy();
    expect(screen.getByText(aliases[1])).toBeTruthy();

    const row = within(screen.getByText(aliases[0]).closest('li'));

    await act(async () => {
      fireEvent.click(row.getByLabelText('Set alias as main title'));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(mockRoute).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ variant: 'success' })
    );
  });

  it('Should not update alias when confirm rejected', async () => {
    const aliases = ['Test alias 1', 'Test alias 2'];
    const mangaId = 1;
    const onTitleUpdate = jest.fn();
    const confirm = jest.fn(() => Promise.reject());
    const enqueueSnackbar = jest.fn();

    render(
      await withUser(adminUser,
        <MangaAliases
          aliases={aliases}
          allowEdits
          mangaId={mangaId}
          onTitleUpdate={onTitleUpdate}
          confirm={confirm}
          enqueueSnackbar={enqueueSnackbar}
        />)
    );

    const row = within(screen.getByText(aliases[0]).closest('li'));

    await act(async () => {
      fireEvent.click(row.getByLabelText('Set alias as main title'));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(0);
  });
});
