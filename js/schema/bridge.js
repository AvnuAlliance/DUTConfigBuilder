/* dot1ba_config: options for testing switches. */
(function () {
  'use strict';
  const DCT = window.DCT;

  DCT.defineSection({
    id: 'bridge',
    order: 40,
    title: 'Bridge (IEEE 802.1BA)',
    short: 'Bridge',
    path: 'dot1ba_config',
    profiles: ['bridge'],
    description: 'Written to the dot1ba_config section. Required for testing switches.',
    fields: [
      {
        key: 'bridge_mac',
        label: 'Bridge MAC address',
        type: 'hex',
        length: 12,
        required: true,
        placeholder: '3CC0C60002C6',
        help:
          'Base MAC address of the switch (12 hex digits). This is the address of the bridge itself, not of an individual port. Separators are removed in the output.',
      },
      {
        key: 'reg_mvrp_not_forwarding',
        label: 'Registers MVRP when not forwarding',
        type: 'bool',
        required: true,
        default: false,
        help:
          'Turn on if the DUT registers MVRP attribute events (VLAN registrations) on a port that is not in the forwarding state. The MVRP test cases expect different behavior depending on this setting.',
      },
      {
        key: 'test_two_ports_only',
        label: 'Only two ports available',
        type: 'bool',
        default: false,
        help:
          'Turn on if the DUT has only two ports that can be used for testing. Leave off (default) when three or more ports can be connected to the test system.',
      },
    ],
  });
})();
