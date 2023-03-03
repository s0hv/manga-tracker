import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { SnackbarProvider } from 'notistack';
import { vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import userEvent from '@testing-library/user-event';

import {
  expectErrorSnackbar,
  mockNotistackHooks,
  muiSelectValue,
  queryClient,
  restoreMocks,
  silenceConsole,
} from '../utils';
import Notifications from '../../src/views/Notifications';

const Root = ({ children }: PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <SnackbarProvider>
      {children}
    </SnackbarProvider>
  </QueryClientProvider>
);

beforeEach(async () => {
  await mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

describe('Notifications view', () => {
  const Rendered = () => (
    <Root>
      <Notifications />
    </Root>
  );

  it('Renders correctly', async () => {
    const mockResponse = vi.fn();
    mockResponse.mockImplementation(() => ({ data: []}));
    fetchMock.get('path:/api/notifications', mockResponse);

    await act(async () => {
      render(<Rendered />);
    });

    expect(mockResponse).toHaveBeenCalledOnce();

    expect(screen.getByRole('button', { name: /Notification type to create/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new notification/i }))
      .toBeInTheDocument();
  });

  // Does not understand await waitFor(expectErrorSnackbar);
  // eslint-disable-next-line jest/expect-expect
  it('Shows error when fetch fails', async () => {
    fetchMock.get(
      'path:/api/notifications',
      500
    );

    const spies = silenceConsole();
    await act(async () => {
      render(<Rendered />);
    });

    // For some reason this gets called after exiting act
    await waitFor(expectErrorSnackbar);
    restoreMocks(spies);
  });

  it('Creates notification when create clicked', async () => {
    const mockResponse = vi.fn();
    mockResponse.mockImplementation(() => ({ data: []}));
    fetchMock.get('path:/api/notifications', mockResponse);

    await act(async () => {
      render(<Rendered />);
    });

    expect(screen.queryByRole('textbox', { name: /webhook url/i })).not.toBeInTheDocument();

    const user = userEvent.setup();
    await muiSelectValue(user, screen, /notification type to create/i, /discord webhook/i);
    await user.click(screen.getByRole('button', { name: /create new notification/i }));

    // This takes long due to dynamic imports
    expect(await screen.findByRole('textbox', { name: /webhook url/i }, { timeout: 13000 })).toBeInTheDocument();
  }, 18000);
});
