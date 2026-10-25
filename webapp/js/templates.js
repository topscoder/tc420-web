// Starting points for new programs. Names follow the 8-character rule.
import PLED from './pled-examples.js';

const all = (hour, minute, level) => ({
  hour,
  minute,
  ch: Array(5).fill(level),
  jump: Array(5).fill(false),
});

const fromRows = (rows) =>
  rows.map(([hour, minute, c1, c2, c3, c4, c5, bits]) => ({
    hour,
    minute,
    ch: [c1, c2, c3, c4, c5],
    jump: [0, 1, 2, 3, 4].map((i) => !!(bits & (1 << i))),
  }));

// id → { name, steps(), linked }. Label key: templates.<id>.
export const TEMPLATES = {
  daynight: {
    name: 'DAYNIGHT',
    linked: true,
    steps: () => [all(0, 0, 0), all(8, 0, 0), all(8, 30, 100), all(20, 0, 100), all(20, 30, 0)],
  },
  sunrise: {
    name: 'SUNRISE',
    linked: true,
    steps: () => [
      all(0, 0, 0),
      all(6, 30, 0),
      all(7, 30, 30),
      all(9, 0, 80),
      all(12, 0, 100),
      all(15, 0, 100),
      all(18, 0, 80),
      all(19, 30, 30),
      all(20, 30, 0),
    ],
  },
  winter: {
    name: 'WINTER',
    linked: true,
    steps: () => [
      all(0, 0, 10),
      all(7, 0, 10),
      all(7, 30, 70),
      all(11, 0, 70),
      all(11, 30, 100),
      all(15, 0, 100),
      all(15, 30, 70),
      all(20, 0, 70),
      all(20, 30, 10),
    ],
  },
  summer: {
    name: 'SUMMER',
    linked: true,
    steps: () => [
      all(0, 0, 10),
      all(6, 0, 10),
      all(6, 30, 70),
      all(11, 0, 70),
      all(11, 30, 100),
      all(15, 0, 100),
      all(15, 30, 70),
      all(21, 30, 70),
      all(22, 0, 10),
    ],
  },
  afrika: { name: 'AFRIKA', linked: false, steps: () => fromRows(PLED.AFRIKA) },
  amazone: { name: 'AMAZONE', linked: false, steps: () => fromRows(PLED.AMAZONE) },
  thailand: { name: 'THAILAND', linked: false, steps: () => fromRows(PLED.THAILAND) },
};
