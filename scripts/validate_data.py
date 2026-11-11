"""驗證 web/data/*.json 的資料完整性。

用法：
    uv run scripts/validate_data.py

檢查項目：必要欄位、id 唯一、類別／部位／特徵標籤／作物是否存在、
相關條目是否存在、示意圖規格是否完整。有錯誤時以結束碼 1 離開（可用於 CI）。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "web" / "data"

REQUIRED = ["id", "name", "en", "sci", "type", "crops", "parts", "tags", "summary",
            "symptoms", "conditions", "prevention", "control", "illus"]
ILLUS_KINDS = {"leaf", "fruit", "plant", "stem", "roots", "bug"}


def load(name: str):
    return json.loads((DATA / name).read_text(encoding="utf-8"))


def main() -> int:
    meta = load("meta.json")
    crops = load("crops.json")
    issues = load("issues.json")

    types = {t["id"] for t in meta["types"]}
    parts = {p["id"] for p in meta["parts"]}
    tags = {t["id"] for t in meta["tags"]}
    crop_ids = {c["id"] for c in crops} | {"*"}
    issue_ids = [i.get("id") for i in issues]

    errors: list[str] = []
    if len(crop_ids) - 1 != len(crops):
        errors.append("crops.json 有重複的 id")
    dup = {x for x in issue_ids if issue_ids.count(x) > 1}
    if dup:
        errors.append(f"issues.json 有重複的 id：{sorted(dup)}")

    for it in issues:
        iid = it.get("id", "?")
        for key in REQUIRED:
            if key not in it or it[key] in ("", [], None):
                errors.append(f"[{iid}] 缺少欄位：{key}")
        if it.get("type") not in types:
            errors.append(f"[{iid}] 未知類別：{it.get('type')}")
        for c in it.get("crops", []):
            if c not in crop_ids:
                errors.append(f"[{iid}] 未知作物：{c}")
        for p in it.get("parts", []):
            if p not in parts:
                errors.append(f"[{iid}] 未知部位：{p}")
        for t in it.get("tags", []):
            if t not in tags:
                errors.append(f"[{iid}] 未知特徵標籤：{t}")
        for r in it.get("related", []):
            if r not in issue_ids:
                errors.append(f"[{iid}] 相關條目不存在：{r}")
            if r == iid:
                errors.append(f"[{iid}] 相關條目不可指向自己")
        # cropNotes：作物專屬說明，作物必須存在且此條目適用該作物
        notes = it.get("cropNotes", {})
        if not isinstance(notes, dict):
            errors.append(f"[{iid}] cropNotes 必須是物件 {{作物id: 說明}}")
            notes = {}
        for c, text in notes.items():
            if c not in crop_ids or c == "*":
                errors.append(f"[{iid}] cropNotes 未知作物：{c}")
            elif "*" not in it.get("crops", []) and c not in it.get("crops", []):
                errors.append(f"[{iid}] cropNotes 的作物 {c} 不在此條目的 crops 中")
            if not isinstance(text, str) or not text.strip():
                errors.append(f"[{iid}] cropNotes.{c} 不可為空")
        for n, g in enumerate(it.get("illus", [])):
            if g.get("k") not in ILLUS_KINDS:
                errors.append(f"[{iid}] 第 {n + 1} 張示意圖類型錯誤：{g.get('k')}")
            if not g.get("cap"):
                errors.append(f"[{iid}] 第 {n + 1} 張示意圖缺少說明 cap")

    counts = {t: sum(1 for i in issues if i.get("type") == t) for t in sorted(types)}
    print(f"作物 {len(crops)} 種；條目 {len(issues)} 筆：{counts}")
    if errors:
        print(f"\n發現 {len(errors)} 個問題：")
        for e in errors:
            print("  -", e)
        return 1
    print("資料驗證通過 ✔")
    return 0


if __name__ == "__main__":
    sys.exit(main())
