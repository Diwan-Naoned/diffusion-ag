import { makeTranslator, type Entry, type Lang } from '../i18n/core.ts';

/** Reads the JSON the server embedded in #page-data. */
export function pageData<T>(): T {
  const el = document.getElementById('page-data');
  return JSON.parse(el?.textContent ?? '{}') as T;
}

export function translatorFrom(lang: Lang, strings: Record<string, Entry>) {
  return makeTranslator(lang, strings);
}

export function $<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T {
  const el = root.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element ${selector}`);
  return el;
}

export function $$<T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

/** localStorage that never throws (private mode, blocked storage). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** Minimal element builder: h('p', { class: 'x' }, 'text', child). Text is always set as text. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | boolean | undefined | null> = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    el.setAttribute(k, v === true ? '' : v);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child);
  }
  return el;
}

/** Element from server-rendered, already-escaped HTML (renderIntervention output only). */
export function fromTrustedHtml(tag: 'div', className: string, html: string): HTMLDivElement {
  const el = document.createElement(tag);
  el.className = className;
  el.innerHTML = html;
  return el;
}

/** Offset between the server clock and this device's clock, from a server timestamp. */
export function serverOffset(serverNow: number): number {
  return serverNow - Date.now();
}

/** JSON POST with the cookies; returns status and parsed body (or null). */
export async function postJson(url: string, body: unknown = {}): Promise<{ status: number; data: any }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, data };
}

/** Saves form drafts before the page is replaced by a language switch (D16). */
export function beforeLanguageSwitch(save: () => void): void {
  for (const form of document.querySelectorAll('[data-lang-switch]')) form.addEventListener('submit', save);
}
