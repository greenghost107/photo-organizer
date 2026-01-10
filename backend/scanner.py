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

    def scan(self, root_path: str):
        self.scanning = True
        self.progress = 0
        self.duplicates = []
        
        # 1. Traversal & Size Filter
        size_map = defaultdict(list)
        all_files = []
        
        for root, _, files in os.walk(root_path):
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in MEDIA_EXTENSIONS:
                    filepath = os.path.join(root, file)
                    try:
                        size = os.path.getsize(filepath)
                        size_map[size].append(filepath)
                        all_files.append(filepath)
                    except OSError:
                        pass
        
        self.total_files = len(all_files)
        if self.total_files == 0:
            self.scanning = False
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

scanner_instance = Scanner()
