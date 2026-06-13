# -*- coding: utf-8 -*-
"""KanjiVG の all.zip から書き順データを抽出し、アプリ用の data/*.js を生成する。

使い方: python build_data.py <kanjivg-all.zip のパス>
出力:   ../data/hiragana.js, katakana.js, kanji1.js, kanji2.js
データ: const XXX_DATA = { "あ": {"strokes": ["M...", ...], "numbers": [[x,y], ...]}, ... }
        strokes: 書き順どおりの SVG パス d 属性 (viewBox 0 0 109 109)
        numbers: 各画の番号ラベル表示位置 [x, y]
ライセンス: KanjiVG © Ulrich Apel (CC BY-SA 3.0) https://kanjivg.tagaini.net
"""
import io
import json
import re
import sys
import zipfile
from pathlib import Path

HIRAGANA = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん"
KATAKANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン"
KANJI1 = ("一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森"
          "人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六")
KANJI2 = ("引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸"
          "古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少"
          "場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当"
          "東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話")

CATEGORIES = [
    ("hiragana", "HIRAGANA_DATA", HIRAGANA),
    ("katakana", "KATAKANA_DATA", KATAKANA),
    ("kanji1", "KANJI1_DATA", KANJI1),
    ("kanji2", "KANJI2_DATA", KANJI2),
]

RE_PATH = re.compile(r'<path[^>]*\bd="([^"]+)"')
RE_NUM = re.compile(r'<text transform="matrix\([^)]*?([\d.]+)\s+([\d.]+)\)"[^>]*>(\d+)</text>')


def extract(svg_text):
    strokes = RE_PATH.findall(svg_text)
    nums = [(int(n), round(float(x), 1), round(float(y), 1))
            for x, y, n in RE_NUM.findall(svg_text)]
    nums.sort()
    numbers = [[x, y] for _, x, y in nums]
    return strokes, numbers


def main(zip_path):
    out_dir = Path(__file__).resolve().parent.parent / "data"
    out_dir.mkdir(exist_ok=True)
    zf = zipfile.ZipFile(zip_path)
    # zip 内のパス → 基本ファイル名 (変種 -Kaisho 等は除外し、素の 0xxxx.svg のみ)
    index = {}
    for name in zf.namelist():
        base = name.rsplit("/", 1)[-1]
        if re.fullmatch(r"[0-9a-f]{5}\.svg", base):
            index[base] = name

    missing = []
    for key, const_name, chars in CATEGORIES:
        entries = []
        for ch in chars:
            base = f"{ord(ch):05x}.svg"
            if base not in index:
                missing.append(ch)
                continue
            svg = zf.read(index[base]).decode("utf-8")
            strokes, numbers = extract(svg)
            if not strokes or len(strokes) != len(numbers):
                print(f"WARN {ch}: strokes={len(strokes)} numbers={len(numbers)}")
            obj = {"strokes": strokes, "numbers": numbers}
            entries.append(f'"{ch}":' + json.dumps(obj, ensure_ascii=False, separators=(",", ":")))
        js = (f"// 自動生成: tools/build_data.py (KanjiVG r20250816 由来)\n"
              f"// 書き順データ: KanjiVG © Ulrich Apel (CC BY-SA 3.0) https://kanjivg.tagaini.net\n"
              f"const {const_name} = {{\n" + ",\n".join(entries) + "\n};\n")
        path = out_dir / f"{key}.js"
        path.write_text(js, encoding="utf-8")
        print(f"{path.name}: {len(entries)} 字, {path.stat().st_size // 1024} KB")

    if missing:
        print("MISSING:", "".join(missing))
        sys.exit(1)
    print("OK: 全文字抽出完了")


if __name__ == "__main__":
    main(sys.argv[1])
