import React, { FunctionComponent, PropsWithChildren } from 'react';
import { render, screen } from '@testing-library/react';
import { SnackbarProvider } from 'notistack';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';

import {
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  mockUTCDates,
  muiSelectValue,
} from '../utils';
import EditableMangaInfo from '../../src/components/EditableMangaInfo';
import {
  defaultDateDistanceFormat,
  defaultDateFormatRegex,
} from '../constants';
import { statusToString } from '@/webUtils/utilities';

const Root: FunctionComponent<PropsWithChildren> = ({ children }) => (
  <SnackbarProvider>
    {children}
  </SnackbarProvider>
);

beforeEach(() => mockNotistackHooks());

const mangaData = {
  mangaId: 1,
  releaseInterval: {
    days: 7,
  },
  latestRelease: '2020-07-05T16:00:00.000Z',
  estimatedRelease: '2020-07-12T16:00:00.000Z',
  latestChapter: 157,
  status: 0,
};


describe('EditableMangaInfo should render correctly', () => {
  mockUTCDates();

  const nullData = {
    mangaId: 1,
    status: 0,
  };

  it('Should render correctly with data', () => {
    render(<Root><EditableMangaInfo mangaData={mangaData} /></Root>);

    expect(screen.queryByRole('row', { name: /manga id: \d+/i })).not.toBeInTheDocument();

    expect(
      screen.getByRole(
        'row',
        { name: new RegExp(`latest release: ${defaultDateFormatRegex} - ${defaultDateDistanceFormat}`, 'i') }
      )
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated release interval: \d+ days \d+ hours/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole(
        'row',
        { name: new RegExp(`estimated next release: ${defaultDateFormatRegex}`, 'i') }
      )
    ).toBeInTheDocument();

    expect(screen.getByRole('row', { name: /latest chapter: \d+/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publication status \w+/i })).toBeInTheDocument();
  });

  it('Should render correctly with null data', () => {
    render(<Root><EditableMangaInfo mangaData={nullData} /></Root>);

    expect(
      screen.getByRole('row', { name: /latest release: unknown/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated release interval: unknown/i })
    ).toBeInTheDocument();

    expect(
      screen.getByRole('row', { name: /estimated next release: unknown/i })
    ).toBeInTheDocument();

    expect(screen.getByRole('row', { name: /latest chapter: unknown/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /publication status \w+/i })).toBeInTheDocument();
  });

  it('Should throw TypeError when mangaData not given', () => {
    // @ts-expect-error
    expect(() => render(<Root><EditableMangaInfo /></Root>)).toThrow(TypeError);
  });
});

describe('EditableMangaInfo should allow editing', () => {
  const mangaId = mangaData.mangaId;

  mockUTCDates();
  beforeEach(() => fetchMock.reset());

  it('Shows success snackbar when edit is successful', async () => {
    fetchMock.post(`/api/admin/manga/${mangaId}/info`, 200);

    render(<Root><EditableMangaInfo mangaData={mangaData} /></Root>);

    await userEvent.click(screen.getByText('Save changes'));

    expectSuccessSnackbar();
  });

  it('Shows success snackbar when edit is successful with new value', async () => {
    fetchMock.post(`/api/admin/manga/${mangaId}/info`, 200);

    render(<Root><EditableMangaInfo mangaData={mangaData} /></Root>);

    const user = userEvent.setup();

    await muiSelectValue(user, screen, /^publication status$/i, statusToString(mangaData.status + 1));

    await user.click(screen.getByText('Save changes'));

    expectSuccessSnackbar();

    const response = JSON.parse(fetchMock.lastCall(`/api/admin/manga/${mangaId}/info`)![1]!.body!.toString());
    expect(response).toEqual({ status: mangaData.status + 1 });
  });

  it('Shows error snackbar when edit is not successful', async () => {
    fetchMock.post(`/api/admin/manga/${mangaId}/info`, 404);

    render(<Root><EditableMangaInfo mangaData={mangaData} /></Root>);

    const user = userEvent.setup();
    await user.click(screen.getByText('Save changes'));

    expectErrorSnackbar();
  });
});
