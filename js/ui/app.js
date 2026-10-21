/*
 * Page wiring: builds the profile picker and the sections from the schema,
 * keeps the output preview and issue list in sync, and handles
 * import, copy and download. Contains no knowledge of individual options.
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;
  const el = util.el;
  const $ = (id) => document.getElementById(id);

  const store = DCT.createStore();
  const collapsed = new Set();
  let issues = [];
  let refreshers = [];
  let currentJson = '';

  const issuesFor = (path) => issues.filter((i) => i.path === path);
  const anyProfile = () => DCT.schema.profiles.some((p) => store.hasProfile(p.id));

  /* ---------- toast ---------- */
  DCT.ui.toast = function (message, kind) {
    const t = $('toast');
    t.textContent = message;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => (t.className = 'toast'), 5000);
  };

  /* ---------- bindings ---------- */
  function topBinding(section, field) {
    const path = DCT.fieldPath(section, field);
    return {
      path,
      scope: store.ctx,
      get: () => store.get(path),
      set: (v) => store.set(path, v),
      isTouched: () => store.isTouched(path),
      reset: field.type === 'list' ? null : () => store.resetField(path),
      defaultValue: () => (field.default === undefined ? undefined : DCT.defaultOf(field, store.ctx)),
      relevant: () => DCT.isFieldRelevant(section, field, store.ctx),
      issuesFor,
    };
  }

  /* ---------- profile picker ---------- */
  function renderProfiles() {
    $('profile-list').replaceChildren(
      ...DCT.schema.profiles.map((p) => {
        const cb = el('input', { type: 'checkbox' });
        cb.addEventListener('change', () => store.setProfile(p.id, cb.checked));
        const card = el(
          'label',
          { class: 'profile' },
          cb,
          el('span', { class: 'profile-check', 'aria-hidden': 'true' }),
          el('span', { class: 'profile-text' }, el('strong', {}, p.label), el('span', {}, p.description))
        );
        refreshers.push(() => {
          cb.checked = store.hasProfile(p.id);
          card.classList.toggle('on', cb.checked);
        });
        return card;
      })
    );
    refreshers.push(() => {
      const all = DCT.schema.profiles.every((p) => store.hasProfile(p.id));
      $('btn-all').textContent = all ? 'Clear all' : 'Select all';
    });
  }

  /* ---------- sections ---------- */
  function profileTags(section) {
    if (section.profiles.length === DCT.schema.profiles.length) return [el('span', { class: 'tag' }, 'All profiles')];
    return section.profiles.map((id) => el('span', { class: 'tag' }, DCT.profileLabel(id)));
  }

  function renderSection(section) {
    const body = el('div', { class: 'section-body' });
    let group = null;
    for (const field of section.fields) {
      if (field.group && field.group !== group) {
        group = field.group;
        body.append(el('h3', { class: 'group' }, group));
      }
      const r = DCT.ui.renderField(field, topBinding(section, field));
      body.append(r.node);
      refreshers.push(r.refresh);
    }

    const enable = section.profiles.length === 1
      ? el('button', { type: 'button', class: 'link', onclick: () => store.setProfile(section.profiles[0], true) }, 'Select ' + DCT.profileLabel(section.profiles[0]))
      : null;
    const note = el(
      'div',
      { class: 'inactive-note' },
      el(
        'span',
        {},
        section.profiles.length === DCT.schema.profiles.length
          ? 'Select a test profile above to edit these settings.'
          : 'Used only when testing ' + section.profiles.map(DCT.profileLabel).join(' or ') + '.'
      ),
      enable
    );

    const chevron = el('span', { class: 'chev', 'aria-hidden': 'true' }, '▾');
    const toggle = el(
      'button',
      {
        type: 'button',
        class: 'section-toggle',
        onclick: () => {
          collapsed.has(section.id) ? collapsed.delete(section.id) : collapsed.add(section.id);
          update();
        },
      },
      el('span', { class: 'section-title' }, section.title),
      el('span', { class: 'tags' }, profileTags(section)),
      chevron
    );

    const node = el(
      'section',
      { class: 'section' + (section.variant ? ' ' + section.variant : ''), id: 'sec-' + section.id },
      el('header', { class: 'section-head' }, toggle, el('p', { class: 'section-desc' }, section.description)),
      note,
      body
    );

    refreshers.push(() => {
      const on = DCT.isSectionRelevant(section, store.ctx);
      const isCollapsed = collapsed.has(section.id);
      node.classList.toggle('inactive', !on);
      node.classList.toggle('collapsed', isCollapsed);
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
      note.hidden = on;
    });
    return node;
  }

  /* ---------- output ---------- */
  function highlight(json) {
    const esc = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return esc.replace(
      /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      (m, str, colon, lit, num) => {
        if (str) return colon ? '<span class="j-key">' + str + '</span>' + colon : '<span class="j-str">' + str + '</span>';
        if (lit) return '<span class="j-lit">' + lit + '</span>';
        return '<span class="j-num">' + num + '</span>';
      }
    );
  }

  function renderOutput() {
    const pre = $('preview');
    const status = $('status');
    const ready = anyProfile();
    $('btn-download').disabled = !ready;
    $('btn-copy').disabled = !ready;

    if (!ready) {
      currentJson = '';
      pre.classList.add('empty');
      pre.textContent = 'Select at least one test profile. The configuration file builds up here as you fill in the settings.';
      status.replaceChildren(el('span', { class: 'dot idle' }), 'No profile selected');
      $('issues').replaceChildren();
      return;
    }

    currentJson = DCT.formatJson(DCT.serialize(store));
    pre.classList.remove('empty');
    pre.innerHTML = highlight(currentJson);

    const errs = issues.filter((i) => i.level === 'error').length;
    const warns = issues.length - errs;
    if (!issues.length) {
      status.replaceChildren(el('span', { class: 'dot ok' }), 'Complete, no issues');
    } else {
      const parts = [];
      if (errs) parts.push(errs + (errs === 1 ? ' error' : ' errors'));
      if (warns) parts.push(warns + (warns === 1 ? ' warning' : ' warnings'));
      status.replaceChildren(el('span', { class: 'dot ' + (errs ? 'error' : 'warning') }), parts.join(', '));
    }

    $('issues').replaceChildren(
      ...issues.map((i) =>
        el(
          'button',
          { type: 'button', class: 'issue ' + i.level, onclick: () => focusPath(i.path) },
          el('span', { class: 'where' }, i.where),
          el('span', { class: 'what' }, i.message)
        )
      )
    );
  }

  function focusPath(path) {
    let p = path;
    let target = null;
    while (p && !(target = document.querySelector('[data-path="' + CSS.escape(p) + '"]'))) {
      p = p.includes('.') ? p.slice(0, p.lastIndexOf('.')) : '';
    }
    if (!target) return;
    const section = target.closest('.section');
    if (section && collapsed.delete(section.id.replace(/^sec-/, ''))) update();
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.remove('flash');
    void target.offsetWidth;
    target.classList.add('flash');
    const input = target.querySelector('input:not([type=checkbox]), select, input');
    if (input && !input.disabled) input.focus({ preventScroll: true });
  }

  /* ---------- update cycle ---------- */
  function update() {
    issues = anyProfile() ? DCT.validate(store) : [];
    refreshers.forEach((fn) => fn());
    renderOutput();
  }

  function build() {
    refreshers = [];
    renderProfiles();
    $('form').replaceChildren(...DCT.schema.sections.map(renderSection));
    update();
  }

  store.subscribe(update);

  /* ---------- actions ---------- */
  $('btn-all').addEventListener('click', () => {
    const all = DCT.schema.profiles.every((p) => store.hasProfile(p.id));
    store.setAllProfiles(!all);
  });


  $('btn-reset').addEventListener('click', () => {
    if (!confirm('Clear all settings and start over?')) return;
    store.reset();
    build();
    DCT.ui.toast('All settings cleared.');
  });

  $('btn-import').addEventListener('click', () => $('file-import').click());
  $('file-import').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const obj = DCT.parseLenientJson(await file.text());
      if (!util.isPlainObject(obj)) throw new Error('the file does not contain a JSON object');
      const { unknown } = store.load(obj);
      build();
      if (unknown.length) DCT.ui.toast('Imported ' + file.name + '. Not recognized and left out: ' + unknown.join(', '), 'warn');
      else DCT.ui.toast('Imported ' + file.name + '.');
    } catch (err) {
      DCT.ui.toast('Could not import ' + file.name + ': ' + err.message, 'error');
    }
  });

  $('btn-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(currentJson);
    } catch (_) {
      const ta = el('textarea', { value: currentJson });
      document.body.append(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    DCT.ui.toast('Copied to clipboard.');
  });

  $('btn-download').addEventListener('click', () => {
    const errs = issues.filter((i) => i.level === 'error').length;
    if (errs && !confirm('The configuration still has ' + errs + (errs === 1 ? ' error' : ' errors') + '. Download anyway?')) return;
    const base = String(store.get('name') || 'dut').trim().replace(/[^\w.-]+/g, '_') || 'dut';
    const fileName = base + '_dut_config.json';
    const url = URL.createObjectURL(new Blob([currentJson + '\n'], { type: 'application/json' }));
    const a = el('a', { href: url, download: fileName });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    DCT.ui.toast('Downloaded ' + fileName + '.');
  });

  build();
})();
