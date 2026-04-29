import { filesTools } from './files.js';
import { calendarTools } from './calendar.js';
import { contactsTools } from './contacts.js';
import { usersTools } from './users.js';
import { appsTools } from './apps.js';

export { filesTools, calendarTools, contactsTools, usersTools, appsTools };

export const allTools = [
  ...filesTools,
  ...calendarTools,
  ...contactsTools,
  ...usersTools,
  ...appsTools,
];
