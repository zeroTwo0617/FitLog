#!/usr/bin/env python3
# 将 fitness-exercise-library 技能的原始数据(exercises.json, ~15.8MB, 6 国语言)
# 精简为小程序可用的中文预设动作库：仅保留必要字段 + 中文分步做法 + 中文译名(nameZh)。
# 输出：data/exercises.preset.js (module.exports = [...])，每条含 nameZh（规则组合生成，覆盖不到回退英文原名）
import json
import os
import re

SRC = r"C:\Users\86151\.workbuddy\skills\fitness-exercise-library\assets\exercises.json"
OUT = r"E:\WorkBuddy\fitness-miniprogram\data\exercises.preset.js"

# ---- 离线中英术语词典（部位/器械/目标肌群/修饰/动作）----
EQUIP = {
    'body weight': '自重', 'bodyweight': '自重', 'dumbbell': '哑铃', 'barbell': '杠铃',
    'kettlebell': '壶铃', 'cable': '绳索', 'band': '弹力带', 'ties': '弹力带', 'rope': '绳',
    'machine': '器械', 'leverage machine': '器械', 'smith machine': '史密斯',
    'stability ball': '瑞士球', 'exercise ball': '健身球', 'medicine ball': '药球',
    'e-z bar': '曲杆', 'ez barbell': '曲杆', 'roller': '泡沫轴', 'plate': '杠片',
    'weighted': '负重', 'none': '', 'other': ''
}
BODYPART = {
    'chest': '胸', 'back': '背', 'shoulders': '肩', 'upper arms': '手臂', 'lower arms': '前臂',
    'upper legs': '腿', 'lower legs': '小腿', 'waist': '腰', 'cardio': '有氧', 'neck': '颈', 'hips': '髋'
}
TARGET = {
    'pectorals': '胸', 'biceps': '二头', 'triceps': '三头', 'delts': '肩', 'glutes': '臀',
    'abs': '腹', 'lats': '背阔', 'quads': '股四头', 'hamstrings': '腘绳', 'calves': '小腿',
    'forearms': '前臂', 'traps': '斜方', 'upper back': '上背', 'lower back': '下背',
    'adductors': '内收', 'abductors': '外展', 'spine': '竖脊', 'hips': '髋', 'neck': '颈',
    'cardiovascular system': '心肺'
}
MOD = {
    'incline': '上斜', 'decline': '下斜', 'seated': '坐姿', 'standing': '站姿',
    'single-arm': '单臂', 'one-arm': '单臂', 'single-leg': '单腿', 'one-leg': '单腿',
    'alternating': '交替', 'alternate': '交替', 'wide': '宽距', 'narrow': '窄距', 'close': '窄距',
    'neutral': '对握', 'hammer': '锤式', 'reverse': '反', 'assisted': '助力',
    'deficit': '赤字', 'pause': '停顿', 'isometric': '静力', 'resistance': '抗阻'
}
STOP = {'to', 'a', 'the', 'on', 'with', 'and', 'of', 'for', 'from', 'into', 'up', 'down', 'or'}

# 动作短语 -> 中文模板(e=器械中文, b=部位中文, t=目标中文, m=修饰串)
MOVEMENTS = [
    ('leg press', lambda e, b, t, m: f"{m}腿举"),
    ('bench press', lambda e, b, t, m: f"{m}{e}卧推"),
    ('overhead press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('shoulder press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('military press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('push up', lambda e, b, t, m: f"{m}{b}俯卧撑"),
    ('pull up', lambda e, b, t, m: f"{m}{b}引体向上"),
    ('chin up', lambda e, b, t, m: f"{m}反握引体"),
    ('dip', lambda e, b, t, m: f"{m}{b}臂屈伸"),
    ('squat', lambda e, b, t, m: f"{m}{e}深蹲"),
    ('deadlift', lambda e, b, t, m: f"{m}{e}硬拉"),
    ('lunge', lambda e, b, t, m: f"{m}{e}弓步"),
    ('curl', lambda e, b, t, m: f"{m}{e}{t}弯举"),
    ('row', lambda e, b, t, m: f"{m}{e}划船"),
    ('lateral raise', lambda e, b, t, m: f"{m}{e}侧平举"),
    ('front raise', lambda e, b, t, m: f"{m}{e}前平举"),
    ('rear delt raise', lambda e, b, t, m: f"{m}{e}后束飞鸟"),
    ('calf raise', lambda e, b, t, m: f"{m}{e}提踵"),
    ('raise', lambda e, b, t, m: f"{m}{e}上举"),
    ('fly', lambda e, b, t, m: f"{m}{e}飞鸟"),
    ('crunch', lambda e, b, t, m: f"{m}{t or b}卷腹"),
    ('sit up', lambda e, b, t, m: f"{m}{t or b}仰卧起坐"),
    ('leg raise', lambda e, b, t, m: f"{m}{t or b}抬腿"),
    ('hip thrust', lambda e, b, t, m: f"{m}{e}臀推"),
    ('glute bridge', lambda e, b, t, m: f"{m}{e}臀桥"),
    ('plank', lambda e, b, t, m: f"{m}平板支撑"),
    ('twist', lambda e, b, t, m: f"{m}{t or b}转体"),
    ('extension', lambda e, b, t, m: f"{m}{t or b}伸展"),
    ('pullover', lambda e, b, t, m: f"{m}{e}颈后下拉"),
    ('kickback', lambda e, b, t, m: f"{m}{e}后踢"),
    ('press', lambda e, b, t, m: f"{m}{e}推举"),
    ('march', lambda e, b, t, m: f"{m}踏步"),
    ('climb', lambda e, b, t, m: f"{m}攀爬"),
    ('cycling', lambda e, b, t, m: f"{m}骑行"),
    ('jumping jack', lambda e, b, t, m: f"{m}开合跳"),
    ('burpee', lambda e, b, t, m: f"{m}波比跳"),
    ('run', lambda e, b, t, m: f"{m}跑步"),
]


def collect_zh_steps(steps_raw):
    if not steps_raw:
        return []
    zh = steps_raw.get("zh") if isinstance(steps_raw, dict) else None
    if isinstance(zh, str):
        return [zh]
    if isinstance(zh, list):
        return [str(x) for x in zh if x]
    if isinstance(zh, dict):
        return [str(v) for v in zh.values() if v]
    return []


def translate(name, equipment, body_part, target):
    nm = (name or '').lower()
    if not nm:
        return ''
    e = EQUIP.get((equipment or '').lower(), '') or ''
    b = BODYPART.get((body_part or '').lower(), '') or ''
    t = TARGET.get((target or '').lower(), '') or ''
    mods = ''.join(v for k, v in MOD.items() if re.search(r'\b' + re.escape(k) + r'\b', nm))
    for phrase, tmpl in MOVEMENTS:
        if re.search(r'\b' + re.escape(phrase) + r'\b', nm):
            out = tmpl(e, b, t, mods)
            if out:
                return out
    # 兜底：逐 token 映射（命中动作单 token 时只用其模板，避免与器械字段重复）
    toks = re.findall(r"[a-z\-]+", nm)
    mv_tok = next((tk for tk in toks if any(ph == tk for ph, _ in MOVEMENTS)), None)
    if mv_tok:
        tmpl = next(t for ph, t in MOVEMENTS if ph == mv_tok)
        return tmpl(e, b, t, mods)
    parts = []
    for tk in toks:
        if tk in STOP:
            continue
        if tk in EQUIP:
            parts.append(EQUIP[tk])
        elif tk in BODYPART:
            parts.append(BODYPART[tk])
        elif tk in TARGET:
            parts.append(TARGET[tk])
        elif tk in MOD:
            parts.append(MOD[tk])
    if parts:
        return ''.join(parts)
    return name  # 最终兜底：英文原名


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    out = []
    translated = 0
    for e in data:
        steps = e.get("instruction_steps") or {}
        name = e.get("name")
        name_zh = translate(name, e.get("equipment"), e.get("body_part"), e.get("target"))
        if name_zh and name_zh != name:
            translated += 1
        out.append({
            "id": e.get("id"),
            "name": name,
            "nameZh": name_zh or name,
            "bodyPart": e.get("body_part"),
            "equipment": e.get("equipment"),
            "target": e.get("target"),
            "category": e.get("category"),
            "steps": collect_zh_steps(steps),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("module.exports = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    size_kb = os.path.getsize(OUT) / 1024
    print(f"OK: wrote {len(out)} exercises -> {OUT} ({size_kb:.1f} KB)")
    print(f"中文译名覆盖: {translated}/{len(out)} ({translated * 100.0 / len(out):.1f}%)")


if __name__ == "__main__":
    main()
