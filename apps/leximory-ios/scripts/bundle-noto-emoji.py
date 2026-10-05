#!/usr/bin/env python3
"""Rename upstream monochrome Noto Emoji artwork for the text-cover font.

Usage: python3 scripts/bundle-noto-emoji.py /path/to/NotoEmoji-Regular.ttf
Requires fontTools. Upstream: Google Fonts static "Noto Emoji" Regular,
https://fonts.google.com/noto/specimen/Noto+Emoji (google/fonts ofl/notoemoji).
"""
import argparse
import hashlib
from pathlib import Path

from fontTools.ttLib import TTFont

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "App/Resources/Fonts/LeximoryNotoEmoji.ttf")
args = parser.parse_args()
expected = "988621dc5c9a75eb6144f28faae30317a8e3421b68b28740747b3d739e2326b8"
if hashlib.sha256(args.source.read_bytes()).hexdigest() != expected:
    parser.error("Unexpected upstream font. Review the font and update the pinned digest before bundling.")
font = TTFont(args.source)
names = {1: "Leximory Noto Emoji", 3: "1.000;LEXI;LeximoryNotoEmoji", 4: "Leximory Noto Emoji", 6: "LeximoryNotoEmoji"}
for record in font["name"].names:
    if record.nameID in names:
        record.string = names[record.nameID].encode(record.getEncoding())
font.save(args.output)
