/*
 * Builds the DUT configuration object from the store.
 * - Only sections/fields relevant to the selected profiles are written.
 * - Required fields are always written.
 * - Optional fields are left out when empty, and when equal to their
 *   default unless "Write defaults" is on.
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;

  function normalize(field, v) {
    if (v === undefined || v === null) return v;
    switch (field.type) {
      case 'hex':
        return util.normalizeHex(v);
      case 'number':
        return v === '' ? null : Number(v);
      case 'bool':
        return !!v;
      case 'multi': {
        const known = field.options.map((o) => o.value);
        const list = Array.isArray(v) ? v : [];
        return known.filter((x) => list.includes(x)).concat(list.filter((x) => !known.includes(x)));
      }
      case 'list':
        return (Array.isArray(v) ? v : []).map((item) => normalizeItem(field, item));
      default:
        return v;
    }
  }

  function normalizeItem(field, item) {
    const out = {};
    for (const sub of field.itemFields) {
      const val = normalize(sub, item ? item[sub.key] : undefined);
      if (val !== undefined) out[sub.key] = val;
    }
    return out;
  }

  DCT.normalizeValue = normalize;

  DCT.serialize = function (store) {
    const ctx = store.ctx;
    const out = {};
    for (const section of DCT.schema.sections) {
      for (const field of section.fields) {
        if (!DCT.isFieldRelevant(section, field, ctx)) continue;
        const path = DCT.fieldPath(section, field);
        const value = normalize(field, store.get(path));
        if (!field.required) {
          if (util.isEmpty(value)) continue;
          const isDefault =
            field.default !== undefined && util.equal(value, normalize(field, DCT.defaultOf(field, ctx)));
          if (isDefault && !store.options.explicitDefaults) continue;
        }
        util.setPath(out, path, value === undefined ? null : value);
      }
    }
    return out;
  };
})();
