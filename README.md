# Dup Photo Locator 📸🎞️

A modern, efficient local utility to find and cleanup exact binary duplicate photos and videos. Built with **FastAPI** and **React**.

## Features

### Duplicate Finder
- Scan **multiple folders simultaneously**, including across different drives
- Per-path validation — green ✓ / red ✕ indicators as you type, with scan blocked on invalid paths
- **Source folder color-coding** — each drive/folder gets a distinct color in results so you can instantly see where each copy lives
- **Filter results by source folder** — toggle pills above results let you narrow down duplicate groups by drive/folder
- Three-stage deduplication (size → partial hash → full SHA-256) handles libraries 100GB+
- Scan progress shows current folder and folder-of-total count
- **Bulk select duplicates from a source folder** — one click to select all copies from a specific drive for easy cleanup
- Reveal any file in Windows Explorer, move selected files to the Recycle Bin

### JSON Remover
- Recursively removes `.json` metadata files from Google Takeout exports
- **Optional: also remove binary files with no extension** (leftover blobs/thumbnails from exports)
- Live progress: files inspected, JSONs removed, no-extension binaries removed
- All deletions go to the Recycle Bin (recoverable)

### Prefix Remover
- Bulk-rename files by stripping common prefixes like `VID_`, `MOV_`, `IMG_`
- Comma-separated prefix input with live preview badges
- Skips files where renaming would cause a name conflict
- Live progress: files inspected, files renamed, errors
- Renames in place — does not move or delete anything

## 🚀 Quick Start (Windows)

The easiest way to run the app is using the provided PowerShell script:

1. Open PowerShell in the project root.
2. Run:
   ```powershell
   ./run.ps1
   ```
3. Open your browser to [http://localhost:5173](http://localhost:5173).

---

## 🛠️ Manual Setup

If you prefer to run the components separately:

### Prerequisites
- Python 3.8+
- Node.js & npm

### Backend
1. `cd backend`
2. `pip install -r requirements.txt`
3. `python main.py` (Runs on port 8000)

### Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev` (Runs on port 5173)

---

## 🧪 Testing with Mock Data
To see the app in action without using your real photos first:
1. Run `python generate_test_data.py`.
2. It will create a folder named `test_library` with intentional duplicates.
3. In the Web UI, enter the absolute path to this folder (e.g., `D:\workspace\dup photo locator\test_library`).

## 🧠 How it Works
To handle libraries up to 100GB+ without lag, the scanner uses a **three-stage validation**:
1. **Size check**: Groups files with identical byte counts.
2. **Partial Hash**: Hashes only the head and tail of the file to eliminate non-matches quickly.
3. **Full SHA256**: Only high-probability candidates are fully hashed for 100% accuracy.

## 🧹 JSON Remover

Google Takeout exports include `.json` metadata files alongside each photo/video. The JSON Remover feature helps clean these up:

- **Real-time progress** - See the current folder being scanned and file counts updating live
- **Binary no-extension file removal** - Check the option to also remove binary files that have no extension (common Takeout export artifacts)
- **Error reporting** - Any files that couldn't be removed are listed with details
- **Safe deletion** - Files are moved to the Recycle Bin, not permanently deleted

### Usage
1. Navigate to the "JSON Remover" tab in the UI
2. Enter the path to your Google Takeout folder
3. Optionally check "Also remove binary files with no extension"
4. Click "Remove JSONs" and confirm
5. Watch the progress as folders are scanned and files are removed

## 🛡️ Safety
- Deleting a file via the UI uses the **Recycle Bin / Trash** (via `send2trash`), so nothing is permanently lost immediately.
