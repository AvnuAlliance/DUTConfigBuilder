/*
 * Application state. Values are kept in a flat map keyed by the full JSON
 * path of each top-level field ("gptp_config.one_step"). A field that the
 * user has not touched has no entry and resolves to its (possibly dynamic)
 * default. List fields always hold an array, which list editors mutate.
 */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;
  const has = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

  DCT.createStore = function () {
    const listeners = new Set();
    const state = { profiles: new Set(), values: {}, options: { explicitDefaults: true } };
    let index = null;
    const fieldIndex = () => index || (index = new Map(DCT.allFields().map((f) => [f.path, f])));

    function effective(path) {
      if (has(state.values, path)) return state.values[path];
      const entry = fieldIndex().get(path);
      return entry ? DCT.defaultOf(entry.field, ctx) : undefined;
    }

    /** Context handed to defaults, rules and `when` conditions. */
    const ctx = { profiles: state.profiles, get: effective };

    function seedLists() {
      for (const { field, path } of fieldIndex().values()) {
        if (field.type === 'list') state.values[path] = DCT.defaultOf(field, ctx) || [];
      }
    }

    const emit = () => listeners.forEach((fn) => fn());

    function findUnknownKeys(obj) {
      const idx = fieldIndex();
      const prefixes = new Set();
      for (const p of idx.keys()) {
        const parts = p.split('.');
        for (let i = 1; i < parts.length; i++) prefixes.add(parts.slice(0, i).join('.'));
      }
      const out = [];
      function walkItems(field, arr, path) {
        if (!Array.isArray(arr)) return;
        arr.forEach((item, i) => {
          for (const [k, v] of Object.entries(item || {})) {
            const sub = field.itemFields.find((f) => f.key === k);
            const p = path + '[' + i + '].' + k;
            if (!sub) out.push(p);
            else if (sub.type === 'list') walkItems(sub, v, p);
          }
        });
      }
      (function walk(o, prefix) {
        for (const [k, v] of Object.entries(o || {})) {
          const p = util.joinPath(prefix, k);
          const entry = idx.get(p);
          if (entry) {
            if (entry.field.type === 'list') walkItems(entry.field, v, p);
          } else if (prefixes.has(p) && util.isPlainObject(v)) {
            walk(v, p);
          } else {
            out.push(p);
          }
        }
      })(obj, '');
      return out;
    }

    const store = {
      ctx,
      options: state.options,

      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },

      hasProfile: (id) => state.profiles.has(id),
      setProfile(id, on) {
        if (on) state.profiles.add(id);
        else state.profiles.delete(id);
        emit();
      },
      setAllProfiles(on) {
        DCT.schema.profiles.forEach((p) => (on ? state.profiles.add(p.id) : state.profiles.delete(p.id)));
        emit();
      },

      setOption(key, value) {
        state.options[key] = value;
        emit();
      },

      get: effective,
      set(path, value) {
        state.values[path] = value;
        emit();
      },
      isTouched: (path) => has(state.values, path),
      resetField(path) {
        delete state.values[path];
        emit();
      },
      resetFields(paths) {
        paths.forEach((p) => delete state.values[p]);
        emit();
      },

      reset() {
        state.profiles.clear();
        state.values = {};
        seedLists();
        emit();
      },

      /** Load an existing configuration object. Returns keys the schema does not know. */
      load(obj) {
        state.profiles.clear();
        state.values = {};
        // A profile counts as used if its own section has any value in the file.
        for (const section of DCT.schema.sections) {
          if (section.profiles.length !== 1) continue;
          const used = section.fields.some((f) => util.getPath(obj, DCT.fieldPath(section, f)) !== undefined);
          if (used) state.profiles.add(section.profiles[0]);
        }
        seedLists();
        for (const { field, path } of fieldIndex().values()) {
          const v = util.getPath(obj, path);
          if (v === undefined) continue;
          state.values[path] = field.type === 'list' ? (Array.isArray(v) ? util.clone(v) : []) : v;
        }
        const unknown = findUnknownKeys(obj);
        emit();
        return { unknown };
      },
    };

    seedLists();
    return store;
  };
})();