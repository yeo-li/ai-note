# Sprint 1 Acceptance Checklist and Desktop Smoke Scenarios

This document defines the Sprint 1 quality gate for AI Note.

It is intentionally split into two states:

- `Currently testable`: can be verified in the current desktop shell or as soon as the corresponding feature lands.
- `Planned`: not yet testable in the current codebase, but required for Sprint 1 completion.

The checklist is written for manual verification in the desktop app first. It can later be turned into automated tests.

## Scope

Sprint 1 covers three product tracks:

- CRUD: create, read, update, delete notes
- AI organize: rewrite note content into cleaner prose or a polite tone
- Context search: find related notes from a natural-language query

## Acceptance Checklist

### A. Desktop App Baseline

- [ ] `Currently testable` The app launches successfully in desktop mode.
- [ ] `Currently testable` The app opens into the notes experience rather than a broken blank screen.
- [ ] `Currently testable` The app keeps note operations inside the desktop boundary and does not require network access for basic CRUD.
- [ ] `Planned` The app persists notes locally across restart.
- [ ] `Planned` The app restores the last opened note or a stable default view on relaunch.

### B. CRUD

- [ ] `Planned` A user can create a new note from the notes list or empty state.
- [ ] `Planned` A user can edit the note title.
- [ ] `Planned` A user can edit the note body.
- [ ] `Planned` A user can see the note appear in the list immediately after creating it.
- [ ] `Planned` A user can open an existing note and see the saved title and body.
- [ ] `Planned` A user can delete a note.
- [ ] `Planned` Deleted notes do not reappear after relaunch.
- [ ] `Planned` Notes are shown in a deterministic order, preferably most recently updated first.

### C. AI Organize

- [ ] `Planned` A user can run AI organize from a note.
- [ ] `Planned` The organize action supports sentence cleanup.
- [ ] `Planned` The organize action supports polite-tone rewriting.
- [ ] `Planned` The result is shown before it is applied.
- [ ] `Planned` A user can accept the result and replace the original note content.
- [ ] `Planned` A user can reject the result without losing the original note content.
- [ ] `Planned` AI organize does not silently modify unrelated notes.

### D. Context Search

- [ ] `Planned` A user can search notes with a natural-language or contextual query.
- [ ] `Planned` The result is a list of related notes, not a generated answer.
- [ ] `Planned` Search results show enough context to choose the right note quickly.
- [ ] `Planned` A query such as `오늘 할 일` can return matching notes that are conceptually related.
- [ ] `Planned` A query such as `아까 전화한 내용` can return the note written for that call.
- [ ] `Planned` Search returns results within the 4 second target from query entry to first usable result.

### E. Sprint 1 Quality Bar

- [ ] `Planned` CRUD is stable enough that a user can rely on the app for daily note capture.
- [ ] `Planned` AI organize output is usable with little or no manual editing.
- [ ] `Planned` Context search returns the expected note list quickly enough to preserve the quick-capture workflow.
- [ ] `Planned` The app still behaves correctly in packaged desktop mode, not only in development.

## Desktop Smoke Scenarios

The smoke scenarios are the shortest end-to-end checks for Sprint 1. Run them in order when possible.

### Smoke 1. Launch and Baseline

Status: `Currently testable`

Steps:

1. Start the desktop app.
2. Confirm the app window opens normally.
3. Confirm the app is usable without signing in.

Expected:

- The app opens successfully.
- There is no crash, error dialog, or broken renderer on startup.

### Smoke 2. CRUD Create and Edit

Status: `Planned`

Steps:

1. Create a new note.
2. Enter a title and a short body.
3. Edit the body again.
4. Return to the notes list and re-open the note.

Expected:

- The new note appears in the list.
- The saved title and body are visible after re-opening.
- The edited content remains intact.

### Smoke 3. CRUD Delete

Status: `Planned`

Steps:

1. Open an existing note.
2. Delete the note.
3. Return to the list.
4. Restart the app and check the list again.

Expected:

- The note is removed from the list.
- The note does not reappear after restart.

### Smoke 4. AI Organize Sentence Cleanup

Status: `Planned`

Steps:

1. Open a rough note with unfinished or informal text.
2. Trigger AI organize.
3. Choose the sentence cleanup option.
4. Review the proposed result.
5. Apply the result.

Expected:

- The note text becomes more readable.
- The user can inspect the result before applying it.
- The original content is not lost until the user confirms the change.

### Smoke 5. AI Organize Polite Tone

Status: `Planned`

Steps:

1. Open a note with a message that needs polite wording.
2. Trigger AI organize.
3. Choose the polite-tone option.
4. Review the proposed result.
5. Apply the result.

Expected:

- The rewritten note sounds appropriate for business or academic communication.
- The result can be used with little or no extra editing.

### Smoke 6. Context Search by Intent

Status: `Planned`

Steps:

1. Enter a contextual query such as `오늘 할 일`.
2. Enter another query such as `아까 전화한 내용`.
3. Review the returned results.

Expected:

- The results are a list of related notes.
- The app does not replace the result list with a generated paragraph.
- The right note is easy to identify from the returned context.

### Smoke 7. 4 Second Search Check

Status: `Planned`

Steps:

1. Enter a contextual query.
2. Start a timer at query submit.
3. Stop the timer when the first usable result is visible.

Expected:

- The first usable result appears in 4 seconds or less.

## Exit Criteria For Sprint 1

Sprint 1 is ready to close when all of the following are true:

- CRUD smoke scenarios are passing in the desktop app.
- AI organize supports sentence cleanup and polite-tone rewriting.
- Context search returns related notes instead of a generated answer.
- Search performance meets the 4 second target in the desktop experience.
- The behavior is validated in the same environment used for the release candidate or packaged build.

## Notes For Future Automation

If this checklist is turned into automated checks later, prioritize the following order:

1. App launch smoke.
2. CRUD create/edit/delete.
3. AI organize happy path.
4. Context search happy path.
5. Search timing assertion.

