/* PROTOTYPE ONLY: two deliberately small, mutually exclusive interaction routes. */
(() => {
  const route = new URLSearchParams(location.search).get('route') || 'wrap';
  const dict = window.__prototypeDictionary;
  const forms = window.__prototypeForms;
  const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'NAV', 'FORM']);
  const metrics = { route, initialScanMs: 0, mutationScanMs: 0, mutationBatches: 0, wrappedTokens: 0, pointerResolutions: 0 };
  const preMetrics = { nodes: document.getElementsByTagName('*').length, scrollHeight: document.documentElement.scrollHeight, shifts: performance.getEntriesByType('layout-shift').reduce((total, entry) => total + entry.value, 0) };
  let tooltip;
  let menu;

  function lookup(surface) {
    const key = surface.toLowerCase();
    const wordKey = dict[key] ? key : forms[key];
    return wordKey && dict[wordKey] ? { wordKey, entry: dict[wordKey] } : null;
  }

  function tokenAt(text, offset) {
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
    let match;
    while ((match = re.exec(text))) {
      if (offset >= match.index && offset <= match.index + match[0].length) {
        return { surface: match[0], start: match.index, end: match.index + match[0].length };
      }
    }
    return null;
  }

  function eligibleText(node) {
    if (!node || node.nodeType !== Node.TEXT_NODE || !node.nodeValue.trim()) return false;
    for (let el = node.parentElement; el; el = el.parentElement) {
      if (ignoredTags.has(el.tagName) || el.closest?.('[data-prototype-ui], [data-p1-word]')) return false;
    }
    return true;
  }

  function removeUi() {
    tooltip?.remove(); tooltip = undefined;
    menu?.remove(); menu = undefined;
  }

  function rectOverlap(a, b) {
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  }

  function showTooltip(hit, rect) {
    removeUi();
    tooltip = document.createElement('div');
    tooltip.dataset.prototypeUi = 'tooltip';
    tooltip.style.cssText = 'position:fixed;z-index:2147483647;max-width:240px;padding:7px 9px;border:1px solid #475569;border-radius:6px;background:#fff;color:#111827;font:13px/1.35 system-ui;box-shadow:0 3px 10px #0003;pointer-events:none;visibility:hidden';
    tooltip.textContent = `${hit.surface}\n${hit.entry[0]}\n${hit.entry[1]}\n${hit.entry[2]}`;
    tooltip.style.whiteSpace = 'pre-line';
    document.documentElement.append(tooltip);
    const gap = 8;
    const headerBottom = [...document.querySelectorAll('*')].reduce((bottom, el) => {
      const style = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return (style.position === 'sticky' || style.position === 'fixed') && box.top <= 0 && box.bottom > 0 ? Math.max(bottom, box.bottom) : bottom;
    }, 0);
    let left = Math.max(4, Math.min(rect.left, innerWidth - tooltip.offsetWidth - 4));
    let top = rect.top - tooltip.offsetHeight - gap;
    if (top < headerBottom + gap) top = rect.bottom + gap;
    if (top + tooltip.offsetHeight > innerHeight - 4) top = Math.max(headerBottom + gap, rect.top - tooltip.offsetHeight - gap);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.style.visibility = 'visible';
    window.__prototypeLastGeometry = { target: rect.toJSON(), tooltip: tooltip.getBoundingClientRect().toJSON(), overlap: rectOverlap(rect, tooltip.getBoundingClientRect()), headerBottom };
  }

  function showMenu(hit, rect) {
    removeUi();
    menu = document.createElement('button');
    menu.dataset.prototypeUi = 'feedback';
    menu.type = 'button';
    menu.textContent = `不会：${hit.surface}`;
    menu.style.cssText = `position:fixed;z-index:2147483647;left:${Math.max(4, Math.min(rect.left, innerWidth - 120))}px;top:${Math.min(innerHeight - 36, rect.bottom + 6)}px;padding:5px 8px;background:#fff;border:1px solid #b91c1c;border-radius:5px;color:#991b1b`;
    menu.addEventListener('click', () => { menu.textContent = `已反馈不会：${hit.wordKey}`; });
    document.documentElement.append(menu);
  }

  function hitFromText(textNode, offset) {
    if (!eligibleText(textNode)) return null;
    const token = tokenAt(textNode.nodeValue, offset);
    if (!token) return null;
    const found = lookup(token.surface);
    if (!found) return null;
    const range = document.createRange();
    range.setStart(textNode, token.start); range.setEnd(textNode, token.end);
    const rect = range.getBoundingClientRect();
    return { ...found, surface: token.surface, rect };
  }

  function rangeAtPoint(event) {
    const roots = event.composedPath?.().filter((item) => item instanceof ShadowRoot) || [];
    for (const root of roots) {
      if (root.caretPositionFromPoint) {
        const pos = root.caretPositionFromPoint(event.clientX, event.clientY);
        if (pos) return { startContainer: pos.offsetNode, startOffset: pos.offset };
      }
    }
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(event.clientX, event.clientY);
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(event.clientX, event.clientY);
      return pos && { startContainer: pos.offsetNode, startOffset: pos.offset };
    }
    return null;
  }

  function pointerHit(event) {
    const range = rangeAtPoint(event);
    if (!range) return null;
    metrics.pointerResolutions++;
    return hitFromText(range.startContainer, range.startOffset);
  }

  function tokenFromEvent(event) {
    return event.composedPath?.().find((item) => item instanceof HTMLElement && item.dataset?.p1Word) || null;
  }

  function installEvents(resolve) {
    document.addEventListener('pointerover', (event) => {
      const target = route === 'wrap' ? tokenFromEvent(event) : pointerHit(event);
      const hit = route === 'wrap' && target ? { wordKey: target.dataset.p1Word, entry: dict[target.dataset.p1Word], surface: target.textContent, rect: target.getBoundingClientRect() } : target;
      if (hit) { showTooltip(hit, hit.rect); resolve('hover', hit); }
    }, true);
    document.addEventListener('click', (event) => {
      const target = route === 'wrap' ? tokenFromEvent(event) : pointerHit(event);
      const hit = route === 'wrap' && target ? { wordKey: target.dataset.p1Word, entry: dict[target.dataset.p1Word], surface: target.textContent, rect: target.getBoundingClientRect() } : target;
      if (hit) { event.preventDefault(); showMenu(hit, hit.rect); resolve('click', hit); }
    }, true);
  }

  function scanText(node) {
    if (!eligibleText(node)) return 0;
    const text = node.nodeValue;
    const re = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
    let match; let cursor = 0; let count = 0; const fragment = document.createDocumentFragment();
    while ((match = re.exec(text))) {
      const found = lookup(match[0]);
      if (!found) continue;
      fragment.append(text.slice(cursor, match.index));
      const span = document.createElement('span');
      span.dataset.p1Word = found.wordKey;
      span.textContent = match[0];
      fragment.append(span);
      cursor = match.index + match[0].length; count++;
    }
    if (!count) return 0;
    fragment.append(text.slice(cursor));
    node.replaceWith(fragment);
    return count;
  }

  function scanRoot(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = []; let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes.reduce((total, text) => total + scanText(text), 0);
  }

  function installWrap(resolve) {
    const started = performance.now();
    metrics.wrappedTokens += scanRoot(document);
    document.querySelectorAll('*').forEach((el) => { if (el.shadowRoot) metrics.wrappedTokens += scanRoot(el.shadowRoot); });
    metrics.initialScanMs = performance.now() - started;
    const observer = new MutationObserver((records) => {
      const startedMutation = performance.now(); let count = 0;
      for (const record of records) {
        if (record.type === 'characterData') count += scanText(record.target);
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) count += scanText(node);
          else if (node.nodeType === Node.ELEMENT_NODE && !node.closest?.('[data-prototype-ui]')) count += scanRoot(node);
        }
      }
      metrics.wrappedTokens += count;
      metrics.mutationScanMs += performance.now() - startedMutation;
      metrics.mutationBatches++;
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    installEvents(resolve);
  }

  function installCaret(resolve) {
    metrics.initialScanMs = 0;
    installEvents(resolve);
  }

  window.__prototype = {
    metrics,
    events: [],
    pointFor(containerId, word) {
      const root = containerId === 'shadow-case' ? document.querySelector('#shadow-host').shadowRoot : document;
      const container = containerId === 'shadow-case' ? root.querySelector('#shadow-text') : document.querySelector(`#${containerId}`);
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        let index = node.nodeValue.toLowerCase().indexOf(word.toLowerCase());
        while (index >= 0) {
          const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + word.length);
          const box = range.getBoundingClientRect();
          if (containerId !== 'bulk' || (box.top >= 64 && box.bottom <= innerHeight)) return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
          index = node.nodeValue.toLowerCase().indexOf(word.toLowerCase(), index + word.length);
        }
      }
      throw new Error(`word not found: ${containerId}/${word}`);
    },
  };
  window.__prototypePreMetrics = preMetrics;
  const resolve = (type, hit) => window.__prototype.events.push({ type, wordKey: hit.wordKey, surface: hit.surface });
  if (route === 'wrap') installWrap(resolve); else installCaret(resolve);
  requestAnimationFrame(() => { window.__prototypeReady = true; });
})();
