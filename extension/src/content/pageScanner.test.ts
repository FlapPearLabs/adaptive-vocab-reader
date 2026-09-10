// ============================================================
// 拖选恢复胶囊（T-VUX-3 / D-7）—— 胶囊局部定位纯函数 + happy-dom 行为级回归
// ============================================================
// 测试 seam 说明（ticket §6.1）：
// - happy-dom 没有布局引擎：Range.getBoundingClientRect() 与胶囊尺寸均为 0 值，
//   行为级测试只能断言「退化选区 rect 下的确定输出」；完整几何（居中/上翻/夹取）
//   由 calculateSelectionPillPosition 纯函数级断言覆盖（viewport / rect / pill 全部注入），
//   真实布局几何由 e2e-verify.cjs 的 D-7 断言在真实 Chrome 中验证。
// - 机制零重写回归：选区竞态处理（mousedown 抢占 / pendingSelectionGestureTarget /
//   selectionchange 隐藏）已由 spa.test.ts 覆盖；本文件只新增 D-7 相关断言，
//   不重复、不放宽既有断言。
import { describe, it, expect, beforeEach } from 'vitest';
import { calculateSelectionPillPosition, createPageScanner, type SelectionRect } from './pageScanner';
import { createDictionary } from './dictionary';
import { initAnnotator, resetAnnotatorState } from './annotator';
import type { DictCore, FormsMap, WordState } from '../shared/types';

const FIXTURE_CORE: DictCore = {
  alpha: { phonetic: 'ˈælfə', pos: 'n.', translation: '阿尔法' },
  beta: { phonetic: 'ˈbiːtə', pos: 'n.', translation: '贝塔' },
};
const FIXTURE_FORMS: FormsMap = {};

/** 选区一个元素的全部文本并派发真实 bubbles mouseup（与 E2E selectElementText 同路径）。 */
function dragSelect(selector: string): void {
  const element = document.querySelector(selector);
  if (!element) throw new Error(`缺少拖选目标：${selector}`);
  const range = document.createRange();
  range.selectNodeContents(element);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: 24, clientY: 24 }));
}

describe('calculateSelectionPillPosition（D-7 胶囊局部几何）', () => {
  const PILL = { width: 80, height: 28 };

  it('正常位置：水平居中于选区上方（中心 x 对齐，不是选区左下）', () => {
    const rect: SelectionRect = { left: 100, top: 50, right: 200, bottom: 70 };
    const pos = calculateSelectionPillPosition(rect, PILL, 1280, 720);
    expect(pos).toEqual({ left: 110, top: 16 });
    expect(pos.left + PILL.width / 2).toBe((rect.left + rect.right) / 2);
  });

  it('上方空间不足：下移到选区下方（gap=6 保留既有下方间距直觉）', () => {
    // above = 20 - 28 - 6 = -14 < safeTop(8) → 下方 = 40 + 6 = 46
    const pos = calculateSelectionPillPosition({ left: 100, top: 20, right: 180, bottom: 40 }, PILL, 1280, 720);
    expect(pos).toEqual({ left: 100, top: 46 });
  });

  it('上方空间恰好等于安全顶界时仍走上方（边界方向反例：>= 而非 >）', () => {
    // above = 42 - 28 - 6 = 8 === safeTop → 必须仍放上方 top=8
    const pos = calculateSelectionPillPosition({ left: 100, top: 42, right: 180, bottom: 62 }, PILL, 1280, 720);
    expect(pos.top).toBe(8);
  });

  it('下翻后超出视口底部时钳制到视口下边距内', () => {
    // above = 10 - 34 = -24 < 8 → below = 170 + 6 = 176 > 200 - 28 - 8 = 164 → 钳到 164
    const pos = calculateSelectionPillPosition({ left: 100, top: 10, right: 180, bottom: 170 }, PILL, 1280, 200);
    expect(pos).toEqual({ left: 100, top: 164 });
  });

  it('选区贴近左缘：居中左值被夹取到安全边距，不越左视口', () => {
    // centerX = 30 → raw left = 30 - 40 = -10 → 夹到 8
    const pos = calculateSelectionPillPosition({ left: -30, top: 100, right: 90, bottom: 120 }, PILL, 1280, 720);
    expect(pos.left).toBe(8);
    expect(pos.top).toBe(66);
  });

  it('选区贴近右缘：居中左值被夹取，胶囊右缘距视口右缘 ≥ 8px', () => {
    // centerX = 1270 → raw left = 1230 > 1280 - 80 - 8 = 1192 → 夹到 1192
    const pos = calculateSelectionPillPosition({ left: 1200, top: 100, right: 1340, bottom: 120 }, PILL, 1280, 720);
    expect(pos.left).toBe(1192);
    expect(pos.left + PILL.width).toBeLessThanOrEqual(1280 - 8);
  });

  it('选区贴视口顶部且下翻值仍小于安全顶界：top 不低于 safeTop（不越视口顶部）', () => {
    // above = 0 - 34 = -34 < 8 → below = 1 + 6 = 7 < 8 → max(8, 7) = 8
    const pos = calculateSelectionPillPosition({ left: 200, top: 0, right: 280, bottom: 1 }, PILL, 1280, 720);
    expect(pos.top).toBe(8);
  });

  it('safeTop 参数生效：自定义安全顶界抬高下翻下限', () => {
    // above = 30 - 34 = -4 < safeTop(48) → below = 50 + 6 = 56 ≥ 48 → 56
    const pos = calculateSelectionPillPosition({ left: 100, top: 30, right: 180, bottom: 50 }, PILL, 1280, 720, 48);
    expect(pos.top).toBe(56);
  });
});

describe('拖选恢复胶囊（D-7 行为级回归，happy-dom 真实 createPageScanner 路径）', () => {
  // createPageScanner 在创建时向全局 document 注册 mouseup/click/selectionchange 监听
  // （生产机制，无移除 API，不得为可测性改动）。跨 it 会累积监听，因此本 describe
  // 采用与 spa.test.ts 相同的先例：单个 it 内完成一条完整场景序列（先正向后负向），
  // 全程只有一个 scanner，杜绝监听累积导致的跨用例 DOM 污染。
  it('行为全链：正向（出现/纯中文文案/退化 rect 定位/mousedown 抢占/点击写入 learning）与负向（已 learning / 已 known / 多词 / 纯数字 / 未收录 静默不弹）', () => {
    document.body.innerHTML =
      '<article><p id="host"><span id="w-alpha">alpha</span> <span id="w-beta">beta</span> <span id="w-num">12345</span> <span id="w-unlisted">zzunlisted</span></p></article>';
    const actions: Array<[string, WordState['status']]> = [];
    const state: Record<string, WordState> = {};
    const scanner = createPageScanner({
      dictionary: createDictionary(FIXTURE_CORE, FIXTURE_FORMS),
      getState: () => state,
      onUserAction: (w, s) => actions.push([w, s]),
    });
    scanner.scanDocument(document.body);

    // ---- 正向 ----
    dragSelect('#w-alpha .avr-word');
    const pill = document.querySelector<HTMLButtonElement>('.avr-selection-action');
    expect(pill).not.toBeNull();
    expect(pill!.dataset.word).toBe('alpha');
    // AC-4：简洁中文，无任何拉丁字母（禁止 Mark as Learning · 不会 之类混排）
    expect(pill!.textContent).toBe('加入生词本');
    expect(pill!.textContent).toMatch(/^[\u4e00-\u9fa5]+$/u);
    // happy-dom 退化 rect（选区与胶囊几何全 0）下的确定输出：
    // left = clamp(centerX=0) = 8（左安全边距）；top = max(safeTop, below=0+6) = 8。
    // 完整几何在纯函数级断言覆盖；真实布局由真实 Chrome E2E 验证。
    expect(pill!.style.left).toBe('8px');
    expect(pill!.style.top).toBe('8px');
    // P-2：胶囊内 mousedown 抢占 preventDefault，选区不被胶囊抢走
    const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    pill!.dispatchEvent(mousedown);
    expect(mousedown.defaultPrevented).toBe(true);
    // 点击 → 写入 learning（source=manual 语义经 onUserAction 呈现）→ 胶囊消失 → 选区清空
    pill!.click();
    expect(actions).toEqual([['alpha', 'learning']]);
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    expect(window.getSelection()?.toString()).toBe('');

    // ---- 负向（已 learning 由上方真实点击写入路径产生）----
    dragSelect('#w-alpha .avr-word');
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    // 已 known
    scanner.setState({ alpha: { status: 'known', source: 'manual', updatedAt: 2, version: 1 } });
    dragSelect('#w-alpha .avr-word');
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    // 多词（含空白）
    dragSelect('#host');
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    // 纯数字
    dragSelect('#w-num');
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    // 未收录
    dragSelect('#w-unlisted');
    expect(document.querySelector('.avr-selection-action')).toBeNull();
    expect(actions).toEqual([['alpha', 'learning']]);
  });
});
