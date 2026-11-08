"""Run Tesseract on one specimen or upload and return the text.

Preprocessing is local. No document leaves this machine.
"""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps


def prepare(image: Image.Image) -> Image.Image:
    grey = ImageOps.autocontrast(image.convert("L"))
    scaled = grey.resize((grey.width * 2, grey.height * 2), Image.Resampling.LANCZOS)
    return ImageEnhance.Contrast(scaled).enhance(1.5)


def tesseract(image: Image.Image, psm: str = "6") -> str:
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as handle:
        image.save(handle.name)
        path = handle.name
    completed = subprocess.run(
        ["tesseract", path, "stdout", "--psm", psm],
        check=False,
        capture_output=True,
        text=True,
    )
    Path(path).unlink(missing_ok=True)
    return completed.stdout or ""


def useful(text: str) -> bool:
    lowered = text.lower()
    return any(token in lowered for token in ("gstin", "udyam", "bill date", "syn-id", "signatory"))


def extract(path: Path) -> dict:
    image = Image.open(path)
    prepared = prepare(image)
    attempts = []
    for angle in (0, 180, 90, 270):
        rotated = prepared.rotate(angle, expand=True) if angle else prepared
        text = tesseract(rotated, "6")
        attempts.append({"orientation": angle, "psm": 6, "chars": len(text)})
        if useful(text):
            return {"text": text, "orientation": angle, "psm": 6, "attempts": attempts}
    # Last try on the original orientation with a different page segmentation.
    text = tesseract(prepared, "4")
    attempts.append({"orientation": 0, "psm": 4, "chars": len(text)})
    return {"text": text, "orientation": 0, "psm": 4, "attempts": attempts}


def main() -> None:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: ocr.py <image>"}))
        sys.exit(2)
    result = extract(Path(sys.argv[1]))
    sys.stdout.write(json.dumps(result))


if __name__ == "__main__":
    main()
