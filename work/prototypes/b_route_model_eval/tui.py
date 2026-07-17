#!/usr/bin/env python3
"""PROTOTYPE ONLY: LM Studio 本地模型的路线 B 交互式小验证。"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from logic import CASES, SCHEMA, State, cache_as_dict, parse_and_score, prompt_for, reduce

RESET = "\x1b[0m"
BOLD = "\x1b[1m"
DIM = "\x1b[2m"

LOOPBACK_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


class RejectRedirects(urllib.request.HTTPRedirectHandler):
    """原型禁止 Provider 将 loopback 请求重定向到别处。"""

    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        raise urllib.error.HTTPError(newurl, code, "原型拒绝任何 HTTP 重定向", headers, fp)


def validate_loopback_base_url(base_url: str) -> str:
    """使用标准 URL 解析精确限制到本机 HTTP Provider。"""
    parsed = urllib.parse.urlsplit(base_url)
    try:
        parsed.port
    except ValueError as error:
        raise ValueError("Provider 端口无效") from error
    if parsed.scheme != "http":
        raise ValueError("原型只允许 http loopback Provider")
    if parsed.hostname not in LOOPBACK_HOSTS:
        raise ValueError("原型只允许 localhost、127.0.0.1 或 [::1]")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Provider URL 不得包含用户名或密码")
    if parsed.query or parsed.fragment:
        raise ValueError("Provider base URL 不得包含 query 或 fragment")
    return base_url.rstrip("/")


def invoke(base_url: str, model: str, case: dict[str, Any]) -> dict[str, Any]:
    base_url = validate_loopback_base_url(base_url)
    body = {
        "model": model,
        "messages": prompt_for(case),
        "temperature": 0,
        "response_format": {"type": "json_schema", "json_schema": SCHEMA},
    }
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.perf_counter()
    try:
        opener = urllib.request.build_opener(RejectRedirects())
        with opener.open(request, timeout=45) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        scored = parse_and_score(content, case)
        return {
            "case_id": case["id"], "source": "provider", "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "raw": content, **scored,
        }
    except (urllib.error.URLError, TimeoutError, KeyError, IndexError, json.JSONDecodeError) as error:
        return {
            "case_id": case["id"], "source": "provider_error", "elapsed_ms": round((time.perf_counter() - started) * 1000, 1),
            "raw": "", "valid_json": False, "valid_contract": False, "automatic_match": False,
            "reason": f"Provider 失败：{error}", "parsed": None,
        }


def render(state: State, model: str, base_url: str, last: dict[str, Any] | None) -> None:
    case = CASES[state.current_index]
    cached = cache_as_dict(state)
    valid = sum(1 for result in state.results if result["valid_json"])
    contract_valid = sum(1 for result in state.results if result.get("valid_contract", False))
    matched = sum(1 for result in state.results if result["automatic_match"])
    print("\x1b[2J\x1b[H", end="")
    print(f"{BOLD}路线 B：本地模型短释义原型（可丢弃）{RESET}")
    print(f"{DIM}模型：{model}  地址：{base_url}  不写入文件或项目数据{RESET}\n")
    print(f"{BOLD}当前例 {state.current_index + 1}/{len(CASES)}：{case['id']}{RESET}")
    print(f"表达：{case['expression']}\n句子：{case['sentence']}\n人工可接受：{' / '.join(case['accepted'])}")
    print(
        f"\n缓存：{len(cached)} 条  已请求：{len(state.results)}  "
        f"JSON 合法：{valid}  合同合法：{contract_valid}  自动命中：{matched}"
    )
    if last is not None:
        print(f"\n{BOLD}最近结果{RESET}  来源：{last['source']}  耗时：{last['elapsed_ms']} ms")
        print(f"判定：{last['reason']}\n原始：{last['raw'] or '<无>'}")
    print(f"\n{BOLD}[n]{RESET} 下一例请求  {BOLD}[a]{RESET} 跑完全部  {BOLD}[c]{RESET} 当前缓存重放  {BOLD}[s]{RESET} 查看汇总  {BOLD}[r]{RESET} 清缓存  {BOLD}[q]{RESET} 退出")


def run_case(state: State, args: argparse.Namespace, index: int, prefer_cache: bool) -> tuple[State, dict[str, Any]]:
    case = CASES[index]
    cached = cache_as_dict(state)
    if prefer_cache and case["id"] in cached:
        original = cached[case["id"]]
        result = {**original, "source": "memory_cache", "elapsed_ms": 0.0}
    else:
        result = invoke(args.base_url, args.model, case)
    return reduce(state, {"kind": "record", "case_id": case["id"], "result": result, "next_index": (index + 1) % len(CASES)}), result


def print_summary(state: State) -> None:
    """供人工审阅的控制台汇总；不持久化任何结果。"""
    print("\n案例汇总：")
    for result in state.results:
        parsed = result.get("parsed") or {}
        print(
            f"- {result['case_id']}: {result['source']}; "
            f"JSON={'是' if result['valid_json'] else '否'}; "
            f"合同={'是' if result.get('valid_contract', False) else '否'}; "
            f"命中={'是' if result['automatic_match'] else '否'}; "
            f"释义={parsed.get('short_zh', '<无>')!r}; 状态={parsed.get('status', '<无>')}"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="PROTOTYPE ONLY: 路线 B 本地模型短释义验证")
    parser.add_argument("--model", required=True, help="LM Studio 已加载模型的 API identifier")
    parser.add_argument("--base-url", default="http://127.0.0.1:1234/v1", help="仅允许本机 loopback API")
    args = parser.parse_args()
    try:
        args.base_url = validate_loopback_base_url(args.base_url)
    except ValueError as error:
        raise SystemExit(str(error)) from error

    state = State()
    last: dict[str, Any] | None = None
    while True:
        render(state, args.model, args.base_url, last)
        command = input("> ").strip().lower()
        if command == "q":
            return 0
        if command == "r":
            state = reduce(state, {"kind": "reset_cache"})
            last = {"source": "state", "elapsed_ms": 0.0, "reason": "已清空内存缓存", "raw": "", "valid_json": True, "valid_contract": True, "automatic_match": False}
        elif command == "n":
            state, last = run_case(state, args, state.current_index, prefer_cache=False)
        elif command == "c":
            state, last = run_case(state, args, state.current_index, prefer_cache=True)
        elif command == "a":
            for _ in range(len(CASES)):
                state, last = run_case(state, args, state.current_index, prefer_cache=False)
        elif command == "s":
            print_summary(state)
            last = {"source": "state", "elapsed_ms": 0.0, "reason": "已输出内存汇总", "raw": "", "valid_json": True, "valid_contract": True, "automatic_match": False}
        else:
            last = {"source": "state", "elapsed_ms": 0.0, "reason": "未知命令", "raw": "", "valid_json": False, "valid_contract": False, "automatic_match": False}


if __name__ == "__main__":
    raise SystemExit(main())
