/*
 * Generic helpers with no knowledge of the DUT schema.
 * Every file attaches to the global namespace `DCT` so the tool runs from
 * file:// without a server (ES modules would require http://).
 */
(function () {
  'use strict';
  const DCT = (window.DCT = window.DCT || {});
  const util = {};

  /* ---------- paths: "gptp_config.domains.0.ports" ---------- */
  util.splitPath = (path) => (path === '' || path == null ? [] : String(path).split('.'));
  util.joinPath = (...parts) => parts.filter((p) => p !== '' && p != null).join('.');

  util.getPath = function (obj, path) {
    let cur = obj;
    for (const key of util.splitPath(path)) {
      if (cur == null) return undefined;
      cur = cur[key];
    }
    return cur;
  };

  util.setPath = function (obj, path, value) {
    const keys = util.splitPath(path);
    let cur = obj;
    keys.forEach((key, i) => {
      if (i === keys.length - 1) {
        cur[key] = value;
        return;
      }
      if (cur[key] == null || typeof cur[key] !== 'object') {
        cur[key] = /^\d+$/.test(keys[i + 1]) ? [] : {};
      }
      cur = cur[key];
    });
    return obj;
  };

  /* ---------- values ---------- */
  util.clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
  util.equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  util.isEmpty = (v) =>
    v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  util.isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /* ---------- hex identifiers (MAC, EUI-64) ---------- */
  util.normalizeHex = (v) => String(v ?? '').replace(/[\s:\-.]/g, '');
  util.isHex = (v, len) => new RegExp('^[0-9a-fA-F]{' + len + '}$').test(v);

  /** EUI-48 → EUI-64 by inserting FFFE in the middle (common clockIdentity mapping). */
  util.macToClockIdentity = function (mac) {
    const m = util.normalizeHex(mac);
    if (!util.isHex(m, 12)) return null;
    const filler = /[a-f]/.test(m) ? 'fffe' : 'FFFE';
    return m.slice(0, 6) + filler + m.slice(6);
  };

  /** log2 interval → human text, e.g. -3 → "125 ms". */
  util.log2IntervalText = function (n) {
    const s = Math.pow(2, n);
    if (s >= 1) return s + ' s';
    return +(s * 1000).toFixed(4) + ' ms';
  };

  /* ---------- tiny DOM builder ---------- */
  const PROPS = new Set(['value', 'checked', 'disabled', 'hidden', 'open', 'textContent']);

  /** el('div', {class: 'x', onclick: fn}, child, 'text', [moreChildren]) */
  util.el = function (tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (PROPS.has(k)) node[k] = v;
      else node.setAttribute(k, v === true ? '' : String(v));
    }
    for (const c of children.flat(Infinity)) {
      if (c === null || c === undefined || c === false) continue;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return node;
  };

  DCT.util = util;
})();
