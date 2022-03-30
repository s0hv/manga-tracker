import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from 'react-query';
import fetchMock from 'fetch-mock';
import { ConfirmProvider } from 'material-ui-confirm';

import { Form } from 'react-final-form';
import { queryClient, mockNotistackHooks } from '../../utils';
import MangaSelector from '../../../src/components/notifications/MangaSelector';

const inputName = 'test';

const Root = ({ selectedManga, children }) => (
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <Form
        onSubmit={jest.fn()}
        initialValues={{ [inputName]: selectedManga }}
        render={() => children}
      />
    </ConfirmProvider>
  </QueryClientProvider>
);

const manga = [
  { mangaId: 1, serviceId: 1, title: 'Test manga 1', serviceName: 'Test service 1' },
  { mangaId: 1, serviceId: 2, title: 'Test manga 1', serviceName: 'Test service 2' },
];

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
});

describe('DeleteNotificationButton', () => {
  const testLabel = 'Search for manga';

  const Rendered = ({ selectedManga }) => (
    <Root selectedManga={selectedManga}>
      <MangaSelector name={inputName} label={testLabel} useFollowsName='useFollows' />
    </Root>
  );

  const formatMangaName = ({ title, serviceName }) => (
    `${title} | ${serviceName || 'All services'}`
  );

  const expectMangaSelected = (selectedManga) => {
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

  it('Renders fetched items correctly', async () => {
    const mockResponse = jest.fn();
    const data = [{
      title: manga[0].title,
      mangaId: manga[1].mangaId,
      services: manga.reduce((prev, { serviceId, serviceName }) => ({
        ...prev,
        [serviceId]: serviceName,
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
    await act(async () => {
      await user.type(autocomplete, 'test');
    });

    expect(screen.getByRole('option', { name: formatMangaName(manga[0]) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: formatMangaName(manga[1]) })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: formatMangaName({
      title: manga[0].title,
      serviceName: null,
    }) })).toBeInTheDocument();

    await user.click(screen.getByRole('option', { name: formatMangaName(manga[0]) }));
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await act(async () => {
      await user.click(autocomplete);
      await user.keyboard('{Escape}');
    });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    expectMangaSelected(manga[0]);
    expect(screen.queryByRole(
      'button', { name: formatMangaName(manga[1]) }
    )).not.toBeInTheDocument();
  });
});
