export const IPC_CHANNELS = {
  // Displays
  DISPLAYS_GET: 'displays:get',
  DISPLAYS_ASSIGN_ROLE: 'displays:assign-role',
  DISPLAYS_GET_ASSIGNMENTS: 'displays:get-assignments',
  DISPLAYS_IDENTIFY: 'displays:identify',
  DISPLAYS_CHANGED: 'displays:changed',

  // Presentation State
  STATE_GET: 'state:get',
  STATE_SET_CONTROL: 'state:set-control',
  STATE_TOGGLE_CONTROL: 'state:toggle-control',
  STATE_SEND_SLIDE: 'state:send-slide',
  STATE_SET_MESSAGE: 'state:set-message',
  STATE_SET_STRESS_TEST: 'state:set-stress-test',
  STATE_UPDATED: 'state:updated',

  // Shortcuts & Settings
  SHORTCUTS_GET: 'shortcuts:get',
  SHORTCUTS_SAVE: 'shortcuts:save',
  BACKUPS_OPEN_FOLDER: 'backups:open-folder',
  NOTIFICATION_EMIT: 'notification:emit',

  // Phase 3: Songs
  SONGS_GET: 'songs:get',
  SONGS_GET_BY_ID: 'songs:get-by-id',
  SONGS_SAVE: 'songs:save',
  SONGS_DELETE: 'songs:delete',

  // Phase 3: Generic Presentations
  PRESENTATIONS_GET: 'presentations:get',
  PRESENTATIONS_SAVE: 'presentations:save',
  PRESENTATIONS_DELETE: 'presentations:delete',

  // Phase 3: Themes
  THEMES_GET: 'themes:get',
  THEMES_SAVE: 'themes:save',
  THEMES_SET_DEFAULT: 'themes:set-default',

  // Phase 3: Background Images
  BACKGROUNDS_GET: 'backgrounds:get',
  BACKGROUNDS_IMPORT: 'backgrounds:import',
  BACKGROUNDS_DELETE: 'backgrounds:delete',

  // Phase 3: Services & Templates
  SERVICES_GET: 'services:get',
  SERVICES_SAVE: 'services:save',
  SERVICES_DELETE: 'services:delete',
  SERVICES_GET_TEMPLATES: 'services:get-templates',

  // Phase 3: Export & Import
  LIBRARY_EXPORT: 'library:export',
  LIBRARY_IMPORT: 'library:import',

  // Diagnostics & Logging
  LOG_FPS_DROP: 'log:fps-drop',
  APP_GET_VERSION: 'app:get-version'
} as const
