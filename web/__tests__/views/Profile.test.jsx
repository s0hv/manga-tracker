import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import fetchMock from 'fetch-mock';

import {
  mockNotistackHooks,
  expectErrorSnackbar,
  expectSuccessSnackbar,
  normalUser,
  getSnackbarMessage,
} from '../utils';
import Profile from '../../src/views/Profile';

beforeEach(() => mockNotistackHooks());

describe('Profile renders correctly', () => {
  it('Should render correctly without user', () => {
    expect(() => render(<Profile />)).not.toThrow();
  });

  it('Should render correctly with user', () => {
    render(<Profile user={normalUser} />);

    // Username found
    const username = screen.getByLabelText(/Username/i);
    expect(username.value).toStrictEqual(normalUser.username);

    // Email found
    const email = screen.getByLabelText(/^Email Address$/i);
    expect(email.value).toStrictEqual(normalUser.email);

    // Password fields empty
    expect(screen.getByLabelText(/^Password$/i).value).toBeEmpty();
    expect(screen.getByLabelText(/^New password$/i).value).toBeEmpty();
    expect(screen.getByLabelText(/^New password again$/i).value).toBeEmpty();

    // Find submit button
    expect(
      screen.getByRole('button', { type: 'submit', name: /Update profile/i })
    ).toBeDefined();
  });
});

describe('Requests should be handled correctly', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  const editInput = (target, value) => {
    fireEvent.change(target, { target: { value }});
  };

  it('Should do a post request on submit', async () => {
    fetchMock.post('/api/profile', 200);
    render(<Profile user={normalUser} />);

    editInput(screen.getByLabelText(/^Password$/i), normalUser.password);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Update profile/i }));
    });

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectSuccessSnackbar();
  });

  it('Should not post when password not given', async () => {
    fetchMock.post('/api/profile', 200);
    render(<Profile user={normalUser} />);

    expect(screen.getByLabelText(/^Password$/i).value).toBeEmpty();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Update profile/i }));
    });

    expect(fetchMock.calls('/api/profile')).toHaveLength(0);
  });

  it('Should show error snackbar on http error', async () => {
    const errorMessage = 'Invalid password provided';
    fetchMock.post('/api/profile', { status: 401, body: { error: errorMessage }});
    render(<Profile user={normalUser} />);

    editInput(screen.getByLabelText(/^Password$/i), 'aaaaa');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Update profile/i }));
    });

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectErrorSnackbar(errorMessage);
  });

  it('Should show error snackbar on fetch error', async () => {
    const errorMessage = 'Unknown fetch error';
    fetchMock.post('/api/profile', { throws: new Error(errorMessage) });
    render(<Profile user={normalUser} />);

    editInput(screen.getByLabelText(/^Password$/i), 'aaaaa');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Update profile/i }));
    });

    expect(fetchMock.calls('/api/profile')).toHaveLength(1);
    expectErrorSnackbar();
    expect(getSnackbarMessage()).toMatchInlineSnapshot(`"Unexpected error occurred"`);
  });
});
