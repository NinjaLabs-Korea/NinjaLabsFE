// Minimal Chrome DevTools Protocol driver over Node's built-in WebSocket (no dependencies).
// One Browser per flow; each flow opens its own browser context (fresh cookie jar and storage).
import { state, ORIGIN } from './state.mjs';

export { ORIGIN };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function browserWs() {
  const v = await (await fetch(`http://127.0.0.1:${state.cdpPort}/json/version`)).json();
  return v.webSocketDebuggerUrl;
}

export class Browser {
  static async connect() {
    const b = new Browser();
    b.ws = new WebSocket(await browserWs());
    await new Promise((r, j) => { b.ws.onopen = r; b.ws.onerror = j; });
    b.id = 0; b.pending = new Map(); b.sessions = new Map();
    b.ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && b.pending.has(m.id)) { const { res, rej } = b.pending.get(m.id); b.pending.delete(m.id); if (m.error) rej(new Error(JSON.stringify(m.error))); else res(m.result); return; }
      if (m.sessionId && b.sessions.has(m.sessionId)) b.sessions.get(m.sessionId)._event(m.method, m.params);
    };
    return b;
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((res, rej) => { this.pending.set(id, { res, rej }); setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); rej(new Error('timeout ' + method)); } }, 60000); });
  }
  async newPage(contextId) {
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank', ...(contextId ? { browserContextId: contextId } : {}) });
    const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
    const p = new Page(this, sessionId, targetId);
    this.sessions.set(sessionId, p);
    await p.init();
    return p;
  }
  async newContext() { return (await this.send('Target.createBrowserContext', { disposeOnDetach: true })).browserContextId; }
  async disposeContext(id) { await this.send('Target.disposeBrowserContext', { browserContextId: id }); }
  close() { this.ws.close(); }
}

export class Page {
  constructor(b, sessionId, targetId) { this.b = b; this.sid = sessionId; this.targetId = targetId; this.reset(); this.inflight = new Map(); this.listeners = []; }
  reset() { this.console = []; this.errors = []; this.failed = []; this.requests = []; }
  send(m, p) { return this.b.send(m, p, this.sid); }
  async init() {
    await Promise.all(['Runtime.enable', 'Log.enable', 'Network.enable', 'Page.enable'].map((m) => this.send(m)));
  }
  _event(method, p) {
    for (const l of this.listeners) l(method, p);
    if (method === 'Runtime.consoleAPICalled' && (p.type === 'error' || p.type === 'warning' || p.type === 'assert')) {
      this.console.push(`[${p.type}] ` + p.args.map((a) => a.value ?? a.description ?? a.type).join(' ').slice(0, 600));
    } else if (method === 'Runtime.exceptionThrown') {
      this.errors.push('[exception] ' + (p.exceptionDetails.exception?.description ?? p.exceptionDetails.text).slice(0, 600));
    } else if (method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) {
      this.console.push(`[log.${p.entry.level}] ${p.entry.text} ${p.entry.url ?? ''}`.slice(0, 600));
    } else if (method === 'Network.requestWillBeSent') {
      this.inflight.set(p.requestId, p.request.url);
      this.requests.push({ id: p.requestId, method: p.request.method, url: p.request.url, type: p.type });
    } else if (method === 'Network.responseReceived') {
      const r = this.requests.find((x) => x.id === p.requestId); if (r) r.status = p.response.status;
      if (p.response.status >= 400) this.failed.push(`${p.response.status} ${r?.method ?? ''} ${p.response.url}`);
    } else if (method === 'Network.loadingFinished') { this.inflight.delete(p.requestId); }
    else if (method === 'Network.loadingFailed') {
      this.inflight.delete(p.requestId);
      if (!p.canceled && p.errorText !== 'net::ERR_ABORTED') this.failed.push(`FAILED ${p.errorText} ${this.requests.find((x) => x.id === p.requestId)?.url}`);
    }
  }
  async idle(quietMs = 700, maxMs = 8000) {
    const start = Date.now(); let last = Date.now(); let n = -1;
    while (Date.now() - start < maxMs) {
      const cur = this.requests.length + this.inflight.size * 1000;
      if (cur !== n) { n = cur; last = Date.now(); }
      if (this.inflight.size === 0 && Date.now() - last > quietMs) return;
      await sleep(100);
    }
  }
  async goto(path) {
    const loaded = new Promise((r) => { const l = (m) => { if (m === 'Page.loadEventFired') { this.listeners = this.listeners.filter((x) => x !== l); r(); } }; this.listeners.push(l); });
    await this.send('Page.navigate', { url: path.startsWith('http') ? path : ORIGIN + path });
    await Promise.race([loaded, sleep(10000)]);
    await this.idle();
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('eval: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
    return r.result.value;
  }
  url() { return this.eval('location.href'); }
  text() { return this.eval('document.body.innerText'); }
  async waitFor(expr, ms = 10000) {
    const s = Date.now();
    while (Date.now() - s < ms) { try { if (await this.eval(expr)) return true; } catch {} await sleep(150); }
    return false;
  }
  async waitText(t, ms = 10000) { return this.waitFor(`document.body.innerText.includes(${JSON.stringify(t)})`, ms); }
  /** Like waitText but throws (naming the text) on timeout, so a missing screen fails where it happens. */
  async waitForText(text, { timeout = 10000 } = {}) {
    if (!(await this.waitFor(`document.body.innerText.includes(${JSON.stringify(text)})`, timeout))) throw new Error(`waitForText timed out after ${timeout}ms: ${JSON.stringify(text)}`);
  }
  /** Waits for a CSS selector (visible = has a layout box); throws naming the selector on timeout. */
  async waitForSelector(selector, { timeout = 10000, visible = true } = {}) {
    const expr = `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && (${!visible} || el.getClientRects().length > 0); })()`;
    if (!(await this.waitFor(expr, timeout))) throw new Error(`waitForSelector timed out after ${timeout}ms: ${selector}${visible ? ' (visible)' : ''}`);
  }
  /** Waits until a non-GET request issued at or after requests[since] has a response (a click that saves something). Throws on timeout. */
  async waitForMutation({ since = 0, timeout = 10000 } = {}) {
    const s = Date.now();
    while (Date.now() - s < timeout) {
      if (this.requests.slice(since).some((r) => r.method !== 'GET' && r.status !== undefined)) return;
      await sleep(100);
    }
    throw new Error(`waitForMutation timed out after ${timeout}ms (no non-GET response among ${this.requests.length - since} new requests)`);
  }
  /** Waits until a request whose URL matches `urlRe`, issued at or after requests[since], has a response. Throws on timeout. */
  async waitForRequest(urlRe, { since = 0, timeout = 10000 } = {}) {
    const s = Date.now();
    while (Date.now() - s < timeout) {
      if (this.requests.slice(since).some((r) => urlRe.test(r.url) && r.status !== undefined)) return;
      await sleep(100);
    }
    throw new Error(`waitForRequest timed out after ${timeout}ms: ${urlRe}`);
  }
  /** The page's <main> has rendered some text (client-rendered gated screens show nothing until the session resolves). */
  mainReady(timeout = 10000) { return this.waitFor(`(document.querySelector('main')?.innerText.trim().length ?? 0) > 0`, timeout); }
  // click the smallest visible element whose text matches
  async click(textOrSelector, { exact = false, selector = 'button, a, [role=button], [role=tab], label, summary' } = {}) {
    const ok = await this.eval(`(() => {
      const t = ${JSON.stringify(textOrSelector)};
      let el = null;
      if (t.startsWith('css:')) el = document.querySelector(t.slice(4));
      else {
        const els = [...document.querySelectorAll(${JSON.stringify(selector)})].filter(e => e.offsetParent !== null || e.getClientRects().length);
        el = els.find(e => e.innerText.trim() === t) || (${exact} ? null : els.find(e => e.innerText.trim().includes(t)));
      }
      if (!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`);
    if (!ok) throw new Error('click target not found: ' + textOrSelector);
    await sleep(200); await this.idle(500);
  }
  // React-compatible value setter
  async fill(selector, value) {
    const ok = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false;
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
    if (!ok) throw new Error('fill target not found: ' + selector);
  }
  async close() { await this.b.send('Target.closeTarget', { targetId: this.targetId }); }
}

const BAD = [/\bundefined\b/, /Invalid Date/, /\bNaN\b/, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, /\[object Object\]/, /\b[a-z]+(?:\.[a-zA-Z]+){2,}\b/];
export function badText(text) {
  const hits = [];
  for (const re of BAD) { const m = text.match(re); if (m) hits.push(m[0]); }
  return hits;
}

/**
 * Chrome's console text for a CSP violation, enforced ("Refused to load ... because it violates the following Content Security
 * Policy directive") or report-only ("[Report Only] Refused to ..."). The FE builds with NODE_ENV=production, so the policy
 * from `next.config.ts contentSecurityPolicy()` is enforced here exactly as in production.
 */
export const CSP_VIOLATION = /Content Security Policy|Refused to (load|execute|connect|frame|apply|evaluate|create|send)/i;

export async function report(page, label, extra = {}) {
  const text = await page.text().catch(() => '');
  const hydration = [...page.console, ...page.errors].filter((l) => /hydrat|did not match|Minified React error #4(18|19|23|25)/i.test(l));
  const csp = [...page.console, ...page.errors].filter((l) => CSP_VIOLATION.test(l));
  const r = { label, url: await page.url().catch(() => ''), console: page.console, errors: page.errors, failed: page.failed, hydration, csp, badText: badText(text), ...extra };
  console.log(JSON.stringify(r));
  page.reset();
  return r;
}
