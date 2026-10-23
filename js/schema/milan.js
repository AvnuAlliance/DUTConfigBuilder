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
      'Run Milan-AVB Endstation and Bridged Endstation Tests',
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
        default: false,
        help:
          'Enable to run the Milan tests on both network interfaces of the DUT, for example the primary and secondary interface of a redundant device, or two primary interfaces as on the DS20. Disable to test only one interface.',
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
  });
})();
