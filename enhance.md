# Enhancement Plan

---

## Step 1: Bug Fix — "Scanning folder 3 of 2"

### Problem
After traversal of all root folders completes, `folders_completed` equals `folders_total` (e.g. both = 2). The scan continues into the hashing phase with `scanning = true`. The frontend displays `folders_completed + 1`, which produces "Scanning folder 3 of 2".

### Root Cause
- `backend/scanner.py` line 104: `self.folders_completed += 1` runs after each folder's traversal
- `frontend/src/components/DuplicateFinder.jsx` line 284: `Scanning folder {status.folders_completed + 1} of {status.folders_total}`
- The `+ 1` assumes we're mid-traversal, but after all folders are walked the scan enters hashing and the condition `status.folders_total > 1` still renders.

### Fix
**Frontend** (`DuplicateFinder.jsx`):
- Cap the display: `Math.min(status.folders_completed + 1, status.folders_total)`
- When `folders_completed === folders_total`, change the text to "Hashing files..." or hide the folder counter entirely since traversal is done.

### Files
- `frontend/src/components/DuplicateFinder.jsx` — line 284

---

## Step 2: Prefix Remover — New Tab/Page

### Goal
New standalone feature (like JSON Remover) to bulk-rename files by stripping common prefixes such as `VID_` and `MOV_` from filenames in a specified folder.

### Backend (`backend/main.py`)
- Add `POST /remove_prefix` endpoint
  - Request body: `{ "path": "...", "prefixes": ["VID_", "MOV_"] }`
  - Traverses the folder recursively
  - For each file whose name starts with any of the specified prefixes, rename it (strip the prefix)
  - Handle conflicts: if the renamed file already exists, skip and log as error
  - Track progress: `{ "running", "inspected_count", "renamed_count", "errors", "current_folder" }`
- Add `GET /remove_prefix/status` endpoint

### Frontend — New Component (`frontend/src/components/PrefixRemover.jsx`)
- Folder path input (reuse same style as JSON Remover)
- Prefix input: text field with comma-separated prefixes, pre-populated with `VID_, MOV_`
- Preview mode (optional): show a count of files that would be affected before executing
- "Remove Prefixes" button with confirmation dialog
- Live progress display: inspected / renamed counters
- Completion summary with error list

### Navigation
- Add "Prefix Remover" tab to the app navigation (alongside Duplicate Finder and JSON Remover)

### Files
- `backend/main.py` — new endpoints
- `frontend/src/components/PrefixRemover.jsx` — new component
- `frontend/src/App.jsx` — add tab/route

---

## Step 3: Bulk Select Duplicates from a Source Folder

### Goal
In the Duplicate Finder results, add a "Select all" button next to each source folder color pill in the filter bar. Clicking it auto-selects all duplicate copies that live in that source folder (but not the "only copy" — only files that have a duplicate elsewhere).

### Frontend (`DuplicateFinder.jsx`)
- In the source filter bar (where color pills are), add a "Select all" button next to each source root pill
- Clicking "Select all from [Folder X]":
  - Iterates over all duplicate groups
  - For each group, selects files whose `source_root` matches the clicked folder
  - Does NOT select a file if it's the only copy in the group from any source (safety: never select all copies)
- Add a "Deselect all from [Folder X]" toggle (same button, toggles state)
- The existing "Trash Selected (N)" button then handles the deletion

### Safety Rule
If selecting all files from a source folder would select ALL copies in a group (leaving none), skip that group to prevent data loss. At minimum, one copy per group must remain unselected.

### Files
- `frontend/src/components/DuplicateFinder.jsx` — filter bar section
