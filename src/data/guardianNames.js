const GUARDIAN_NAMES = [
  'Aegis',
  'Nyra',
  'Orion',
  'Zenith',
  'Atlas',
  'Nova',
  'Cipher',
  'Vesper',
  'Zephyr',
  'Iris',
  'Kairos',
  'Lyra',
  'Malachai',
  'Nyx',
  'Odin',
  'Phoenix',
  'Qyra',
  'Rax',
  'Solaris',
  'Thorne',
  'Ulysses',
  'Vex',
  'Warden',
  'Xander',
  'Yasmine',
  'Zara',
  'Aether',
  'Bryn',
  'Caspian',
  'Dryad',
  'Eos',
  'Fennix',
  'Gareth',
  'Halo',
  'Ionic',
  'Jax',
  'Kael',
  'Lux',
  'Mira',
  'Nova',
  'Osiris',
  'Prism',
  'Quill',
  'Rune',
  'Sylph',
  'Titan',
  'Umbra',
  'Valkyrie',
  'Whisper',
  'Xenith',
  'Yara',
];

function getGuardianName(index) {
  const baseNames = GUARDIAN_NAMES;
  const cycleIndex = index % baseNames.length;
  const cycle = Math.floor(index / baseNames.length);

  if (cycle === 0) {
    return baseNames[cycleIndex];
  }

  return `${baseNames[cycleIndex]} ${cycle}`;
}

module.exports = {
  GUARDIAN_NAMES,
  getGuardianName
};
