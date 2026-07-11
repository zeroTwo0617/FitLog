#!/usr/bin/env python3
# 将 fitness-exercise-library 技能的原始数据(exercises.json, ~15.8MB, 6 国语言)
# 精简为小程序可用的中文预设动作库：仅保留必要字段 + 中文步骤。
# 输出：data/exercises.preset.js (小程序可直接 require 的 JS 模块，规避微信对双扩展名 .json 的解析 bug)
import json
import os

SRC = r"C:\Users\86151\.workbuddy\skills\fitness-exercise-library\assets\exercises.json"
OUT = r"E:\WorkBuddy\fitness-miniprogram\data\exercises.preset.js"


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


def main():
    with open(SRC, "r", encoding="utf-8") as f:
        data = json.load(f)

    out = []
    for e in data:
        steps = e.get("instruction_steps") or {}
        out.append({
            "id": e.get("id"),
            "name": e.get("name"),
            "bodyPart": e.get("body_part"),
            "equipment": e.get("equipment"),
            "target": e.get("target"),
            "category": e.get("category"),
            "steps": collect_zh_steps(steps),
        })

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    # 输出为 JS 模块：module.exports = [...]，微信小程序 require 最稳，规避 exercises.preset.json 双扩展名解析坑
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("module.exports = ")
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";\n")

    size_kb = os.path.getsize(OUT) / 1024
    print(f"OK: wrote {len(out)} exercises -> {OUT} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
