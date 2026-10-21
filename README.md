# DUT Config Builder

Browser tool that creates DUT configuration files for the Avnu Express Test Suite (AETS).

## Run

Open `index.html` in any current browser (Chrome, Edge, Firefox). No server, no installation.
The scripts are plain files loaded with `<script src>`, which works from `file://`.

## Structure

```
index.html            page skeleton and script order
css/styles.css        all styling (light and dark)
js/core/util.js       generic helpers (paths, hex, DOM builder)
js/core/registry.js   schema registry: defineProfile(), defineSection()
js/core/store.js      state, defaults, import of existing files
js/core/validation.js generic checks + section rules
js/core/serializer.js state -> configuration object
js/core/json.js       pretty printing, lenient parsing (accepts 0xA0)
js/schema/*.js        the DUT options, one file per section   <- most changes happen here
js/ui/fields.js       one renderer per field type
js/ui/app.js          page wiring, preview, import/copy/download
```

The form, validation, output and import are all generated from the schema files.
The UI and engine contain no knowledge of individual options.

## Add an option

Add an entry to the `fields` array of the matching section in `js/schema/`:

```js
{
  key: 'my_new_option',        // JSON key (relative to the section path)
  label: 'My new option',
  type: 'bool',                // text | hex | number | bool | select | multi | list
  default: false,              // value, or (ctx) => value for dynamic defaults
  required: false,             // required fields are always written
  group: 'DUT capabilities',   // optional sub-heading
  help: 'What it means and when to change it.',
}
```

Other field properties: `unit`, `min`, `max`, `exclusiveMin`, `integer`, `length` (hex),
`options` (select, multi), `placeholder`, `hint: (v) => text`, `when: (ctx) => bool`,
`validate: (value, ctx, scope) => message`, `action` (button next to the input).

Cross-field checks go into the section's `rules` array and return
`[{ level: 'error' | 'warning', path, message }]`.

## Add a section or profile

Create a file in `js/schema/` that calls `DCT.defineSection({...})` and add a
`<script>` line for it in `index.html`. Profiles are defined in `js/schema/profiles.js`.
