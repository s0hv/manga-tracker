import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import fetchMock from 'fetch-mock';
import { ConfirmProvider } from 'material-ui-confirm';

import { Form, Field } from 'react-final-form';
import {
  queryClient,
  mockNotistackHooks,
  expectSuccessSnackbar,
  expectErrorSnackbar,
} from '../../utils';
import DeleteNotificationButton
  from '../../../src/components/notifications/DeleteNotificationButton';

const Root = ({ notificationId, children }) => (
  <QueryClientProvider client={queryClient}>
    <ConfirmProvider>
      <Form
        onSubmit={jest.fn()}
        render={() => (
          <form>
            <Field name='notificationId' initialValue={notificationId} render={() => 'test'} />
            {children}
          </form>
        )}
      />
    </ConfirmProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  mockNotistackHooks();
  fetchMock.reset();
  queryClient.clear();
});

describe('DeleteNotificationButton', () => {
  const notificationId = 1;

  const Rendered = ({ notificationId: notifId = notificationId }) => (
    <Root notificationId={notifId}>
      <DeleteNotificationButton
        fieldName='notificationId'
      />
    </Root>
  );

  const getDeleteButton = () => screen.getByRole('button', { name: /delete notification/i });


  it('Renders correctly', async () => {
    render(<Rendered />);

    expect(getDeleteButton()).toBeInTheDocument();
  });

  it('Calls correct API path when delete clicked', async () => {
    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({}));
    fetchMock.delete(
      `glob:/api/notifications/${notificationId}`,
      mockRoute
    );

    render(<Rendered />);

    const user = userEvent.setup();

    const btn = getDeleteButton();
    await user.click(btn);

    expect(screen.getByText(/Are you sure you want to delete this notification/i)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /yes/i }));
    });

    expect(mockRoute).toHaveBeenCalledOnce();
    expectSuccessSnackbar();
  });

  it('Shows error when delete failed', async () => {
    fetchMock.delete(
      `glob:/api/notifications/${notificationId}`,
      500
    );

    render(<Rendered />);

    const user = userEvent.setup();

    const btn = getDeleteButton();
    await user.click(btn);

    expect(screen.getByText(/Are you sure you want to delete this notification/i)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /yes/i }));
    });

    expectErrorSnackbar();
  });

  it('Does nothing when no clicker', async () => {
    const mockRoute = jest.fn();
    mockRoute.mockImplementation(() => Promise.resolve({}));
    fetchMock.delete(
      `glob:/api/notifications/${notificationId}`,
      mockRoute
    );

    render(<Rendered />);

    const user = userEvent.setup();

    const btn = getDeleteButton();
    await user.click(btn);

    expect(screen.getByText(/Are you sure you want to delete this notification/i)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole('button', { name: /no/i }));
    });

    expect(mockRoute).not.toHaveBeenCalled();
  });
});
