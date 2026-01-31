/**
 * CalDAV Service - barrel exports
 */

export {
  // Lifecycle
  startCaldavSync,
  stopCaldavSync,
  getCaldavStatus,
  // Account CRUD
  listAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  enableAccount,
  disableAccount,
  testAccountConnection,
  syncAccount,
  completeAccountGoogleOAuth,
  // Backward-compatible configuration
  testCaldavConnection,
  configureCaldav,
  configureGoogleOAuth,
  completeGoogleOAuth,
  enableCaldav,
  disableCaldav,
  // Calendars
  listCalendars,
  syncCalendars,
  // Events
  listEvents,
  getEvent,
  createEvent,
  updateEvent,
  deleteEvent,
  // Copy rules
  listCopyRules,
  getCopyRule,
  createCopyRule,
  updateCopyRule,
  deleteCopyRule,
  executeCopyRule,
} from './caldav-service'

export { accountManager } from './caldav-account-manager'
export type { AccountStatus } from './caldav-account-manager'
