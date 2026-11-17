#!/usr/bin/env python3
"""Run the actual Windows EXE against fake browsers in an isolated Wine prefix.

Requires a working 64-bit Wine prefix under /tmp; never modifies host browser
settings. This checks Win32 discovery/launch behavior, not Windows desktop UI.
"""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parent


def windows_path(path):
    return "Z:" + str(path.resolve()).replace("/", "\\")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wine", required=True)
    parser.add_argument("--prefix", type=Path, required=True)
    parser.add_argument("--cc", default="x86_64-w64-mingw32-gcc")
    args = parser.parse_args()
    prefix = args.prefix.resolve()
    if not prefix.is_relative_to(Path(tempfile.gettempdir()).resolve()) or not prefix.name.startswith("school-wine-"):
        raise SystemExit("Use a dedicated /tmp/school-wine-* prefix only.")
    env = dict(os.environ, WINEPREFIX=str(prefix), WINEDEBUG="-all", WINEARCH="win64")

    def wine(*command):
        # Wine background services may inherit stdout; a regular file avoids
        # waiting for their pipes to close after the tested process has exited.
        with tempfile.TemporaryFile() as output:
            result = subprocess.run([args.wine, *map(str, command)], env=env, stdout=output, stderr=output, timeout=55)
            if result.returncode:
                output.seek(0)
                raise AssertionError(f"Wine command failed ({result.returncode}): {output.read().decode(errors='replace')[-1200:]}")

    with tempfile.TemporaryDirectory(prefix="school-windows-check-") as directory:
        work = Path(directory)
        stub = work / "browser-stub.exe"
        subprocess.run([args.cc, "-Os", "-s", "-municode", "-static", str(ROOT / "browser-stub.c"), "-o", str(stub)], check=True)
        browsers = {}
        for name in ("msedge.exe", "chrome.exe"):
            target = work / "한글 브라우저 경로" / name
            target.parent.mkdir(exist_ok=True)
            shutil.copyfile(stub, target)
            browsers[name] = windows_path(target)
        log = work / "arguments.txt"
        env["SCHOOL_TEST_LOG"] = windows_path(log)
        exe = ROOT.parent.parent.parent / "downloads" / "School-Mercenaries.exe"
        assert exe.is_file()
        user_choice = "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice"
        app_root = "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\"
        cases = [
            ("Default Edge", "MSEdgeHTM", [], "msedge.exe", True),
            ("Default Chrome", "ChromeHTML", [], "chrome.exe", True),
            ("Explicit Edge", "ChromeHTML", ["--edge"], "msedge.exe", True),
            ("Explicit Chrome", "MSEdgeHTM", ["--chrome"], "chrome.exe", True),
            ("Missing Edge fallback", "MSEdgeHTM", [], "chrome.exe", False),
        ]
        for name, prog_id, flags, expected, edge_present in cases:
            lines = ["Windows Registry Editor Version 5.00", "", f"[{user_choice}]", f'"ProgId"="{prog_id}"', ""]
            for browser, path in browsers.items():
                lines += [f"[-{app_root}{browser}]", ""]
                if browser == "msedge.exe" and not edge_present:
                    continue
                # Quoted registry paths exercise stripping; the directory also
                # contains spaces and Korean characters.
                escaped = ('"' + path + '"').replace("\\", "\\\\").replace('"', '\\"')
                lines += [f"[{app_root}{browser}]", f'@="{escaped}"', ""]
            registry = work / "browsers.reg"
            registry.write_text("\r\n".join(lines), encoding="utf-16")
            wine("reg.exe", "import", windows_path(registry))
            log.unlink(missing_ok=True)
            wine(windows_path(exe), *flags)
            deadline = time.monotonic() + 5
            while not log.exists() and time.monotonic() < deadline:
                time.sleep(0.05)
            received = log.read_text(encoding="utf-8").splitlines()
            assert received == [browsers[expected], "--app=https://motracv.github.io/-/school.html?desktop=1", "--start-maximized", "--no-first-run"], received
            print(f"PASS {name}: real EXE → Unicode browser path → exact game app URL", flush=True)


if __name__ == "__main__":
    main()
