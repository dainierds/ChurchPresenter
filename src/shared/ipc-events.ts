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
  WORKSPACE_GET_INFO: 'workspace:get-info',
  WORKSPACE_SET_PATH: 'workspace:set-path',
  WORKSPACE_CHOOSE_FOLDER: 'workspace:choose-folder',
  WORKSPACE_OPEN_FOLDER: 'workspace:open-folder',
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

  // Phase 3 & Extended Theme System
  THEMES_GET: 'themes:get',
  THEMES_SAVE: 'themes:save',
  THEMES_DELETE: 'themes:delete',
  THEMES_DUPLICATE: 'themes:duplicate',
  THEMES_SET_DEFAULT: 'themes:set-default',
  THEMES_GET_TYPE_DEFAULTS: 'themes:get-type-defaults',
  THEMES_SET_TYPE_DEFAULT: 'themes:set-type-default',
  THEMES_APPLY_SCOPE: 'themes:apply-scope',
  THEMES_EXPORT: 'themes:export',
  THEMES_IMPORT: 'themes:import',
  THEMES_UPLOAD_BG: 'themes:upload-bg',
  FONTS_GET: 'fonts:get',
  FONTS_IMPORT: 'fonts:import',
  FONTS_DELETE: 'fonts:delete',
  FONTS_CHANGED: 'fonts:changed',

  // Phase 3: Background Images
  BACKGROUNDS_GET: 'backgrounds:get',
  BACKGROUNDS_IMPORT: 'backgrounds:import',
  BACKGROUNDS_DELETE: 'backgrounds:delete',

  // Phase 3: Services & Templates
  SERVICES_GET: 'services:get',
  SERVICES_SAVE: 'services:save',
  SERVICES_DELETE: 'services:delete',
  SERVICES_DUPLICATE: 'services:duplicate',
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
  BIBLE_IMPORT_FILE: 'bible:import-file',
  BIBLE_DELETE_TRANSLATION: 'bible:delete-translation',
  BIBLE_SET_DEFAULT: 'bible:set-default',
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
  VIDEO_SET_DURATION: 'video:set-duration',
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

  // Phase 5C: YouTube Integration
  YOUTUBE_GET_ITEMS: 'youtube:get-items',
  YOUTUBE_SAVE_ITEM: 'youtube:save-item',
  YOUTUBE_DELETE_ITEM: 'youtube:delete-item',
  YOUTUBE_CHECK_AVAILABILITY: 'youtube:check-availability',
  YOUTUBE_VERIFY_PLAYLIST: 'youtube:verify-playlist',
  YOUTUBE_GET_METADATA: 'youtube:get-metadata',
  YOUTUBE_OPEN_BROWSER: 'youtube:open-browser',
  YOUTUBE_CLOSE_BROWSER: 'youtube:close-browser',
  YOUTUBE_NAVIGATE_BROWSER: 'youtube:navigate-browser',
  YOUTUBE_GET_BROWSER_URL: 'youtube:get-browser-url',
  YOUTUBE_SET_BROWSER_BOUNDS: 'youtube:set-browser-bounds',
  YOUTUBE_CLEAR_SESSION: 'youtube:clear-session',
  YOUTUBE_SET_BROWSER_VISIBLE: 'youtube:set-browser-visible',
  YOUTUBE_CONTROL: 'youtube:control',
  YOUTUBE_SYNC_TICK: 'youtube:sync-tick',
  YOUTUBE_DOWNLOAD_VIDEO: 'youtube:download-video',
  YOUTUBE_AD_STATUS: 'youtube:ad-status',
  YOUTUBE_DOWNLOAD_PROGRESS: 'youtube:download-progress',
  YOUTUBE_ERROR: 'youtube:error',
  YOUTUBE_GET_PREVIEW_FRAME: 'youtube:get-preview-frame',
  YOUTUBE_GET_EMBED_URL: 'youtube:get-embed-url',

  // Native Dialogs & File Access
  DIALOG_OPEN_FILE: 'dialog:open-file',
  DIALOG_OPEN_FOLDER: 'dialog:open-folder',

  // File Watching (External Changes)
  WATCH_FILE: 'watch:file',
  UNWATCH_FILE: 'watch:unwatch-file',
  FILE_CHANGED: 'watch:file-changed',

  // Libraries (ProPresenter Style Collections)
  LIBRARIES_GET: 'libraries:get',
  LIBRARIES_SAVE: 'libraries:save',
  LIBRARIES_RENAME: 'libraries:rename',
  LIBRARIES_REORDER: 'libraries:reorder',
  LIBRARIES_DELETE: 'libraries:delete',
  LIBRARIES_MOVE_ITEM: 'libraries:move-item',

  // Timers
  TIMERS_GET: 'timers:get',
  TIMERS_SAVE: 'timers:save',
  TIMERS_DELETE: 'timers:delete',
  TIMERS_TICK: 'timers:tick',

  // Diagnostics & Logging
  LOG_FPS_DROP: 'log:fps-drop',
  LOG_MEDIA_ERROR: 'log:media-error',
  OUTPUT_CAPTURE_ROLE: 'output:capture-role',
  OUTPUT_OPEN_PREVIEW: 'output:open-preview',
  OUTPUT_CLOSE: 'output:close',
  APP_GET_VERSION: 'app:get-version',
  APP_GET_ENV_INFO: 'app:get-env-info',
  DEV_COPY_PROD_LIBRARY: 'dev:copy-prod-library',

  // Floating Output Preview Window (Requirement 3)
  FLOATING_PREVIEW_OPEN: 'floating-preview:open',
  FLOATING_PREVIEW_SET_ALWAYS_ON_TOP: 'floating-preview:set-always-on-top',
  FLOATING_PREVIEW_CLOSE: 'floating-preview:close',

  // Phase 6: Remote Control
  REMOTE_GET_CONFIG: 'remote:get-config',
  REMOTE_SAVE_CONFIG: 'remote:save-config',
  REMOTE_GET_STATUS: 'remote:get-status',
  REMOTE_REGENERATE_PIN: 'remote:regenerate-pin',
  REMOTE_KICK_CLIENT: 'remote:kick-client',
  REMOTE_GET_NETWORK_INTERFACES: 'remote:get-network-interfaces',
  REMOTE_ACTION_DISPATCH: 'remote:action-dispatch',

  // Phase 6: Stage Layouts
  STAGE_GET_LAYOUTS: 'stage:get-layouts',
  STAGE_SAVE_LAYOUT: 'stage:save-layout',
  STAGE_DELETE_LAYOUT: 'stage:delete-layout',
  STAGE_GET_ASSIGNMENT: 'stage:get-assignment',
  STAGE_SET_ASSIGNMENT: 'stage:set-assignment',

  // Phase 6: Messages
  MESSAGES_GET_ACTIVE: 'messages:get-active',
  MESSAGES_SEND: 'messages:send',
  MESSAGES_CLEAR: 'messages:clear',
  MESSAGES_GET_PRESETS: 'messages:get-presets',
  MESSAGES_SAVE_PRESET: 'messages:save-preset',
  MESSAGES_DELETE_PRESET: 'messages:delete-preset',

  // Phase 7: Crash Recovery, Output Health, System Monitor, Checklist, Diagnostics, Rehearsal & Emergency
  RECOVERY_CHECK: 'recovery:check',
  RECOVERY_DISMISS: 'recovery:dismiss',
  RECOVERY_GET_SNAPSHOT: 'recovery:get-snapshot',
  OUTPUT_HEALTH_GET: 'output-health:get',
  OUTPUT_HEALTH_HEARTBEAT: 'output-health:heartbeat',
  OUTPUT_HEALTH_CHANGED: 'output-health:changed',
  SYSTEM_METRICS_GET: 'system-metrics:get',
  SYSTEM_METRICS_TICK: 'system-metrics:tick',
  CHECKLIST_RUN: 'checklist:run',
  CHECKLIST_FIX_ITEM: 'checklist:fix-item',
  DIAGNOSTICS_GET_LOGS: 'diagnostics:get-logs',
  DIAGNOSTICS_EXPORT_ZIP: 'diagnostics:export-zip',
  REHEARSAL_SET_MODE: 'rehearsal:set-mode',
  REHEARSAL_GET_STATUS: 'rehearsal:get-status',
  REHEARSAL_GET_SUMMARY: 'rehearsal:get-summary',
  REHEARSAL_MODE_CHANGED: 'rehearsal:mode-changed',
  EMERGENCY_ACTIVATE: 'emergency:activate',
  EMERGENCY_DEACTIVATE: 'emergency:deactivate',
  EMERGENCY_GET_STATUS: 'emergency:get-status',
  SAFE_MODE_GET_STATUS: 'safe-mode:get-status',

  // Phase 8: Automation, Macros, Props, Loops & MIDI
  MACROS_GET_ALL: 'macros:get-all',
  MACROS_SAVE: 'macros:save',
  MACROS_DELETE: 'macros:delete',
  MACROS_DUPLICATE: 'macros:duplicate',
  MACROS_RUN: 'macros:run',
  MACROS_RUN_STEP: 'macros:run-step',
  MACROS_STOP_ALL: 'macros:stop-all',
  MACROS_GET_STATUS: 'macros:get-status',
  MACROS_STATUS_CHANGED: 'macros:status-changed',
  PROPS_GET_ALL: 'props:get-all',
  PROPS_SAVE: 'props:save',
  PROPS_DELETE: 'props:delete',
  PROPS_TOGGLE: 'props:toggle',
  PROPS_GET_ACTIVE: 'props:get-active',
  PROPS_ACTIVE_CHANGED: 'props:active-changed',
  LOOP_START: 'loop:start',
  LOOP_STOP: 'loop:stop',
  LOOP_GET_STATUS: 'loop:get-status',
  LOOP_STATUS_CHANGED: 'loop:status-changed',
  MIDI_GET_INPUTS: 'midi:get-inputs',
  MIDI_TRIGGER_MESSAGE: 'midi:trigger-message',

  // Phase 9: OBS Studio & Broadcast
  OBS_GET_CONFIG: 'obs:get-config',
  OBS_SAVE_CONFIG: 'obs:save-config',
  OBS_CONNECT: 'obs:connect',
  OBS_DISCONNECT: 'obs:disconnect',
  OBS_GET_STATUS: 'obs:get-status',
  OBS_GET_SCENES: 'obs:get-scenes',
  OBS_SET_SCENE: 'obs:set-scene',
  OBS_START_STREAM: 'obs:start-stream',
  OBS_STOP_STREAM: 'obs:stop-stream',
  OBS_START_RECORD: 'obs:start-record',
  OBS_STOP_RECORD: 'obs:stop-record',
  OBS_STATUS_CHANGED: 'obs:status-changed',

  // Broadcast Studio & Streaming
  BROADCAST_GET_SETTINGS: 'broadcast:get-settings',
  BROADCAST_SAVE_SETTINGS: 'broadcast:save-settings',
  BROADCAST_GET_SCENES: 'broadcast:get-scenes',
  BROADCAST_SAVE_SCENE: 'broadcast:save-scene',
  BROADCAST_DELETE_SCENE: 'broadcast:delete-scene',
  BROADCAST_START_STREAM: 'broadcast:start-stream',
  BROADCAST_STOP_STREAM: 'broadcast:stop-stream',
  BROADCAST_START_RECORD: 'broadcast:start-record',
  BROADCAST_STOP_RECORD: 'broadcast:stop-record',
  BROADCAST_GET_STATUS: 'broadcast:get-status',
  BROADCAST_STATUS_CHANGED: 'broadcast:status-changed',
  BROADCAST_GET_AUDIO_MIXER: 'broadcast:get-audio-mixer',
  BROADCAST_SAVE_AUDIO_MIXER: 'broadcast:save-audio-mixer',
  BROADCAST_LIST_DESKTOP_SOURCES: 'broadcast:list-desktop-sources',

  // Phase 10: Extras (Sync, Song Importers, CCLI Reports, Subtitles, AI, Backups)
  // 1. Multi-PC Sync
  SYNC_EXPORT_PACKAGE: 'sync:export-package',
  SYNC_INSPECT_PACKAGE: 'sync:inspect-package',
  SYNC_MERGE_PACKAGE: 'sync:merge-package',
  SYNC_UNDO: 'sync:undo',
  SYNC_GET_CONFIG: 'sync:get-config',
  SYNC_SAVE_CONFIG: 'sync:save-config',

  // 2. Song Importers
  SONG_IMPORT_PARSE_FILE: 'song-import:parse-file',
  SONG_IMPORT_EXECUTE: 'song-import:execute',

  // 3. CCLI Song Usage
  CCLI_RECORD_USAGE: 'ccli:record-usage',
  CCLI_GET_REPORT: 'ccli:get-report',
  CCLI_EXPORT_CSV: 'ccli:export-csv',
  CCLI_CLEAR_HISTORY: 'ccli:clear-history',
  CCLI_GET_CONFIG: 'ccli:get-config',
  CCLI_SAVE_CONFIG: 'ccli:save-config',

  // 4. Live Subtitles
  SUBTITLES_GET_CONFIG: 'subtitles:get-config',
  SUBTITLES_SAVE_CONFIG: 'subtitles:save-config',
  SUBTITLES_SEND: 'subtitles:send',
  SUBTITLES_CLEAR: 'subtitles:clear',
  SUBTITLES_STATUS_CHANGED: 'subtitles:status-changed',

  // 5. AI Assistant
  AI_GET_CONFIG: 'ai:get-config',
  AI_SAVE_CONFIG: 'ai:save-config',
  AI_EXECUTE_TASK: 'ai:execute-task',

  // 6. Secondary Backup
  BACKUP_GET_SECONDARY_CONFIG: 'backup:get-secondary-config',
  BACKUP_SAVE_SECONDARY_CONFIG: 'backup:save-secondary-config',
  BACKUP_RUN_SECONDARY: 'backup:run-secondary',

  // Church Branding (Logo & Background)
  CHURCH_BRANDING_GET: 'church-branding:get',
  CHURCH_BRANDING_SAVE: 'church-branding:save',
  CHURCH_BRANDING_UPLOAD_LOGO: 'church-branding:upload-logo',
  CHURCH_BRANDING_UPLOAD_BACKGROUND: 'church-branding:upload-background'
} as const
