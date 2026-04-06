# Multi-Folder Duplicate Detection — Remaining Tasks

## Status: Phase 3 Frontend — 3 items outstanding

All backend (Phase 1) and API (Phase 2) work is complete. Phase 4 (optional/advanced) was deprioritized.

---

## Outstanding Items

All changes target: `frontend/src/components/DuplicateFinder.jsx`

### 1. Per-Path Validation UI (PRD Task 3.2)
- [x] Added `GET /validate_path?path=` endpoint in `backend/main.py`
- [x] Debounced validation (600ms) on path input change in frontend
- [x] Green ✓ / Red ✕ icon overlaid on input field for each path
- [x] Input border turns emerald (valid) or rose (invalid)
- [x] "Start Scan" disabled if any non-empty path is invalid
- [x] Error message shown below inputs when invalid path detected

### 2. Color-Code Files by Source Location (PRD Task 3.4)
- [x] `SOURCE_COLORS` palette (8 colors: cyan, emerald, amber, violet, rose, orange, pink, lime)
- [x] `sourceColorMap` (useMemo) maps each unique `source_root` to a color
- [x] Source root badge in each file card uses its assigned color (background + text + dot)

### 3. Filter Results by Source Folder (PRD Task 3.4)
- [x] Filter bar rendered above results when 2+ source roots exist
- [x] Each source root shown as a toggle pill with its assigned color and group count
- [x] Active filters highlight the pill; inactive groups are hidden
- [x] "Clear" link resets all filters
- [x] Counter shown: "Showing X of Y groups"

---

## What's Already Done

### Phase 1: Backend (`backend/scanner.py`)
- [x] Multi-path input (`scan(root_paths: List[str])`)
- [x] Aggregated traversal across all paths
- [x] Overlapping path normalization (`_normalize_paths()`)
- [x] Source folder metadata tracking (`file_metadata`)
- [x] Multi-folder progress calculation
- [x] Current folder status reporting

### Phase 2: API (`backend/main.py`)
- [x] `POST /scan` accepts `{ "paths": [...] }`
- [x] Backward compatible with `{ "path": "..." }`
- [x] Path existence validation before scan
- [x] Status response includes `current_folder`, `folders_completed`, `folders_total`

### Phase 3: Frontend (`frontend/src/components/DuplicateFinder.jsx`)
- [x] Dynamic folder list with add/remove
- [x] "Add Folder" button
- [x] Remove (X) button per folder
- [x] "Scanning folder X of Y" progress display
- [x] Overall progress bar
- [x] Source root shown in file cards

### Phase 4: Optional/Advanced — Not Started
- [ ] Native folder browser dialog
- [ ] Preset/profile support
- [ ] Exclusion patterns
- [ ] Cross-drive intelligence (smart suggestions, batch by drive)
