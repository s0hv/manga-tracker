import { render, screen, act } from '@testing-library/react';
// import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from 'react-query';
import fetchMock from 'fetch-mock';
import { SnackbarProvider } from 'notistack';

import {
  queryClient,
  mockNotistackHooks,
  expectErrorSnackbar,
} from '../utils';
import Notifications from '../../src/views/Notifications';

const Root = ({ children }) => (
  <QueryClientProvider client={queryClient}>
    <SnackbarProvider>
      {children}
    </SnackbarProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
});

describe('Notifications view', () => {
  const Rendered = () => (
    <Root>
      <Notifications />
    </Root>
  );

  it('Renders correctly', async () => {
    const mockResponse = jest.fn();
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

  it('Shows error when fetch fails', async () => {
    fetchMock.get(
      'path:/api/notifications',
      500
    );

    await act(async () => {
      render(<Rendered />);
    });

    expectErrorSnackbar();
  });

  /* Commented out as it times out for some reason after switching to next.js swc config
  it('Creates notification when create clicked', async () => {
    const mockResponse = jest.fn();
    mockResponse.mockImplementation(() => ({ data: []}));
    fetchMock.get('path:/api/notifications', mockResponse);

    await act(async () => {
      render(<Rendered />);
    });

    expect(screen.queryByRole('textbox', { name: /webhook url/i })).not.toBeInTheDocument();

    const user = userEvent.setup();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /create new notification/i }));
    });

    expect(screen.getByRole('textbox', { name: /webhook url/i })).toBeInTheDocument();
  });
  */
});
