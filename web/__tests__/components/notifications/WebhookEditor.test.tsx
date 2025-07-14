import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  expectErrorSnackbar,
  expectSuccessSnackbar,
  mockNotistackHooks,
  queryClient,
} from '../../utils';
import { defaultDataForType } from '@/components/notifications/defaultDatas';
import WebhookEditor from '@/components/notifications/WebhookEditor';
import type {
  NotificationData,
  NotificationField,
} from '@/types/api/notifications';
import { NotificationTypes } from '@/webUtils/constants';

vi.mock('@uiw/react-codemirror');

const Root = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

beforeEach(async () => {
  await mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

const defaultWebhookData = defaultDataForType[NotificationTypes.Webhook];
const defaultNotificationDataNoManga: NotificationData = {
  ...defaultWebhookData,
  notificationId: 1,
  destination: 'destination',
  useFollows: true,
  timesRun: null,
  timesFailed: null,
  disabled: false,
  groupByManga: false,
  name: '',
  manga: null,
  overrides: {},
};

describe('WebhookEditor', () => {
  const Rendered = ({ notificationData, defaultExpanded = true }: { notificationData: NotificationData, defaultExpanded?: boolean }) => (
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

    expect(screen.queryByRole('textbox', { name: /^webhook json format$/i })).not.toBeInTheDocument();
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
    const mockRoute = vi.fn();
    mockRoute.mockImplementation(() => Promise.resolve({
      data: { notificationId: defaultNotificationDataNoManga.notificationId },
    }));
    fetchMock.post(
      `glob:/api/notifications`,
      mockRoute
    );

    render(<Rendered notificationData={defaultNotificationDataNoManga} />);

    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(mockRoute).toHaveBeenCalledOnce();

    const sort = (a: NotificationData, b: NotificationData) => ((a.name < b.name) ? 1 : -1);
    const response = JSON.parse(fetchMock.lastCall('/api/notifications')?.[1]?.body as string);
    response.fields.sort(sort);

    const data: Partial<NotificationData> = { ...defaultNotificationDataNoManga };
    delete data.timesFailed;
    delete data.timesRun;
    delete data.manga;
    delete data.overrides;
    data.fields = data.fields!.map(f => ({
      name: f.name,
      value: f.value,
    } as NotificationField));

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

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expectErrorSnackbar();
  });
});
