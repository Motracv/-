#!/usr/bin/env python3
"""Build a small portable Windows launcher with MinGW-w64 (no external runtime)."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import zipfile

VERSION = "1.0.0"
ROOT = Path(__file__).resolve().parent
REPO = ROOT.parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--cc", default="x86_64-w64-mingw32-gcc")
    parser.add_argument("--windres", default="x86_64-w64-mingw32-windres")
    parser.add_argument("--output", type=Path, default=REPO / "downloads")
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="school-windows-") as temp:
        resource = Path(temp) / "app.o"
        exe = Path(temp) / "School-Mercenaries.exe"
        subprocess.run([args.windres, "--codepage=65001", "--preprocessor=" + args.cc,
                        "--preprocessor-arg=-E", "--preprocessor-arg=-xc", "--preprocessor-arg=-DRC_INVOKED",
                        "-i", "app.rc", "-o", str(resource)], cwd=ROOT, check=True)
        subprocess.run([args.cc, "-std=c11", "-Os", "-s", "-Wall", "-Wextra", "-Werror",
                        "-municode", "-mwindows", "-static", "-static-libgcc",
                        "-Wl,--no-insert-timestamp,--dynamicbase,--nxcompat,--high-entropy-va",
                        "launcher.c", str(resource), "-ladvapi32", "-lshell32", "-luser32",
                        "-o", str(exe)], cwd=ROOT, check=True)
        archive = args.output / f"School-Mercenaries-Windows-{VERSION}.zip"
        exe_bytes = exe.read_bytes()
        files = {
            "School-Mercenaries.exe": exe_bytes,
            "먼저 읽어주세요.txt": b"\xef\xbb\xbf" + (ROOT / "사용방법.txt").read_bytes(),
        }
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as out:
            for name, data in files.items():
                item = zipfile.ZipInfo(name, date_time=(2026, 11, 18, 0, 0, 0))
                item.compress_type = zipfile.ZIP_DEFLATED
                item.external_attr = 0o100644 << 16
                out.writestr(item, data)
        (args.output / "School-Mercenaries.exe").write_bytes(exe_bytes)
        artifacts = [archive, args.output / "School-Mercenaries.exe"]
        checksums = "".join(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n" for p in artifacts)
        (args.output / "SHA256SUMS.txt").write_text(checksums, encoding="ascii")
        print(json.dumps({"version": VERSION, "artifacts": [{"file": p.name, "bytes": p.stat().st_size} for p in artifacts]}, indent=2))


if __name__ == "__main__":
    main()
