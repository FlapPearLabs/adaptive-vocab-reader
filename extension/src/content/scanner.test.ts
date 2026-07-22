import { describe, it, expect } from 'vitest';

// isContentNode, extractWordsFromText 是纯函数，可在 Node 环境测试
import { isContentNode, extractWordsFromText, normalizeWord } from './scanner';

describe('normalizeWord', () => {
  it('转小写', () => {
    expect(normalizeWord('Hello')).toBe('hello');
  });

  it('去除首尾标点', () => {
    expect(normalizeWord('"hello."')).toBe('hello');
  });

  it('保留内部连字符', () => {
    expect(normalizeWord('well-known')).toBe('well-known');
  });

  it('去除尾部撇号+s', () => {
    expect(normalizeWord("readers'")).toBe('readers');
  });

  it('过滤纯数字', () => {
    expect(normalizeWord('12345')).toBeNull();
  });

  it('过滤短词（单字母）', () => {
    expect(normalizeWord('a')).toBe('a'); // 保留单字母，词典可能包含
    expect(normalizeWord('I')).toBe('i');
  });

  it('过滤空字符串', () => {
    expect(normalizeWord('')).toBeNull();
  });
});

describe('extractWordsFromText', () => {
  it('提取正常英文单词', () => {
    const words = extractWordsFromText('Hello world, this is a test.');
    expect(words.map((w) => w.word)).toEqual(['hello', 'world', 'this', 'is', 'a', 'test']);
  });

  it('跳过中文', () => {
    const words = extractWordsFromText('你好 world 测试');
    expect(words.map((w) => w.word)).toEqual(['world']);
  });

  it('每个词记录在原文中的位置', () => {
    const text = 'Hello world.';
    const words = extractWordsFromText(text);
    expect(words[0]!.startIndex).toBe(0);
    expect(words[0]!.endIndex).toBe(5);
    expect(words[1]!.startIndex).toBe(6);
    expect(words[1]!.endIndex).toBe(11);
  });
});

describe('isContentNode', () => {
  function makeNode(tagName: string): Element {
    // 简单模拟，仅检查 tagName
    return { tagName, nodeType: 1, closest: () => null } as unknown as Element;
  }

  it('SCRIPT 不是正文节点', () => {
    expect(isContentNode(makeNode('SCRIPT'))).toBe(false);
  });

  it('STYLE 不是正文节点', () => {
    expect(isContentNode(makeNode('STYLE'))).toBe(false);
  });

  it('CODE 不是正文节点', () => {
    expect(isContentNode(makeNode('CODE'))).toBe(false);
  });

  it('PRE 不是正文节点', () => {
    expect(isContentNode(makeNode('PRE'))).toBe(false);
  });

  it('NAV 不是正文节点', () => {
    expect(isContentNode(makeNode('NAV'))).toBe(false);
  });

  it('INPUT 不是正文节点', () => {
    expect(isContentNode(makeNode('INPUT'))).toBe(false);
  });

  it('TEXTAREA 不是正文节点', () => {
    expect(isContentNode(makeNode('TEXTAREA'))).toBe(false);
  });

  it('P 是正文节点', () => {
    expect(isContentNode(makeNode('P'))).toBe(true);
  });

  it('DIV 是正文节点', () => {
    expect(isContentNode(makeNode('DIV'))).toBe(true);
  });

  it('SPAN 是正文节点', () => {
    expect(isContentNode(makeNode('SPAN'))).toBe(true);
  });

  it('正文元素位于导航或评论祖先内时跳过', () => {
    const inNav = { tagName: 'A', closest: () => ({ tagName: 'NAV' }) } as unknown as Element;
    const inComment = { tagName: 'P', closest: () => ({ className: 'comment-section' }) } as unknown as Element;
    expect(isContentNode(inNav)).toBe(false);
    expect(isContentNode(inComment)).toBe(false);
  });
});
