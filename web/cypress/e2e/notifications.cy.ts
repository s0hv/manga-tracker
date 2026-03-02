import { normalUser } from '../../__tests__/constants';
import { Selector } from '../selectors';

type NotificationFields = {
  webhookUsername: string
  embedTitle: string
  message: string
  embedUrl: string
  webhookUserAvatarUrl: string
  embedContent: string
  footerContent: string
  embedThumbnail: string
  embedColor: string
};

const defaultNotificationValues: NotificationFields = {
  webhookUsername: '$MANGA_TITLES',
  embedTitle: '$MANGA_TITLE - Chapter $CHAPTER_NUMBER',
  message: '',
  embedUrl: '$URL',
  webhookUserAvatarUrl: '',
  embedContent: '$TITLE\n'
    + '$URL\n'
    + 'by $GROUP',
  footerContent: '$GROUP',
  embedThumbnail: '$MANGA_COVER',
  embedColor: '',
};

const emptyNotificationValues: NotificationFields = {
  webhookUsername: '',
  embedTitle: '',
  message: '',
  embedUrl: '',
  webhookUserAvatarUrl: '',
  embedContent: '',
  footerContent: '',
  embedThumbnail: '',
  embedColor: '',
};

const validateNotificationFields = (fields: NotificationFields) => {
  cy.findByRole('textbox', { name: /^webhook username$/i }).should('have.value', fields.webhookUsername);
  cy.findByRole('textbox', { name: /^embed title$/i }).should('have.value', fields.embedTitle);
  cy.findByRole('textbox', { name: /^message$/i }).should('have.value', fields.message);
  cy.findByRole('textbox', { name: /^embed url$/i }).should('have.value', fields.embedUrl);
  cy.findByRole('textbox', { name: /^webhook user avatar url$/i }).should('have.value', fields.webhookUserAvatarUrl);
  cy.findByRole('textbox', { name: /^embed content$/i }).should('have.value', fields.embedContent);
  cy.findByRole('textbox', { name: /^footer content$/i }).should('have.value', fields.footerContent);
  cy.findByRole('textbox', { name: /^embed thumbnail$/i }).should('have.value', fields.embedThumbnail);
  cy.findByRole('textbox', { name: /^embed color$/i }).should('have.value', fields.embedColor);
};

describe('Notifications page works correctly', () => {
  it('should allow creation of notifications and setting overrides', () => {
    cy.login(normalUser);

    Selector.getUserMenuBtn().click();
    Selector.getNotificationsLink().click();

    Selector.getNotificationTypeSelect().click();
    Selector.getDiscordWebhookOption().click();
    Selector.getCreateNotificationBtn().click();

    cy.findByRole('textbox', { name: /^name$/i }).type('Test notification');
    cy.findByRole('textbox', { name: /^webhook url$/i }).type('https://test.com/123');
    cy.findByRole('checkbox', { name: /^use follows$/i }).click();

    validateNotificationFields(defaultNotificationValues);

    // Persist the notification
    Selector.getSaveBtn().click();
    Selector.assertAlertExists(/^notification saved$/i);

    // Select override
    Selector.getMangaOverrideSelect().click();
    cy.findByRole('option', { name: /^jojo part 2$/i }).click();
    Selector.getDeleteNotificationBtn().should('be.disabled');

    // Validate empty fields for the override
    validateNotificationFields(emptyNotificationValues);

    const overrideName = 'Test override name';
    cy.findByRole('textbox', { name: /^webhook username$/i }).type(overrideName);
    Selector.getSaveBtn().click();
    Selector.assertAlertExists(/^notification override saved$/i);

    validateNotificationFields({
      ...emptyNotificationValues,
      webhookUsername: overrideName,
    });

    // Back to the base notification
    Selector.getMangaOverrideSelect().focus();
    cy.findByRole('button', { name: /^clear$/i }).click();

    // Check that the override info is still there
    Selector.getMangaOverrideSelect().click();
    cy.findByRole('option', { name: /^jojo part 2$/i }).click();

    validateNotificationFields({
      ...emptyNotificationValues,
      webhookUsername: overrideName,
    });

    // Back to the base notification
    Selector.getMangaOverrideSelect().focus();
    cy.findByRole('button', { name: /^clear$/i }).click();

    // Validate original fields
    validateNotificationFields(defaultNotificationValues);

    // Delete the notification
    Selector.getDeleteNotificationBtn().click();
    cy.findByText('Are you sure you want to delete this notification?').should('exist');
    Selector.getYesBtn().click();
    Selector.assertAlertExists(/^notification deleted$/i);

    cy.findByRole('textbox', { name: /^name$/i }).should('not.exist');

    // Reload the page to make sure the changes are persisted
    cy.reload();
    cy.findByRole('heading', { name: /^discord webhook$/i }).should('not.exist');
  });
});
