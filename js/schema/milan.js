/* Top-level options used by the Milan (Advanced Certification Program) test cases. */
(function () {
  'use strict';
  const DCT = window.DCT;

  DCT.defineSection({
    id: 'milan',
    order: 20,
    title: 'Milan',
    path: '',
    profiles: ['milan'],
    description:
      'Used by the Milan test cases, which find and control the DUT through ATDECC.',
    fields: [
      {
        key: 'entity_id',
        label: 'ATDECC Entity ID',
        type: 'hex',
        length: 16,
        required: true,
        placeholder: '3CC0C60500E20000',
        help:
          'The 64-bit ATDECC Entity ID of the DUT (16 hex digits), exactly as it advertises it in its ADP ENTITY_AVAILABLE messages. The Milan test cases use it to recognize the DUT on the network. Any ATDECC controller, such as Hive, shows it. Separators like ":" or "-" are removed in the output.',
      },
      {
        key: 'test_two_ports',
        label: 'Test both interfaces',
        type: 'bool',
        required: true,
        // Follows "Redundant device" in the general settings until changed by hand.
        default: (ctx) => ctx.get('redundant_device') === true,
        help:
          'Enable to run the Milan tests on both network interfaces of the DUT, for example the primary and secondary interface of a redundant device, or two primary interfaces as on the DS20. Disable to test only one interface. Turned on automatically when Redundant device is on in the general settings.',
      },
      {
        key: 'discovery_timeout',
        label: 'Discovery timeout',
        type: 'number',
        unit: 's',
        default: 30,
        exclusiveMin: 0,
        help:
          'Maximum time the Milan test cases wait for the DUT to be discovered through ATDECC before they report a failure. Optional; 30 s applies when it is left out of the file. Increase it if the DUT takes long to start advertising after boot or after a link change.',
      },
    ],
    rules: [
      function redundancyRule(ctx) {
        if (ctx.get('redundant_device') === true && ctx.get('test_two_ports') !== true) {
          return [
            {
              level: 'warning',
              path: 'test_two_ports',
              message: 'Redundant device is on in the general settings, but only one interface will be tested.',
            },
          ];
        }
        return [];
      },
    ],
  });
})();