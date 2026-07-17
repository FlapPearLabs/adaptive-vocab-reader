"""路线 B 原型的纯逻辑；不是生产模块。"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any


CASES: tuple[dict[str, Any], ...] = (
    {"id": "address-policy", "expression": "addressed", "sentence": "The policy addressed inequality.", "accepted": ("处理", "解决", "应对")},
    {"id": "bank-river", "expression": "bank", "sentence": "They sat on the bank of the river.", "accepted": ("河岸", "岸边")},
    {"id": "run-software", "expression": "runs", "sentence": "The program runs smoothly on this device.", "accepted": ("运行", "运转")},
    {"id": "run-into", "expression": "ran into", "sentence": "We ran into an unexpected problem during deployment.", "accepted": ("遇到", "碰到")},
    {"id": "run-business", "expression": "runs", "sentence": "She runs a small publishing company.", "accepted": ("经营", "管理")},
    {"id": "put-off", "expression": "put off", "sentence": "They put off the meeting until Friday.", "accepted": ("推迟", "延期")},
    {"id": "out-of-order", "expression": "out of order", "sentence": "The elevator is out of order today.", "accepted": ("出故障", "坏了", "故障")},
    {"id": "point-out", "expression": "pointed out", "sentence": "The report pointed out several safety risks.", "accepted": ("指出", "提到")},
    {"id": "go-down", "expression": "went down", "sentence": "The production server went down after the update.", "accepted": ("宕机", "停止运行", "故障")},
    {"id": "rule-out", "expression": "ruled out", "sentence": "The doctor ruled out a serious infection.", "accepted": ("排除", "否定")},
    {"id": "shed-light", "expression": "shed light on", "sentence": "The new evidence sheds light on the cause of the failure.", "accepted": ("阐明", "说明", "揭示")},
    {"id": "back-up", "expression": "back up", "sentence": "Back up the database before changing the schema.", "accepted": ("备份",)},
    {"id": "come-across", "expression": "came across", "sentence": "I came across an unfamiliar legal term in the article.", "accepted": ("偶然发现", "遇到")},
    {"id": "aimed-at", "expression": "aimed at", "sentence": "The policy is aimed at reducing pollution.", "accepted": ("旨在", "针对")},
    {"id": "stem-from", "expression": "stems from", "sentence": "The issue stems from an outdated configuration.", "accepted": ("源于", "起因于")},
    {"id": "drain", "expression": "drains", "sentence": "Streaming video drains the battery quickly.", "accepted": ("耗电", "耗尽电量")},
)


SCHEMA: dict[str, Any] = {
    "name": "reading_gloss",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "expression": {"type": "string"},
            "short_zh": {"type": "string"},
            "status": {"type": "string", "enum": ["answer", "need_more_context"]},
        },
        "required": ["expression", "short_zh", "status"],
    },
}


def prompt_for(case: dict[str, Any]) -> list[dict[str, str]]:
    return [
        {
            "role": "system",
            "content": (
                "你是本地英文阅读助手。只解释指定英文表达在给定句子中的意思，"
                "输出简短、自然的简体中文释义；不要翻译整句，不要解释语法，不要编造。"
                "给定的是一个完整句子；只要该句能合理区分当前常见义项，就必须回答，"
                "short_zh 最多六个汉字。只有句子确实无法区分含义时，才将 status 写为 "
                "need_more_context，并把 short_zh 写为空字符串。只要 short_zh 非空，status 就必须为 answer。"
            ),
        },
        {
            "role": "user",
            "content": f"目标表达：{case['expression']}\n所在句：{case['sentence']}",
        },
    ]


def parse_and_score(raw_content: str, case: dict[str, Any]) -> dict[str, Any]:
    """解析模型内容并做保守的自动初筛；语义判断仍需要人审。"""
    try:
        parsed = json.loads(raw_content)
    except json.JSONDecodeError as error:
        return {
            "valid_json": False,
            "valid_contract": False,
            "automatic_match": False,
            "reason": f"JSON 无效：{error.msg}",
            "parsed": None,
        }

    required = {"expression", "short_zh", "status"}
    if not isinstance(parsed, dict) or set(parsed) != required:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "字段不符合原型 schema",
            "parsed": parsed,
        }
    if not all(isinstance(parsed.get(field), str) for field in required):
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "字段类型不符合原型 schema",
            "parsed": parsed,
        }
    if parsed["expression"].strip() != case["expression"]:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "expression 未原样回显目标表达",
            "parsed": parsed,
        }
    if parsed["status"] not in {"answer", "need_more_context"}:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "status 非法",
            "parsed": parsed,
        }

    compact_short_zh = re.sub(r"\s+", "", parsed["short_zh"])
    if parsed["status"] == "answer" and not compact_short_zh:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "answer 必须携带非空 short_zh",
            "parsed": parsed,
        }
    if parsed["status"] == "need_more_context" and compact_short_zh:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "need_more_context 必须使用空 short_zh",
            "parsed": parsed,
        }
    if len(compact_short_zh) > 6:
        return {
            "valid_json": True,
            "valid_contract": False,
            "automatic_match": False,
            "reason": "short_zh 超过六个字符",
            "parsed": parsed,
        }

    normalized = re.sub(r"[\s，、；;。.！!？?]+", "", parsed["short_zh"])
    expected = {re.sub(r"[\s，、；;。.！!？?]+", "", item) for item in case["accepted"]}
    matched = parsed["status"] == "answer" and normalized in expected
    return {
        "valid_json": True,
        "valid_contract": True,
        "automatic_match": matched,
        "reason": "命中预设可接受短释义" if matched else "合同合法，需人工复核",
        "parsed": parsed,
    }


@dataclass(frozen=True)
class State:
    current_index: int = 0
    cache: tuple[tuple[str, dict[str, Any]], ...] = ()
    results: tuple[dict[str, Any], ...] = ()


def cache_as_dict(state: State) -> dict[str, dict[str, Any]]:
    return dict(state.cache)


def reduce(state: State, action: dict[str, Any]) -> State:
    """不含 I/O 的可移植状态转换。"""
    kind = action["kind"]
    if kind == "record":
        cache = cache_as_dict(state)
        cache[action["case_id"]] = action["result"]
        return State(
            current_index=action.get("next_index", state.current_index),
            cache=tuple(cache.items()),
            results=state.results + (action["result"],),
        )
    if kind == "reset_cache":
        return State(current_index=state.current_index, cache=(), results=state.results)
    if kind == "select":
        return State(current_index=action["index"] % len(CASES), cache=state.cache, results=state.results)
    raise ValueError(f"unknown action: {kind}")
