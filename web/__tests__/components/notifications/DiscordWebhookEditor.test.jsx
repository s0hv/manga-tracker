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
  ],
};

describe('DeleteNotificationButton', () => {
  const Rendered = ({ notificationData }) => (
    <Root>
      <DiscordWebhookEditor
        notificationData={notificationData}
      />
    </Root>
  );

  it('Renders correctly', async () => {
    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Manga updates to notify on/i })).toBeInTheDocument();
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
