/*
 * PDF report. Builds a printable document from the same data as the JSON
 * file and opens the browser's print dialog, where "Save as PDF" creates
 * the file. No library or server needed; works from file://.
 * Layout and print rules live in css/report.css.
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;
  const el = util.el;

  const helpText = (field, ctx) => (typeof field.help === 'function' ? field.help(ctx) : field.help || '');

  function formatValue(field, v) {
    if (v === null || v === undefined || v === '') return '–';
    switch (field.type) {
      case 'bool':
        return v ? 'true' : 'false';
      case 'select': {
        const opt = (field.options || []).find((o) => o.value === v);
        return opt ? opt.label : String(v);
      }
      case 'multi':
        if (!Array.isArray(v) || !v.length) return 'none';
        return v.join(', ') + (field.unit ? ' ' + field.unit : '');
      case 'number':
        return String(v) + (field.unit ? ' ' + field.unit : '');
      default:
        return String(v);
    }
  }

  function isDefault(field, v, ctx) {
    if (field.default === undefined || field.type === 'list') return false;
    return util.equal(v, DCT.normalizeValue(field, DCT.defaultOf(field, ctx)));
  }

  /* ---------- lists (domains, ports) ---------- */
  function collectSubfields(field, out = []) {
    for (const sub of field.itemFields) {
      if (!out.includes(sub)) out.push(sub);
      if (sub.type === 'list') collectSubfields(sub, out);
    }
    return out;
  }

  function listEntries(field, items) {
    if (!items.length) return el('p', { class: 'r-empty' }, 'No entries');
    const scalars = field.itemFields.filter((f) => f.type !== 'list');
    const lists = field.itemFields.filter((f) => f.type === 'list');
    const cellClass = (f) => (f.type === 'hex' ? 'mono' : undefined);

    if (!lists.length) {
      return el(
        'table',
        { class: 'r-grid' },
        el('thead', {}, el('tr', {}, el('th', {}, ''), scalars.map((f) => el('th', {}, f.label)))),
        el(
          'tbody',
          {},
          items.map((item, i) =>
            el(
              'tr',
              {},
              el('td', { class: 'r-item' }, DCT.itemTitle(field, item, i)),
              scalars.map((f) => el('td', { class: cellClass(f) }, formatValue(f, item[f.key])))
            )
          )
        )
      );
    }

    return el(
      'div',
      { class: 'r-entries' },
      items.map((item, i) =>
        el(
          'div',
          { class: 'r-entry' },
          el('h4', {}, DCT.itemTitle(field, item, i)),
          el(
            'table',
            { class: 'r-kv' },
            el('tbody', {}, scalars.map((f) => el('tr', {}, el('th', {}, f.label), el('td', { class: cellClass(f) }, formatValue(f, item[f.key])))))
          ),
          lists.map((f) => el('div', { class: 'r-sublist' }, el('h5', {}, f.label), listEntries(f, item[f.key] || [])))
        )
      )
    );
  }

  function listBlock(field, items, ctx) {
    return el(
      'div',
      { class: 'r-list' },
      el('h3', {}, field.label, ' ', el('code', {}, field.key)),
      el('p', { class: 'r-help' }, helpText(field, ctx)),
      listEntries(field, items),
      el(
        'dl',
        { class: 'r-ref' },
        collectSubfields(field).map((f) => [el('dt', {}, f.label, ' ', el('code', {}, f.key)), el('dd', {}, helpText(f, ctx))])
      )
    );
  }

  /* ---------- sections ---------- */
  function paramTable(rows) {
    return el(
      'table',
      { class: 'r-table' },
      el('colgroup', {}, el('col', { class: 'c-param' }), el('col', { class: 'c-value' }), el('col', { class: 'c-help' })),
      el('thead', {}, el('tr', {}, el('th', {}, 'Parameter'), el('th', {}, 'Value'), el('th', {}, 'Explanation'))),
      el('tbody', {}, rows)
    );
  }

  function renderSection(section, out, ctx) {
    const blocks = [];
    let rows = [];
    let group = null;
    const flush = () => {
      if (rows.length) blocks.push(paramTable(rows));
      rows = [];
    };

    for (const field of section.fields) {
      if (!DCT.isFieldRelevant(section, field, ctx)) continue;
      const v = util.getPath(out, DCT.fieldPath(section, field));
      if (v === undefined) continue; // not written to the file

      if (field.type === 'list') {
        flush();
        blocks.push(listBlock(field, Array.isArray(v) ? v : [], ctx));
        continue;
      }
      if (field.group && field.group !== group) {
        group = field.group;
        rows.push(el('tr', { class: 'r-group' }, el('td', { colspan: 3 }, group)));
      }
      rows.push(
        el(
          'tr',
          {},
          el('td', { class: 'r-param' }, el('strong', {}, field.label), el('code', {}, field.key)),
          el(
            'td',
            { class: 'r-value' },
            el('span', { class: field.type === 'hex' ? 'mono' : undefined }, formatValue(field, v)),
            isDefault(field, v, ctx) ? el('span', { class: 'r-default' }, 'default') : null
          ),
          el('td', { class: 'r-help' }, helpText(field, ctx))
        )
      );
    }
    flush();

    return el(
      'section',
      { class: 'r-section' },
      el('h2', {}, section.title),
      el('p', { class: 'r-desc' }, section.description),
      blocks.length ? blocks : el('p', { class: 'r-empty' }, 'Nothing from this section is written to the file.')
    );
  }

  /* ---------- document ---------- */
  function buildReport(store, issues, fileName) {
    const ctx = store.ctx;
    const out = DCT.serialize(store);
    const profiles = DCT.schema.profiles.filter((p) => store.hasProfile(p.id));
    const errs = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errs;
    const status = !issues.length
      ? 'Complete, no issues'
      : [errs ? errs + (errs === 1 ? ' error' : ' errors') : '', warns ? warns + (warns === 1 ? ' warning' : ' warnings') : '']
          .filter(Boolean)
          .join(', ');

    const meta = [
      ['Device', store.get('name') || '–'],
      ['Test profiles', profiles.map((p) => p.label + ' (' + p.description + ')').join(', ')],
      ['Configuration file', fileName],
      ['Created', new Date().toLocaleString()],
      ['Status', status],
    ];

    return el(
      'article',
      { class: 'r-doc' },
      el(
        'header',
        { class: 'r-head' },
        el('img', { src: 'img/icon.ico', alt: '' }),
        el('div', {}, el('h1', {}, 'DUT configuration'), el('p', {}, 'Avnu Express Test Suite'))
      ),
      el('table', { class: 'r-meta' }, el('tbody', {}, meta.map(([k, v]) => el('tr', {}, el('th', {}, k), el('td', {}, v))))),
      issues.length
        ? el(
            'div',
            { class: 'r-issues' + (errs ? '' : ' only-warnings') },
            el('h2', {}, 'Open issues'),
            el('ul', {}, issues.map((i) => el('li', { class: i.level }, el('strong', {}, i.where + ': '), i.message)))
          )
        : null,
      DCT.schema.sections.filter((s) => DCT.isSectionRelevant(s, ctx)).map((s) => renderSection(s, out, ctx))
    );
  }

  /** Fill #report and open the print dialog; the PDF file name defaults to the page title. */
  function exportPdf(store, issues, baseName) {
    const root = document.getElementById('report');
    const previousTitle = document.title;
    root.replaceChildren(buildReport(store, issues, baseName + '_dut_config.json'));
    document.title = baseName + '_dut_config';
    const restore = () => {
      document.title = previousTitle;
      root.replaceChildren();
      window.removeEventListener('afterprint', restore);
    };
    window.addEventListener('afterprint', restore);
    // Wait for the icon to load so it appears in the PDF.
    const img = root.querySelector('img');
    const go = () => window.print();
    if (img && !img.complete) {
      img.addEventListener('load', go, { once: true });
      img.addEventListener('error', go, { once: true });
    } else {
      go();
    }
  }

  DCT.ui = DCT.ui || {};
  DCT.ui.buildReport = buildReport;
  DCT.ui.exportPdf = exportPdf;
})();