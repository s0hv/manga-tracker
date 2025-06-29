import type { FC, PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { ConfirmProvider } from 'material-ui-confirm';
import { FormContainer } from 'react-hook-form-mui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { mockNotistackHooks, queryClient } from '../../utils';
import MangaSelector, {
  type MangaSelectorProps,
} from '@/components/notifications/MangaSelector';
import type { NotificationFollow } from '@/types/api/notifications';

const inputName = 'manga';
const overrideName = 'overrideId';

const Root: FC<PropsWithChildren<{ selectedManga?: NotificationFollow[] }>> = ({ selectedManga, children }) => (
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <FormContainer
        onSuccess={vi.fn()}
        defaultValues={{
          [inputName]: selectedManga,
          [overrideName]: null,
        }}
      >
        {children}
      </FormContainer>
    </ConfirmProvider>
  </QueryClientProvider>
);

const manga: NotificationFollow[] = [
  { mangaId: 1, serviceId: 1, title: 'Test manga 1', serviceName: 'Test service 1' },
  { mangaId: 1, serviceId: 2, title: 'Test manga 1', serviceName: 'Test service 2' },
];

beforeEach(async () => {
  await mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

type RenderProps = {
  selectedManga?: NotificationFollow[]
} & Omit<
  MangaSelectorProps,
  | 'name'
  | 'label'
  | 'useFollowsName'
>;

describe('MangaSelector', () => {
  const testLabel = 'Search for manga';

  const Rendered: FC<RenderProps> = ({ selectedManga, ...selectorProps }) => (
    <Root selectedManga={selectedManga}>
      <MangaSelector name={inputName} label={testLabel} {...selectorProps} />
    </Root>
  );

  const formatMangaName = ({ title, serviceName }: { title: string, serviceName: string | null }) => (
    `${title} | ${serviceName || 'All services'}`
  );

  const expectMangaSelected = (selectedManga: NotificationFollow) => {
    expect(screen.getByRole(
      'button', { name: formatMangaName(selectedManga) }
    )).toBeInTheDocument();
  };

  it('Renders correctly', async () => {
    render(<Rendered />);

    expect(screen.getByRole('combobox', { name: testLabel })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /use follows/i })).toBeInTheDocument();
  });

  it('Disabled the autocomplete when useFollows is checked', async () => {
    render(<Rendered />);

    const useFollows = screen.getByRole('checkbox', { name: /use follows/i });
    const autocomplete = screen.getByRole('combobox', { name: testLabel });
    const user = userEvent.setup();

    await user.click(useFollows);
    expect(autocomplete).toBeDisabled();

    await user.click(useFollows);
    expect(autocomplete).not.toBeDisabled();
  });

  it('Renders initial manga', async () => {
    render(<Rendered selectedManga={manga} />);

    expectMangaSelected(manga[0]);
    expectMangaSelected(manga[1]);
  });

  it('Disabled input when disabled is true', async () => {
    render(<Rendered selectedManga={manga} disabled />);

    expect(screen.getByRole('checkbox', { name: /use follows/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: testLabel })).toBeDisabled();
  });

  it('Renders fetched items correctly', async () => {
    const mockResponse = vi.fn();
    const data = [{
      title: manga[0].title,
      mangaId: manga[1].mangaId,
      services: manga.reduce((prev, { serviceId, serviceName }) => ({
        ...prev,
        [String(serviceId)]: serviceName,
      }), {}),
    }];
    mockResponse.mockImplementation(() => ({ data }));
    fetchMock.get(
      `glob:/api/quicksearch?query=*&withServices=true`,
      mockResponse
    );

    render(<Rendered />);

    const user = userEvent.setup();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    const autocomplete = screen.getByRole('combobox', { name: testLabel });
    await user.type(autocomplete, 'test');


    expect(screen.getByRole('option', { name: formatMangaName(manga[0]) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: formatMangaName(manga[1]) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: formatMangaName({
      title: manga[0].title,
      serviceName: null,
    }) })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: formatMangaName(manga[0]) }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(autocomplete);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    expectMangaSelected(manga[0]);
    expect(screen.queryByRole(
      'button', { name: formatMangaName(manga[1]) }
    )).not.toBeInTheDocument();
  });
});
