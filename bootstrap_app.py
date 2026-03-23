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
    ".framework-blueprint",
}

BLUEPRINT_DIR_NAME = ".framework-blueprint"


# ---------------------------------------------------------------------------
# Framework selection
# ---------------------------------------------------------------------------

def ask_framework() -> str:
    valid = {"aws-cdk", "aws-sam"}
    while True:
        choice = input(
            "\nWhich AWS development framework are you using? [aws-cdk | aws-sam]: "
        ).strip().lower()
        if choice in valid:
            return choice
        print(f"  Invalid choice '{choice}'. Please enter 'aws-cdk' or 'aws-sam'.")


# ---------------------------------------------------------------------------
# Scaffolding
# ---------------------------------------------------------------------------

def scaffold_project(root: Path, blueprint_dir: Path, framework: str) -> None:
    print("\n=== Scaffolding project from .framework-blueprint ===")

    app_dir_name    = "cdk-app"          if framework == "aws-cdk" else "sam-app"
    lambda_dir_name = "lambda_functions" if framework == "aws-cdk" else "src"

    # Destinations that must not already exist before we start copying
    guard_paths = [
        root / app_dir_name,
        root / "frontend-ws-connection-and-payload-tester",
        root / "local-ws-dev-server",
    ]

    conflicts = [p for p in guard_paths if p.exists()]
    if conflicts:
        print("\nError: The following paths already exist. Aborting to prevent data loss:")
        for p in conflicts:
            print(f"  - {p}")
        print("\nRemove or rename these directories before running bootstrap_app.py again.")
        sys.exit(1)

    # 1. Copy the framework app directory (cdk-app or sam-app)
    src  = blueprint_dir / app_dir_name
    dest = root / app_dir_name
    print(f"  Copying {src.name} -> {dest}")
    shutil.copytree(src, dest)

    # 2. Copy frontend tester
    src  = blueprint_dir / "frontend-ws-connection-and-payload-tester"
    dest = root / "frontend-ws-connection-and-payload-tester"
    print(f"  Copying {src.name} -> {dest}")
    shutil.copytree(src, dest)

    # 3. Copy local dev server
    src  = blueprint_dir / "local-ws-dev-server"
    dest = root / "local-ws-dev-server"
    print(f"  Copying {src.name} -> {dest}")
    shutil.copytree(src, dest)

    # 4. Copy template lambda functions into the app directory under the correct name
    src  = blueprint_dir / "template-lambda-functions"
    dest = root / app_dir_name / lambda_dir_name
    print(f"  Copying template-lambda-functions -> {dest} (as '{lambda_dir_name}')")
    shutil.copytree(src, dest)

    print("  Scaffolding complete.")


# ---------------------------------------------------------------------------
# Patch local-ws-dev-server/src/index.ts with lambda import statements
# ---------------------------------------------------------------------------

def patch_index_ts(root: Path, framework: str) -> None:
    index_ts = root / "local-ws-dev-server" / "src" / "index.ts"

    if not index_ts.exists():
        print(f"\nWarning: {index_ts} not found — skipping import patch.")
        return

    app_dir    = "cdk-app"          if framework == "aws-cdk" else "sam-app"
    lambda_dir = "lambda_functions" if framework == "aws-cdk" else "src"
    label      = f"{app_dir}/{lambda_dir} directory"

    import_block = (
        f"// =======================================\n"
        f"//  Load Your Lambda Functions from the {label}\n"
        f"// =======================================\n"
        f'import {{ lambdaHandler as $connectRouteKeyLambdaHandler }} from'
        f' "../../{app_dir}/{lambda_dir}/connect-route-function/index";\n'
        f'import {{ lambdaHandler as customActionRouteKeyLambdaHandler }} from'
        f' "../../{app_dir}/{lambda_dir}/customAction-route-function/index";\n'
        f'import {{ lambdaHandler as $disconnectRouteKeyLambdaHandler }} from'
        f' "../../{app_dir}/{lambda_dir}/disconnect-route-function/index";\n'
        f'import {{ lambdaHandler as $defaultRouteKeyLambdaHandler }} from'
        f' "../../{app_dir}/{lambda_dir}/default-route-function/index";\n'
        f'import {{ lambdaHandler as customAuthorizerLambdaHandler }} from'
        f' "../../{app_dir}/{lambda_dir}/authorizer-function/index";\n'
    )

    content = index_ts.read_text(encoding="utf-8")

    # Insert the block immediately before the first real import line
    marker = 'import { createServer } from "http";'
    if marker not in content:
        print(f"\nWarning: Insertion marker not found in {index_ts} — skipping import patch.")
        return

    patched = content.replace(marker, import_block + "\n" + marker, 1)
    index_ts.write_text(patched, encoding="utf-8")

    print(f"\n=== Patched local-ws-dev-server/src/index.ts with lambda import statements ===")


# ---------------------------------------------------------------------------
# Patch nodemon.json watch path (CDK uses lambda_functions, not src)
# ---------------------------------------------------------------------------

def patch_nodemon_json(root: Path, framework: str) -> None:
    if framework != "aws-cdk":
        return

    nodemon_json = root / "local-ws-dev-server" / "nodemon.json"
    if not nodemon_json.exists():
        return

    content = nodemon_json.read_text(encoding="utf-8")
    patched = content.replace('"../sam-app/src"', '"../cdk-app/lambda_functions"')
    if patched != content:
        nodemon_json.write_text(patched, encoding="utf-8")
        print("  Patched local-ws-dev-server/nodemon.json watch path for aws-cdk.")


# ---------------------------------------------------------------------------
# npm install helpers (original functionality)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()

    if not root.is_dir():
        print(f"Invalid directory: {root}")
        sys.exit(1)

    blueprint_dir = root / BLUEPRINT_DIR_NAME
    if not blueprint_dir.is_dir():
        print(f"Error: {BLUEPRINT_DIR_NAME} directory not found at {blueprint_dir}")
        sys.exit(1)

    # Step 1: Ask which framework to use
    framework = ask_framework()
    print(f"\nSelected framework: {framework}")

    # Step 2: Scaffold project directories from blueprint
    scaffold_project(root, blueprint_dir, framework)

    # Step 3: Patch lambda import statements into local-ws-dev-server/src/index.ts
    patch_index_ts(root, framework)

    # Step 4: Patch nodemon.json watch path (CDK only)
    patch_nodemon_json(root, framework)

    # Step 5: Run npm install across the monorepo (skips .framework-blueprint)
    npm_path = resolve_npm()
    if not npm_path:
        print("Could not find npm in PATH.")
        sys.exit(127)

    print(f"\nScanning for package.json files under: {root}")
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