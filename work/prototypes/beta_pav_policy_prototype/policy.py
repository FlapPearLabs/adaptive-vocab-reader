"""可丢弃的词汇展示与测试策略原型。

问题：在 50 道分层初测和每日校准轮下，Beta/PAV 画像、隐藏词审计与
状态迁移是否可解释、可重复。这个文件不读写磁盘、不访问网络，也不是生产代码。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from hashlib import sha256
from math import ceil, exp, lgamma, sqrt
from typing import Iterable


NUM_BANDS = 10
MEAN_THRESHOLD = 0.85
LOWER_THRESHOLD = 0.70
MIN_AUDITS = 20
WILSON_Z_90_ONE_SIDED = 1.2815515655


class WordState(StrEnum):
    KNOWN = "会"
    NOT_KNOWN = "不会"
    UNKNOWN = "未知"


class Answer(StrEnum):
    CORRECT = "答对"
    INCORRECT = "答错"
    UNCERTAIN = "不确定"


class Bucket(StrEnum):
    ACTIVE_CHECK = "活跃状态核验"
    BOUNDARY = "边界校准"
    AUDIT = "隐藏词审计"


class AuditSource(StrEnum):
    INITIAL = "初测单次答对"
    HIDDEN = "高置信未知词"


class Display(StrEnum):
    QUIET = "不提示"
    LIGHT = "轻提示"
    STRONG = "强提示"


@dataclass(frozen=True)
class Word:
    key: str
    band: int


@dataclass
class WordRecord:
    state: WordState = WordState.UNKNOWN
    source: str = "未确认"
    pending_initial_audit: bool = False
    in_active_list: bool = False
    last_audit: Answer | None = None


@dataclass
class Evidence:
    correct: int = 0
    incorrect_or_uncertain: int = 0

    @property
    def total(self) -> int:
        return self.correct + self.incorrect_or_uncertain


@dataclass(frozen=True)
class PavBlock:
    start_band: int
    end_band: int
    correct: int
    incorrect_or_uncertain: int
    pav_mean: float
    spec_beta_mean: float
    lower_90: float


@dataclass(frozen=True)
class Posterior:
    mean: float
    lower_90: float
    block: PavBlock


@dataclass
class AuditStats:
    completed: int = 0
    misses: int = 0


@dataclass(frozen=True)
class Question:
    word: Word
    bucket: Bucket
    audit_source: AuditSource | None
    frozen_mean: float
    frozen_lower_90: float
    frozen_display: Display


@dataclass
class PolicyState:
    records: dict[str, WordRecord]
    evidence: list[Evidence] = field(default_factory=lambda: [Evidence() for _ in range(NUM_BANDS)])
    audit_stats: AuditStats = field(default_factory=AuditStats)
    audit_coverage: dict[int, int] = field(default_factory=lambda: {band: 0 for band in range(NUM_BANDS)})
    audit_next_source: AuditSource = AuditSource.INITIAL
    round_number: int = 0


def stable_score(seed: str, round_number: int, bucket: str, word: str) -> int:
    """用于可重放选题的稳定伪随机排序，不使用全局 RNG。"""
    raw = f"{seed}|{round_number}|{bucket}|{word}".encode("utf-8")
    return int.from_bytes(sha256(raw).digest()[:8], "big")


def unit_score(seed: str, *parts: str) -> float:
    raw = "|".join((seed, *parts)).encode("utf-8")
    return int.from_bytes(sha256(raw).digest()[:8], "big") / 2**64


def beta_mean(correct: int, incorrect_or_uncertain: int) -> float:
    return (1 + correct) / (2 + correct + incorrect_or_uncertain)


def pooled_beta_mean(correct: int, incorrect_or_uncertain: int, original_band_count: int) -> float:
    return (original_band_count + correct) / (2 * original_band_count + correct + incorrect_or_uncertain)


def _beta_fraction(a: float, b: float, x: float) -> float:
    """Lentz continued fraction; 足够用于原型中的小计数 Beta CDF。"""
    max_iter = 200
    eps = 3e-14
    tiny = 1e-300
    qab = a + b
    qap = a + 1.0
    qam = a - 1.0
    c = 1.0
    d = 1.0 - qab * x / qap
    if abs(d) < tiny:
        d = tiny
    d = 1.0 / d
    h = d
    for m in range(1, max_iter + 1):
        m2 = 2 * m
        aa = m * (b - m) * x / ((qam + m2) * (a + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        h *= d * c
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
        d = 1.0 + aa * d
        if abs(d) < tiny:
            d = tiny
        c = 1.0 + aa / c
        if abs(c) < tiny:
            c = tiny
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            return h
    raise RuntimeError("Beta continued fraction did not converge")


def beta_cdf(x: float, a: float, b: float) -> float:
    if x <= 0.0:
        return 0.0
    if x >= 1.0:
        return 1.0
    bt = exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * __import__("math").log(x) + b * __import__("math").log(1.0 - x))
    if x < (a + 1.0) / (a + b + 2.0):
        return bt * _beta_fraction(a, b, x) / a
    return 1.0 - bt * _beta_fraction(b, a, 1.0 - x) / b


def beta_quantile(a: float, b: float, probability: float) -> float:
    """二分求 Beta 10% 分位数，刻意不用第三方科学计算依赖。"""
    if probability <= 0.0:
        return 0.0
    if probability >= 1.0:
        return 1.0
    lo, hi = 0.0, 1.0
    for _ in range(90):
        mid = (lo + hi) / 2.0
        if beta_cdf(mid, a, b) < probability:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2.0


def build_pav_blocks(evidence: list[Evidence]) -> list[PavBlock]:
    """按规格的“Beta 后验均值 + 权重 C+U+2”执行 PAV。

    这里同时保留 PAV 的加权均值与规格要求的重新 Beta 化均值。它们在合并
    多个频段时并不总相同，正是本原型要暴露的规则一致性问题。
    """
    work: list[dict[str, float | int]] = []
    for band, item in enumerate(evidence):
        weight = item.total + 2
        work.append(
            {
                "start": band,
                "end": band,
                "correct": item.correct,
                "incorrect": item.incorrect_or_uncertain,
                "weight": weight,
                "weighted_sum": beta_mean(item.correct, item.incorrect_or_uncertain) * weight,
            }
        )
        while len(work) >= 2:
            left, right = work[-2], work[-1]
            left_mean = float(left["weighted_sum"]) / float(left["weight"])
            right_mean = float(right["weighted_sum"]) / float(right["weight"])
            if left_mean >= right_mean:
                break
            work[-2:] = [
                {
                    "start": left["start"],
                    "end": right["end"],
                    "correct": int(left["correct"]) + int(right["correct"]),
                    "incorrect": int(left["incorrect"]) + int(right["incorrect"]),
                    "weight": int(left["weight"]) + int(right["weight"]),
                    "weighted_sum": float(left["weighted_sum"]) + float(right["weighted_sum"]),
                }
            ]
    blocks: list[PavBlock] = []
    for item in work:
        correct = int(item["correct"])
        incorrect = int(item["incorrect"])
        total = correct + incorrect
        original_band_count = int(item["end"]) - int(item["start"]) + 1
        blocks.append(
            PavBlock(
                start_band=int(item["start"]),
                end_band=int(item["end"]),
                correct=correct,
                incorrect_or_uncertain=incorrect,
                pav_mean=float(item["weighted_sum"]) / float(item["weight"]),
                spec_beta_mean=pooled_beta_mean(correct, incorrect, original_band_count),
                lower_90=beta_quantile(original_band_count + correct, original_band_count + incorrect, 0.10),
            )
        )
    return blocks


def posteriors_by_band(evidence: list[Evidence]) -> list[Posterior]:
    output: list[Posterior | None] = [None] * NUM_BANDS
    for block in build_pav_blocks(evidence):
        for band in range(block.start_band, block.end_band + 1):
            output[band] = Posterior(block.spec_beta_mean, block.lower_90, block)
    return [item for item in output if item is not None]


def wilson_upper_90(misses: int, completed: int) -> float:
    if completed == 0:
        return 1.0
    z = WILSON_Z_90_ONE_SIDED
    p = misses / completed
    denom = 1.0 + z * z / completed
    center = (p + z * z / (2.0 * completed)) / denom
    margin = z * sqrt((p * (1.0 - p) + z * z / (4.0 * completed)) / completed) / denom
    return center + margin


def high_confidence_quiet(record: WordRecord, posterior: Posterior, audit_stats: AuditStats) -> bool:
    return (
        record.state is WordState.UNKNOWN
        and posterior.mean >= MEAN_THRESHOLD
        and posterior.lower_90 >= LOWER_THRESHOLD
        and audit_stats.completed >= MIN_AUDITS
        and wilson_upper_90(audit_stats.misses, audit_stats.completed) <= 0.30
    )


def display_for(record: WordRecord, posterior: Posterior, audit_stats: AuditStats) -> Display:
    if record.state is WordState.KNOWN:
        return Display.QUIET
    if record.state is WordState.NOT_KNOWN:
        return Display.STRONG
    return Display.QUIET if high_confidence_quiet(record, posterior, audit_stats) else Display.LIGHT


def add_random_evidence(state: PolicyState, word: Word, answer: Answer) -> None:
    item = state.evidence[word.band]
    if answer is Answer.CORRECT:
        item.correct += 1
    else:
        item.incorrect_or_uncertain += 1


def apply_initial_answer(state: PolicyState, word: Word, answer: Answer) -> None:
    """初测是随机样本：更新画像，并直接给该词状态。"""
    record = state.records[word.key]
    add_random_evidence(state, word, answer)
    if answer is Answer.CORRECT:
        record.state = WordState.KNOWN
        record.source = "初测单次答对"
        record.pending_initial_audit = True
        record.in_active_list = False
    else:
        record.state = WordState.NOT_KNOWN
        record.source = "初测答错或不确定"
        record.pending_initial_audit = False
        record.in_active_list = True


def apply_manual_mark(state: PolicyState, word: Word, target: WordState) -> None:
    """网页手动操作只改变该词；调用方可比较 evidence 前后不变。"""
    record = state.records[word.key]
    record.state = target
    record.source = "用户手动会" if target is WordState.KNOWN else "用户手动不会"
    record.pending_initial_audit = False
    record.in_active_list = target is WordState.NOT_KNOWN


def apply_active_check_answer(state: PolicyState, word: Word, answer: Answer) -> None:
    """活跃状态核验只更新该词，不更新无偏频段画像。"""
    record = state.records[word.key]
    record.pending_initial_audit = False
    if answer is Answer.CORRECT:
        record.state = WordState.KNOWN
        record.source = "活跃状态核验答对"
        record.in_active_list = False
    else:
        record.state = WordState.NOT_KNOWN
        record.source = "活跃状态核验答错或不确定"
        record.in_active_list = True


def apply_boundary_answer(state: PolicyState, word: Word, answer: Answer) -> None:
    """边界校准只更新画像；已确认该词保持未知且无审计标记。"""
    add_random_evidence(state, word, answer)


def apply_audit_answer(state: PolicyState, word: Word, answer: Answer, was_quiet: bool) -> None:
    """审计既是随机画像证据，也结算被抽词的待审计状态。"""
    record = state.records[word.key]
    add_random_evidence(state, word, answer)
    state.audit_stats.completed += 1
    if was_quiet and answer is not Answer.CORRECT:
        state.audit_stats.misses += 1
    record.pending_initial_audit = False
    record.last_audit = answer
    if answer is Answer.CORRECT:
        record.state = WordState.KNOWN
        record.source = "随机审计答对"
        record.in_active_list = False
    else:
        record.state = WordState.NOT_KNOWN
        record.source = "随机审计答错或不确定"
        record.in_active_list = True


def initial_questions(words: list[Word], seed: str) -> list[Word]:
    selected: list[Word] = []
    for band in range(NUM_BANDS):
        candidates = [word for word in words if word.band == band]
        selected.extend(sorted(candidates, key=lambda word: stable_score(seed, 0, "initial", word.key))[:5])
    return selected


def _pick_one(candidates: list[Word], coverage: dict[int, int], seed: str, round_number: int, bucket: str) -> Word | None:
    if not candidates:
        return None
    minimum_coverage = min(coverage[word.band] for word in candidates)
    least_covered = [word for word in candidates if coverage[word.band] == minimum_coverage]
    chosen = min(least_covered, key=lambda word: stable_score(seed, round_number, bucket, word.key))
    coverage[chosen.band] += 1
    return chosen


def _posterior_for(word: Word, state: PolicyState) -> Posterior:
    return posteriors_by_band(state.evidence)[word.band]


def _audit_question(state: PolicyState, words: list[Word], seed: str, selected: set[str]) -> Question | None:
    profiles = posteriors_by_band(state.evidence)
    pools: dict[AuditSource, list[Word]] = {
        AuditSource.INITIAL: [
            word
            for word in words
            if word.key not in selected
            and state.records[word.key].state is WordState.KNOWN
            and state.records[word.key].pending_initial_audit
        ],
        AuditSource.HIDDEN: [
            word
            for word in words
            if word.key not in selected
            and state.records[word.key].state is WordState.UNKNOWN
            and high_confidence_quiet(state.records[word.key], profiles[word.band], state.audit_stats)
        ],
    }
    preferred = state.audit_next_source
    fallback = AuditSource.HIDDEN if preferred is AuditSource.INITIAL else AuditSource.INITIAL
    source = preferred if pools[preferred] else fallback
    chosen = _pick_one(pools[source], state.audit_coverage, seed, state.round_number, f"audit:{source}")
    if chosen is None:
        return None
    state.audit_next_source = fallback
    posterior = profiles[chosen.band]
    selected.add(chosen.key)
    return Question(chosen, Bucket.AUDIT, source, posterior.mean, posterior.lower_90, display_for(state.records[chosen.key], posterior, state.audit_stats))


def calibration_quotas(count: int) -> dict[Bucket, int]:
    """已确认的 5–30 题校准轮目标配额。"""
    if not 5 <= count <= 30:
        raise ValueError("calibration round supports 5..30 questions")
    active = count // 5
    boundary = ceil(2 * count / 5)
    return {
        Bucket.ACTIVE_CHECK: active,
        Bucket.BOUNDARY: boundary,
        Bucket.AUDIT: count - active - boundary,
    }


def daily_plan(state: PolicyState, words: list[Word], seed: str, count: int) -> list[Question]:
    """按已确认配额生成计划；空缺只在边界/审计之间确定性交替回填。"""
    state.round_number += 1
    wanted = calibration_quotas(count)
    profiles = posteriors_by_band(state.evidence)
    selected: set[str] = set()
    result: list[Question] = []
    coverage = {band: 0 for band in range(NUM_BANDS)}

    def active_check_question() -> Question | None:
        candidates = [word for word in words if word.key not in selected and state.records[word.key].state is WordState.NOT_KNOWN]
        chosen = _pick_one(candidates, coverage, seed, state.round_number, "active-check")
        if chosen is None:
            return None
        selected.add(chosen.key)
        posterior = profiles[chosen.band]
        return Question(chosen, Bucket.ACTIVE_CHECK, None, posterior.mean, posterior.lower_90, display_for(state.records[chosen.key], posterior, state.audit_stats))

    def boundary_question() -> Question | None:
        candidates = [
            word
            for word in words
            if word.key not in selected
            and state.records[word.key].state is WordState.UNKNOWN
            and display_for(state.records[word.key], profiles[word.band], state.audit_stats) is Display.LIGHT
        ]
        if not candidates:
            return None
        distances = {word.key: abs(profiles[word.band].mean - MEAN_THRESHOLD) for word in candidates}
        nearest = min(distances.values())
        nearest_candidates = [word for word in candidates if distances[word.key] == nearest]
        chosen = _pick_one(nearest_candidates, coverage, seed, state.round_number, "boundary")
        if chosen is None:
            return None
        selected.add(chosen.key)
        posterior = profiles[chosen.band]
        return Question(chosen, Bucket.BOUNDARY, None, posterior.mean, posterior.lower_90, display_for(state.records[chosen.key], posterior, state.audit_stats))

    factories = {Bucket.ACTIVE_CHECK: active_check_question, Bucket.BOUNDARY: boundary_question, Bucket.AUDIT: lambda: _audit_question(state, words, seed, selected)}
    for bucket in (Bucket.ACTIVE_CHECK, Bucket.BOUNDARY, Bucket.AUDIT):
        for _ in range(wanted[bucket]):
            question = factories[bucket]()
            if question is not None:
                result.append(question)
    fallback_start = stable_score(seed, state.round_number, "controlled-fallback", "start") % 2
    fallback_buckets = (Bucket.BOUNDARY, Bucket.AUDIT)
    fallback_index = 0
    while len(result) < count:
        preferred = fallback_buckets[(fallback_start + fallback_index) % 2]
        alternative = fallback_buckets[(fallback_start + fallback_index + 1) % 2]
        fallback_index += 1
        question = factories[preferred]()
        if question is None:
            question = factories[alternative]()
        if question is None:
            break
        result.append(question)
    return result


@dataclass(frozen=True)
class SimulatedLearner:
    name: str
    known_probability_by_band: tuple[float, ...]
    known_answer_correct: float
    unknown_guess_correct: float


@dataclass(frozen=True)
class SimulationResult:
    learner: str
    daily_count: int
    initial_quiet_unknown: int
    final_quiet_unknown: int
    final_true_misses: int
    final_false_light_prompts: int
    audit_completed: int
    audit_misses: int
    audit_upper_90: float
    high_confident_bands: tuple[int, ...]
    pava_spec_divergence: float
    daily_bucket_counts: dict[str, int]
    audit_source_counts: dict[str, int]


def fixed_bank(size_per_band: int = 100) -> list[Word]:
    return [Word(f"b{band:02d}_w{index:03d}", band) for band in range(NUM_BANDS) for index in range(size_per_band)]


def latent_known(seed: str, learner: SimulatedLearner, word: Word) -> bool:
    return unit_score(seed, learner.name, word.key, "latent") < learner.known_probability_by_band[word.band]


def simulated_answer(seed: str, learner: SimulatedLearner, word: Word, event: str) -> Answer:
    score = unit_score(seed, learner.name, word.key, event)
    if latent_known(seed, learner, word):
        return Answer.CORRECT if score < learner.known_answer_correct else Answer.UNCERTAIN
    if score < learner.unknown_guess_correct:
        return Answer.CORRECT
    return Answer.UNCERTAIN


def run_simulation(learner: SimulatedLearner, daily_count: int, days: int = 25, seed: str = "prototype-2026-07-22") -> SimulationResult:
    words = fixed_bank()
    state = PolicyState(records={word.key: WordRecord() for word in words})
    for word in initial_questions(words, seed):
        apply_initial_answer(state, word, simulated_answer(seed, learner, word, "initial"))
    profiles = posteriors_by_band(state.evidence)
    initial_quiet_unknown = sum(
        1
        for word in words
        if state.records[word.key].state is WordState.UNKNOWN
        and display_for(state.records[word.key], profiles[word.band], state.audit_stats) is Display.QUIET
    )
    bucket_counts = {bucket.value: 0 for bucket in Bucket}
    audit_source_counts = {source.value: 0 for source in AuditSource}
    for day in range(1, days + 1):
        plan = daily_plan(state, words, seed, daily_count)
        for question in plan:
            bucket_counts[question.bucket.value] += 1
            if question.bucket is Bucket.AUDIT and question.audit_source is not None:
                audit_source_counts[question.audit_source.value] += 1
            answer = simulated_answer(seed, learner, question.word, f"day-{day}-{question.bucket}-{question.word.key}")
            if question.bucket is Bucket.ACTIVE_CHECK:
                apply_active_check_answer(state, question.word, answer)
            elif question.bucket is Bucket.BOUNDARY:
                apply_boundary_answer(state, question.word, answer)
            else:
                apply_audit_answer(state, question.word, answer, question.frozen_display is Display.QUIET)
    profiles = posteriors_by_band(state.evidence)
    quiet_unknown = [
        word
        for word in words
        if state.records[word.key].state is WordState.UNKNOWN
        and display_for(state.records[word.key], profiles[word.band], state.audit_stats) is Display.QUIET
    ]
    light_unknown = [
        word
        for word in words
        if state.records[word.key].state is WordState.UNKNOWN
        and display_for(state.records[word.key], profiles[word.band], state.audit_stats) is Display.LIGHT
    ]
    final_blocks = build_pav_blocks(state.evidence)
    divergence = max((abs(block.pav_mean - block.spec_beta_mean) for block in final_blocks), default=0.0)
    return SimulationResult(
        learner=learner.name,
        daily_count=daily_count,
        initial_quiet_unknown=initial_quiet_unknown,
        final_quiet_unknown=len(quiet_unknown),
        final_true_misses=sum(1 for word in quiet_unknown if not latent_known(seed, learner, word)),
        final_false_light_prompts=sum(1 for word in light_unknown if latent_known(seed, learner, word)),
        audit_completed=state.audit_stats.completed,
        audit_misses=state.audit_stats.misses,
        audit_upper_90=wilson_upper_90(state.audit_stats.misses, state.audit_stats.completed),
        high_confident_bands=tuple(band for band, posterior in enumerate(profiles) if posterior.mean >= MEAN_THRESHOLD and posterior.lower_90 >= LOWER_THRESHOLD),
        pava_spec_divergence=divergence,
        daily_bucket_counts=bucket_counts,
        audit_source_counts=audit_source_counts,
    )


def default_learners() -> tuple[SimulatedLearner, ...]:
    return (
        SimulatedLearner("稳定高掌握", (0.98, 0.97, 0.96, 0.95, 0.94, 0.93, 0.92, 0.90, 0.88, 0.85), 0.98, 0.25),
        SimulatedLearner("随词频明显下降", (0.98, 0.94, 0.88, 0.80, 0.70, 0.58, 0.46, 0.34, 0.24, 0.16), 0.96, 0.25),
        SimulatedLearner("高噪声回答", (0.94, 0.89, 0.82, 0.74, 0.65, 0.56, 0.46, 0.36, 0.28, 0.20), 0.82, 0.25),
    )


def prototype_checks() -> list[tuple[str, bool, str]]:
    """不是测试套件；供终端展示的规格边界检查。"""
    checks: list[tuple[str, bool, str]] = []
    k3 = wilson_upper_90(3, 20)
    k4 = wilson_upper_90(4, 20)
    checks.append(("Wilson n=20,k=3 通过", k3 <= 0.30, f"上界={k3:.6f}"))
    checks.append(("Wilson n=20,k=4 失败", k4 > 0.30, f"上界={k4:.6f}"))

    evidence = [Evidence(0, 5), Evidence(5, 0)] + [Evidence() for _ in range(8)]
    blocks = build_pav_blocks(evidence)
    checks.append(("PAV 合并低频高于高频的违反", blocks[0].start_band == 0 and blocks[0].end_band == 1, f"首块={blocks[0].start_band}-{blocks[0].end_band}"))
    preserved_prior = build_pav_blocks([Evidence(0, 0), Evidence(1, 0)] + [Evidence() for _ in range(8)])[0]
    checks.append(("PAV 合并后验保留每段先验", abs(preserved_prior.pav_mean - 0.60) < 1e-12 and abs(preserved_prior.spec_beta_mean - 0.60) < 1e-12, f"PAV={preserved_prior.pav_mean:.3f}, Beta={preserved_prior.spec_beta_mean:.3f}"))

    word = Word("lifecycle", 0)
    policy = PolicyState(records={word.key: WordRecord()})
    apply_initial_answer(policy, word, Answer.CORRECT)
    initial_ok = policy.records[word.key].state is WordState.KNOWN and policy.records[word.key].pending_initial_audit
    apply_audit_answer(policy, word, Answer.UNCERTAIN, was_quiet=True)
    failure_ok = policy.records[word.key].state is WordState.NOT_KNOWN and not policy.records[word.key].pending_initial_audit and policy.records[word.key].in_active_list
    checks.append(("单次答对→审计不确定→不会/清标记", initial_ok and failure_ok, f"状态={policy.records[word.key].state}"))

    before = [(item.correct, item.incorrect_or_uncertain) for item in policy.evidence]
    apply_manual_mark(policy, word, WordState.KNOWN)
    after = [(item.correct, item.incorrect_or_uncertain) for item in policy.evidence]
    checks.append(("手动标记不更新画像", before == after, f"evidence={after[0]}"))

    boundary_word = Word("boundary", 0)
    boundary_state = PolicyState(records={boundary_word.key: WordRecord()})
    apply_boundary_answer(boundary_state, boundary_word, Answer.CORRECT)
    checks.append(("边界校准答对仍保持未知", boundary_state.records[boundary_word.key].state is WordState.UNKNOWN and boundary_state.evidence[0].correct == 1, f"状态={boundary_state.records[boundary_word.key].state}"))

    words = fixed_bank()
    def rich_state() -> PolicyState:
        fixture = PolicyState(records={item.key: WordRecord() for item in words})
        fixture.evidence = [Evidence(1, 1) for _ in range(NUM_BANDS)]
        for item in words[:30]:
            fixture.records[item.key] = WordRecord(WordState.NOT_KNOWN, "fixture", False, True)
        for item in words[30:60]:
            fixture.records[item.key] = WordRecord(WordState.KNOWN, "fixture", True, False)
        return fixture

    def bucket_summary(plan: list[Question]) -> dict[Bucket, int]:
        return {bucket: sum(1 for question in plan if question.bucket is bucket) for bucket in Bucket}

    plan5 = daily_plan(rich_state(), words, "fixture-seed", 5)
    plan10 = daily_plan(rich_state(), words, "fixture-seed", 10)
    plan30 = daily_plan(rich_state(), words, "fixture-seed", 30)
    summary5 = bucket_summary(plan5)
    summary10 = bucket_summary(plan10)
    summary30 = bucket_summary(plan30)
    checks.append(("每日 5 题三桶配额 1/2/2", summary5 == {Bucket.ACTIVE_CHECK: 1, Bucket.BOUNDARY: 2, Bucket.AUDIT: 2}, str({key.value: value for key, value in summary5.items()})))
    checks.append(("每日 10 题三桶配额 2/4/4", summary10 == {Bucket.ACTIVE_CHECK: 2, Bucket.BOUNDARY: 4, Bucket.AUDIT: 4}, str({key.value: value for key, value in summary10.items()})))
    checks.append(("每日 30 题三桶配额 6/12/12", summary30 == {Bucket.ACTIVE_CHECK: 6, Bucket.BOUNDARY: 12, Bucket.AUDIT: 12}, str({key.value: value for key, value in summary30.items()})))

    def audit_ready_state() -> PolicyState:
        fixture = PolicyState(records={item.key: WordRecord() for item in words})
        fixture.evidence = [Evidence(50, 0) for _ in range(NUM_BANDS)]
        fixture.audit_stats = AuditStats(20, 0)
        for item in words[:10]:
            fixture.records[item.key] = WordRecord(WordState.KNOWN, "fixture", True, False)
        return fixture

    alternating = daily_plan(audit_ready_state(), words, "fixture-seed", 5)
    sources = [question.audit_source for question in alternating if question.bucket is Bucket.AUDIT]
    expected_sources = [AuditSource.INITIAL, AuditSource.HIDDEN, AuditSource.INITIAL, AuditSource.HIDDEN, AuditSource.INITIAL]
    checks.append(("审计来源在两池之间交替", sources == expected_sources, "/".join(source.value for source in sources if source)))
    checks.append(("候选不足只回填边界/审计", len(alternating) == 5 and all(question.bucket is Bucket.AUDIT for question in alternating), f"请求=5, 实际={len(alternating)}"))

    def mixed_fallback_state() -> PolicyState:
        fixture = PolicyState(records={item.key: WordRecord() for item in words})
        fixture.evidence = [Evidence(1, 1) for _ in range(NUM_BANDS)]
        for item in words[:20]:
            fixture.records[item.key] = WordRecord(WordState.KNOWN, "fixture", True, False)
        return fixture

    mixed_fallback = daily_plan(mixed_fallback_state(), words, "fixture-seed", 10)
    mixed_summary = bucket_summary(mixed_fallback)
    checks.append(("边界与审计候选共存时交替回填", len(mixed_fallback) == 10 and mixed_summary == {Bucket.ACTIVE_CHECK: 0, Bucket.BOUNDARY: 5, Bucket.AUDIT: 5}, str({key.value: value for key, value in mixed_summary.items()})))

    exhausted_state = PolicyState(records={item.key: WordRecord(WordState.KNOWN, "fixture", False, False) for item in words})
    exhausted = daily_plan(exhausted_state, words, "fixture-seed", 5)
    checks.append(("边界与审计均耗尽时少出题", not exhausted, f"请求=5, 实际={len(exhausted)}"))

    first = daily_plan(rich_state(), words, "fixture-seed", 10)
    second = daily_plan(rich_state(), words, "fixture-seed", 10)
    checks.append(("同一种子、轮次与快照选题可重放", [item.word.key for item in first] == [item.word.key for item in second], ",".join(item.word.key for item in first[:3])))
    return checks
