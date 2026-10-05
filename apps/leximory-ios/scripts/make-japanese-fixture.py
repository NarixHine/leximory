#!/usr/bin/env python3
"""Reproducible, original Japanese text with ruby and several pages per chapter."""
from pathlib import Path
from zipfile import ZipFile, ZIP_STORED
output = Path(__file__).resolve().parents[1] / 'App/Resources/Ebooks/japanese-fixture.epub'
with ZipFile(output, 'w', compression=ZIP_STORED) as book:
    book.writestr('mimetype', 'application/epub+zip')
    book.writestr('META-INF/container.xml', '''<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>''')
    book.writestr('OPS/book.opf', '''<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">leximory-japanese-fixture</dc:identifier><dc:title>雨の庭</dc:title><dc:language>ja</dc:language><meta property="dcterms:modified">2026-10-05T00:00:00Z</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="one" href="one.xhtml" media-type="application/xhtml+xml"/><item id="two" href="two.xhtml" media-type="application/xhtml+xml"/></manifest><spine page-progression-direction="rtl"><itemref idref="one"/><itemref idref="two"/></spine></package>''')
    book.writestr('OPS/nav.xhtml', '''<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目次</title></head><body><nav epub:type="toc"><ol><li><a href="one.xhtml">第一章　雨の庭</a></li><li><a href="two.xhtml">第二章　朝の光</a></li></ol></nav></body></html>''')
    for file, title, ending in [('one', '第一章　雨の庭', '第一章の終わり。'), ('two', '第二章　朝の光', '第二章の終わり。')]:
        paragraphs = ['<p>窓の向こうに、<ruby>東京<rt>とうきょう</rt></ruby>の小さな庭が見えた。雨の音を聞きながら、静かに本を開いた。</p>']
        paragraphs += [f'<p>第{n}節。白い猫は木の下を歩いている。風が葉を揺らし、水の滴が光っていた。「今日も少しずつ読もう」と思った。<em>遠くの空</em>は明るく、庭には花の香りが満ちている。2026年、朝の記録。</p>' for n in range(1, 65)]
        paragraphs.append(f'<p>{ending}</p>')
        book.writestr(f'OPS/{file}.xhtml', '<html xmlns="http://www.w3.org/1999/xhtml" lang="ja"><head><title>' + title + '</title><style>html,body{writing-mode:horizontal-tb;direction:rtl}p{font-size:9px}</style></head><body><h1>' + title + '</h1>' + ''.join(paragraphs) + '</body></html>')
print(output.name)
