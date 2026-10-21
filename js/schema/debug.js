/* additional_options: debugging switches that invalidate certification. */
(function () {
  'use strict';
  const DCT = window.DCT;

  const OPTIONS = [
    ['shorter_run', 'Wait 30 s instead of 5 min in test cases 10.1 and 11.10.'],
    ['switch_power_before_test', 'Switch the DUT off and on again before the test. Requires a power block.'],
    ['allow_no_default_biases', 'Skip the check of the gPTP bias values configured on the Linux test machine.'],
    ['gptp_skip_port_iteration', 'Skip the dialog in gPTP test cases 6.x, 7.x, 8.1 and 23.1 that asks you to move the cable to the other Ethernet port.'],
    ['allow_pre_part_link_toggle', 'Take the Ethernet link down and up in the gPTP test cases.'],
    ['allow_experimental_profishark', 'Skip the ProfiShark firmware check.'],
  ];

  DCT.defineSection({
    id: 'debug',
    order: 90,
    title: 'Debug options',
    short: 'Debug',
    path: '',
    profiles: ['milan', 'gptp', 'switch'],
    variant: 'danger',
    description: 'For debugging only. Selecting any option here invalidates the certification result.',
    fields: [
      {
        key: 'additional_options',
        label: 'Additional options',
        type: 'multi',
        layout: 'rows',
        default: [],
        options: OPTIONS.map(([value, description]) => ({ value, label: value, description })),
        help: 'Each option changes how the tests run. Leave all of them off for a certification run.',
      },
    ],
    rules: [
      (ctx) =>
        (ctx.get('additional_options') || []).length
          ? [{ level: 'warning', path: 'additional_options', message: 'Debug options are selected, so the results cannot be used for certification.' }]
          : [],
    ],
  });
})();