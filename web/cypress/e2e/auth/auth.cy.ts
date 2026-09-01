import { normalUser } from '../../../__tests__/constants';
import { Selector } from '../../selectors';

beforeEach(() => {
  cy.task('flushRedis');
});

afterEach(() => {
  cy.task('flushRedis');
});

describe('Test authentication', () => {
  it('Logs in with correct email + password', () => {
    cy.visit('/');
    Selector.getRecentReleasesHeading().should('exist');

    cy.findByRole('link', { name: /login/i }).click();

    cy.wait(300);

    cy.findByRole('textbox', { name: /email address/i }).focus().type(normalUser.email);
    cy.findByLabelText(/password/i).type(normalUser.password);
    cy.findByRole('button', { name: /^sign in$/i }).click();
    Selector.getUserMenuBtn().should('exist');
  });

  it('Ratelimits after 3 failed login attempts', () => {
    const login = () => {
      cy.visit('/login');
      cy.wait(300);
      cy.findByRole('textbox', { name: /email address/i }).focus().clear().type(normalUser.email);
      cy.findByLabelText(/password/i).type('aaaaaaaaa');
      cy.findByRole('button', { name: /^sign in$/i }).click();
    };

    for (let i = 0; i < 2; i++) {
      login();
      if (i === 0) {
        cy.findByRole('alert').within(() => {
          cy.findByText(/Invalid login/i).should('exist');
        });
      }
    }

    // This should not reset the rate limiting
    cy.login(normalUser);
    cy.logout();

    login();

    cy.url().should('include', '/login');

    // 4th time should rate limit
    login();

    cy.findByRole('alert').within(() => {
      cy.findByText(/Ratelimited/i).should('exist');
    });
  });
});

