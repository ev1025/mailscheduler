#!/usr/bin/env python3
"""
데이트/여행 Notion CSV → travel_items INSERT SQL 생성기.

사용:
  python scripts/import-travel-csv.py <csv파일경로> <출력SQL경로>

CSV "종류" 컬럼이 내장 카테고리와 일치하는 행만 등록.
매칭 안 되는 종류(여행·동네투어·영화 등)는 SKIP 하고 리포트에만 남김.
"""
import csv
import sys
import re

CATEGORY_MAP = {
    "자연": "자연",
    "공연": "공연",
    "식사": "식당",
    "식당": "식당",
    "숙소": "숙소",
    "놀거리": "놀거리",
    "쇼핑": "쇼핑",
    "데이트": "데이트",
    # CSV 전용 → 내장 카테고리 매핑
    "여행": "기타",
    "동네투어": "놀거리",
    "영화": "공연",
}


def parse_month(raw):
    if not raw:
        return None
    m = re.search(r"(\d{1,2})\s*월", raw)
    return int(m.group(1)) if m else None


def sql_escape(s):
    if s is None or s == "":
        return "NULL"
    return "'" + s.replace("'", "''") + "'"


def main(in_path, out_path):
    with open(in_path, encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    lines = []
    inserted, skipped = [], []

    lines.append("-- 데이트/여행 CSV → travel_items 일괄 등록")
    lines.append("-- 카테고리는 모르는 값 → 기타 로 폴백. 중복 방지: (title, user_id) 존재 시 skip.")
    lines.append("-- user_id 는 app_users 에서 name='나' 자동 매핑.")
    lines.append("")
    lines.append("-- 구버전 스키마의 CHECK 제약이 남아 있을 수 있어 방어적으로 드롭.")
    lines.append("-- ('공연' '데이트' 등 v2 카테고리가 원래 제약에 없으므로)")
    lines.append("ALTER TABLE travel_items DROP CONSTRAINT IF EXISTS travel_items_category_check;")
    lines.append("")
    lines.append("-- 단일 INSERT + VALUES 리스트 + WHERE NOT EXISTS 로 일괄 중복제거 등록")
    lines.append("WITH uid AS (SELECT id FROM app_users WHERE name = '나' LIMIT 1)")
    lines.append("INSERT INTO travel_items (title, category, region, month, visited, user_id)")
    lines.append("SELECT v.title, v.category, v.region, v.month, v.visited, (SELECT id FROM uid)")
    lines.append("FROM (VALUES")

    value_rows = []
    for r in rows:
        title = (r.get("뭐 할래?") or "").strip()
        if not title:
            continue
        raw_kind = (r.get("종류") or "").strip()
        category = CATEGORY_MAP.get(raw_kind, "기타")  # 모르는 값은 기타로 폴백

        region = (r.get("위치") or "").strip() or None
        month = parse_month(r.get("제철") or "")
        visited = (r.get("했음") or "").strip().lower() == "yes"

        value_rows.append(
            f"  ({sql_escape(title)}, {sql_escape(category)}, {sql_escape(region)}::TEXT, "
            f"{'NULL::INT' if month is None else f'{month}::INT'}, {str(visited).upper()})"
        )
        inserted.append((title, raw_kind, category))

    lines.append(",\n".join(value_rows))
    lines.append(") AS v(title, category, region, month, visited)")
    lines.append("WHERE (SELECT id FROM uid) IS NOT NULL")
    lines.append("  AND NOT EXISTS (")
    lines.append("    SELECT 1 FROM travel_items t")
    lines.append("    WHERE t.title = v.title AND t.user_id = (SELECT id FROM uid)")
    lines.append("  );")
    lines.append("")
    lines.append(f"-- 포함: {len(inserted)} 건")
    for t, k, c in inserted:
        lines.append(f"--   {k} → {c}: {t}")
    lines.append(f"-- SKIP (카테고리 불일치): {len(skipped)} 건")
    for t, k in skipped:
        lines.append(f"--   {k or '(공백)'}: {t}")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    # 콘솔 출력은 영문/숫자만 (한글 깨짐 방지)
    sys.stdout.write(f"Wrote {out_path}\n")
    sys.stdout.write(f"Inserted: {len(inserted)}, Skipped: {len(skipped)}\n")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: import-travel-csv.py <csv> <out.sql>\n")
        sys.exit(1)
    main(sys.argv[1], sys.argv[2])
