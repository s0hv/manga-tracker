import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { SnackbarProvider } from 'notistack';
import { describe, expect, vi, it, beforeEach } from 'vitest';
import type { PropsWithChildren } from 'react';
import userEvent from '@testing-library/user-event';

import { mockNotistackHooks, muiSelectValue, queryClient } from '../utils';
import Notifications from '@/views/Notifications';

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

    expect(screen.getByRole('combobox', { name: /Notification type to create/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create new notification/i }))
      .toBeInTheDocument();
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
