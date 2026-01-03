import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  convertToOauthUser,
  expectErrorSnackbar,
  expectSuccessSnackbar,
  getSnackbarMessage,
  mockNotistackHooks,
  normalUser,
  restoreMocks,
  silenceConsole,
} from '../utils';
import Profile from '@/views/Profile';

beforeEach(() => mockNotistackHooks());

describe('Profile renders correctly', () => {
  it('Should render correctly without user', () => {
    expect(() => render(<Profile user={null} />)).not.toThrow();
  });

  it('Should render correctly with credentials user', () => {
    render(<Profile user={normalUser} />);

    // Username found
    const username = screen.getByLabelText(/Username/i);
    expect(username).toHaveValue(normalUser.username);

    // Email found
    const email = screen.getByLabelText(/^Email Address$/i);
    expect(email).toHaveValue(normalUser.email);
    expect(email).toBeDisabled();

    // Password fields empty
    expect(screen.getByLabelText<HTMLInputElement>(/^Password$/i).value).toBeEmpty();
    expect(screen.getByLabelText<HTMLInputElement>(/^New password$/i).value).toBeEmpty();
    expect(screen.getByLabelText<HTMLInputElement>(/^New password again$/i).value).toBeEmpty();

    // Find submit button
    expect(
      screen.getByRole('button', { name: /Update profile/i })
    ).toBeDefined();
  });

  it('Should render correctly with oauth user', () => {
    render(<Profile user={convertToOauthUser(normalUser)} />);

    // Username found
    const username = screen.getByLabelText(/Username/i);
    expect(username).toHaveValue(normalUser.username);

    // Email found
    const email = screen.getByLabelText(/^Email Address$/i);
    expect(email).toHaveValue(normalUser.email);
    expect(email).toBeDisabled();

    // Password fields empty
    expect(screen.queryByLabelText(/^Password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^New password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^New password again$/i)).not.toBeInTheDocument();

    // Find submit button
    expect(
      screen.getByRole('button', { name: /Update profile/i })
    ).toBeDefined();
  });
});

describe('Requests should be handled correctly', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  const editInput = async (user: UserEvent, target: HTMLElement, value: any) => {
    await user.type(target, value);
  };

  it('Should do a post request on submit', async () => {
    fetchMock.post('/api/profile', 200);
    render(<Profile user={normalUser} />);
    const user = userEvent.setup();

    await editInput(user, screen.getByLabelText(/^Password$/i), normalUser.password);
    await user.click(screen.getByRole('button', { name: /Update profile/i }));

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectSuccessSnackbar();
  });

  it('Should not post when password not given', async () => {
    fetchMock.post('/api/profile', 200);
    render(<Profile user={normalUser} />);

    expect(screen.getByLabelText<HTMLInputElement>(/^Password$/i).value).toBeEmpty();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/^New password$/i), 'aaa');
    await user.click(screen.getByRole('button', { name: /Update profile/i }));

    expect(fetchMock.calls('/api/profile')).toHaveLength(0);
  });

  it('Should show error snackbar on http error', async () => {
    const errorMessage = 'Invalid password provided';
    fetchMock.post('/api/profile', { status: 401, body: { error: errorMessage }});
    render(<Profile user={normalUser} />);
    const user = userEvent.setup();

    await editInput(user, screen.getByLabelText(/^Password$/i), 'aaaaa');
    await user.click(screen.getByRole('button', { name: /Update profile/i }));

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectErrorSnackbar(errorMessage);
  });

  it('Should show error snackbar on fetch error', async () => {
    const errorMessage = 'Unknown fetch error';
    fetchMock.post('/api/profile', { throws: new Error(errorMessage) });
    render(<Profile user={normalUser} />);
    const user = userEvent.setup();

    await editInput(user, screen.getByLabelText(/^Password$/i), 'aaaaa');

    const spies = silenceConsole();
    await user.click(screen.getByRole('button', { name: /Update profile/i }));
    restoreMocks(spies);

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectErrorSnackbar();
    expect(getSnackbarMessage()).toMatchInlineSnapshot(`"Unexpected error occurred"`);
  });
});
