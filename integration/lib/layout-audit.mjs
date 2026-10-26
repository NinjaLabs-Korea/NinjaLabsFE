// Layout probe for the dense-width sweep (flow 14). `denseProbe` is serialised and evaluated inside the page, so it must stay
// self-contained (no imports, no outer variables). It returns the layout problems of the current page at the current width:
//
//   clipped          text or an image sits (partly) outside an ancestor with overflow hidden|clip (the content is cut off).
//                    Intentional truncation is exempt: `text-overflow: ellipsis` on the x axis, `line-clamp` on the y axis.
//   icon-wrapped     an icon (img/svg) sits on a different line than the label text next to it (pill, button, badge, link).
//   page-overflow    the page scrolls horizontally, or an element sticks out of the viewport (outside a scroller).
//   squeezed         text wrapped to a few characters per line.
//   overlap          two interactive elements overlap each other.
//   covered          an interactive element's centre is hit by an unrelated element.
//
// Every offending element is tagged `data-sweep-hit="<kind>"` so the caller can outline it before taking a screenshot.
export function denseProbe() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const issues = [];
  document.querySelectorAll('[data-sweep-hit]').forEach((e) => e.removeAttribute('data-sweep-hit'));

  const styleCache = new Map();
  const cs = (el) => {
    let s = styleCache.get(el);
    if (!s) { s = getComputedStyle(el); styleCache.set(el, s); }
    return s;
  };
  const sigOf = (el) => `${el.tagName.toLowerCase()}.${String(el.getAttribute('class') || '').split(/\s+/).filter(Boolean).slice(0, 8).join('.')}`;
  const textOf = (el) => (el.textContent || el.getAttribute('alt') || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
  const add = (kind, el, sig, detail) => {
    el.setAttribute('data-sweep-hit', kind);
    issues.push({ kind, sig, text: textOf(el), detail });
  };
  const skipped = (el) => !!el.closest('dialog:not([open]), .sr-only, [inert]');
  const visible = (el) => {
    if (!el.getClientRects().length) return false;
    const s = cs(el);
    return s.visibility !== 'hidden' && s.display !== 'contents' && !skipped(el);
  };
  const inScroller = (el) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = cs(n);
      if (s.overflowX === 'auto' || s.overflowX === 'scroll') return true;
      if ((s.overflowX === 'hidden' || s.overflowX === 'clip') && n.scrollWidth > n.clientWidth + 1) return true;
    }
    return false;
  };
  const ownTextNodes = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  const rectsOfText = (nodes) => {
    const out = [];
    for (const node of nodes) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const q of range.getClientRects()) if (q.width > 0 && q.height > 0) out.push(q);
    }
    return out;
  };
  const union = (rects) => {
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (const q of rects) { l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); }
    return { left: l, top: t, right: r, bottom: b };
  };
  const isMedia = (el) => ['IMG', 'svg', 'SVG', 'CANVAS', 'VIDEO'].includes(el.tagName);
  const all = [...document.body.querySelectorAll('*')];

  // ---- clipped ---------------------------------------------------------------------------------------------------------
  const seenClip = new Set();
  for (const el of all) {
    if (!visible(el)) continue;
    const own = ownTextNodes(el);
    const media = isMedia(el);
    if (!own.length && !media) continue;
    const s = cs(el);
    if (s.position === 'fixed') continue;
    const leafRect = media ? el.getBoundingClientRect() : union(rectsOfText(own));
    if (!(leafRect.right > leafRect.left)) continue;
    const fontSize = parseFloat(s.fontSize) || 14;
    let escaping = s.position === 'absolute';
    for (let a = media ? el.parentElement : el; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const as = cs(a);
      if (a !== el && escaping) {
        if (as.position === 'static') continue;
        escaping = as.position === 'absolute' || as.position === 'fixed';
      }
      const clipX = as.overflowX === 'hidden' || as.overflowX === 'clip';
      const clipY = as.overflowY === 'hidden' || as.overflowY === 'clip';
      if (!clipX && !clipY) continue;
      if (a.clientWidth === 0 || a.clientHeight === 0) continue;
      const box = a.getBoundingClientRect();
      const left = box.left + a.clientLeft, top = box.top + a.clientTop;
      const right = left + a.clientWidth, bottom = top + a.clientHeight;
      let problem = '';
      if (clipX && !media && (as.textOverflow === 'ellipsis' || s.textOverflow === 'ellipsis')) {
        // truncated on purpose
      } else if (clipX && (leafRect.right > right + 1.5 || leafRect.left < left - 1.5)) {
        problem = `x: leaf ${Math.round(leafRect.left)}-${Math.round(leafRect.right)} vs box ${Math.round(left)}-${Math.round(right)}`;
      }
      if (!problem && clipY) {
        let clamped = false;
        for (let n = el; n; n = n.parentElement) { const v = cs(n).getPropertyValue('-webkit-line-clamp'); if (v && v !== 'none') clamped = true; if (n === a) break; }
        const tol = media ? 1.5 : Math.max(2, fontSize * 0.3);
        if (!clamped && (leafRect.bottom > bottom + tol || leafRect.top < top - tol)) {
          problem = `y: leaf ${Math.round(leafRect.top)}-${Math.round(leafRect.bottom)} vs box ${Math.round(top)}-${Math.round(bottom)}`;
        }
      }
      if (problem) {
        const sig = `${sigOf(el)} in ${sigOf(a)}`;
        if (!seenClip.has(el)) { seenClip.add(el); add('clipped', el, sig, problem); a.setAttribute('data-sweep-hit', 'clipper'); }
        break;
      }
    }
  }

  // ---- icon-wrapped ----------------------------------------------------------------------------------------------------
  for (const icon of all) {
    if (!isMedia(icon) || !visible(icon)) continue;
    const ir = icon.getBoundingClientRect();
    if (ir.width > 40 || ir.height > 40 || ir.width === 0) continue;
    const parent = icon.parentElement;
    if (!parent || parent === document.body) continue;
    const ps = cs(parent);
    const textRects = rectsOfText(ownTextNodes(parent));
    const overlapsLine = (r) => Math.min(ir.bottom, r.bottom) - Math.max(ir.top, r.top) >= Math.min(ir.height, r.height) * 0.3;
    if (textRects.length && !textRects.some(overlapsLine)) {
      add('icon-wrapped', icon, `${sigOf(icon)} in ${sigOf(parent)}`, `icon ${Math.round(ir.top)}-${Math.round(ir.bottom)}, text ${textRects.map((r) => Math.round(r.top)).join(',')}`);
      continue;
    }
    if ((ps.display === 'flex' || ps.display === 'inline-flex') && ps.flexDirection.startsWith('row') && ps.flexWrap !== 'nowrap') {
      const stacked = [...parent.children].some((sib) => {
        if (sib === icon || !visible(sib) || !sib.textContent.trim()) return false;
        const sr = sib.getBoundingClientRect();
        return sr.top >= ir.bottom - 1 || ir.top >= sr.bottom - 1;
      });
      if (stacked) add('icon-wrapped', icon, `${sigOf(icon)} in ${sigOf(parent)}`, 'wrapped flex row');
    }
  }

  // ---- page-overflow ---------------------------------------------------------------------------------------------------
  const scrollWidth = document.documentElement.scrollWidth;
  let offenders = 0;
  for (const el of all) {
    if (offenders >= 4) break;
    if (!el.getClientRects().length) continue;
    const s = cs(el);
    if (s.visibility === 'hidden' || s.position === 'fixed' || s.display === 'contents') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 && !inScroller(el) && !el.closest('dialog:not([open]), .sr-only, [aria-hidden="true"], [inert]') && (ownTextNodes(el).length || isMedia(el) || /^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName))) {
      offenders += 1;
      add('page-overflow', el, sigOf(el), `right=${Math.round(r.right)} vw=${vw}`);
    }
  }
  if (scrollWidth > vw + 1 && !offenders) issues.push({ kind: 'page-overflow', sig: 'document', text: '', detail: `scrollWidth=${scrollWidth} vw=${vw}` });

  // ---- squeezed --------------------------------------------------------------------------------------------------------
  for (const el of all) {
    const nodes = ownTextNodes(el);
    if (!nodes.length || !visible(el) || inScroller(el)) continue;
    const text = nodes.map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim();
    if (text.length < 8) continue;
    const tops = new Set(rectsOfText(nodes).map((q) => Math.round(q.top)));
    if (tops.size > 3 && text.length / tops.size < 3.5) add('squeezed', el, sigOf(el), `${tops.size} lines for ${text.length} chars`);
  }

  // ---- overlap / covered -----------------------------------------------------------------------------------------------
  const interactive = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, [role="button"], [role="tab"], [role="combobox"], [role="menuitem"]')) {
    if (!visible(el) || el.closest('[aria-hidden="true"]')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 6 || r.height < 6 || r.right <= 0 || r.left >= vw) continue;
    const s = cs(el);
    if (s.opacity === '0' || s.pointerEvents === 'none') continue;
    interactive.push({ el, r });
  }
  const seenPair = new Set();
  for (let i = 0; i < interactive.length; i += 1) {
    for (let j = i + 1; j < interactive.length; j += 1) {
      const a = interactive[i], b = interactive[j];
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
      const h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (w <= 2 || h <= 2) continue;
      const area = w * h;
      if (area < 20 || area < 0.25 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) continue;
      const sig = [sigOf(a.el), sigOf(b.el)].sort().join(' x ');
      if (seenPair.has(sig)) continue;
      seenPair.add(sig);
      add('overlap', a.el, sig, `${textOf(a.el)} / ${textOf(b.el)}`);
      b.el.setAttribute('data-sweep-hit', 'overlap');
    }
  }
  for (const { el, r } of interactive) {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (cx < 0 || cx >= vw || cy < 0 || cy >= vh) continue;
    const hit = document.elementFromPoint(cx, cy);
    if (!hit || el.contains(hit) || hit.contains(el)) continue;
    if (hit.closest('label') && el.closest('label') === hit.closest('label')) continue;
    if (el.labels && [...el.labels].some((l) => l.contains(hit))) continue;
    add('covered', el, `${sigOf(el)} under ${sigOf(hit)}`, textOf(hit));
  }

  return { vw, issues };
}
