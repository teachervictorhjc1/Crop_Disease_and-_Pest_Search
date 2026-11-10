"""由 web/data/*.json 產生 Supabase 用的種子資料 SQL（supabase/seed.sql）。

用法：
    uv run scripts/build_seed_sql.py

產生的 seed.sql 可直接貼到 Supabase 的 SQL Editor 執行；
內容使用 upsert（on conflict do update），重複執行也不會產生重複資料。
"""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "web" / "data"
OUT = ROOT / "supabase" / "seed.sql"


def q(value: str | None) -> str:
    """SQL 字串常值（單引號跳脫）。"""
    if value is None:
        return "null"
    return "'" + str(value).replace("'", "''") + "'"


def arr(values: list[str]) -> str:
    """text[] 常值。"""
    return "array[" + ", ".join(q(v) for v in values) + "]::text[]" if values else "'{}'::text[]"


def js(value) -> str:
    """jsonb 常值。"""
    return q(json.dumps(value, ensure_ascii=False)) + "::jsonb"


def main() -> None:
    crops = json.loads((DATA / "crops.json").read_text(encoding="utf-8"))
    issues = json.loads((DATA / "issues.json").read_text(encoding="utf-8"))

    lines = [
        "-- 由 scripts/build_seed_sql.py 自動產生，請勿手動編輯",
        "-- 請先執行 supabase/schema.sql 建立資料表",
        "begin;",
        "",
    ]

    for c in crops:
        lines.append(
            "insert into public.crops (id, name, en, \"group\", emoji, sort) values ("
            f"{q(c['id'])}, {q(c['name'])}, {q(c.get('en'))}, {q(c['group'])}, {q(c.get('emoji'))}, {int(c.get('sort', 0))})"
            " on conflict (id) do update set name = excluded.name, en = excluded.en, \"group\" = excluded.\"group\","
            " emoji = excluded.emoji, sort = excluded.sort;"
        )
    lines.append("")

    for n, it in enumerate(issues, start=1):
        lines.append(
            "insert into public.issues (id, sort, name, en, sci, type, crops, parts, tags, summary, symptoms,"
            " conditions, prevention, control, illus, photo_query, related) values ("
            f"{q(it['id'])}, {n}, {q(it['name'])}, {q(it.get('en'))}, {q(it.get('sci'))}, {q(it['type'])}, "
            f"{arr(it['crops'])}, {arr(it['parts'])}, {arr(it['tags'])}, {q(it['summary'])}, {js(it['symptoms'])}, "
            f"{q(it['conditions'])}, {js(it['prevention'])}, {js(it['control'])}, {js(it['illus'])}, "
            f"{q(it.get('photoQuery'))}, {arr(it.get('related', []))})"
            " on conflict (id) do update set sort = excluded.sort, name = excluded.name, en = excluded.en,"
            " sci = excluded.sci, type = excluded.type, crops = excluded.crops, parts = excluded.parts,"
            " tags = excluded.tags, summary = excluded.summary, symptoms = excluded.symptoms,"
            " conditions = excluded.conditions, prevention = excluded.prevention, control = excluded.control,"
            " illus = excluded.illus, photo_query = excluded.photo_query, related = excluded.related,"
            " updated_at = now();"
        )

    lines += ["", "commit;", ""]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(f"已產生 {OUT.relative_to(ROOT)}：作物 {len(crops)} 筆、條目 {len(issues)} 筆")


if __name__ == "__main__":
    main()
