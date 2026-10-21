/* Top-level options used by every test profile. */
(function () {
  'use strict';
  const DCT = window.DCT;

  DCT.defineSection({
    id: 'general',
    order: 10,
    title: 'General',
    path: '',
    profiles: ['milan', 'gptp', 'bridge'],
    description:
      'Identifies the device under test and tells the test system how long to wait when it switches the DUT on and off via the power block.',
    fields: [
      {
        key: 'name',
        label: 'Device name',
        type: 'text',
        required: true,
        placeholder: 'DS20',
        help:
          'Name of the device under test. Keep it short and unambiguous, for example model and hardware revision, so test runs can be traced back to the exact unit.',
      },
      {
        key: 'power_on_delay',
        label: 'Power-on delay',
        type: 'number',
        unit: 's',
        required: true,
        default: 20,
        exclusiveMin: 0,
        help:
          'Time the test scripts wait after switching the DUT on before they continue. Must be greater than 0. Measure how long the device needs from power-on until it is fully operational (booted, links up, discoverable, gPTP running) and add a safety margin. A value that is too short is a common cause of failures in test cases that power-cycle the DUT.',
      },
      {
        key: 'power_off_delay',
        label: 'Power-off delay',
        type: 'number',
        unit: 's',
        required: true,
        default: 5,
        exclusiveMin: 0,
        help:
          'Time the test scripts wait after switching the DUT off before they continue. Must be greater than 0. Make it long enough for the device to lose power completely, so the next power-on is a real cold start. Devices with large buffer capacitors need more time.',
      },
      {
        key: 'supported_speeds',
        label: 'Supported link speeds',
        type: 'multi',
        unit: 'Mbps',
        required: true,
        default: [100, 1000],
        options: [100, 1000].map((v) => ({ value: v, label: String(v) })),
        help:
          'Ethernet link speeds the DUT supports on the tested interfaces, written to the file as a list of numbers in Mbps, for example [100, 1000].',
      },
    ],
  });
})();
