import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import type { FC, PropsWithChildren } from 'react';

import {
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  queryClient,
} from '../../utils';
import DiscordWebhookEditor
  from '../../../src/components/notifications/DiscordWebhookEditor';
import type {
  NotificationData,
  NotificationFieldData,
  NotificationFollow,
} from '@/types/api/notifications';
import type { UpsertNotificationOverride } from '@/db/notifications';

const Root: FC<PropsWithChildren> = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

const defaultNotificationDataNoManga: NotificationData = {
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
  overrides: {
    1: [
      {
        value: 'test',
        name: 'message',
        optional: true,
      },
    ],
  },
  fields: [
    {
      value: '',
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
      value: '',
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

const defaultDataWithManga: NotificationData = {
  ...defaultNotificationDataNoManga,
  manga: [{
    title: 'Test manga',
    mangaId: 1,
    serviceId: 1,
    serviceName: 'Test service',
  }],
  useFollows: false,
};

describe('DiscordWebhookEditor', () => {
  const Rendered = ({ notificationData, defaultExpanded = true }: { notificationData: NotificationData, defaultExpanded?: boolean}) => (
    <Root>
      <DiscordWebhookEditor
        notificationData={notificationData}
        defaultExpanded={defaultExpanded}
      />
    </Root>
  );

  const sortFields = (a: NotificationFieldData, b: NotificationFieldData) => ((a.name < b.name) ? 1 : -1);


  const notificationFollowsMock = (follows: NotificationFollow[] = []) => {
    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve(follows));
    fetchMock.get(
      `glob:/api/notifications/notificationFollows`,
      mockRoute
    );

    return mockRoute;
  };

  const changeOverride = async (overrideName: string, user: ReturnType<typeof userEvent.setup>, useAct = false) => {
    const overrideInput = screen.getByRole('combobox', { name: /^Manga override/i });

    if (useAct) {
      await act(async () => {
        await user.type(overrideInput, overrideName, { skipAutoClose: true });
      });
    } else {
      await user.type(overrideInput, overrideName, { skipAutoClose: true });
    }

    const listbox = screen.getByRole('listbox', { name: /^Manga override/i });
    const listItem = within(listbox).getByRole('option', { name: new RegExp(overrideName, 'i') });

    if (useAct) {
      await act(async () => {
        fireEvent.click(listItem);
      });
    } else {
      await user.click(listItem);
    }
  };

  it('Renders correctly', async () => {
    const mock = notificationFollowsMock();
    await act(async () => {
      render(<Rendered notificationData={defaultNotificationDataNoManga} />);
    });

    expect(mock).toHaveBeenCalledOnce();

    expect(screen.getByRole('heading', { name: /^discord webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Manga updates to notify on/i })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /^Manga override/i })).toBeInTheDocument();
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
    const mock = notificationFollowsMock();
    await act(async () => {
      render(<Rendered notificationData={defaultNotificationDataNoManga} defaultExpanded={false} />);
    });

    expect(mock).toHaveBeenCalledOnce();

    expect(screen.getByRole('heading', { name: /^discord webhook/i })).toBeInTheDocument();

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeInTheDocument();

    expect(screen.queryByRole('textbox', { name: /^Webhook url/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Manga updates to notify on/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /^Manga override/i })).not.toBeInTheDocument();
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
    notificationFollowsMock();
    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({
      data: defaultNotificationDataNoManga,
    }));
    fetchMock.post(
      `glob:/api/notifications`,
      mockRoute
    );

    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockRoute).toHaveBeenCalledOnce();

    const response = JSON.parse(fetchMock.lastCall('/api/notifications')![1]!.body as any) as NotificationData;
    response.fields.sort(sortFields);

    const data: Partial<NotificationData> = { ...defaultNotificationDataNoManga };
    delete data.timesFailed;
    delete data.timesRun;
    delete data.manga;
    delete data.overrides;

    expect(response).toEqual(
      expect.objectContaining(
        {
          ...data,
          fields: data.fields!
            .filter(f => f.value?.length > 0)
            .sort(sortFields)
            .map(f => ({ name: f.name, value: f.value })),
        }
      )
    );

    expectSuccessSnackbar();
  });

  it('Shows error on failed submit', async () => {
    notificationFollowsMock();
    fetchMock.post(
      `glob:/api/notifications`,
      400
    );

    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expectErrorSnackbar('Failed to create/update notification');
  });

  it('Shows error on failed override submit', async () => {
    notificationFollowsMock([
      {
        mangaId: 1,
        title: 'test',
        serviceName: '',
        serviceId: null,
      },
    ]);
    fetchMock.post(
      `glob:/api/notifications/override`,
      400
    );

    await act(async () => {
      render(<Rendered notificationData={defaultNotificationDataNoManga} />);
    });

    const user = userEvent.setup();
    await changeOverride('test', user);

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expectErrorSnackbar('Failed to create/update notification override');
  }, 10*1000);

  it('should reload form when changing override', async () => {
    const mock = notificationFollowsMock([{
      mangaId: 1,
      title: 'Test manga',
      serviceId: null,
      serviceName: 'All services',
    }]);
    await act(async () => {
      render(<Rendered notificationData={defaultNotificationDataNoManga} />);
    });
    const overrideId = 1;

    expect(mock).toHaveBeenCalledOnce();

    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({
      data: defaultNotificationDataNoManga,
    }));
    fetchMock.post(
      `glob:/api/notifications/override`,
      mockRoute
    );

    const user = userEvent.setup();
    await changeOverride('test manga', user);

    const override = defaultNotificationDataNoManga.overrides[overrideId];
    expect(override).toHaveLength(1);
    expect(override[0].name).toBe('message');

    expect(screen.getByRole('textbox', { name: /^Webhook username/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed title/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Message$/i })).toHaveValue(override[0].value);
    expect(screen.getByRole('textbox', { name: /^Embed url/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Webhook user avatar url/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed content/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Footer content/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed thumbnail/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed color/i })).toHaveValue('');

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^Manga updates to notify on/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^use follows/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Save/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^Disabled$/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^Group by manga/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /^Save/i }));

    expect(mockRoute).toHaveBeenCalledOnce();

    const response = JSON.parse(fetchMock.lastCall('/api/notifications/override')![1]!.body as any) as UpsertNotificationOverride;
    response.fields.sort(sortFields);

    const fields = override.map(f => ({
      name: f.name,
      value: f.value,
    }));

    fields.sort(sortFields);

    expect(response).toEqual({
      notificationId: 1,
      notificationType: 1,
      overrideId: overrideId,
      fields: fields,
    });
  }, 30*1000);

  it('Warns of unsaved changes when changing to an override', async () => {
    notificationFollowsMock();
    await act(async () => {
      render(<Rendered notificationData={defaultDataWithManga} />);
    });

    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({
      data: defaultNotificationDataNoManga,
    }));
    fetchMock.post(
      `glob:/api/notifications/override`,
      mockRoute
    );

    const user = userEvent.setup();

    const text = 'changes';
    await user.type(screen.getByRole('textbox', { name: /^Message$/i }), text);

    // This shit prints out act errors to no end even if I wrap everything inside act.
    // Tests seem to pass tho, so it's fine for now.
    await changeOverride(defaultDataWithManga.manga![0].title, user, true);

    expect(await screen.findByText(/You have unsaved changes\. Do you want to discard changes\?/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Do not discard form changes/i }));
    });

    const msgField = defaultDataWithManga.fields.filter(f => f.name === 'message')[0]!;
    expect(await screen.findByRole('textbox', { name: /^Message$/i }, { timeout: 5000 })).toHaveValue(msgField.value + text);

    await changeOverride(defaultDataWithManga.manga![0].title, user, true);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Discard form changes/i }));
    });

    const override = defaultDataWithManga.overrides[1];

    expect(await screen.findByRole('textbox', { name: /^Webhook username/i }, { timeout: 5000 })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed title/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Message$/i })).toHaveValue(override[0].value);
    expect(screen.getByRole('textbox', { name: /^Embed url/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Webhook user avatar url/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed content/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Footer content/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed thumbnail/i })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: /^Embed color/i })).toHaveValue('');

    expect(screen.getByRole('textbox', { name: /^name$/i })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: /^Webhook url/i })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: /^Manga updates to notify on/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^use follows/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Save/i })).not.toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^Disabled$/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^Group by manga/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^delete notification/i })).toBeDisabled();

    expect(mockRoute).not.toHaveBeenCalled();
  }, 30*1000);
});
