import React from 'react';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import MangaAliases from '../../src/components/MangaAliases';
import { adminUser, withUser, normalUser } from '../utils';

describe('MangaAliases renders correctly', () => {
  it('Should render correctly without aliases', () => {
    const { container, rerender } = render(<MangaAliases />);
    expect(container.childElementCount).toBe(0);

    rerender(<MangaAliases aliases={[]} />);
    expect(container.childElementCount).toBe(0);
  });

  it('Should render correctly with aliases', () => {
    const aliases = ['test_1', 'test_2', 'test_3'];
    render(<MangaAliases aliases={aliases} />);

    expect(screen.getByText(/^alternative titles$/i)).toBeInTheDocument();

    aliases.forEach(alias => {
      expect(screen.getByText(alias)).toBeInTheDocument();
    });

    expect(screen.getAllByRole('listitem')).toHaveLength(aliases.length);
  });

  it('Should render correctly with editing allowed as admin', async () => {
    const aliases = ['a', 'b', 'c'];
    render(
      await withUser(
        adminUser,
        <MangaAliases aliases={aliases} allowEdits />
      )
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(aliases.length);

    listItems.forEach(listItem => {
      const li = within(listItem);
      expect(li.getByRole('button', { name: /set alias as main title/i }))
        .toBeInTheDocument();
    });
  });

  it('Should not render buttons when allowEdits without admin', async () => {
    const aliases = ['a', 'b', 'c'];
    render(
      await withUser(
        normalUser,
        <MangaAliases aliases={aliases} allowEdits />
      )
    );

    const listItems = screen.getAllByRole('listitem');
    expect(listItems).toHaveLength(aliases.length);

    listItems.forEach(listItem => {
      const li = within(listItem);
      expect(li.queryByRole('button', { name: /set alias as main title/i }))
        .not.toBeInTheDocument();
    });
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
      await withUser(
        adminUser,
        <MangaAliases
          aliases={aliases}
          allowEdits
          mangaId={mangaId}
          onTitleUpdate={onTitleUpdate}
          confirm={confirm}
          enqueueSnackbar={enqueueSnackbar}
        />
      )
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
      await withUser(
        adminUser,
        <MangaAliases
          aliases={aliases}
          allowEdits
          mangaId={mangaId}
          onTitleUpdate={onTitleUpdate}
          confirm={confirm}
          enqueueSnackbar={enqueueSnackbar}
        />
      )
    );

    const row = within(screen.getByText(aliases[0]).closest('li'));

    await act(async () => {
      fireEvent.click(row.getByLabelText('Set alias as main title'));
    });

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(enqueueSnackbar).toHaveBeenCalledTimes(0);
  });
});
