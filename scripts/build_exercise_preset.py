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
    'weighted': '负重', 'none': '', 'other': '', 'upper body ergometer': '上肢功率车',
    'tire': '轮胎', 'skierg machine': '滑雪机', 'stepmill machine': '楼梯机', 'wheel roller': '健腹轮'
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
    'deficit': '赤字', 'pause': '停顿', 'isometric': '静力', 'resistance': '抗阻',
    # 解剖/姿态/方向类修饰
    'finger': '手指', 'toe': '脚尖', 'heel': '脚跟', 'knee': '膝', 'ankle': '踝',
    'wrist': '腕', 'elbow': '肘', 'cross': '交叉', 'side': '侧', 'straight': '直',
    'bent': '屈', 'prone': '俯卧', 'supine': '仰卧', 'lying': '卧', 'hanging': '悬垂',
    'circular': '环', 'double': '双', 'forward': '前', 'backward': '后', 'astride': '分腿',
    'half': '半', 'diamond': '钻石', 'clock': '时钟', 'clasped': '交叉', 'balance': '平衡',
    'box': '箱', 'frog': '蛙式', 'air': '空中', 'pike': '折叠', 'tuck': '团身',
    'single': '单', 'quarter': '四分之三', 'full': '全',
    # 第二批修饰
    'front': '前', 'parallel': '对握', 'gripless': '无握', 'rotary': '旋转',
    'overhead': '过顶', 'twin handle': '双手柄', 'quick': '快速', 'vertical': '垂直',
    'wall': '墙', 'feet': '脚', 'v.': '', 'version': ''
}
STOP = {'to', 'a', 'the', 'on', 'with', 'and', 'of', 'for', 'from', 'into', 'up', 'down', 'or'}

# SPECIAL：体操/瑜伽/有氧等专有名词，整体短语优先匹配（含复数容错）
SPECIAL = [
    ('mountain climber', '登山者'),
    ('front lever', '前水平'),
    ('back lever', '后水平'),
    ('human flag', '人体旗帜'),
    ('full planche', '俄式挺身'),
    ('planche', '俄式挺身'),
    ('maltese', '马耳他'),
    ('l sit', 'L支撑'),
    ('v sit', 'V字支撑'),
    ('dead bug', '死虫式'),
    ('bird dog', '鸟狗式'),
    ('cocoon', '茧式'),
    ('superman', '超人式'),
    ('hollow', '空心支撑'),
    ('handstand', '倒立'),
    ('wall sit', '靠墙静蹲'),
    ('butterfly yoga pose', '蝴蝶式'),
    ('bear crawl', '熊爬'),
    ('battling rope', '战绳'),
    ('battle rope', '战绳'),
    ('cross trainer', '椭圆机'),
    ('farmers walk', '农夫行走'),
    ('air bike', '空中自行车'),
    ('hands bike', '手自行车'),
    ('elevator', '引体上升'),
    ('gironda sternum chin', '吉隆达引体'),
    ('gorilla chin', '大猩猩引体'),
    ('flutter kick', '交替踢腿'),
    ('butt up', '臀上抬'),
    ('bridge', '桥'),
    ('flag', '人体旗帜'),
    # 第二批：举重/体操/瑜伽/有氧/投掷
    ('muscle up', '双力臂'),
    ('kipping muscle up', '摆荡双力臂'),
    ('skin the cat', '猫式悬垂'),
    ('upward facing dog', '上犬式'),
    ('sphinx', '狮身人面式'),
    ('inchworm', '尺蠖'),
    ('wheel rollerout', '健腹轮'),
    ('tire flip', '翻轮胎'),
    ('power clean', '高翻'),
    ('snatch pull', '抓举拉'),
    ('wind sprints', '冲刺跑'),
    ('skater hops', '滑冰跳'),
    ('ski step', '滑雪步'),
    ('ski ergometer', '滑雪机'),
    ('walking on stepmill', '楼梯机行走'),
    ('left hook', '左勾拳'),
    ('medicine ball overhead slam', '药球砸'),
    ('medicine ball catch and overhead throw', '药球接抛'),
    ('one arm slam', '单臂砸'),
    ('pelvic tilt', '骨盆倾斜'),
    ('hyperextension', '背伸展'),
    ('exercise ball hug', '健身球抱'),
    ('suspended abdominal fallout', '悬垂卷腹'),
    ('posterior step to overhead reach', '后撤步过顶伸展'),
    ('shoulder tap', '肩部触'),
    ('leg pull in flat bench', '仰卧位收腹'),
    ('body-up', '起身'),
    ('bottoms-up', '臀上抬'),
    ('otis up', '奥提斯起'),
    ('landmine 180', '杠铃转体'),
    ('lat pulldown', '高位下拉'),
    ('quick feet', '快速脚'),
    ('one arm against wall', '单臂靠墙'),
]

# 动作短语 -> 中文模板(e=器械中文, b=部位中文, t=目标中文, m=修饰串)
MOVEMENTS = [
    ('leg press', lambda e, b, t, m: f"{m}腿举"),
    ('bench press', lambda e, b, t, m: f"{m}{e}卧推"),
    ('overhead press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('shoulder press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('military press', lambda e, b, t, m: f"{m}{e}肩上推举"),
    ('push up', lambda e, b, t, m: f"{m}俯卧撑"),
    ('pull up', lambda e, b, t, m: f"{m}引体向上"),
    ('chin up', lambda e, b, t, m: f"{m}反握引体"),
    ('dip', lambda e, b, t, m: f"{m}臂屈伸"),
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
    ('crunch', lambda e, b, t, m: f"{m}卷腹"),
    ('sit up', lambda e, b, t, m: f"{m}仰卧起坐"),
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
    # 第二批：拉伸/有氧/基础动作
    ('stretch', lambda e, b, t, m: f"{m}{e}{t or b}拉伸"),
    ('walk', lambda e, b, t, m: f"{m}{e}行走"),
    ('crawl', lambda e, b, t, m: f"{m}爬行"),
    ('jump', lambda e, b, t, m: f"{m}跳"),
    ('kick', lambda e, b, t, m: f"{m}{t or b}踢"),
    ('pose', lambda e, b, t, m: f"{m}瑜伽体式"),
    ('yoga', lambda e, b, t, m: f"{m}瑜伽"),
    ('circle', lambda e, b, t, m: f"{m}{b or t}绕环"),
    ('bend', lambda e, b, t, m: f"{m}{b or t}屈"),
    ('touch', lambda e, b, t, m: f"{m}{b or t}触"),
    ('rotation', lambda e, b, t, m: f"{m}{b or t}旋转"),
    ('swing', lambda e, b, t, m: f"{m}{b or t}摆"),
    ('squeeze', lambda e, b, t, m: f"{m}{b or t}挤压"),
    ('slap', lambda e, b, t, m: f"{m}{b or t}拍"),
    ('drag', lambda e, b, t, m: f"{m}{b or t}拖"),
    ('shake', lambda e, b, t, m: f"{m}抖动"),
    ('pulse', lambda e, b, t, m: f"{m}脉冲"),
    ('hold', lambda e, b, t, m: f"{m}保持"),
    ('clap', lambda e, b, t, m: f"{m}击掌"),
    # 第三批：器械 lever 系列 / 举重 / 投掷 / 拳击 / 基础
    ('pulldown', lambda e, b, t, m: f"{m}{e}下拉"),
    ('shrug', lambda e, b, t, m: f"{m}{e}耸肩"),
    ('calf', lambda e, b, t, m: f"{m}{e}提踵"),
    ('snatch', lambda e, b, t, m: f"{m}{e}抓举"),
    ('flip', lambda e, b, t, m: f"{m}{e}翻"),
    ('slam', lambda e, b, t, m: f"{m}{e}砸"),
    ('throw', lambda e, b, t, m: f"{m}{e}抛"),
    ('catch', lambda e, b, t, m: f"{m}{e}接"),
    ('hook', lambda e, b, t, m: f"{m}勾拳"),
    ('tilt', lambda e, b, t, m: f"{m}{t or b}倾斜"),
    ('tap', lambda e, b, t, m: f"{m}{t or b}触"),
    ('reach', lambda e, b, t, m: f"{m}{t or b}伸展"),
    ('step', lambda e, b, t, m: f"{m}{t or b}步"),
    ('hop', lambda e, b, t, m: f"{m}跳"),
    ('sprint', lambda e, b, t, m: f"{m}冲刺"),
    ('pull', lambda e, b, t, m: f"{m}{e}拉"),
    ('gripper', lambda e, b, t, m: f"{m}握力"),
]


def plural(w):
    if w.endswith(('s', 'x', 'ch', 'sh')):
        return w + 'es'
    if w.endswith('y') and w[-2] not in 'aeiou':
        return w[:-1] + 'ies'
    return w + 's'


def plural_phrase(ph):
    toks = ph.split()
    if not toks:
        return ph
    toks[-1] = plural(toks[-1])
    return ' '.join(toks)


def normalize(nm):
    nm = (nm or '').lower()
    nm = re.sub(r'\([^)]*\)', ' ', nm)        # 去括号内容 (male)/(female)
    nm = re.sub(r'\b\d+/\d+\b', ' ', nm)      # 去分数 3/4
    nm = nm.replace('°', ' ')                  # 去度数符号
    nm = re.sub(r'\b\d+\b', ' ', nm)          # 去孤立数字 45
    nm = re.sub(r'\bwith\b.*$', ' ', nm)      # 去 with 后缀
    nm = nm.replace('-', ' ')                 # 连字符转空格（push-up -> push up）
    nm = re.sub(r'\s+', ' ', nm).strip()
    return nm


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
    raw = (name or '').lower()
    nm = normalize(raw)
    if not nm:
        return ''
    e = EQUIP.get((equipment or '').lower(), '') or ''
    b = BODYPART.get((body_part or '').lower(), '') or ''
    t = TARGET.get((target or '').lower(), '') or ''
    mods = ''.join(v for k, v in MOD.items() if re.search(r'\b' + re.escape(normalize(k)) + r'\b', nm))

    # SPECIAL：体操/瑜伽/有氧专有名词优先（key 也归一化，兼容连字符/数字）
    for phrase, zh in SPECIAL:
        np = normalize(phrase)
        if re.search(r'\b(' + re.escape(np) + r'|' + re.escape(normalize(plural_phrase(phrase))) + r')\b', nm):
            return zh

    # MOVEMENTS：动作短语（含复数）
    for phrase, tmpl in MOVEMENTS:
        if re.search(r'\b(' + re.escape(phrase) + r'|' + re.escape(plural_phrase(phrase)) + r')\b', nm):
            out = tmpl(e, b, t, mods)
            if out:
                return out

    # 兜底单 token（容错复数）
    toks = re.findall(r"[a-z]+", nm)
    mv_tok = next((tk for tk in toks if any(ph == tk or ph == tk.rstrip('s') for ph, _ in MOVEMENTS)), None)
    if mv_tok:
        ph = mv_tok if any(p == mv_tok for p, _ in MOVEMENTS) else next(p for p, _ in MOVEMENTS if p == mv_tok.rstrip('s'))
        tmpl = next(t for p, t in MOVEMENTS if p == ph)
        return tmpl(e, b, t, mods)

    parts = []
    for tk in toks:
        if tk in STOP:
            continue
        v = (EQUIP.get(tk) or EQUIP.get(tk.rstrip('s')) or
             BODYPART.get(tk) or BODYPART.get(tk.rstrip('s')) or
             TARGET.get(tk) or TARGET.get(tk.rstrip('s')) or
             MOD.get(tk) or MOD.get(tk.rstrip('s')))
        if v:
            parts.append(v)
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
