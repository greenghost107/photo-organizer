"""
Build script: compiles the React frontend, copies it into backend/static,
then packages everything with PyInstaller into a single .exe.
"""

import os
import sys
import shutil
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(ROOT, "frontend")
FRONTEND_DIST = os.path.join(FRONTEND_DIR, "dist")
BACKEND_DIR = os.path.join(ROOT, "backend")
STATIC_DIR = os.path.join(BACKEND_DIR, "static")


def run(cmd, cwd=None):
    print(f"\n>>> {cmd}")
    result = subprocess.run(cmd, shell=True, cwd=cwd)
    if result.returncode != 0:
        print(f"ERROR: command failed with exit code {result.returncode}")
        sys.exit(result.returncode)


def main():
    # 1. Build React frontend
    print("\n=== Building frontend ===")
    run("npm install", cwd=FRONTEND_DIR)
    run("npm run build", cwd=FRONTEND_DIR)

    # 2. Copy dist into backend/static
    print("\n=== Copying frontend dist to backend/static ===")
    if os.path.exists(STATIC_DIR):
        shutil.rmtree(STATIC_DIR)
    shutil.copytree(FRONTEND_DIST, STATIC_DIR)
    print(f"Copied {FRONTEND_DIST} -> {STATIC_DIR}")

    # 3. Run PyInstaller
    print("\n=== Running PyInstaller ===")
    dist_dir = os.path.join(ROOT, "dist")
    pyinstaller_cmd = (
        "python -m PyInstaller "
        "--onefile "
        "--noconsole "
        '--name "DupPhotoLocator" '
        '--add-data "static;static" '
        '--add-data "scanner.py;." '
        "--hidden-import pystray._win32 "
        "--hidden-import PIL._imagingtk "
        f'--distpath "{dist_dir}" '
        "main.py"
    )
    run(pyinstaller_cmd, cwd=BACKEND_DIR)

    exe_path = os.path.join(dist_dir, "DupPhotoLocator.exe")
    if os.path.exists(exe_path):
        print(f"\n=== Build successful ===")
        print(f"Output: {exe_path}")
    else:
        print("\nERROR: exe not found after build")
        sys.exit(1)


if __name__ == "__main__":
    main()
