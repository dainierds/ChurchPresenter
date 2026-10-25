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
  STATE_SET_STRESS_TEST: 'state:set-stress-test',
  STATE_UPDATED: 'state:updated',

  // Shortcuts & Settings
  SHORTCUTS_GET: 'shortcuts:get',
  SHORTCUTS_SAVE: 'shortcuts:save',
  BACKUPS_OPEN_FOLDER: 'backups:open-folder',
  NOTIFICATION_EMIT: 'notification:emit',

  // Diagnostics & Logging
  LOG_FPS_DROP: 'log:fps-drop',
  APP_GET_VERSION: 'app:get-version'
} as const
