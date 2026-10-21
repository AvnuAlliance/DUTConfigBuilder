/* JSON text in and out. */
(function () {
  'use strict';
  const DCT = window.DCT;

  const isPrim = (v) => v === null || typeof v !== 'object';

  function inline(v) {
    if (isPrim(v)) return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(inline).join(', ') + ']';
    return '{' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + inline(x)).join(', ') + '}';
  }

  /**
   * Pretty-print like the hand-written AETS samples: objects and arrays that
   * hold only plain values (ports, speeds) stay on one line.
   */
  DCT.formatJson = function (value, indent = 4, width = 110) {
    const pad = (n) => ' '.repeat(n * indent);
    function fmt(v, level) {
      if (isPrim(v)) return JSON.stringify(v);
      const flat = (Array.isArray(v) ? v : Object.values(v)).every(isPrim);
      const one = inline(v);
      if (level > 0 && flat && one.length + level * indent <= width) return one;
      const entries = Array.isArray(v)
        ? v.map((x) => pad(level + 1) + fmt(x, level + 1))
        : Object.entries(v).map(([k, x]) => pad(level + 1) + JSON.stringify(k) + ': ' + fmt(x, level + 1));
      const [open, close] = Array.isArray(v) ? ['[', ']'] : ['{', '}'];
      if (!entries.length) return open + close;
      return open + '\n' + entries.join(',\n') + '\n' + pad(level) + close;
    }
    return fmt(value, 0);
  };

  /**
   * Parse files written by hand: accepts hex literals such as 0xA0 (used in
   * the AETS documentation sample) and trailing commas.
   */
  DCT.parseLenientJson = function (text) {
    const cleaned = text
      .replace(/^\uFEFF/, '')
      .replace(/([:\[,]\s*)0x([0-9a-fA-F]+)/g, (m, pre, hex) => pre + parseInt(hex, 16))
      .replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(cleaned);
  };
})();
