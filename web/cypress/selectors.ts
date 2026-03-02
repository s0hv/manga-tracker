export const Selector = {
  // region Top bar

  getLogoLink() {
    return cy.findByRole('heading', { name: 'Manga tracker' }).closest('a');
  },

  getUserMenuBtn() {
    return cy.findByRole('button', { name: 'account of current user' });
  },

  getProfileLink() {
    return cy.findByRole('menuitem', { name: 'Profile' });
  },

  getFollowsLink() {
    return cy.findByRole('menuitem', { name: 'Follows' });
  },

  getNotificationsLink() {
    return cy.findByRole('menuitem', { name: 'Notifications' });
  },

  getServicesLink() {
    return cy.findByRole('menuitem', { name: 'Services' });
  },

  getLogoutLink() {
    return cy.findByRole('menuitem', { name: 'Logout' });
  },

  // endregion Top bar

  getFollowsText(loggedIn: boolean) {
    const text = loggedIn
      ? /^Recent releases (for your follows)$/i
      : /^Recent releases$/i;

    return cy.findByRole('heading', { name: text });
  },

  getRecentReleaseHeader(name: string) {
    return cy.findByRole('heading', { name });
  },

  getMangaSearchInput() {
    return cy.findByRole('combobox', { name: 'manga search' });
  },

  getMangaCoverImage(mangaTitle: string) {
    return cy.findByRole('img', { name: mangaTitle });
  },

  getStatsTab() {
    return cy.findByRole('tab', { name: /^stats$/i });
  },

  getChaptersTab() {
    return cy.findByRole('tab', { name: /^chapters$/i });
  },

  getFilterServicesElement(variant: 'combobox' | 'listbox' = 'combobox') {
    return cy.findByRole(variant, { name: 'Filter services' });
  },

  getNotificationTypeSelect() {
    return cy.findByRole('combobox', { name: /^notification type to create$/i });
  },

  getDiscordWebhookOption() {
    return cy.findByRole('option', { name: /^discord webhook$/i });
  },

  getCreateNotificationBtn() {
    return cy.findByRole('button', { name: /^create new notification$/i });
  },
  getMangaOverrideSelect() {
    return cy.findByRole('combobox', { name: /^manga override$/i });
  },

  getDeleteNotificationBtn() {
    return cy.findByRole('button', { name: /^delete notification$/i });
  },

  getSaveBtn() {
    return cy.findByRole('button', { name: /^save$/i });
  },

  getYesBtn() {
    return cy.findByRole('button', { name: /^yes$/i });
  },

  getEditChaptersBtn() {
    return cy.findByRole('button', { name: /^edit chapters$/i });
  },

  assertAlertExists(text: string | RegExp) {
    cy.get('[role="alert"]').contains(text).should('exist');
  },
};
