# 将中文变量字体切成多个 unicode-range 切片，浏览器按需下载。
# 用法: python scripts/font-slices.py
import os
import subprocess
import sys

SRC = 'assets/fonts/ShangguSansSC-VF.woff2'
OUT_DIR = 'assets/fonts/sc'
CHUNK = 1000

ranges = []
ranges.append((0x0020, 0x007E))
ranges.append((0x3000, 0x303F))
ranges.append((0xFF00, 0xFFEF))
pos = 0x4E00
while pos <= 0x9FA5:
    ranges.append((pos, min(pos + CHUNK - 1, 0x9FA5)))
    pos += CHUNK

os.makedirs(OUT_DIR, exist_ok=True)
for f in os.listdir(OUT_DIR):
    if f.endswith('.woff2'):
        os.remove(os.path.join(OUT_DIR, f))

blocks = []
total = 0
URL_TPL = "url(" + chr(36) + "{browser.runtime.getURL('/assets/fonts/sc/%s')}) format('woff2')"
for idx, (start, end) in enumerate(ranges):
    name = 'sans-%03d.woff2' % idx
    out = os.path.join(OUT_DIR, name)
    unicodes = 'U+%04X-%04X' % (start, end)
    subprocess.run([
        sys.executable, '-m', 'fontTools.subset', SRC,
        '--output-file=' + out,
        '--flavor=woff2',
        '--unicodes=' + unicodes,
        '--layout-features=*',
        '--no-hinting',
    ], check=True)
    size = os.path.getsize(out)
    total += size
    blocks.append(
        '  @font-face {\n'
        '    font-family: "ShangguSansSCVF";\n'
        '    src: ' + (URL_TPL % name) + ';\n'
        '    unicode-range: ' + unicodes + ';\n'
        '  }'
    )
    print('%s: %.1f KB (%s)' % (name, size / 1024, unicodes))

header = "/** 由 scripts/font-slices.py 生成，请勿手改 */\nimport browser from 'webextension-polyfill'\n\nexport const FONT_SLICE_CSS = `\n"
css = header + '\n'.join(blocks) + '\n`\n'
with open('src/styles/fontSlices.ts', 'w', encoding='utf-8') as f:
    f.write(css)
print('total: %.1f KB in %d slices' % (total / 1024, len(ranges)))