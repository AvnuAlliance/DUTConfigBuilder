/*
 * Schema registry. Schema files in js/schema/ call DCT.defineProfile() and
 * DCT.defineSection(); everything else (form, validation, output, import)
 * is generated from what is registered here.
 *
 * Section:  { id, order, title, short?, path, profiles[], description, variant?, fields[], rules[] }
 * Field:    { key, label, type, required?, default?, help, group?, unit?, ... }
 *   types:  text | hex | number | bool | select | multi | list
 *   key may be a dotted path relative to the section ("CMLDS.ports").
 *   default may be a value or a function (ctx) => value.
 * Rule:     (ctx) => [{ level?: 'error'|'warning', path, message }]
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;

  const schema = { profiles: [], sections: [] };
  DCT.schema = schema;

  DCT.defineProfile = function (profile) {
    schema.profiles.push(profile);
  };

  DCT.defineSection = function (section) {
    section.path = section.path || '';
    section.fields = section.fields || [];
    section.rules = section.rules || [];
    schema.sections.push(section);
    schema.sections.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  DCT.fieldPath = (section, field) => util.joinPath(section.path, field.key);

  DCT.allFields = function () {
    const out = [];
    for (const section of schema.sections) {
      for (const field of section.fields) {
        out.push({ section, field, path: DCT.fieldPath(section, field) });
      }
    }
    return out;
  };

  DCT.defaultOf = function (field, ctx) {
    const d = typeof field.default === 'function' ? field.default(ctx) : field.default;
    return util.clone(d);
  };

  DCT.isSectionRelevant = (section, ctx) => section.profiles.some((p) => ctx.profiles.has(p));
  DCT.isFieldRelevant = (section, field, ctx) =>
    DCT.isSectionRelevant(section, ctx) && (!field.when || field.when(ctx));

  DCT.profileLabel = (id) => (schema.profiles.find((p) => p.id === id) || { label: id }).label;

  DCT.itemTitle = (field, item, i) =>
    field.itemTitle ? field.itemTitle(item || {}, i) : 'Entry ' + (i + 1);

  /** Human-readable location of a value, e.g. "gPTP › Domains › Domain 0 › priority1". */
  DCT.describePath = function (path, ctx) {
    for (const { section, field, path: fp } of DCT.allFields()) {
      const sectionName = section.short || section.title;
      if (path === fp) return [sectionName, field.label].join(' › ');
      if (field.type === 'list' && path.startsWith(fp + '.')) {
        const parts = [sectionName, field.label];
        const rest = path.slice(fp.length + 1).split('.');
        let f = field;
        let value = ctx.get(fp);
        while (rest.length && f && f.type === 'list') {
          const i = Number(rest.shift());
          const item = Array.isArray(value) ? value[i] : undefined;
          parts.push(DCT.itemTitle(f, item, i));
          const key = rest.shift();
          if (!key) break;
          const sub = f.itemFields.find((x) => x.key === key);
          if (!sub) break;
          parts.push(sub.label);
          f = sub;
          value = item ? item[key] : undefined;
        }
        return parts.join(' › ');
      }
    }
    return path;
  };
})();
