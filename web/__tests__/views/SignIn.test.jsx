import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import {
  mockNotistackHooks,
  expectErrorSnackbar,
  getSnackbarMessage,
} from '../utils';
import SignIn from '../../src/views/SignIn';

beforeEach(() => mockNotistackHooks());

describe('Sign in page functionality', () => {
  const replaceMock = jest.fn();

  delete window.location;
  window.location = { replace: replaceMock };

  beforeEach(() => {
    fetchMock.reset();
    replaceMock.mockReset();
  });

  const editInput = (target, value) => {
    fireEvent.change(target, { target: { value }});
  };

  const prepareSignIn = () => {
    render(<SignIn />);

    const email = 'test@test.com';
    const emailInput = screen.getByLabelText(/email address/i);
    editInput(emailInput, email);

    const password = 'test_password12345';
    const passwordInput = screen.getByLabelText(/password/i);
    editInput(passwordInput, password);

    return { email, password };
  };

  it('Should call login api on login', async () => {
    fetchMock.post('/api/login', 200);
    prepareSignIn();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    expect(fetchMock.calls('/api/login')).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it('Should show snackbar on error', async () => {
    fetchMock.post('/api/login', { status: 400 });
    prepareSignIn();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    expectErrorSnackbar();
    expect(getSnackbarMessage()).toMatchInlineSnapshot(`"Server returned status 400 Bad Request"`);
    expect(fetchMock.calls('/api/login')).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(0);
  });

  it('Should include correct body in request without remember me', async () => {
    const { email, password } = prepareSignIn();
    const opts = { body: { email, password }};
    fetchMock.post(
      '/api/login',
      200,
      opts
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    expect(fetchMock.calls('/api/login', opts)).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });

  it('Should include correct body in request with remember me', async () => {
    const { email, password } = prepareSignIn();
    const opts = { body: { email, password, rememberme: true }};
    fetchMock.post(
      '/api/login',
      200,
      opts
    );

    fireEvent.click(screen.getByLabelText(/remember me/i));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /sign in/i }));
    });

    expect(fetchMock.calls('/api/login', opts)).toHaveLength(1);
    expect(replaceMock).toHaveBeenCalledTimes(1);
  });
});
