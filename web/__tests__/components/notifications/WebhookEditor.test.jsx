import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';

import {
  queryClient,
  mockNotistackHooks,
  expectSuccessSnackbar,
  expectErrorSnackbar,
} from '../../utils';
import WebhookEditor from '../../../src/components/notifications/WebhookEditor';
import { NotificationTypes } from '../../../src/utils/constants';
import {
  defaultDataForType,
} from '../../../src/components/notifications/defaultDatas';


const Root = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

const defaultWebhookData = defaultDataForType[NotificationTypes.Webhook];
const defaultNotificationDataNoManga = {
  ...defaultWebhookData,
  notificationId: 1,
  destination: 'destination',
  useFollows: true,
};

describe('WebhookEditor', () => {
  const Rendered = ({ notificationData, defaultExpanded = true }) => (
    <Root>
      <WebhookEditor
        notificationData={notificationData}
        defaultExpanded={defaultExpanded}
      />
    </Root>
  );

  it('Renders correctly', async () => {
    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    expect(screen.getByRole('heading', { name: /^json webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByText(/^webhook json format$/i)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Manga updates to notify on/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^use follows/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save/i })).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: /^Disabled$/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Group by manga/i })).toBeInTheDocument();
    expect(screen.getByText(/^formatting help/i)).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeInTheDocument();
  });

  it('Renders correctly when collapsed', async () => {
    render(<Rendered notificationData={defaultNotificationDataNoManga} defaultExpanded={false} />);

    expect(screen.getByRole('heading', { name: /^json webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeInTheDocument();

    expect(screen.queryByRole(/^webhook json format$/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Webhook url/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Manga updates to notify on/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^use follows/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/i })).not.toBeInTheDocument();

    expect(screen.queryByRole('checkbox', { name: /^Disabled$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Group by manga/i })).not.toBeInTheDocument();

    // Does not work as expected.
    // expect(screen.queryByText(/^formatting help/i)).not.toBeInTheDocument();
  });

  it('Does post request on save', async () => {
    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({
      data: { notificationId: defaultNotificationDataNoManga.notificationId },
    }));
    fetchMock.post(
      `glob:/api/notifications`,
      mockRoute
    );

    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expect(mockRoute).toHaveBeenCalledOnce();

    const sort = (a, b) => ((a.name < b.name) ? 1 : -1);
    const response = JSON.parse(fetchMock.lastCall('/api/notifications')[1].body);
    response.fields.sort(sort);

    const data = { ...defaultNotificationDataNoManga };
    delete data.timesFailed;
    delete data.timesRun;
    delete data.manga;

    expect(response).toEqual(
      expect.objectContaining(data)
    );

    expectSuccessSnackbar();
  });

  it('Shows error on failed submit', async () => {
    fetchMock.post(
      `glob:/api/notifications`,
      400
    );

    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /^save$/i }));
    });

    expectErrorSnackbar();
  });
});
