/*
 * Field renderers. renderField(field, binding) returns { node, refresh }.
 * The binding decouples a control from where its value lives:
 *   { path, ctx, get(), set(v), relevant(), issuesFor(path), scope,
 *     visible?(), isTouched?(), reset?(), defaultValue?() }
 * relevant() false → greyed out (profile not selected).
 * visible()  false → hidden (field.when condition not met).
 * Top-level fields bind to the store; list item fields bind to the item.
 * To add a new field type, add a case to buildControl().
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;
  const el = util.el;
  const ui = (DCT.ui = DCT.ui || {});
  let uid = 0;

  function displayValue(field, v) {
    if (v === undefined || v === null || v === '') return '';
    if (field.type === 'select') {
      const opt = field.options.find((o) => o.value === v);
      return opt ? String(opt.value) : String(v);
    }
    if (Array.isArray(v)) return v.length ? v.join(', ') : 'none';
    return String(v) + (field.unit && field.type === 'number' ? ' ' + field.unit : '');
  }

  function messages(list) {
    return list.map((m) => el('div', { class: 'msg ' + m.level }, m.message));
  }

  /* ---------- controls per type ---------- */
  function buildControl(field, b, id) {
    switch (field.type) {
      case 'bool': {
        const input = el('input', { type: 'checkbox', id, role: 'switch' });
        const text = el('span', { class: 'switch-text' });
        input.addEventListener('change', () => b.set(input.checked));
        return {
          node: el('label', { class: 'switch' }, input, el('span', { class: 'track', 'aria-hidden': 'true' }), text),
          focusEl: input,
          alwaysSync: true,
          setValue: (v) => {
            input.checked = !!v;
            text.textContent = v ? 'true' : 'false';
          },
          setDisabled: (d) => (input.disabled = d),
        };
      }

      case 'select': {
        const placeholder = el('option', { value: '', disabled: true }, 'Choose…');
        const custom = el('option', { value: 'custom', hidden: true });
        let customValue;
        const select = el(
          'select',
          { id },
          placeholder,
          field.options.map((o, i) => el('option', { value: String(i) }, o.label)),
          custom
        );
        select.addEventListener('change', () => {
          b.set(select.value === 'custom' ? customValue : field.options[Number(select.value)].value);
        });
        return {
          node: el('div', { class: 'select-wrap' }, select),
          focusEl: select,
          alwaysSync: true,
          setValue: (v) => {
            const i = field.options.findIndex((o) => o.value === v);
            if (i < 0 && !util.isEmpty(v)) {
              customValue = v;
              custom.textContent = v + ' (not in list)';
              custom.hidden = false;
              select.value = 'custom';
            } else {
              custom.hidden = true;
              select.value = i >= 0 ? String(i) : '';
            }
          },
          setDisabled: (d) => (select.disabled = d),
        };
      }

      case 'number': {
        const input = el('input', {
          type: 'number',
          id,
          step: field.step ?? (field.integer ? 1 : 'any'),
          min: field.min,
          max: field.max,
          inputmode: field.integer ? 'numeric' : 'decimal',
        });
        input.addEventListener('input', () => b.set(input.value === '' ? '' : Number(input.value)));
        return {
          node: input,
          focusEl: input,
          setValue: (v) => (input.value = v === undefined || v === null ? '' : String(v)),
          setDisabled: (d) => (input.disabled = d),
        };
      }

      case 'multi': {
        const rows = field.layout === 'rows';
        const boxes = field.options.map((o, i) => {
          const cb = el('input', { type: 'checkbox', id: i === 0 ? id : undefined });
          cb.addEventListener('change', () => {
            const current = new Set(b.get() || []);
            if (cb.checked) current.add(o.value);
            else current.delete(o.value);
            const known = field.options.map((x) => x.value);
            b.set(known.filter((x) => current.has(x)).concat([...current].filter((x) => !known.includes(x))));
          });
          const node = rows
            ? el('label', { class: 'option-row' }, cb, el('span', {}, el('code', {}, o.label), el('span', { class: 'desc' }, o.description)))
            : el('label', { class: 'chip' }, cb, el('span', {}, o.label));
          return { cb, node, value: o.value };
        });
        return {
          node: el('div', { class: rows ? 'option-rows' : 'chips' }, boxes.map((x) => x.node)),
          focusEl: boxes[0] && boxes[0].cb,
          alwaysSync: true,
          setValue: (v) => boxes.forEach((x) => (x.cb.checked = Array.isArray(v) && v.includes(x.value))),
          setDisabled: (d) => boxes.forEach((x) => (x.cb.disabled = d)),
        };
      }

      default: {
        // text, hex
        const input = el('input', {
          type: 'text',
          id,
          class: field.type === 'hex' ? 'mono' : undefined,
          placeholder: field.placeholder,
          spellcheck: 'false',
          autocomplete: 'off',
        });
        input.addEventListener('input', () => b.set(input.value));
        return {
          node: input,
          focusEl: input,
          setValue: (v) => (input.value = v == null ? '' : String(v)),
          setDisabled: (d) => (input.disabled = d),
        };
      }
    }
  }

  /* ---------- a single field ---------- */
  function renderField(field, b, opts = {}) {
    if (field.type === 'list') return renderList(field, b, opts);

    const id = 'f' + ++uid;
    const compact = !!opts.compact;
    const control = buildControl(field, b, id);
    const meta = el('span', { class: 'meta' });
    const hint = el('div', { class: 'hint' });
    const errors = el('div', { class: 'errors' });

    const resetBtn = b.reset
      ? el('button', { type: 'button', class: 'icon-btn', title: 'Reset to default', 'aria-label': 'Reset to default', onclick: () => b.reset() }, '↺')
      : null;

    const actionBtn = field.action
      ? el(
          'button',
          {
            type: 'button',
            class: 'btn tiny',
            title: field.action.title,
            onclick: () => {
              const v = field.action.run(b.scope);
              if (v != null) {
                b.set(v);
                control.setValue(v);
              } else if (field.action.failMessage) {
                ui.toast(field.action.failMessage, 'warn');
              }
            },
          },
          field.action.label
        )
      : null;

    const head = el(
      'div',
      { class: 'field-head' },
      el('label', { for: id }, field.label, field.required ? el('span', { class: 'req', title: 'Required' }, '*') : null),
      compact ? null : el('code', { class: 'key' }, field.key.split('.').pop())
    );

    const controlRow = el(
      'div',
      { class: 'field-control' },
      control.node,
      field.unit ? el('span', { class: 'unit' }, field.unit) : null,
      actionBtn,
      resetBtn,
      compact ? null : meta
    );

    const node = compact
      ? el('div', { class: 'field compact' + (field.width ? ' ' + field.width : ''), dataset: { path: b.path } }, head, controlRow, hint, errors)
      : el(
          'div',
          { class: 'field', dataset: { path: b.path } },
          el('div', { class: 'field-info' }, head, el('p', { class: 'help' }, field.help)),
          el('div', { class: 'field-main' }, controlRow, hint, errors)
        );

    function refresh() {
      node.hidden = b.visible ? !b.visible() : false;
      const active = b.relevant();
      control.setDisabled(!active);
      if (actionBtn) actionBtn.disabled = !active;
      if (control.alwaysSync || document.activeElement !== control.focusEl) control.setValue(b.get());

      const def = b.defaultValue ? b.defaultValue() : undefined;
      if (resetBtn) resetBtn.hidden = !(b.isTouched() && def !== undefined && !util.equal(def, b.get()));
      meta.textContent = def !== undefined && field.type !== 'multi' && displayValue(field, def) !== '' ? 'Default ' + displayValue(field, def) : '';

      hint.textContent = field.hint ? field.hint(b.get()) || '' : '';
      const list = b.issuesFor(b.path);
      errors.replaceChildren(...messages(list));
      node.classList.toggle('has-error', list.some((m) => m.level === 'error'));
    }

    return { node, refresh };
  }

  /* ---------- lists (domains, ports) ---------- */
  function renderList(field, b, opts = {}) {
    const compact = !!opts.compact;
    const items = el('div', { class: 'list-items' });
    const errors = el('div', { class: 'errors' });
    let childRefreshers = [];
    let buttons = [];
    let dupButtons = [];
    const canAdd = () => !field.canAdd || field.canAdd(b.ctx, arr());

    const arr = () => (Array.isArray(b.get()) ? b.get() : []);
    const commit = (a) => {
      b.set(a);
      rebuild();
      refresh();
    };

    const addBtn = el(
      'button',
      {
        type: 'button',
        class: 'btn ghost small',
        onclick: () => {
          const a = arr();
          a.push(field.newItem(a));
          commit(a);
        },
      },
      '+ ' + (field.addLabel || 'Add')
    );

    const reference = el(
      'details',
      { class: 'ref' },
      el('summary', {}, 'What goes into each ' + (field.itemTitle ? field.itemTitle({}, 0).split(' ')[0].toLowerCase() : 'entry')),
      el(
        'dl',
        {},
        field.itemFields.map((sub) => [
          el('dt', {}, sub.label, ' ', el('code', {}, sub.key)),
          el('dd', {}, sub.help || ''),
        ])
      )
    );

    const head = el(
      'div',
      { class: 'field-head' },
      el('label', {}, field.label, field.required ? el('span', { class: 'req', title: 'Required' }, '*') : null),
      el('code', { class: 'key' }, field.key)
    );

    const node = el(
      'div',
      { class: 'field type-list' + (compact ? ' nested' : ''), dataset: { path: b.path } },
      el('div', { class: 'list-info' }, head, compact ? null : el('p', { class: 'help' }, field.help), reference),
      errors,
      items,
      el('div', { class: 'list-foot' }, addBtn)
    );

    function renderItem(item, i, a) {
      const title = el('span', { class: 'item-title' });
      const dup = el('button', { type: 'button', class: 'icon-btn', title: 'Duplicate', 'aria-label': 'Duplicate', onclick: () => { a.splice(i + 1, 0, util.clone(item)); commit(a); } }, '⧉');
      const del = el('button', { type: 'button', class: 'icon-btn', title: 'Remove', 'aria-label': 'Remove', onclick: () => { a.splice(i, 1); commit(a); } }, '✕');
      buttons.push(dup, del);
      dupButtons.push(dup);

      const grid = el('div', { class: 'item-grid' });
      const nested = el('div', { class: 'item-nested' });
      for (const sub of field.itemFields) {
        const sb = {
          path: b.path + '.' + i + '.' + sub.key,
          ctx: b.ctx,
          get: () => item[sub.key],
          set: (v) => {
            item[sub.key] = v;
            // onChange may adjust sibling values of the same item (e.g. priority1).
            if (sub.onChange) sub.onChange(v, item, b.ctx);
            b.set(arr());
          },
          visible: sub.when ? () => sub.when(b.ctx, item) : undefined,
          scope: item,
          relevant: b.relevant,
          issuesFor: b.issuesFor,
        };
        const r = renderField(sub, sb, { compact: true });
        (sub.type === 'list' ? nested : grid).append(r.node);
        childRefreshers.push(r.refresh);
      }
      childRefreshers.push(() => (title.textContent = DCT.itemTitle(field, item, i)));

      return el(
        'div',
        { class: 'item' + (field.itemStyle === 'row' ? ' row' : '') },
        el('div', { class: 'item-head' }, title, el('div', { class: 'item-actions' }, dup, del)),
        grid,
        nested.childElementCount ? nested : null
      );
    }

    function rebuild() {
      childRefreshers = [];
      buttons = [];
      dupButtons = [];
      const a = arr();
      items.replaceChildren(...a.map((item, i) => renderItem(item, i, a)));
      items.hidden = a.length === 0;
    }

    function refresh() {
      node.hidden = b.visible ? !b.visible() : false;
      const active = b.relevant();
      const addable = canAdd();
      addBtn.disabled = !active;
      addBtn.hidden = !addable;
      buttons.forEach((x) => (x.disabled = !active));
      dupButtons.forEach((x) => (x.hidden = !addable));
      childRefreshers.forEach((fn) => fn());
      const list = b.issuesFor(b.path);
      errors.replaceChildren(...messages(list));
    }

    rebuild();
    return { node, refresh };
  }

  ui.renderField = renderField;
})();