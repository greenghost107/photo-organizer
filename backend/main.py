from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import os
from scanner import scanner_instance
from send2trash import send2trash
import threading
import time
import subprocess
from fastapi.responses import FileResponse
from fastapi import HTTPException

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ScanRequest(BaseModel):
    path: str = None  # For backward compatibility
    paths: List[str] = None  # New multi-path support

@app.get("/")
async def root():
    return {"message": "Dup Photo Locator API"}

@app.post("/scan")
async def start_scan(request: ScanRequest):
    if scanner_instance.scanning:
        return {"status": "already scanning"}

    # Support both single path and multiple paths
    if request.paths:
        scan_paths = request.paths
    elif request.path:
        scan_paths = [request.path]
    else:
        raise HTTPException(status_code=400, detail="Must provide 'path' or 'paths'")

    # Validate that all paths exist
    invalid_paths = [p for p in scan_paths if not os.path.exists(p)]
    if invalid_paths:
        raise HTTPException(status_code=404, detail=f"Paths not found: {invalid_paths}")

    # Run scan in a separate thread to not block FastAPI
    thread = threading.Thread(target=scanner_instance.scan, args=(scan_paths,))
    thread.start()
    return {"status": "started", "paths": scan_paths}

@app.get("/status")
async def get_status():
    return {
        "scanning": scanner_instance.scanning,
        "progress": scanner_instance.progress,
        "total_files": scanner_instance.total_files,
        "current_folder": scanner_instance.current_folder,
        "folders_completed": scanner_instance.folders_completed,
        "folders_total": scanner_instance.folders_total
    }

@app.get("/results")
async def get_results():
    # Return grouped duplicates with detailed info
    results = []
    for group in scanner_instance.duplicates:
        group_info = []
        for path in group:
            try:
                stat = os.stat(path)
                metadata = scanner_instance.file_metadata.get(path, {})
                group_info.append({
                    "path": path,
                    "name": os.path.basename(path),
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "source_root": metadata.get("source_root", "")
                })
            except OSError:
                continue
        if group_info:
            results.append(group_info)
    return {"results": results}

class DeleteRequest(BaseModel):
    paths: List[str]

class RemoveJsonRequest(BaseModel):
    path: str
    remove_no_ext_binaries: bool = False

# Global state for JSON removal progress
json_cleanup_status = {
    "running": False,
    "inspected_count": 0,
    "removed_count": 0,
    "removed_noext_count": 0,
    "errors": [],
    "path": "",
    "current_folder": ""  # Currently traversing folder for UI visibility
}

def _is_binary_file(filepath: str, check_bytes: int = 512) -> bool:
    """Check if a file is binary by reading the first N bytes for null bytes."""
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(check_bytes)
            return b'\x00' in chunk
    except Exception:
        return False

def perform_json_removal(path: str, remove_no_ext_binaries: bool = False):
    global json_cleanup_status
    json_cleanup_status["running"] = True
    json_cleanup_status["inspected_count"] = 0
    json_cleanup_status["removed_count"] = 0
    json_cleanup_status["removed_noext_count"] = 0
    json_cleanup_status["errors"] = []
    json_cleanup_status["path"] = path
    json_cleanup_status["current_folder"] = ""

    print(f"DEBUG: Starting JSON removal in: {path} (remove_no_ext_binaries={remove_no_ext_binaries})")

    try:
        for root, dirs, files in os.walk(path):
            # Update current folder for UI visibility
            json_cleanup_status["current_folder"] = root
            for file in files:
                json_cleanup_status["inspected_count"] += 1

                # Log progress to console every 500 files
                if json_cleanup_status["inspected_count"] % 500 == 0:
                    print(f"DEBUG: Inspected {json_cleanup_status['inspected_count']} files... (Found {json_cleanup_status['removed_count']} JSONs, {json_cleanup_status['removed_noext_count']} no-ext binaries)")

                full_path = os.path.join(root, file)

                if file.lower().endswith(".json"):
                    try:
                        send2trash(full_path)
                        json_cleanup_status["removed_count"] += 1
                    except Exception as e:
                        json_cleanup_status["errors"].append({"path": full_path, "error": str(e)})
                elif remove_no_ext_binaries and '.' not in file:
                    # File has no extension — check if it's binary
                    if _is_binary_file(full_path):
                        try:
                            send2trash(full_path)
                            json_cleanup_status["removed_noext_count"] += 1
                        except Exception as e:
                            json_cleanup_status["errors"].append({"path": full_path, "error": str(e)})
    except Exception as e:
        print(f"ERROR: JSON removal failed: {str(e)}")
        json_cleanup_status["errors"].append({"path": "global", "error": str(e)})
    finally:
        json_cleanup_status["running"] = False
        json_cleanup_status["current_folder"] = ""
        print(f"DEBUG: Finished JSON cleanup. Total inspected: {json_cleanup_status['inspected_count']}, Removed JSONs: {json_cleanup_status['removed_count']}, Removed no-ext binaries: {json_cleanup_status['removed_noext_count']}")

@app.post("/remove_json")
async def start_remove_json(request: RemoveJsonRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="Path not found")
    
    if json_cleanup_status["running"]:
        return {"status": "already_running"}
    
    background_tasks.add_task(perform_json_removal, request.path, request.remove_no_ext_binaries)
    return {"status": "started", "path": request.path}

@app.get("/remove_json/status")
async def get_remove_json_status():
    return json_cleanup_status

@app.post("/delete")
async def delete_files(request: DeleteRequest):
    deleted = []
    errors = []
    for path in request.paths:
        try:
            send2trash(path)
            deleted.append(path)
        except Exception as e:
            errors.append({"path": path, "error": str(e)})
    
    # Update scanner.duplicates after deletion
    # Simple way: just remove the deleted paths from the list
    new_duplicates = []
    for group in scanner_instance.duplicates:
        new_group = [p for p in group if p not in deleted and os.path.exists(p)]
        if len(new_group) > 1:
            new_duplicates.append(new_group)
    scanner_instance.duplicates = new_duplicates

    return {"deleted": deleted, "errors": errors}

@app.get("/validate_path")
async def validate_path(path: str):
    return {"valid": os.path.isdir(path)}

class RemovePrefixRequest(BaseModel):
    path: str
    prefixes: List[str]

prefix_removal_status = {
    "running": False,
    "inspected_count": 0,
    "renamed_count": 0,
    "errors": [],
    "path": "",
    "current_folder": ""
}

def perform_prefix_removal(path: str, prefixes: List[str]):
    global prefix_removal_status
    prefix_removal_status["running"] = True
    prefix_removal_status["inspected_count"] = 0
    prefix_removal_status["renamed_count"] = 0
    prefix_removal_status["errors"] = []
    prefix_removal_status["path"] = path
    prefix_removal_status["current_folder"] = ""

    try:
        for root, dirs, files in os.walk(path):
            prefix_removal_status["current_folder"] = root
            for file in files:
                prefix_removal_status["inspected_count"] += 1
                matched_prefix = next((p for p in prefixes if file.startswith(p)), None)
                if matched_prefix:
                    new_name = file[len(matched_prefix):]
                    if not new_name:
                        continue  # Stripping prefix would leave empty name, skip
                    old_path = os.path.join(root, file)
                    new_path = os.path.join(root, new_name)
                    if os.path.exists(new_path):
                        prefix_removal_status["errors"].append({"path": old_path, "error": f"Target '{new_name}' already exists"})
                        continue
                    try:
                        os.rename(old_path, new_path)
                        prefix_removal_status["renamed_count"] += 1
                    except Exception as e:
                        prefix_removal_status["errors"].append({"path": old_path, "error": str(e)})
    except Exception as e:
        prefix_removal_status["errors"].append({"path": "global", "error": str(e)})
    finally:
        prefix_removal_status["running"] = False
        prefix_removal_status["current_folder"] = ""

@app.post("/remove_prefix")
async def start_remove_prefix(request: RemovePrefixRequest, background_tasks: BackgroundTasks):
    if not os.path.exists(request.path):
        raise HTTPException(status_code=404, detail="Path not found")
    if prefix_removal_status["running"]:
        return {"status": "already_running"}
    valid_prefixes = [p.strip() for p in request.prefixes if p.strip()]
    if not valid_prefixes:
        raise HTTPException(status_code=400, detail="At least one prefix required")
    background_tasks.add_task(perform_prefix_removal, request.path, valid_prefixes)
    return {"status": "started", "path": request.path, "prefixes": valid_prefixes}

@app.get("/remove_prefix/status")
async def get_remove_prefix_status():
    return prefix_removal_status

@app.get("/file")
async def get_file(path: str):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File not found")
    # Verify extension is allowed media
    from scanner import MEDIA_EXTENSIONS
    if os.path.splitext(path)[1].lower() not in MEDIA_EXTENSIONS:
         raise HTTPException(status_code=400, detail="Not a supported media file")
    return FileResponse(path)

@app.get("/reveal")
async def reveal_file(path: str):
    if not os.path.exists(path):
         raise HTTPException(status_code=404, detail="File not found")
    try:
        # Windows specific 'Reveal in Explorer'
        subprocess.run(['explorer', '/select,', os.path.normpath(path)])
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
