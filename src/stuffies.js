export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];

export const RARITY_LABELS = {
  common: '⚪ Common',
  uncommon: '🟢 Uncommon',
  rare: '🔵 Rare',
  epic: '🟣 Epic',
  legendary: '🟡 Legendary',
  mythic: '🌈 Mythic',
};

export const RARITY_COLORS = {
  common: '#aaa',
  uncommon: '#4caf50',
  rare: '#2196f3',
  epic: '#9c27b0',
  legendary: '#ff9800',
  mythic: 'var(--mythic-gradient)',
};

// Bag definitions: name, cost, emoji, and rarity weights (must sum to 100)
export const BAGS = {
  crinkle: {
    name: 'Crinkle Bag',
    emoji: '🛍️',
    cost: 15,
    desc: 'Common & Uncommon stuffies only',
    weights: { common: 70, uncommon: 30, rare: 0, epic: 0, legendary: 0, mythic: 0 },
  },
  silver: {
    name: 'Silver Bag',
    emoji: '🥈',
    cost: 40,
    desc: 'Chance at Rare!',
    weights: { common: 45, uncommon: 35, rare: 20, epic: 0, legendary: 0, mythic: 0 },
  },
  gold: {
    name: 'Gold Bag',
    emoji: '🥇',
    cost: 100,
    desc: 'Chance at Epic!',
    weights: { common: 25, uncommon: 30, rare: 30, epic: 15, legendary: 0, mythic: 0 },
  },
  diamond: {
    name: 'Diamond Bag',
    emoji: '💎',
    cost: 250,
    desc: 'Chance at Legendary!',
    weights: { common: 10, uncommon: 20, rare: 30, epic: 25, legendary: 15, mythic: 0 },
  },
  mythic: {
    name: 'Mythic Bag',
    emoji: '✨',
    cost: 600,
    desc: 'All rarities — even Mythic!',
    weights: { common: 5, uncommon: 10, rare: 20, epic: 30, legendary: 25, mythic: 10 },
  },
  plush: {
    name: 'Plush Bag',
    emoji: '🧸',
    cost: 100,
    desc: 'Real stuffie art — hand-picked designs!',
    weights: { common: 34, uncommon: 30, rare: 20, epic: 10, legendary: 5, mythic: 1 },
  },
};

// Each stuffie has a fixed rarity — a Stripe Zebra is always Legendary, everywhere.
export const STUFFIE_ROSTER = [
  // Common (12)
  { key: 'puppy',      emoji: '🐶', name: 'Pudding Pup',        rarity: 'common' },
  { key: 'kitty',      emoji: '🐱', name: 'Snuggle Kitty',      rarity: 'common' },
  { key: 'bunny',      emoji: '🐰', name: 'Biscuit Bunny',      rarity: 'common' },
  { key: 'chick',      emoji: '🐥', name: 'Sunny Chick',        rarity: 'common' },
  { key: 'pig',        emoji: '🐷', name: 'Rosie Pig',          rarity: 'common' },
  { key: 'hamster',    emoji: '🐹', name: 'Nibbles Hamster',    rarity: 'common' },
  { key: 'frog',       emoji: '🐸', name: 'Puddle Frog',        rarity: 'common' },
  { key: 'turtle',     emoji: '🐢', name: 'Pebble Turtle',      rarity: 'common' },
  { key: 'bee',        emoji: '🐝', name: 'Honey Bee',          rarity: 'common' },
  { key: 'ladybug',    emoji: '🐞', name: 'Dotty Ladybug',      rarity: 'common' },
  { key: 'hedgehog',   emoji: '🦔', name: 'Pepper Hedgehog',    rarity: 'common' },
  { key: 'penguin',    emoji: '🐧', name: 'Pebble Penguin',     rarity: 'common' },
  // Uncommon (10)
  { key: 'koala',      emoji: '🐨', name: 'Misty Koala',        rarity: 'uncommon' },
  { key: 'panda',      emoji: '🐼', name: 'Marshmallow Panda',  rarity: 'uncommon' },
  { key: 'bear',       emoji: '🐻', name: 'Honey Bear',         rarity: 'uncommon' },
  { key: 'fox',        emoji: '🦊', name: 'Clover Fox',         rarity: 'uncommon' },
  { key: 'wolf',       emoji: '🐺', name: 'Storm Wolf',         rarity: 'uncommon' },
  { key: 'raccoon',    emoji: '🦝', name: 'Bandit Raccoon',     rarity: 'uncommon' },
  { key: 'otter',      emoji: '🦦', name: 'River Otter',        rarity: 'uncommon' },
  { key: 'sloth',      emoji: '🦥', name: 'Dreamy Sloth',       rarity: 'uncommon' },
  { key: 'capybara',   emoji: '🦫', name: 'Coco Capybara',      rarity: 'uncommon' },
  { key: 'deer',       emoji: '🦌', name: 'Fern Deer',          rarity: 'uncommon' },
  // Rare (8)
  { key: 'owl',        emoji: '🦉', name: 'Luna Owl',           rarity: 'rare' },
  { key: 'bat',        emoji: '🦇', name: 'Velvet Bat',         rarity: 'rare' },
  { key: 'butterfly',  emoji: '🦋', name: 'Bloom Butterfly',    rarity: 'rare' },
  { key: 'lion',       emoji: '🦁', name: 'Mango Lion',         rarity: 'rare' },
  { key: 'tiger',      emoji: '🐯', name: 'Stripe Tiger',       rarity: 'rare' },
  { key: 'flamingo',   emoji: '🦩', name: 'Cotton Flamingo',    rarity: 'rare' },
  { key: 'dolphin',    emoji: '🐬', name: 'Coral Dolphin',      rarity: 'rare' },
  { key: 'elephant',   emoji: '🐘', name: 'Dusty Elephant',     rarity: 'rare' },
  // Epic (5)
  { key: 'peacock',    emoji: '🦚', name: 'Jewel Peacock',      rarity: 'epic' },
  { key: 'parrot',     emoji: '🦜', name: 'Prism Parrot',       rarity: 'epic' },
  { key: 'octopus',    emoji: '🐙', name: 'Swirly Octopus',     rarity: 'epic' },
  { key: 'crab',       emoji: '🦀', name: 'Crimson Crab',       rarity: 'epic' },
  { key: 'axolotl',    emoji: '🦎', name: 'Aqua Axolotl',       rarity: 'epic' },
  // Legendary (3)
  { key: 'giraffe',    emoji: '🦒', name: 'Patches Giraffe',    rarity: 'legendary' },
  { key: 'zebra',      emoji: '🦓', name: 'Stripe Zebra',       rarity: 'legendary' },
  { key: 'whale',      emoji: '🐋', name: 'Indigo Whale',       rarity: 'legendary' },
  // Mythic (2)
  { key: 'unicorn',    emoji: '🦄', name: 'Star Unicorn',       rarity: 'mythic' },
  { key: 'dragon',     emoji: '🐉', name: 'Ember Dragon',       rarity: 'mythic' },
  // Plush — custom AI art (PNG), plush:true keeps them out of regular bags
  { key: 'plush-pig',      img: 'stuffiesimagesopt1/pig.png',      name: 'Plush Pig',      rarity: 'common',    plush: true },
  { key: 'plush-cow',      img: 'stuffiesimagesopt1/cow.png',      name: 'Plush Cow',      rarity: 'common',    plush: true },
  { key: 'plush-sheep',    img: 'stuffiesimagesopt1/sheep.png',    name: 'Plush Sheep',    rarity: 'common',    plush: true },
  { key: 'plush-goat',     img: 'stuffiesimagesopt1/goat.png',     name: 'Plush Goat',     rarity: 'common',    plush: true },
  { key: 'plush-duck',     img: 'stuffiesimagesopt1/duck.png',     name: 'Plush Duck',     rarity: 'common',    plush: true },
  { key: 'plush-chicken',  img: 'stuffiesimagesopt1/chicken.png',  name: 'Plush Chicken',  rarity: 'common',    plush: true },
  { key: 'plush-rooster',  img: 'stuffiesimagesopt1/rooster.png',  name: 'Plush Rooster',  rarity: 'common',    plush: true },
  { key: 'plush-mouse',    img: 'stuffiesimagesopt1/mouse.png',    name: 'Plush Mouse',    rarity: 'common',    plush: true },
  { key: 'plush-bluebird', img: 'stuffiesimagesopt1/bluebird.png', name: 'Plush Bluebird', rarity: 'common',    plush: true },
  { key: 'plush-bear',     img: 'stuffiesimagesopt1/bear.png',     name: 'Plush Bear',     rarity: 'uncommon',  plush: true },
  { key: 'plush-horse',    img: 'stuffiesimagesopt1/horse.png',    name: 'Plush Horse',    rarity: 'uncommon',  plush: true },
  { key: 'plush-otter',    img: 'stuffiesimagesopt1/otter.png',    name: 'Plush Otter',    rarity: 'uncommon',  plush: true },
  { key: 'plush-bunny',    img: 'stuffiesimagesopt1/bunny.png',    name: 'Plush Bunny',    rarity: 'uncommon',  plush: true },
  { key: 'plush-cat',      img: 'stuffiesimagesopt1/cat.png',      name: 'Plush Cat',      rarity: 'uncommon',  plush: true },
  { key: 'plush-dog',      img: 'stuffiesimagesopt1/dog.png',      name: 'Plush Dog',      rarity: 'uncommon',  plush: true },
  { key: 'plush-frog',     img: 'stuffiesimagesopt1/frog.png',     name: 'Plush Frog',     rarity: 'uncommon',  plush: true },
  { key: 'plush-turtle',   img: 'stuffiesimagesopt1/turtle.png',   name: 'Plush Turtle',   rarity: 'uncommon',  plush: true },
  { key: 'plush-fox',      img: 'stuffiesimagesopt1/fox.png',      name: 'Plush Fox',      rarity: 'rare',      plush: true },
  { key: 'plush-owl',      img: 'stuffiesimagesopt1/owl.png',      name: 'Plush Owl',      rarity: 'rare',      plush: true },
  { key: 'plush-deer',     img: 'stuffiesimagesopt1/deer.png',     name: 'Plush Deer',     rarity: 'rare',      plush: true },
  { key: 'plush-elephant', img: 'stuffiesimagesopt1/elephant.png', name: 'Plush Elephant', rarity: 'rare',      plush: true },
  { key: 'plush-penguin',  img: 'stuffiesimagesopt1/penguin.png',  name: 'Plush Penguin',  rarity: 'rare',      plush: true },
  { key: 'plush-monkey',   img: 'stuffiesimagesopt1/monkey.png',   name: 'Plush Monkey',   rarity: 'rare',      plush: true },
  { key: 'plush-lion',     img: 'stuffiesimagesopt1/lion.png',     name: 'Plush Lion',     rarity: 'epic',      plush: true },
  { key: 'plush-dolphin',  img: 'stuffiesimagesopt1/dolphin.png',  name: 'Plush Dolphin',  rarity: 'epic',      plush: true },
  { key: 'plush-zebra',    img: 'stuffiesimagesopt1/zebra.png',    name: 'Plush Zebra',    rarity: 'epic',      plush: true },
  { key: 'plush-tigger',   img: 'stuffiesimagesopt1/tigger.png',   name: 'Plush Tiger',    rarity: 'epic',      plush: true },
  { key: 'plush-whale',    img: 'stuffiesimagesopt1/whale.png',    name: 'Plush Whale',    rarity: 'legendary', plush: true },
  { key: 'plush-giraffe',  img: 'stuffiesimagesopt1/giraffe.png',  name: 'Plush Giraffe',  rarity: 'legendary', plush: true },
  { key: 'plush-shark',    img: 'stuffiesimagesopt1/shark.png',    name: 'Plush Shark',    rarity: 'mythic',    plush: true },
];

export function rollStuffie(bagKey) {
  const bag = BAGS[bagKey];
  const isPlush = bagKey === 'plush';
  const rarity = weightedRoll(bag.weights);
  const pool = STUFFIE_ROSTER.filter(s => s.rarity === rarity && !!s.plush === isPlush);
  const animal = pool[Math.floor(Math.random() * pool.length)];
  return { ...animal };
}

function weightedRoll(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [rarity, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return rarity;
  }
  return 'common';
}

export function stuffieCard(stuffie, size = 'normal') {
  const label = RARITY_LABELS[stuffie.rarity] || stuffie.rarity;
  const sizeClass = size === 'large' ? 'stuffie-card--large' : size === 'small' ? 'stuffie-card--small' : '';
  const name = stuffie.name.replace(/'/g, "\\'");
  return `
    <div class="stuffie-card ${stuffie.rarity} ${sizeClass}" onclick="stuffieTap(this,'${name}')">
      <div class="stuffie-emoji">${stuffie.img
        ? `<img src="${stuffie.img}" alt="${stuffie.name}" class="stuffie-img">`
        : stuffie.emoji}</div>
      <div class="stuffie-name">${stuffie.name}</div>
      <div class="stuffie-rarity rarity-${stuffie.rarity}">${label}</div>
    </div>
  `;
}

// Global tap handler — bounce animation + speech
window.stuffieTap = (card, name) => {
  card.classList.remove('stuffie-bounce');
  void card.offsetWidth; // force reflow so re-tapping restarts animation
  card.classList.add('stuffie-bounce');
  card.addEventListener('animationend', () => card.classList.remove('stuffie-bounce'), { once: true });

  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(name);
    utt.pitch = 1.4;
    utt.rate  = 0.9;
    window.speechSynthesis.speak(utt);
  }
};
