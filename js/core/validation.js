/*
 * Validation. Generic checks come from the field definition (required,
 * hex length, number range); cross-field checks come from section rules.
 * Result: [{ level: 'error'|'warning', path, where, message }]
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;

  DCT.checkValue = function (field, v) {
    if (util.isEmpty(v)) {
      if (!field.required) return null;
      return field.type === 'list' ? 'At least one entry is required.' : 'Required.';
    }
    switch (field.type) {
      case 'hex': {
        const h = util.normalizeHex(v);
        if (!/^[0-9a-fA-F]*$/.test(h)) return 'Use hexadecimal digits only (0–9, A–F).';
        if (h.length !== field.length) return 'Enter ' + field.length + ' hex digits; this has ' + h.length + '.';
        return null;
      }
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n)) return 'Enter a number.';
        if (field.integer && !Number.isInteger(n)) return 'Enter a whole number.';
        if (field.exclusiveMin !== undefined && n <= field.exclusiveMin) return 'Must be greater than ' + field.exclusiveMin + '.';
        if (field.min !== undefined && n < field.min) return 'Must be at least ' + field.min + '.';
        if (field.max !== undefined && n > field.max) return 'Must be at most ' + field.max + '.';
        return null;
      }
      case 'text':
        if (field.pattern && !field.pattern.test(v)) return field.patternMessage || 'Invalid format.';
        return null;
      default:
        return null;
    }
  };

  DCT.validate = function (store) {
    const ctx = store.ctx;
    const issues = [];

    function push(level, path, message) {
      issues.push({ level, path, message, where: DCT.describePath(path, ctx) });
    }

    function check(field, value, path, scope) {
      const msg = DCT.checkValue(field, value);
      if (msg) push('error', path, msg);
      else if (field.validate) {
        const r = field.validate(value, ctx, scope);
        if (r) typeof r === 'string' ? push('error', path, r) : push(r.level || 'error', path, r.message);
      }
      if (field.type === 'list' && Array.isArray(value)) {
        value.forEach((item, i) => {
          for (const sub of field.itemFields) {
            check(sub, item ? item[sub.key] : undefined, path + '.' + i + '.' + sub.key, item);
          }
        });
      }
    }

    for (const section of DCT.schema.sections) {
      if (!DCT.isSectionRelevant(section, ctx)) continue;
      for (const field of section.fields) {
        if (!DCT.isFieldRelevant(section, field, ctx)) continue;
        const path = DCT.fieldPath(section, field);
        check(field, store.get(path), path, ctx);
      }
      for (const rule of section.rules) {
        for (const issue of rule(ctx) || []) push(issue.level || 'error', issue.path, issue.message);
      }
    }

    const rank = { error: 0, warning: 1 };
    return issues.sort((a, b) => rank[a.level] - rank[b.level]);
  };
})();
