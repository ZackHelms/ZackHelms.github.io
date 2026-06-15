// Run with: node generate-assets.js
// Generates sprite001-a.png and sprite001-b.png (16x16 pixel walk frames)
// Requires: npm install canvas

const { createCanvas } = require('canvas');
const fs = require('fs');

function saveCanvas(canvas, filename) {
  const buf = canvas.toBuffer('image/png');
  fs.writeFileSync(filename, buf);
  console.log('wrote', filename);
}

function drawCharacter(ctx, frame) {
  ctx.clearRect(0, 0, 16, 16);

  // Skin
  ctx.fillStyle = '#f4c48a';
  ctx.fillRect(6, 1, 4, 4); // head

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(7, 2, 1, 1);
  ctx.fillRect(9, 2, 1, 1);

  // Body
  ctx.fillStyle = '#3a6fbf';
  ctx.fillRect(5, 5, 6, 5); // torso

  // Arms
  ctx.fillStyle = '#3a6fbf';
  if (frame === 0) {
    ctx.fillRect(3, 5, 2, 4); // left arm down
    ctx.fillRect(11, 5, 2, 4); // right arm down
  } else {
    ctx.fillRect(3, 5, 2, 3); // left arm up
    ctx.fillRect(11, 6, 2, 4); // right arm lower
  }

  // Legs
  ctx.fillStyle = '#1a1a2e';
  if (frame === 0) {
    ctx.fillRect(5, 10, 2, 5); // left leg
    ctx.fillRect(9, 10, 2, 5); // right leg
  } else {
    ctx.fillRect(5, 10, 2, 3); // left leg up
    ctx.fillRect(5, 13, 2, 2);
    ctx.fillRect(9, 10, 2, 5); // right leg down
  }

  // Feet
  ctx.fillStyle = '#8b4513';
  if (frame === 0) {
    ctx.fillRect(4, 14, 3, 2);
    ctx.fillRect(9, 14, 3, 2);
  } else {
    ctx.fillRect(4, 14, 3, 2);
    ctx.fillRect(9, 14, 3, 2);
  }
}

for (let f = 0; f < 2; f++) {
  const canvas = createCanvas(16, 16);
  const ctx = canvas.getContext('2d');
  drawCharacter(ctx, f);
  saveCanvas(canvas, `sprite001-${f === 0 ? 'a' : 'b'}.png`);
}
