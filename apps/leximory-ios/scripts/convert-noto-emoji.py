#!/usr/bin/env python3
"""Convert upstream Noto CBDT artwork to Apple's sbix format, retaining cmap and GSUB.

Usage: python3 scripts/convert-noto-emoji.py /path/to/NotoColorEmoji.ttf
Requires fontTools. Upstream: googlefonts/noto-emoji, 2D/fonts/NotoColorEmoji.ttf.
"""
import argparse
import hashlib
from pathlib import Path

from fontTools.ttLib import TTFont, newTable
from fontTools.ttLib.tables.sbixStrike import Strike
from fontTools.ttLib.tables.sbixGlyph import Glyph
from fontTools.pens.ttGlyphPen import TTGlyphPen
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("source", type=Path)
parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "App/Resources/Fonts/LeximoryNotoColorEmoji.ttf")
args = parser.parse_args()
expected = "15671215ab769fdc7162a045d56fd7d7e477c51b04e6b3c761d914d8fdd6cc44"
if hashlib.sha256(args.source.read_bytes()).hexdigest() != expected:
    parser.error("Unexpected upstream font. Review the font and update the pinned digest before converting.")
f=TTFont(args.source)
sbix=newTable('sbix'); sbix.version=1; sbix.flags=1; sbix.strikes={}
for source, data in zip(f['CBLC'].strikes, f['CBDT'].strikeData):
 strike=Strike(ppem=source.bitmapSizeTable.ppemY)
 for name, bitmap in data.items():
  bitmap.ensureDecompiled(); m=bitmap.metrics
  strike.glyphs[name]=Glyph(glyphName=name, originOffsetX=m.BearingX, originOffsetY=m.BearingY-m.height, graphicType='png ', imageData=bitmap.imageData)
 sbix.strikes[strike.ppem]=strike
f['sbix']=sbix
for tag in ['CBDT','CBLC']: del f[tag]
f['glyf']=newTable('glyf'); f['glyf'].glyphs={n:TTGlyphPen(None).glyph() for n in f.getGlyphOrder()}; f['glyf'].glyphOrder=f.getGlyphOrder()
f['loca']=newTable('loca')
f['maxp']=newTable('maxp'); f['maxp'].tableVersion=0x10000; f['maxp'].numGlyphs=len(f.getGlyphOrder())
for k in ['maxPoints','maxContours','maxCompositePoints','maxCompositeContours','maxZones','maxTwilightPoints','maxStorage','maxFunctionDefs','maxInstructionDefs','maxStackElements','maxSizeOfInstructions','maxComponentElements','maxComponentDepth']: setattr(f['maxp'],k,0)
f['maxp'].maxZones=1
for n in f['name'].names:
 if n.nameID in [1,4,6]: n.string={1:'Leximory Noto Color Emoji',4:'Leximory Noto Color Emoji',6:'LeximoryNotoColorEmoji'}[n.nameID].encode(n.getEncoding())
f.save(args.output)
