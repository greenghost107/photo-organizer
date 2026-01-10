from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict
import os
from scanner import scanner_instance
from send2trash import send2trash
import threading
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
    path: str

@app.get("/")
async def root():
    return {"message": "Dup Photo Locator API"}

@app.post("/scan")
async def start_scan(request: ScanRequest):
    if scanner_instance.scanning:
        return {"status": "already scanning"}
    
    # Run scan in a separate thread to not block FastAPI
    thread = threading.Thread(target=scanner_instance.scan, args=(request.path,))
    thread.start()
    return {"status": "started", "path": request.path}

@app.get("/status")
async def get_status():
    return {
        "scanning": scanner_instance.scanning,
        "progress": scanner_instance.progress,
        "total_files": scanner_instance.total_files
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
                group_info.append({
                    "path": path,
                    "name": os.path.basename(path),
                    "size": stat.st_size,
                    "modified": stat.st_mtime
                })
            except OSError:
                continue
        if group_info:
            results.append(group_info)
    return {"results": results}

class DeleteRequest(BaseModel):
    paths: List[str]

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
