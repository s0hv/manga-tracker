import React from 'react';
import { render, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import { beforeEach, describe, expect, it, vi } from 'vitest';


import {
  expectErrorSnackbar,
  getSnackbarMessage,
  mockNotistackHooks,
} from '../utils';

import SignIn from '../../src/views/SignIn';

beforeEach(() => mockNotistackHooks());

describe.skip('Sign in page functionality', () => {
  const replaceMock = vi.fn();

  delete (window as any).location;
  (window as any).location = { replace: replaceMock };

  beforeEach(() => {
    fetchMock.reset();
    replaceMock.mockReset();
  });

  const prepareSignIn = async (user: UserEvent) => {
    render(<SignIn />);

    const email = 'test@test.com';
    const emailInput = screen.getByLabelText(/email address/i);
    await user.type(emailInput, email);

    const password = 'test_password12345';
    const passwordInput = screen.getByLabelText(/password/i);
    await user.type(passwordInput, password);

    return { email, password };
  };

  it('Should call login api on login', async () => {
    fetchMock.post('/api/login', 200);
    const user = userEvent.setup();
    await prepareSignIn(user);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(fetchMock.calls('/api/login')).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it('Should show snackbar on error', async () => {
    fetchMock.post('/api/login', { status: 400 });
    const user = userEvent.setup();
    await prepareSignIn(user);

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expectErrorSnackbar();
    expect(getSnackbarMessage()).toMatchInlineSnapshot(`"Server returned status 400 Bad Request"`);
    expect(fetchMock.calls('/api/login')).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(0);
  });

  it('Should include correct body in request without remember me', async () => {
    const user = userEvent.setup();
    const { email, password } = await prepareSignIn(user);
    const opts = { body: { email, password }};
    fetchMock.post(
      '/api/login',
      200,
      opts
    );

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(fetchMock.calls('/api/login', opts)).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it('Should include correct body in request with remember me', async () => {
    const user = userEvent.setup();
    const { email, password } = await prepareSignIn(user);
    const opts = { body: { email, password, rememberme: true }};
    fetchMock.post(
      '/api/login',
      200,
      opts
    );

    await user.click(screen.getByLabelText(/remember me/i));
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(fetchMock.calls('/api/login', opts)).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
