# 生成 ShangguSans 的子集字体：GB2312 常用汉字 + ASCII + 常用全角符号
# 用法: python scripts/font-subset.py
import subprocess
import sys

chars = set()
# GB2312 汉字与符号区
for hi in range(0xB0, 0xF8):
    for lo in range(0xA1, 0xFF):
        try:
            chars.add(bytes([hi, lo]).decode('gb2312'))
        except UnicodeDecodeError:
            pass
# ASCII
chars.update(chr(c) for c in range(0x20, 0x7F))
# 常用中文标点与全角符号
chars.update('，。、；：？！“”‘’（）【】《》…—～·　￥€£©®™°±×÷≤≥≠≈∞√∑∏∫←→↑↓')
# 常用制表/省略号
chars.update('⋯◦▪▫■□●○◆◇★☆♠♣♥♦')

text = ''.join(sorted(chars))
with open('scripts/font-subset-chars.txt', 'w', encoding='utf-8') as f:
    f.write(text)
print('chars:', len(text))

subprocess.run([
    sys.executable, '-m', 'fontTools.subset',
    'assets/fonts/ShangguSansSC-VF.woff2',
    '--output-file=assets/fonts/ShangguSansSC-VF.woff2.tmp',
    '--flavor=woff2',
    '--text-file=scripts/font-subset-chars.txt',
    '--layout-features=*',
    '--desubroutinize',
    '--no-hinting',
], check=True)
import os
print('orig KB:', round(os.path.getsize('assets/fonts/ShangguSansSC-VF.woff2') / 1024, 1))
print('subset KB:', round(os.path.getsize('assets/fonts/ShangguSansSC-VF.woff2.tmp') / 1024, 1))
