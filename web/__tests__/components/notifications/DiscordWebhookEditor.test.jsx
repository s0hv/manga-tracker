import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from 'react-query';
import fetchMock from 'fetch-mock';

import {
  queryClient,
  mockNotistackHooks,
  expectSuccessSnackbar,
  expectErrorSnackbar,
} from '../../utils';
import DiscordWebhookEditor
  from '../../../src/components/notifications/DiscordWebhookEditor';

const Root = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
});

const defaultNotificationDataNoManga = {
  notificationId: 1,
  useFollows: true,
  notificationType: 1,
  timesRun: 0,
  timesFailed: 0,
  disabled: false,
  groupByManga: true,
  destination: 'destination',
  name: 'Test webhook',
  manga: null,
  fields: [
    {
      value: null,
      name: 'message',
      optional: true,
    },
    {
      value: '$MANGA_TITLE - Chapter $CHAPTER_NUMBER',
      name: 'embed_title',
      optional: false,
    },
    {
      value: '$MANGA_TITLES',
      name: 'username',
      optional: true,
    },
    {
      value: null,
      name: 'avatar_url',
      optional: true,
    },
    {
      value: '$TITLE\n$URL\nby $GROUP',
      name: 'embed_content',
      optional: false,
    },
    {
      value: '$URL',
      name: 'url',
      optional: true,
    },
    {
      value: '$GROUP',
      name: 'footer',
      optional: true,
    },
    {
      value: '$MANGA_COVER',
      name: 'thumbnail',
      optional: true,
    },
    {
      value: '#FF8080',
      name: 'color',
      optional: true,
    },
  ],
};

describe('DiscordWebhookEditor', () => {
  const Rendered = ({ notificationData, defaultExpanded = true }) => (
    <Root>
      <DiscordWebhookEditor
        notificationData={notificationData}
        defaultExpanded={defaultExpanded}
      />
    </Root>
  );

  it('Renders correctly', async () => {
    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    expect(screen.getByRole('heading', { name: /^discord webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Manga updates to notify on/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^use follows/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook username/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Embed title/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Message$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Embed url/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook user avatar url/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Embed content/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Footer content/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Embed thumbnail/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Embed color/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save/i })).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: /^Disabled$/i })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /^Group by manga/i })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeInTheDocument();

    expect(screen.getByText(/^formatting help/i)).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i }).closest('form')).toHaveFormValues({
      name: defaultNotificationDataNoManga.name,
      destination: defaultNotificationDataNoManga.destination,
      disabled: defaultNotificationDataNoManga.disabled,
      groupByManga: defaultNotificationDataNoManga.groupByManga,
      ...defaultNotificationDataNoManga.fields.filter(f => f.value).reduce((prev, f) => ({
        ...prev,
        [f.name]: f.value,
      }), {}),
    });
  });

  it('Renders correctly when collapsed', async () => {
    render(<Rendered notificationData={defaultNotificationDataNoManga} defaultExpanded={false} />);

    expect(screen.getByRole('heading', { name: /^discord webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeInTheDocument();

    expect(screen.queryByRole('textbox', { name: /^Webhook url/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Manga updates to notify on/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^use follows/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Webhook username/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Embed title/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Message$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Embed url/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Webhook user avatar url/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Embed content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Footer content/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Embed thumbnail/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /^Embed color/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Save/i })).not.toBeInTheDocument();

    expect(screen.queryByRole('checkbox', { name: /^Disabled$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /^Group by manga/i })).not.toBeInTheDocument();

    expect(screen.queryByRole(/^formatting help/i)).not.toBeInTheDocument();
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
      expect.objectContaining(
        {
          ...data,
          fields: data.fields
            .filter(f => f.value?.length > 0)
            .sort(sort)
            .map(f => ({ name: f.name, value: f.value })),
        }
      )
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
