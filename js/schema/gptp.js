/* gptp_config: everything the IEEE 802.1AS test cases need. */
(function () {
  'use strict';
  const DCT = window.DCT;
  const util = DCT.util;

  const CONFORMANCE_2011 = 'IEEE802.1AS-2011';
  const CONFORMANCE_2020 = 'IEEE802.1AS-2020';
  const is2020 = (ctx) => ctx.get('gptp_config.conformance') === CONFORMANCE_2020;

  const TIME_SOURCES = [
    { value: 0x10, label: '16 (0x10) Atomic clock' },
    { value: 0x20, label: '32 (0x20) GPS' },
    { value: 0x30, label: '48 (0x30) Terrestrial radio' },
    { value: 0x40, label: '64 (0x40) PTP' },
    { value: 0x50, label: '80 (0x50) NTP' },
    { value: 0x60, label: '96 (0x60) Hand set' },
    { value: 0x90, label: '144 (0x90) Other' },
    { value: 0xa0, label: '160 (0xA0) Internal oscillator' },
  ];

  /* ---------- ports (used in domains and CMLDS) ---------- */
  const portFields = () => [
    {
      key: 'number',
      label: 'Port number',
      type: 'number',
      integer: true,
      min: 1,
      max: 65535,
      required: true,
      width: 'narrow',
      help: 'PTP port number of the DUT port (portIdentity.portNumber). Port numbers start at 1.',
    },
    {
      key: 'clock_identity',
      label: 'Clock identity',
      type: 'hex',
      length: 16,
      required: true,
      placeholder: '3CC0C6FFFE0500E2',
      width: 'wide',
      action: {
        label: 'From MAC',
        title: 'Derive from the MAC address of this port by inserting FFFE in the middle',
        run: (item) => util.macToClockIdentity(item.mac_address),
        failMessage: 'Enter a valid 12-digit MAC address for this port first.',
      },
      help:
        'clockIdentity the DUT sends in its gPTP messages (EUI-64, 16 hex digits). Together with the port number it forms the port identity. IEEE 802.1AS-2011 - subclause 8.5.2.2.1 defines mapping rules to convert EUI-48  to EUI-64. It mandates to put FFFE in the middle of MAC address. Check it against a capture of the DUT’s Announce or Pdelay messages.',
    },
    {
      key: 'mac_address',
      label: 'MAC address',
      type: 'hex',
      length: 12,
      required: true,
      placeholder: '3CC0C60500E2',
      help:
        'Source MAC address the DUT uses for gPTP frames on this port (12 hex digits). Separators are removed in the output.',
    },
  ];

  const newPort = (arr) => {
    const last = arr[arr.length - 1];
    return {
      number: last ? (Number(last.number) || 0) + 1 : 1,
      clock_identity: last ? last.clock_identity || '' : '',
      mac_address: '',
    };
  };

  const portList = (overrides) =>
    Object.assign(
      {
        type: 'list',
        itemFields: portFields(),
        newItem: newPort,
        itemTitle: (p) => 'Port ' + (p.number ?? '?'),
        itemStyle: 'row',
        addLabel: 'Add port',
      },
      overrides
    );

  /* ---------- domains ---------- */
  const newDomain = (arr) => {
    const used = new Set(arr.map((d) => Number(d.number)));
    let n = 0;
    while (used.has(n)) n++;
    const template = arr[0] && Array.isArray(arr[0].ports) && arr[0].ports.length ? arr[0].ports : [{ number: 1 }];
    return {
      number: n,
      priority1: 248,
      time_source: 0xa0,
      priority2: 248,
      is_gm_capable: true,
      // Same ports and MACs as the first domain; clock identities usually differ per domain.
      ports: template.map((p) => ({ number: p.number, clock_identity: '', mac_address: p.mac_address || '' })),
    };
  };

  const domainFields = [
    {
      key: 'number',
      label: 'Domain number',
      type: 'number',
      integer: true,
      min: 0,
      max: 255,
      required: true,
      width: 'narrow',
      help:
        'gPTP domain number (domainNumber). An entry for domain 0 is mandatory. IEEE 802.1AS-2011 supports domain 0 only; additional domains require IEEE 802.1AS-2020 and the CMLDS ports.',
    },
    {
      key: 'priority1',
      label: 'priority1',
      type: 'number',
      integer: true,
      min: 0,
      max: 255,
      required: true,
      width: 'narrow',
      help:
        'priority1 of the DUT’s clock in this domain, as advertised in Announce messages. Lower values win the best master selection. IEEE 802.1AS Table 8-2 defaults: 246 for network infrastructure devices, 248 for other devices, 250 for portable devices, 255 if the device is not grandmaster-capable.',
    },
    {
      key: 'priority2',
      label: 'priority2',
      type: 'number',
      integer: true,
      min: 0,
      max: 255,
      required: true,
      width: 'narrow',
      help:
        'priority2 of the DUT’s clock, as advertised in Announce messages. It is compared after priority1 and the clock quality in the best master selection. IEEE 802.1AS Clause 8.6.2.5 priority2 default: 248.',
    },
    {
      key: 'time_source',
      label: 'Time source',
      type: 'select',
      options: TIME_SOURCES,
      required: true,
      help:
        'timeSource the DUT advertises in Announce messages. IEEE 1588-2008 Table 7 defines 160 (0xA0) for Internal Oscillator.',
    },
    {
      key: 'is_gm_capable',
      label: 'Grandmaster-capable',
      type: 'bool',
      required: true,
      onChange: (value, domain) => {
        if (value === false) domain.priority1 = 255;
        else if (Number(domain.priority1) === 255) domain.priority1 = 248;
      },
      help:
        'Whether the DUT can become grandmaster in this domain. If it cannot, priority1 must be 255. Turning this off sets priority1 to 255; turning it on again sets 248.',
    },
    portList({
      key: 'ports',
      label: 'Ports',
      required: true,
      help: 'Every gPTP port of the DUT in this domain, with its port identity and MAC address.',
    }),
  ];

  const logInterval = (key, label, def, help) => ({
    key,
    label,
    type: 'number',
    integer: true,
    min: -128,
    max: 127,
    default: def,
    group: 'Initial message intervals',
    hint: (v) => (v === '' || v == null || !Number.isInteger(Number(v)) ? '' : 'Interval: ' + util.log2IntervalText(Number(v))),
    help,
  });

  const capability = (key, label, help) => ({
    key,
    label,
    type: 'bool',
    required: true,
    default: false,
    group: 'DUT capabilities',
    help,
  });

  DCT.defineSection({
    id: 'gptp',
    order: 30,
    title: 'gPTP (IEEE 802.1AS)',
    short: 'gPTP',
    path: 'gptp_config',
    profiles: ['gptp'],
    description: 'Written to the gptp_config section. Required to run the IEEE 802.1AS test cases.',
    fields: [
      /* ---- identity ---- */
      {
        key: 'conformance',
        label: 'Conformance',
        type: 'select',
        required: true,
        group: 'Device',
        options: [
          { value: CONFORMANCE_2011, label: CONFORMANCE_2011 },
          { value: CONFORMANCE_2020, label: CONFORMANCE_2020 },
        ],
        help:
          'Edition of IEEE 802.1AS the DUT implements. It selects the expected behavior in the gPTP test cases and the default for allowed lost responses (3 for 2011, 9 for 2020).',
      },
      {
        key: 'is_bridge',
        label: 'Time-aware switch',
        type: 'bool',
        required: true,
        group: 'Device',
        default: false,
        help:
          'Turn on if the DUT is a time-aware switch, which relays gPTP time from one port to its other ports. Endstations use false. A redundant device (see the general settings) is an endstation, even though it has two interfaces.',
      },
      {
        key: 'domains',
        label: 'Domains',
        type: 'list',
        required: true,
        group: 'Device',
        default: () => [newDomain([])],
        itemFields: domainFields,
        newItem: newDomain,
        itemTitle: (d) => 'Domain ' + (d.number ?? '?'),
        addLabel: 'Add domain',
        // Only IEEE 802.1AS-2020 supports more than one domain.
        canAdd: (ctx, domains) => domains.length === 0 || is2020(ctx),
        help:
          'The gPTP domains of the DUT with the clock attributes it advertises and the ports taking part in each domain. IEEE 802.1AS-2011 supports domain 0 only. With IEEE 802.1AS-2020 you can add further domains; a new domain copies the port numbers and MAC addresses of the first domain.',
      },
      portList({
        key: 'CMLDS.ports',
        label: 'CMLDS ports',
        group: 'Device',
        when: is2020, // CMLDS exists only in IEEE 802.1AS-2020
        default: () => [],
        addLabel: 'Add CMLDS port',
        help:
          'For devices using the Common Mean Link Delay Service (CMLDS) of IEEE 802.1AS-2020. Required when the DUT supports more than one domain. CMLDS has its own clock identity, which usually differs from the clock identity of the domains. Leave the list empty otherwise; the CMLDS section is then left out of the file.',
      }),

      /* ---- message behavior ---- */
      {
        key: 'one_step',
        label: 'One-step Sync',
        type: 'bool',
        default: false,
        group: 'Message behavior',
        help:
          'Turn on if the DUT sends one-step Sync messages, carrying the timestamp in the Sync message itself without a Follow_Up. Most gPTP devices use two-step (off).',
      },
      {
        key: 'sends_signaling_messages',
        label: 'Sends Signaling messages',
        type: 'bool',
        default: true,
        group: 'Message behavior',
        help:
          'Whether the DUT sends gPTP Signaling messages at all. If it does not, the two TLV options below must be off as well.',
      },
      {
        key: 'sends_message_interval_request_tlv',
        label: 'Sends message interval request TLV',
        type: 'bool',
        default: true,
        group: 'Message behavior',
        help:
          'Whether the DUT’s Signaling messages carry the message interval request TLV, which asks the link partner to change its Sync, Announce or Pdelay_Req interval.',
      },
      {
        key: 'sends_gptp_capable_message_interval_request_tlv',
        label: 'Sends gPTP-capable message interval request TLV',
        type: 'bool',
        default: true,
        group: 'Message behavior',
        help:
          'Whether the DUT’s Signaling messages carry the gPTP-capable message interval request TLV (IEEE 802.1AS-2020), which asks the link partner to change how often it sends gPTP-capable Signaling messages.',
      },

      /* ---- intervals ---- */
      logInterval(
        'initial_log_sync_interval',
        'Initial Sync interval',
        -3,
        'initialLogSyncInterval: the interval between Sync messages the DUT starts with, as the base-2 logarithm of seconds. −3 means 125 ms, which is the default.'
      ),
      logInterval(
        'initial_log_announce_interval',
        'Initial Announce interval',
        0,
        'initialLogAnnounceInterval: the interval between Announce messages the DUT starts with, as the base-2 logarithm of seconds. 0 means 1 s, which is the default.'
      ),
      logInterval(
        'initial_log_pdelay_interval',
        'Initial Pdelay_Req interval',
        0,
        'initialLogPdelayReqInterval: the interval between Pdelay_Req messages the DUT starts with, as the base-2 logarithm of seconds. 0 means 1 s, which is the default.'
      ),
      logInterval(
        'initial_log_gptp_capable_message_interval',
        'Initial gPTP-capable interval',
        0,
        'The interval between Signaling messages carrying the gPTP-capable TLV (IEEE 802.1AS-2020) the DUT starts with, as the base-2 logarithm of seconds. 0 means 1 s, which is the default.'
      ),

      /* ---- thresholds ---- */
      {
        key: 'neighbor_rate_ratio_valid_threshold',
        label: 'Neighbor rate ratio valid threshold',
        type: 'number',
        integer: true,
        min: 0,
        default: 10,
        group: 'Thresholds',
        help:
          'Threshold the DUT applies before it sets neighborRateRatioValid, meaning before it considers the measured frequency ratio to its link partner valid. Typically this is the number of Pdelay exchanges the DUT needs for that calculation. Default 10.',
      },
      {
        key: 'allowed_lost_responses',
        label: 'Allowed lost responses',
        type: 'number',
        integer: true,
        min: 0,
        group: 'Thresholds',
        default: (ctx) => (ctx.get('gptp_config.conformance') === CONFORMANCE_2020 ? 9 : 3),
        help:
          'allowedLostResponses: how many Pdelay_Req messages in a row may go without a valid response before the DUT resets asCapable and asCapableAcrossDomains. Default 3 for IEEE 802.1AS-2011 and 9 for 2020; this field follows the selected conformance until you enter a value.',
      },

      /* ---- capabilities ---- */
      capability(
        'can_set_priority1_to_255',
        'Can set priority1 to 255',
        'Whether priority1 can be configured to 255 on the DUT, making it not grandmaster-capable. Some test cases need the DUT in that state.'
      ),
      capability(
        'has_access_to_signal_locked_to_gptp',
        'Has signal locked to gPTP',
        'Whether a signal locked to gPTP time is accessible on the DUT, for example a 1PPS or media clock output, so that synchronization accuracy can be measured externally.'
      ),
      capability(
        'can_report_pdelay_length_of_cable',
        'Can report cable delay',
        'Whether the DUT can report the link delay it measured with Pdelay (the delay caused by the cable) through a management or user interface, so it can be compared with the expected value.'
      ),
      capability(
        'can_administratively_disable_port',
        'Can disable a port',
        'Whether a DUT port can be switched off by configuration, for example in a web interface or CLI, without unplugging the cable.'
      ),
      capability(
        'can_administratively_disable_gptp_on_port',
        'Can disable gPTP on a port',
        'Whether gPTP can be turned off on a single port while the port itself stays up.'
      ),
      capability(
        'allows_configuring_neighbor_prop_delay_threshold',
        'Can raise neighbor prop delay threshold',
        'Whether neighborPropDelayThresh can be configured to a value above 10 ms. A port whose measured link delay exceeds this threshold is not asCapable; the IEEE 802.1AS default for copper links is 800 ns.'
      ),

      /* ---- Avnu requirements ---- */
      {
        key: 'supports_avnu_ptp5',
        label: 'Supports Avnu PTP-5',
        type: 'bool',
        default: true,
        group: 'Avnu requirements',
        help:
          'Avnu requirement PTP-5: the DUT stops sending Pdelay_Req when, for allowedLostResponses Pdelay_Req messages in a row, it receives more than one Pdelay_Resp from different clock identities. It resumes after 5 minutes, after a link toggle, or when portOper or ptpPortEnabled toggles. Default on.',
      },
      {
        key: 'sync_locked',
        label: 'Sync locked (PTP relay)',
        type: 'bool',
        default: false,
        group: 'Avnu requirements',
        help:
          'IEEE 802.1AS-2020 (bridges): does the PTP instance act as a PTP relay instance on two or more PTP ports? Avnu requirement PTP-29 asks whether the implementation supports this PTP relay function. Default off.',
      },
      {
        key: 'supports_subnano_timestamp',
        label: 'Sub-nanosecond timestamps',
        type: 'bool',
        default: false,
        group: 'Avnu requirements',
        help: 'Whether the implementation supports a timestamp granularity below 1 nanosecond. Default off.',
      },
    ],

    rules: [
      function domainRules(ctx) {
        const issues = [];
        const domains = ctx.get('gptp_config.domains') || [];
        const cmlds = ctx.get('gptp_config.CMLDS.ports') || [];
        const conformance = ctx.get('gptp_config.conformance');
        const numbers = domains.map((d) => Number(d.number));

        if (!numbers.includes(0)) {
          issues.push({ path: 'gptp_config.domains', message: 'An entry for domain 0 is required.' });
        }
        const dup = [...new Set(numbers.filter((n, i) => numbers.indexOf(n) !== i))];
        if (dup.length) {
          issues.push({ path: 'gptp_config.domains', message: 'Domain number ' + dup.join(', ') + ' is used more than once.' });
        }
        if (conformance === CONFORMANCE_2011 && numbers.some((n) => n !== 0)) {
          issues.push({ path: 'gptp_config.domains', message: 'IEEE 802.1AS-2011 supports domain 0 only. Remove the other domains.' });
        }
        if (conformance === CONFORMANCE_2020 && domains.length > 1 && !cmlds.length) {
          issues.push({ path: 'gptp_config.CMLDS.ports', message: 'More than one domain is configured, so the CMLDS ports must be listed.' });
        }
        domains.forEach((d, i) => {
          const path = 'gptp_config.domains.' + i + '.priority1';
          if (d.is_gm_capable === false && Number(d.priority1) !== 255) {
            issues.push({ level: 'warning', path, message: 'The DUT is not grandmaster-capable in this domain, so priority1 should be 255.' });
          }
          if (d.is_gm_capable === true && Number(d.priority1) === 255) {
            issues.push({ level: 'warning', path, message: 'priority1 255 means not grandmaster-capable, but Grandmaster-capable is on.' });
          }
        });
        return issues;
      },

      function redundantBridgeRule(ctx) {
        if (ctx.get('redundant_device') === true && ctx.get('gptp_config.is_bridge') === true) {
          return [
            {
              level: 'warning',
              path: 'gptp_config.is_bridge',
              message: 'Redundant device is on in the general settings, so the DUT is an endstation and cannot be a time-aware bridge. Turn one of them off.',
            },
          ];
        }
        return [];
      },

      function signalingRule(ctx) {
        if (ctx.get('gptp_config.sends_signaling_messages') !== false) return [];
        return ['sends_message_interval_request_tlv', 'sends_gptp_capable_message_interval_request_tlv']
          .filter((k) => ctx.get('gptp_config.' + k) === true)
          .map((k) => ({
            level: 'warning',
            path: 'gptp_config.' + k,
            message: 'The DUT does not send Signaling messages, so it cannot send this TLV. Turn it off.',
          }));
      },
    ],
  });
})();