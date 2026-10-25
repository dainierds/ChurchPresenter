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

  // Demo Data Management
  DEMO_LOAD: 'demo:load',
  DEMO_CLEAR: 'demo:clear',
  DEMO_HAS: 'demo:has',

  // Phase 4: Bible
  BIBLE_GET_TRANSLATIONS: 'bible:get-translations',
  BIBLE_IMPORT_TRANSLATION: 'bible:import-translation',
  BIBLE_DELETE_TRANSLATION: 'bible:delete-translation',
  BIBLE_PARSE_REFERENCE: 'bible:parse-reference',
  BIBLE_GET_VERSES: 'bible:get-verses',
  BIBLE_SEARCH_TEXT: 'bible:search-text',
  BIBLE_GET_FAVORITES: 'bible:get-favorites',
  BIBLE_TOGGLE_FAVORITE: 'bible:toggle-favorite',
  BIBLE_GET_RECENT: 'bible:get-recent',
  BIBLE_ADD_RECENT: 'bible:add-recent',
  BIBLE_GENERATE_SLIDES: 'bible:generate-slides',
  BIBLE_GET_ROLE_CONFIGS: 'bible:get-role-configs',
  BIBLE_SAVE_ROLE_CONFIG: 'bible:save-role-config',

  // Phase 5A: Media & PDF
  MEDIA_GET: 'media:get',
  MEDIA_IMPORT: 'media:import',
  MEDIA_IMPORT_FOLDER: 'media:import-folder',
  MEDIA_DELETE: 'media:delete',
  MEDIA_CHECK_INTEGRITY: 'media:check-integrity',
  VIDEO_PLAY: 'video:play',
  VIDEO_CONTROL: 'video:control',
  MEDIA_SYNC_TICK: 'media:sync-tick',
  AUDIO_PLAY_INDEPENDENT: 'audio:play-independent',
  AUDIO_CONTROL_INDEPENDENT: 'audio:control-independent',
  PDF_RENDER_PAGE: 'pdf:render-page',
  PDF_GET_PAGE_COUNT: 'pdf:get-page-count',

  // Phase 5B: PowerPoint & Video Conversion
  POWERPOINT_DETECT_CONVERTERS: 'powerpoint:detect-converters',
  POWERPOINT_IMPORT: 'powerpoint:import',
  POWERPOINT_EDIT: 'powerpoint:edit',
  POWERPOINT_CHECK_MODIFIED: 'powerpoint:check-modified',
  POWERPOINT_CANCEL: 'powerpoint:cancel',
  FFMPEG_DETECT: 'ffmpeg:detect',
  FFMPEG_CONVERT: 'ffmpeg:convert',
  FFMPEG_CANCEL: 'ffmpeg:cancel',

  // Diagnostics & Logging
  LOG_FPS_DROP: 'log:fps-drop',
  LOG_MEDIA_ERROR: 'log:media-error',
  OUTPUT_CAPTURE_ROLE: 'output:capture-role',
  OUTPUT_OPEN_PREVIEW: 'output:open-preview',
  APP_GET_VERSION: 'app:get-version',
  APP_GET_ENV_INFO: 'app:get-env-info',
  DEV_COPY_PROD_LIBRARY: 'dev:copy-prod-library'
} as const
