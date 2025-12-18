This short note explains how to diagnose and preview the final row arrays that the app will append to Google Sheets for Contacts and Invoices (non-destructive).

Why
- If you are seeing newly appended rows in Google Sheets but the 'Tax Registration Number' column is empty, use the preview and debug options below.

How to preview Contacts append (non-destructive)
- Open the app in the browser and open DevTools (F12).
- In the console you can manually preview the Contacts row built from the Manual Client modal using:

  window.previewManualClientAppend();

  This will console.log a preview object containing the contacts object and the row array that would be sent to Sheets.

How to preview Invoices append (non-destructive)
- You can run the invoice save flow in preview mode by first setting this flag in the console:

  window.DEBUG_PREVIEW_APPEND = true;

- Then run the Save operation in the UI. The app will log a preview of the rows it would send and skip making the actual API append call.

Notes and fixes included
- The client-side mapping now normalizes TRN synonyms ("TRN", "TRN Number") into the canonical header "Tax Registration Number" before mapping to a numeric column index.
- The invoice append logic now prefers the selected client's TRN (clientTRN) when populating the invoice row's "Tax Registration Number" — this prevents the field from being empty when the client's TRN is available but the invoice-level vatNo field is not.
- The append flow now forces a live refresh of the Columns Index mapping when performing appends (Contacts and Invoices). This avoids using stale cached mappings and ensures the append uses the latest column indexes defined on the sheet.
- Both Contacts and Invoices use the same canonical mapping algorithm: the app now normalizes TRN synonyms into the canonical header `Tax Registration Number` and uses a live Columns Index mapping to place values into the correct numeric column index before appending.
 - The Columns Index loader now prefers to fetch live ranges via the client-side ServiceAccountAuth (if configured), then falls back to the local CSV. This ensures the app imports the latest mapping directly from the spreadsheet when available.

If a preview still shows the TRN missing
- Check that the Manual Client TRN field contains a value.
- Ensure the Columns Index mapping for the dataset (Contacts or Invoices) contains a mapping entry for "Tax Registration Number".
- If mapping shows a valid index and the contacts/invoice object contains the TRN, but Sheets still shows it missing, set window.DEBUG_PREVIEW_APPEND = true and re-attempt a save — inspect the console preview to see exactly which columns contain the value.

If you'd like, I can also add a small UI preview button inside the Manual Client modal (so you can preview without opening devtools) — tell me if you want that added.
