Session Logger (session_logger.js)

What it does
- Appends a session metadata row to a sheet named "System Logs" in your spreadsheet when the app detects the spreadsheet is reachable via the client-side ServiceAccountAuth.

When it runs
- The logger runs once per browser session (uses sessionStorage to avoid duplicate rows for repeated page loads) and runs automatically shortly after DOM load.
 - The logger will ensure the sheet named "System Logs" exists and will create it if missing. It will also create a header row if one does not already exist or does not match the expected headers.
- A manual API is exposed as window.sessionLogger.runSessionLog() to trigger it on-demand.

What it records (row order)
- Timestamp (ISO)
- IP (public IP detected via ipify)
- Browser (parsed brief browser name/version)
- Device ID (persistent per browser via localStorage)
- Location (latitude,longitude — from geolocation API when available)
- Session ID (random persistent value for this browser tab session)
- App version / page title
- Spreadsheet ID
- Page URL (window.location.href)
- User agent string
- Columns Index summary (per-dataset counts from client cache)
- Event (defaults to 'startup')
- Details (freeform string or JSON with event data)

Safety / privacy
- The client-side service-account approach exposes the service account credentials in the browser — this code assumes the app is used in a trusted single-user environment. Do not deploy in public-facing apps.
- Only a compact set of metadata is logged and nothing sensitive (no private invoice data) is appended.

Debugging
- If window.DEBUG_PREVIEW_APPEND is set, the logger will only log the row to console and skip the actual append.
- All append errors are logged to the console for troubleshooting.

Retry queue
- When an append fails (for example ServiceAccountAuth not available, missing spreadsheet ID, or a network/permission error) the failed row is stored in a persistent local retry queue (localStorage key: `session_logger_pending`).
- The UI has a System Logs modal (toolbar button) where you can Preview, Append Now (force) or Flush Pending rows. Flushing will attempt to write queued rows and will keep any rows that still fail.
- Programmatic APIs available on window.sessionLogger:
	- flushPendingRows() — attempts to append queued rows (returns object with flushed/remaining counts)
	- getPendingRows() — returns the array of pending items
	- clearPendingQueue() — clears the local pending queue
	- _pendingCount — numeric count of pending rows (read-only)
