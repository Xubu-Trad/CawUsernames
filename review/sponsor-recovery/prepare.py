"""Fetch only pinned public source inputs; verify bytes before writing."""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen

root = Path(__file__).resolve().parent
for item in json.loads((root / "sources.json").read_text()):
    name = item["file"]
    if name not in {"source.ts", "current.ts", "runServices.ts"}:
        raise ValueError("unexpected output name")
    url = item["url"]
    if not url.startswith("https://raw.githubusercontent.com/GilgameshCaw/Caw/"):
        raise ValueError("unexpected source host")
    destination = root / name
    if destination.exists():
        data = destination.read_bytes()
    else:
        with urlopen(url, timeout=30) as response:
            data = response.read(1024 * 1024 + 1)
    if len(data) > 1024 * 1024:
        raise ValueError("source exceeds limit")
    if hashlib.sha256(data).hexdigest() != item["sha256"]:
        raise ValueError("source hash mismatch: " + name)
    if not destination.exists():
        with destination.open("xb") as output:
            output.write(data)
    print("verified", name)
