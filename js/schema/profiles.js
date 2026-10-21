/*
 * Test profiles shown at the top of the page. Sections declare which
 * profiles they belong to; a section is editable when at least one of its
 * profiles is selected. Add a profile here, then reference its id in sections.
 */
(function () {
  'use strict';
  const DCT = window.DCT;

  DCT.defineProfile({
    id: 'milan',
    label: 'Milan',
    description: 'Milan-AVB Endstation Certification Program',
  });

  DCT.defineProfile({
    id: 'gptp',
    label: 'gPTP',
    description: 'IEEE 802.1AS time synchronization test cases',
  });

  DCT.defineProfile({
    id: 'switch',
    label: 'Switch',
    description: 'Milan-AVB Switch Certification Program',
  });
})();