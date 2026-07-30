#!/usr/bin/env python3
"""将固定 ECDICT CSV 确定性转换为本地词典核心包。

本脚本不调用网络、模型或数据库。调用方负责取得并固定输入 CSV 快照；脚本只做
机械筛选、词形映射和可重复报告。默认产物面向 1,000 词垂直切片，也可用同一规则
扩至约 10,000 词。
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


MAX_TRANSLATION_LENGTH = 40
# 与运行时首测候选规则对齐：每题需 1 正确 + 3 干扰项 = 4 个互异中文选项，
# 故一个词合格当且仅当全局存在 >= 3 个与其自身翻译不同的其他翻译。
DISTRACTOR_COUNT = 3
WORD_PATTERN = re.compile(r"[a-z]+$")
FORM_SEPARATOR = re.compile(r"[,;]")
POS_TOKEN = r"(?:abbr|adj|adv|art|aux|conj|det|interj|int|n|num|ord|phr|pl|prep|pron|s|v|vi|vt|a|ad)\."
POS_PREFIX = re.compile(rf"^\s*({POS_TOKEN}(?:\s*(?:/|&|,|and)\s*{POS_TOKEN})*)\s*", re.IGNORECASE)
INFLECTION_CODES = {"p", "i", "3", "d", "r", "t", "s"}


def _compact_text(value: str | None) -> str:
    return " ".join((value or "").split())


def _positive_rank(value: str | None) -> int | None:
    try:
        rank = int((value or "").strip())
    except ValueError:
        return None
    return rank if rank > 0 else None


def _is_simple_word(word: str) -> bool:
    return bool(WORD_PATTERN.fullmatch(word))


def _has_invalid_utf8(value: str | None) -> bool:
    return any(0xDC80 <= ord(character) <= 0xDCFF for character in value or "")


def _normalize_pos(value: str) -> str:
    tokens = re.findall(POS_TOKEN, value, flags=re.IGNORECASE)
    unique: list[str] = []
    for token in tokens:
        normalized = token.lower()
        if normalized not in unique:
            unique.append(normalized)
    return "/".join(unique)


def _extract_pos_and_translation(raw_pos: str | None, raw_translation: str | None) -> tuple[str, str]:
    explicit_pos = _normalize_pos(_compact_text(raw_pos))
    derived_pos: list[str] = []
    meanings: list[str] = []
    normalized_translation = (raw_translation or "").replace("\\n", "\n")
    for raw_line in normalized_translation.splitlines() or [normalized_translation]:
        line = _compact_text(raw_line)
        if not line:
            continue
        match = POS_PREFIX.match(line)
        if match:
            for token in _normalize_pos(match.group(1)).split("/"):
                if token and token not in derived_pos:
                    derived_pos.append(token)
            line = line[match.end() :].strip()
        if line:
            meanings.append(line)
    pos = explicit_pos or "/".join(derived_pos)
    return pos, "；".join(meanings)


def _parse_exchange(exchange: str, headword: str) -> list[str]:
    forms: list[str] = []
    for segment in (exchange or "").split("/"):
        if ":" not in segment:
            continue
        code, raw_forms = segment.split(":", 1)
        if code not in INFLECTION_CODES:
            continue
        for raw_form in FORM_SEPARATOR.split(raw_forms):
            form = _compact_text(raw_form).lower()
            if form and form != headword and _is_simple_word(form):
                forms.append(form)
    return forms


def _json_bytes(payload: Any) -> bytes:
    return (json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8")


def _write_json(path: Path, payload: Any) -> None:
    path.write_bytes(_json_bytes(payload))


def _input_sha256(input_path: Path) -> str:
    digest = hashlib.sha256()
    with input_path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _candidate_from_row(row: dict[str, str], rejections: Counter[str]) -> dict[str, Any] | None:
    required_values = (row.get(field) for field in ("word", "phonetic", "translation", "pos", "bnc", "frq", "exchange"))
    if any(_has_invalid_utf8(value) for value in required_values):
        rejections["invalid_utf8_row"] += 1
        return None
    word = _compact_text(row.get("word"))
    if not _is_simple_word(word):
        rejections["not_simple_lowercase_word"] += 1
        return None

    phonetic = _compact_text(row.get("phonetic"))
    if not phonetic:
        rejections["missing_phonetic"] += 1
        return None

    pos, translation = _extract_pos_and_translation(row.get("pos"), row.get("translation"))
    if not translation:
        rejections["missing_translation"] += 1
        return None
    if not pos:
        rejections["missing_pos"] += 1
        return None
    if len(translation) > MAX_TRANSLATION_LENGTH:
        rejections["translation_too_long"] += 1
        return None

    frq = _positive_rank(row.get("frq"))
    bnc = _positive_rank(row.get("bnc"))
    if frq is None and bnc is None:
        rejections["missing_frequency_rank"] += 1
        return None

    return {
        "word": word,
        "phonetic": phonetic,
        "pos": pos,
        "translation": translation,
        "exchange": _compact_text(row.get("exchange")),
        "rank_key": (0, frq, word) if frq is not None else (1, bnc, word),
    }


def _select_candidates(input_path: Path, limit: int) -> tuple[list[dict[str, Any]], Counter[str], int, int]:
    rejections: Counter[str] = Counter()
    candidates_by_word: dict[str, dict[str, Any]] = {}
    input_rows = 0
    with input_path.open("r", encoding="utf-8-sig", errors="surrogateescape", newline="") as source:
        reader = csv.DictReader(source)
        required_columns = {"word", "phonetic", "translation", "pos", "bnc", "frq", "exchange"}
        missing_columns = required_columns - set(reader.fieldnames or ())
        if missing_columns:
            raise ValueError(f"CSV missing required columns: {', '.join(sorted(missing_columns))}")
        for row in reader:
            input_rows += 1
            candidate = _candidate_from_row(row, rejections)
            if candidate is None:
                continue
            existing = candidates_by_word.get(candidate["word"])
            if existing is None or candidate["rank_key"] < existing["rank_key"]:
                if existing is not None:
                    rejections["duplicate_word_replaced"] += 1
                candidates_by_word[candidate["word"]] = candidate
            else:
                rejections["duplicate_word_discarded"] += 1

    candidates = sorted(candidates_by_word.values(), key=lambda item: item["rank_key"])
    eligible_count = len(candidates)
    if eligible_count < limit:
        raise ValueError(
            f"eligible records ({eligible_count}) are fewer than requested limit ({limit}); "
            f"rejections={dict(sorted(rejections.items()))}"
        )
    return candidates[:limit], rejections, input_rows, eligible_count


def build_core(
    input_path: Path,
    output_dir: Path,
    *,
    limit: int,
    source_ref: str = "UNSPECIFIED",
    source_date: str = "UNSPECIFIED",
) -> dict[str, Any]:
    """生成核心词典、词形表、频段表与构建报告并返回报告。"""
    if limit <= 0:
        raise ValueError("limit must be positive")
    input_path = Path(input_path)
    output_dir = Path(output_dir)
    selected, rejections, input_rows, eligible_count = _select_candidates(input_path, limit)
    output_dir.mkdir(parents=True, exist_ok=True)

    core = {
        item["word"]: [item["phonetic"], item["pos"], item["translation"]]
        for item in sorted(selected, key=lambda item: item["word"])
    }
    bands = {
        item["word"]: min(9, index * 10 // len(selected))
        for index, item in enumerate(selected)
    }

    form_candidates: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for item in selected:
        for form in _parse_exchange(item["exchange"], item["word"]):
            form_candidates[form].append(item)

    forms: dict[str, str] = {}
    collisions: dict[str, list[str]] = {}
    for form, candidates in sorted(form_candidates.items()):
        unique_candidates = {candidate["word"]: candidate for candidate in candidates}
        ranked = sorted(unique_candidates.values(), key=lambda item: item["rank_key"])
        forms[form] = ranked[0]["word"]
        if len(ranked) > 1:
            collisions[form] = [candidate["word"] for candidate in ranked]

    # core 优先查找：forms 的键若同时是已选 core 主词条（如 could→can），运行时 lookup 会先命中 core，
    # 该 forms 项永不生效。记录这些碰撞键并在产物中丢弃，保持构建产物与运行时 core-first 行为一致。
    core_form_collisions = sorted(form for form in forms if form in core)
    forms = {key: value for key, value in forms.items() if key not in core}

    core_path = output_dir / "dict-core.json"
    forms_path = output_dir / "forms.json"
    bands_path = output_dir / "frequency-bands.json"
    _write_json(core_path, core)
    _write_json(forms_path, forms)
    _write_json(bands_path, bands)

    artifacts = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (core_path, forms_path, bands_path)
    }

    # 首测候选资格统计（与运行时 strategy/quiz.ts eligibleCandidates 同一规则）：
    # 一个词能成为首测题，当且仅当全局存在 >= DISTRACTOR_COUNT 个与其自身翻译不同的其他翻译
    # （四选项互异）。core 主词条一律自洽（运行时 core 优先查找，lookup(w).word===w），
    # 不再因「forms 遮蔽」排除任何 core 词——13 个 core-form 碰撞词作为合法 core 词条保留。
    distinct_translations = {item["translation"] for item in selected}
    distinct_translation_count = len(distinct_translations)
    quiz_ineligible_words = [
        item["word"]
        for item in selected
        if sum(1 for t in distinct_translations if t != item["translation"]) < DISTRACTOR_COUNT
    ]

    report = {
        "schema_version": 1,
        "source": {
            "path": str(input_path),
            "reference": source_ref,
            "acquired_on": source_date,
            "sha256": _input_sha256(input_path),
        },
        "selection": {
            "limit": limit,
            "sort": "frq positive ascending; rows without frq use bnc positive ascending after frq-ranked rows; tag ignored",
            "word_rule": "ASCII lowercase letters only",
            "max_translation_length": MAX_TRANSLATION_LENGTH,
        },
        "input_rows": input_rows,
        "eligible_count": eligible_count,
        "selected_count": len(selected),
        "selection_order": [item["word"] for item in selected],
        "rejections": dict(sorted(rejections.items())),
        "form_collisions": collisions,
        "core_form_collisions": core_form_collisions,
        "quiz_eligibility": {
            "distractor_count": DISTRACTOR_COUNT,
            "distinct_translation_count": distinct_translation_count,
            "self_canonical_rule": "core-first lookup; no form-shadow exclusion (13 core-form collisions kept as core headwords; their forms keys dropped at build time)",
            "ineligible_count": len(quiz_ineligible_words),
            "ineligible_words": quiz_ineligible_words,
        },
        "artifacts": artifacts,
        "license": "ECDICT repository LICENSE is MIT; Chinese-definition redistribution chain remains UNKNOWN; dogfood only.",
    }
    _write_json(output_dir / "build-report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Build a deterministic local ECDICT core package")
    parser.add_argument("--input", type=Path, required=True, help="fixed ECDICT CSV snapshot")
    parser.add_argument("--output-dir", type=Path, required=True, help="directory for derived JSON files")
    parser.add_argument("--limit", type=int, default=1000, help="number of core headwords (default: 1000)")
    parser.add_argument("--source-ref", required=True, help="fixed upstream commit, release, or URL")
    parser.add_argument("--source-date", required=True, help="acquisition date in YYYY-MM-DD")
    args = parser.parse_args()
    report = build_core(
        args.input,
        args.output_dir,
        limit=args.limit,
        source_ref=args.source_ref,
        source_date=args.source_date,
    )
    print(json.dumps({"selected_count": report["selected_count"], "output_dir": str(args.output_dir)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
