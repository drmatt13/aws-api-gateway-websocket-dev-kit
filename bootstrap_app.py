#!/usr/bin/env python3
import os
import sys
import shutil
import subprocess
from pathlib import Path

SKIP_DIRS = {
    "node_modules",
    ".git",
    ".next",
    "dist",
    "build",
    "coverage",
    ".turbo",
    ".nx",
    ".cache",
    ".venv",
    "venv",
}

def resolve_npm():
    candidates = ["npm.cmd", "npm"] if os.name == "nt" else ["npm"]

    for candidate in candidates:
        resolved = shutil.which(candidate)
        if resolved:
            return resolved

    return None

def find_package_dirs(root: Path):
    package_dirs = []
    for current_root, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        if "package.json" in files:
            package_dirs.append(Path(current_root))
    return sorted(package_dirs)

def run_install(pkg_dir: Path, npm_path: str):
    print(f"\n=== Running npm install in: {pkg_dir} ===")
    result = subprocess.run([npm_path, "install"], cwd=pkg_dir)
    return result.returncode

def main():
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()

    if not root.is_dir():
        print(f"Invalid directory: {root}")
        sys.exit(1)

    npm_path = resolve_npm()
    if not npm_path:
        print("Could not find npm in PATH.")
        sys.exit(127)

    print(f"Scanning for package.json files under: {root}")
    print(f"Resolved npm: {npm_path}")

    package_dirs = find_package_dirs(root)
    print(f"Found {len(package_dirs)} package.json file(s):")
    for d in package_dirs:
        print(f" - {d}")

    failures = []
    for pkg_dir in package_dirs:
        code = run_install(pkg_dir, npm_path)
        if code != 0:
            failures.append((pkg_dir, code))

    print("\n=== Done ===")
    if failures:
        print("Some installs failed:")
        for pkg_dir, code in failures:
            print(f" - {pkg_dir} (exit code {code})")
        sys.exit(1)

    print("All installs completed successfully.")

if __name__ == "__main__":
    main()