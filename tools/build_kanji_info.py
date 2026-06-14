# -*- coding: utf-8 -*-
"""KANJIDIC2 から小1・小2漢字(240字)の 音読み・訓読み・学年 を抽出する。

使い方: python build_kanji_info.py <kanjidic2.xml のパス>
出力:   tools/kanji_readings.json
        { "山": {"grade":1, "on":["サン"], "kun":["やま"]}, ... }
読みは権威データ(KANJIDIC2 © EDRDG, CC BY-SA 4.0)から取得し、AIの推測を排除する。
意味・例語・例文は別途 精査して付与する(このスクリプトの対象外)。
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

KANJI1 = ("一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森"
          "人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六")
KANJI2 = ("引羽雲園遠何科夏家歌画回会海絵外角楽活間丸岩顔汽記帰弓牛魚京強教近兄形計元言原戸"
          "古午後語工公広交光考行高黄合谷国黒今才細作算止市矢姉思紙寺自時室社弱首秋週春書少"
          "場色食心新親図数西声星晴切雪船線前組走多太体台地池知茶昼長鳥朝直通弟店点電刀冬当"
          "東答頭同道読内南肉馬売買麦半番父風分聞米歩母方北毎妹万明鳴毛門夜野友用曜来里理話")

TARGET = {ch: (1 if ch in KANJI1 else 2) for ch in (KANJI1 + KANJI2)}


def clean_on(readings):
    """音読み: 接頭/接尾形(- 付き)を除き、カタカナのみ。最大3つ。"""
    out = []
    for r in readings:
        if r.startswith('-') or r.endswith('-'):
            continue
        if not re.fullmatch(r'[ァ-ヴー]+', r):
            continue
        if r not in out:
            out.append(r)
    return out[:3]


def clean_kun(readings):
    """訓読み: 接頭/接尾形を除く。送り仮名の「.」は保持(UI で淡色表示)。最大4つ。"""
    out = []
    for r in readings:
        if r.startswith('-') or r.endswith('-'):
            continue
        if r not in out:
            out.append(r)
    return out[:4]


def main(xml_path):
    tree = ET.parse(xml_path)
    root = tree.getroot()
    result = {}
    for ch in root.findall('character'):
        lit = ch.findtext('literal')
        if lit not in TARGET:
            continue
        grade = None
        misc = ch.find('misc')
        if misc is not None:
            g = misc.findtext('grade')
            if g:
                grade = int(g)
        on, kun = [], []
        rm = ch.find('reading_meaning')
        if rm is not None:
            for grp in rm.findall('rmgroup'):
                for rd in grp.findall('reading'):
                    t = rd.get('r_type')
                    if t == 'ja_on':
                        on.append(rd.text)
                    elif t == 'ja_kun':
                        kun.append(rd.text)
        result[lit] = {
            'grade': grade or TARGET[lit],
            'on': clean_on(on),
            'kun': clean_kun(kun),
        }

    missing = [ch for ch in TARGET if ch not in result]
    out_path = Path(__file__).resolve().parent / 'kanji_readings.json'
    # 教育課程順 (KANJI1 → KANJI2) を保つ
    ordered = {ch: result[ch] for ch in (KANJI1 + KANJI2) if ch in result}
    out_path.write_text(json.dumps(ordered, ensure_ascii=False, indent=0), encoding='utf-8')
    print(f"{out_path.name}: {len(ordered)} 字")
    g1 = sum(1 for c in ordered if ordered[c]['grade'] == 1)
    print(f"  grade1={sum(1 for c in KANJI1 if c in ordered)} grade2={sum(1 for c in KANJI2 if c in ordered)} (kanjidic grade1 tag={g1})")
    if missing:
        print('MISSING:', ''.join(missing))
        sys.exit(1)
    # サンプル表示
    for c in ['一', '山', '学', '上', '生', '気']:
        if c in ordered:
            print(f"  {c}: on={ordered[c]['on']} kun={ordered[c]['kun']}")


if __name__ == '__main__':
    main(sys.argv[1])
