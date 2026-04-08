import os
import hashlib
from typing import List, Dict, Set, Tuple
from collections import defaultdict

MEDIA_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.mp4', '.mov', '.avi', '.mkv', '.heic', '.dng'
}

def get_file_hash(filepath: str, full: bool = False) -> str:
    """Computes SHA256 hash. If full=False, only hashes first/last 4KB."""
    hash_sha256 = hashlib.sha256()
    size = os.path.getsize(filepath)
    
    with open(filepath, 'rb') as f:
        if full or size <= 8192:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        else:
            # Hash first 4KB
            hash_sha256.update(f.read(4096))
            # Hash last 4KB
            f.seek(-4096, os.SEEK_END)
            hash_sha256.update(f.read(4096))
            
    return hash_sha256.hexdigest()

class Scanner:
    def __init__(self):
        self.scanning = False
        self.progress = 0
        self.total_files = 0
        self.duplicates = []
        self.current_folder = ""
        self.folders_completed = 0
        self.folders_total = 0
        self.file_metadata = {}  # Track source root for each file

    def _normalize_paths(self, paths: List[str]) -> List[str]:
        """Remove duplicate and overlapping paths."""
        normalized = []
        for path in paths:
            path = os.path.abspath(path)
            # Check if this path is not a subfolder of any already added path
            is_subfolder = False
            for existing in normalized:
                try:
                    # Check if path is relative to existing
                    os.path.relpath(path, existing)
                    if path.startswith(existing):
                        is_subfolder = True
                        break
                except ValueError:
                    # Different drives on Windows
                    pass
            if not is_subfolder:
                # Also remove any existing paths that are subfolders of this path
                normalized = [p for p in normalized if not p.startswith(path)]
                normalized.append(path)
        return normalized

    def scan(self, root_paths: List[str]):
        self.scanning = True
        self.progress = 0
        self.duplicates = []
        self.current_folder = ""
        self.file_metadata = {}

        # Convert single path to list for backward compatibility
        if isinstance(root_paths, str):
            root_paths = [root_paths]

        # Normalize paths and remove duplicates/overlaps
        root_paths = self._normalize_paths(root_paths)
        self.folders_total = len(root_paths)
        self.folders_completed = 0

        # 1. Traversal & Size Filter
        size_map = defaultdict(list)
        all_files = []

        for root_path in root_paths:
            self.current_folder = root_path
            if not os.path.exists(root_path):
                continue

            for root, _, files in os.walk(root_path):
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext in MEDIA_EXTENSIONS:
                        filepath = os.path.join(root, file)
                        try:
                            size = os.path.getsize(filepath)
                            size_map[size].append(filepath)
                            all_files.append(filepath)
                            # Store metadata: source root for each file
                            self.file_metadata[filepath] = {
                                "source_root": root_path,
                                "size": size
                            }
                        except OSError:
                            pass

            self.folders_completed += 1

        self.total_files = len(all_files)
        if self.total_files == 0:
            self.scanning = False
            self.current_folder = ""
            return

        # Keep only sizes with > 1 file
        candidates = {size: paths for size, paths in size_map.items() if len(paths) > 1}
        
        # 2. Partial Hash Filter
        partial_hash_map = defaultdict(list)
        processed_count = 0
        
        for size, paths in candidates.items():
            for path in paths:
                try:
                    p_hash = get_file_hash(path, full=False)
                    partial_hash_map[(size, p_hash)].append(path)
                except Exception:
                    pass
                processed_count += 1
                self.progress = int((processed_count / self.total_files) * 50) # 50% for partial

        # Keep only (size, partial_hash) with > 1 file
        candidates = {k: paths for k, paths in partial_hash_map.items() if len(paths) > 1}
        
        # 3. Full Hash Filter
        full_hash_map = defaultdict(list)
        processed_count_full = 0
        total_full_candidates = sum(len(p) for p in candidates.values())
        
        for key, paths in candidates.items():
            for path in paths:
                try:
                    f_hash = get_file_hash(path, full=True)
                    full_hash_map[f_hash].append(path)
                except Exception:
                    pass
                processed_count_full += 1
                if total_full_candidates > 0:
                    self.progress = 50 + int((processed_count_full / total_full_candidates) * 50)

        # Final Duplicates
        self.duplicates = [paths for paths in full_hash_map.values() if len(paths) > 1]
        self.scanning = False
        self.progress = 100
        self.current_folder = ""

scanner_instance = Scanner()
