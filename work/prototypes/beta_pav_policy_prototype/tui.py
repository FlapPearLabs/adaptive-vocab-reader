#!/usr/bin/env python3
"""/prototype Skill 要求的可手动驱动终端外壳。"""

from __future__ import annotations

import argparse
import os

from policy import (
    Answer,
    AuditStats,
    Evidence,
    MEAN_THRESHOLD,
    MIN_AUDITS,
    LOWER_THRESHOLD,
    Word,
    WordRecord,
    WordState,
    build_pav_blocks,
    default_learners,
    display_for,
    posteriors_by_band,
    prototype_checks,
    run_simulation,
    wilson_upper_90,
)


BOLD = "\x1b[1m"
DIM = "\x1b[2m"
RESET = "\x1b[0m"


def clear() -> None:
    os.system("clear")


def headline(title: str) -> None:
    print(f"{BOLD}{title}{RESET}")


def show_checks() -> None:
    headline("规格边界自检（不是生产测试套件）")
    for name, passed, detail in prototype_checks():
        flag = "通过" if passed else "失败"
        print(f"{flag:4} {name:32} {DIM}{detail}{RESET}")
    print()


def show_pav_diagnostic() -> None:
    headline("PAV / 合并后验一致性诊断")
    evidence = [Evidence(0, 0), Evidence(1, 0), Evidence(0, 0), Evidence(0, 0)] + [Evidence() for _ in range(6)]
    blocks = build_pav_blocks(evidence)
    print("构造：频段 0 无回答（Beta(1,1)，均值 0.500）；频段 1 一答对（Beta(2,1)，均值 0.667）。")
    print("这违反“高频段掌握率不得低于低频段”，故 PAV 合并。")
    for block in blocks[:3]:
        print(
            f"频段 {block.start_band}-{block.end_band}: PAV 加权均值={block.pav_mean:.3f}；"
            f"合并后验均值={block.spec_beta_mean:.3f}；10% 下界={block.lower_90:.3f}"
        )
    print()
    print("结论：合并 m 个频段后使用 `Beta(m+ΣC, m+ΣU)`，保留 m 个原始先验。")
    print("该后验均值与 PAV 加权均值完全一致。")


def show_threshold_table() -> None:
    headline("高置信门槛观测")
    print(f"条件：均值 ≥ {MEAN_THRESHOLD:.2f}，10% 下界 ≥ {LOWER_THRESHOLD:.2f}，审计数 ≥ {MIN_AUDITS}，Wilson 上界 ≤ 0.30")
    print(f"Wilson: n=20,k=3 → {wilson_upper_90(3, 20):.6f}；n=20,k=4 → {wilson_upper_90(4, 20):.6f}")
    profile = posteriors_by_band([Evidence(5, 0)] * 10)
    record = WordRecord(WordState.UNKNOWN)
    before = display_for(record, profile[0], AuditStats(19, 0))
    after = display_for(record, profile[0], AuditStats(20, 3))
    print(f"每频段初测 5/5 对：均值={profile[0].mean:.3f}，下界={profile[0].lower_90:.3f}；19 审计={before}，20 审计/3 漏标={after}")
    print("这显示 50 题后不会立刻静默：样本下界不足或审计不足均会保留轻提示。")


def show_simulations(daily_count: int) -> None:
    headline(f"固定题库模拟：25 轮、每日 {daily_count} 题、每频段 100 词")
    print("情境                 初始静默未知  最终静默未知  隐藏真不会  审计(漏)   Wilson上界  高置信频段  三桶累计")
    for learner in default_learners():
        result = run_simulation(learner, daily_count)
        buckets = "/".join(str(result.daily_bucket_counts[label]) for label in ("活跃状态核验", "边界校准", "隐藏词审计"))
        bands = ",".join(map(str, result.high_confident_bands)) or "无"
        print(
            f"{result.learner:10} {result.initial_quiet_unknown:>10} {result.final_quiet_unknown:>12}"
            f" {result.final_true_misses:>10} {result.audit_completed:>3}({result.audit_misses:>2})"
            f" {result.audit_upper_90:>10.3f} {bands:>10} {buckets}"
        )
        if result.pava_spec_divergence > 1e-9:
            print(f"  {DIM}异常：PAV/合并后验均值差={result.pava_spec_divergence:.3f}。{RESET}")
        print(f"  {DIM}审计来源：初测单次答对={result.audit_source_counts['初测单次答对']}；高置信未知词={result.audit_source_counts['高置信未知词']}。{RESET}")
    print()
    print("说明：‘隐藏真不会’由模拟器隐藏的潜在掌握状态计算，仅用于比较策略；真实产品只能用独立随机审计答案估计。")


def render() -> None:
    clear()
    headline("Beta/PAV 词汇展示与测试策略 — 可丢弃逻辑原型")
    print("问题：50 题后何时能保守地隐藏未知词；三桶日测和审计标记会怎样演化？")
    print(f"{DIM}固定合成题库；无词典下载、无浏览器、无持久化、无模型调用。{RESET}\n")
    print(f"{BOLD}[1]{RESET} 运行三类学习者模拟（25 轮，每日 5 题）")
    print(f"{BOLD}[2]{RESET} 运行三类学习者模拟（25 轮，每日 10 题）")
    print(f"{BOLD}[3]{RESET} 运行三类学习者模拟（25 轮，每日 30 题）")
    print(f"{BOLD}[4]{RESET} 查看 Wilson、审计标记与手动标记边界自检")
    print(f"{BOLD}[5]{RESET} 查看 PAV 合并后验一致性诊断")
    print(f"{BOLD}[6]{RESET} 查看高置信门槛在 50 题后的保守行为")
    print(f"{BOLD}[q]{RESET} 退出")


def pause() -> None:
    input("\n按 Enter 返回菜单…")


def interactive() -> None:
    while True:
        render()
        choice = input("选择：").strip().lower()
        clear()
        if choice == "1":
            show_simulations(5)
        elif choice == "2":
            show_simulations(10)
        elif choice == "3":
            show_simulations(30)
        elif choice == "4":
            show_checks()
        elif choice == "5":
            show_pav_diagnostic()
        elif choice == "6":
            show_threshold_table()
        elif choice == "q":
            return
        else:
            print("未知选项。")
        pause()


def main() -> None:
    parser = argparse.ArgumentParser(description="Beta/PAV strategy throwaway prototype")
    parser.add_argument("--simulate", choices=("5", "10", "30"), help="non-interactively run fixed simulations")
    parser.add_argument("--checks", action="store_true", help="print rule-boundary checks")
    parser.add_argument("--pav", action="store_true", help="print PAV diagnostic")
    parser.add_argument("--thresholds", action="store_true", help="print threshold observation")
    args = parser.parse_args()
    if args.simulate:
        show_simulations(int(args.simulate))
    elif args.checks:
        show_checks()
    elif args.pav:
        show_pav_diagnostic()
    elif args.thresholds:
        show_threshold_table()
    else:
        interactive()


if __name__ == "__main__":
    main()
