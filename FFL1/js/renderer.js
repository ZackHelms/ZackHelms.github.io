// renderer.js — Canvas 2D rendering helpers
export const TILE_SIZE = 20;

export const TILE_COLORS = {
  0:  { bg: '#1a2e1a', accent: '#2a4a2a' },  // grass
  1:  { bg: '#2a2a3a', accent: '#3a3a5a' },  // mountain
  2:  { bg: '#0a1a3a', accent: '#1a2a5a' },  // water
  3:  { bg: '#0d2010', accent: '#1a3a18' },  // forest
  4:  { bg: '#2a2010', accent: '#3a3020' },  // desert
  5:  { bg: '#1a1a3a', accent: '#ffc300' },  // town
  6:  { bg: '#1a0a0a', accent: '#8b0000' },  // dungeon
  7:  { bg: '#0a2a2a', accent: '#00f5ff' },  // gate
  8:  { bg: '#1e1e18', accent: '#2e2e28' },  // road
  9:  { bg: '#111118', accent: '#222228' },  // wall
  10: { bg: '#181818', accent: '#222222' },  // floor
};

const FONT_MONO  = "'Share Tech Mono', monospace";
const FONT_TITLE = "'Black Ops One', sans-serif";

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = canvas.width;
    this.H = canvas.height;
  }

  clear(color = '#06060e') {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }

  drawTile(tx, ty, tileType, camX, camY) {
    const px = (tx - camX) * TILE_SIZE;
    const py = (ty - camY) * TILE_SIZE;
    if (px < -TILE_SIZE || py < -TILE_SIZE || px > this.W || py > this.H) return;
    const c = TILE_COLORS[tileType] || TILE_COLORS[0];
    this.ctx.fillStyle = c.bg;
    this.ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    // Grid lines
    this.ctx.strokeStyle = c.accent;
    this.ctx.lineWidth = 0.5;
    this.ctx.strokeRect(px + 0.5, py + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    // Special tile markers
    if (tileType === 5) this.drawTileIcon(px, py, '🏘', '#ffc300');
    if (tileType === 6) this.drawTileIcon(px, py, '⚔', '#8b0000');
    if (tileType === 7) this.drawTileIcon(px, py, '▶', '#00f5ff');
    if (tileType === 2) this.drawWater(px, py);
  }

  drawTileIcon(px, py, char, color) {
    this.ctx.font = `${TILE_SIZE * 0.6}px sans-serif`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillStyle = color;
    this.ctx.fillText(char, px + TILE_SIZE / 2, py + TILE_SIZE / 2);
  }

  drawWater(px, py) {
    const now = Date.now();
    const wave = Math.sin((now / 800) + px * 0.1) * 2;
    this.ctx.fillStyle = '#1a3a6a';
    this.ctx.fillRect(px + 2, py + TILE_SIZE / 2 + wave, TILE_SIZE - 4, 3);
  }

  drawPlayer(px, py, facing = 'down') {
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    // Body
    this.ctx.fillStyle = '#39ff14';
    this.ctx.fillRect(cx - 4, cy - 5, 8, 10);
    // Head
    this.ctx.fillStyle = '#ffd700';
    this.ctx.fillRect(cx - 3, cy - 9, 6, 6);
    // Eyes
    this.ctx.fillStyle = '#06060e';
    if (facing === 'down') {
      this.ctx.fillRect(cx - 2, cy - 7, 2, 2);
      this.ctx.fillRect(cx + 1, cy - 7, 2, 2);
    }
    // Glow
    this.ctx.shadowColor = '#39ff14';
    this.ctx.shadowBlur = 8;
    this.ctx.fillStyle = '#39ff14';
    this.ctx.fillRect(cx - 4, cy - 5, 8, 10);
    this.ctx.shadowBlur = 0;
  }

  drawNPC(px, py, color = '#00f5ff') {
    const cx = px + TILE_SIZE / 2;
    const cy = py + TILE_SIZE / 2;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(cx - 3, cy - 4, 6, 8);
    this.ctx.fillStyle = '#ffd700';
    this.ctx.fillRect(cx - 2, cy - 8, 5, 5);
  }

  drawMap(mapData, camX, camY, player, objects = []) {
    const { width, height, tiles } = mapData;
    // Draw tiles
    for (let ty = 0; ty < height; ty++) {
      for (let tx = 0; tx < width; tx++) {
        this.drawTile(tx, ty, tiles[ty * width + tx], camX, camY);
      }
    }
    // Draw objects
    for (const obj of objects) {
      const px = (obj.x - camX) * TILE_SIZE;
      const py = (obj.y - camY) * TILE_SIZE;
      if (obj.type === 'npc') this.drawNPC(px, py, '#00f5ff');
    }
    // Draw player
    const ppx = (player.x - camX) * TILE_SIZE;
    const ppy = (player.y - camY) * TILE_SIZE;
    this.drawPlayer(ppx, ppy, player.facing);
  }

  // ── UI ELEMENTS ────────────────────────────────────────────────────────────
  drawPanel(x, y, w, h, title = null) {
    this.ctx.fillStyle = '#0b0b16';
    this.ctx.fillRect(x, y, w, h);
    this.ctx.strokeStyle = '#1a1a30';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    if (title) {
      this.ctx.fillStyle = '#ffc300';
      this.ctx.font = `bold 11px ${FONT_MONO}`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(title, x + 8, y + 6);
      this.ctx.strokeStyle = '#1a1a30';
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + 22); this.ctx.lineTo(x + w, y + 22);
      this.ctx.stroke();
    }
  }

  drawText(text, x, y, opts = {}) {
    const { color = '#dde3ff', size = 11, align = 'left', font = FONT_MONO } = opts;
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ${font}`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(text, x, y);
  }

  drawTitle(text, x, y, opts = {}) {
    const { color = '#39ff14', size = 28, glow = '#39ff14' } = opts;
    this.ctx.shadowColor = glow;
    this.ctx.shadowBlur = 20;
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px ${FONT_TITLE}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(text, x, y);
    this.ctx.shadowBlur = 0;
  }

  drawHpBar(x, y, w, current, max, label = '') {
    const ratio = Math.max(0, current / max);
    const barColor = ratio > 0.5 ? '#39ff14' : ratio > 0.25 ? '#ffc300' : '#ff4455';
    this.ctx.fillStyle = '#1a1a30';
    this.ctx.fillRect(x, y, w, 5);
    this.ctx.fillStyle = barColor;
    this.ctx.fillRect(x, y, Math.floor(w * ratio), 5);
    if (label) {
      this.ctx.fillStyle = '#353555';
      this.ctx.font = `9px ${FONT_MONO}`;
      this.ctx.textAlign = 'left';
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(label, x, y + 7);
    }
  }

  drawCharStatus(char, x, y, selected = false) {
    const h = 52;
    this.ctx.fillStyle = selected ? '#0f1a2a' : '#0b0b16';
    this.ctx.fillRect(x, y, 200, h);
    this.ctx.strokeStyle = selected ? '#00f5ff' : '#1a1a30';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, 199, h - 1);

    const classColor = { human: '#ffc300', mutant: '#39ff14', monster: '#ff4455' };
    this.drawText(char.name, x + 8, y + 6, { color: classColor[char.class] || '#dde3ff', size: 11 });
    this.drawText(`[${char.class}]`, x + 8, y + 18, { color: '#353555', size: 9 });

    if (!char.alive) {
      this.drawText('KO', x + 130, y + 6, { color: '#ff4455', size: 11 });
    } else {
      this.drawText(`HP ${char.hp}/${char.maxHp}`, x + 90, y + 6, { color: '#dde3ff', size: 9 });
    }
    this.drawHpBar(x + 8, y + 32, 184, char.hp, char.maxHp);
    // Status indicators
    const statusColors = { poison: '#9933ff', sleep: '#3399ff', stone: '#999999', blind: '#cc6600' };
    let sx = x + 8;
    for (const st of (char.status || [])) {
      this.drawText(`[${st}]`, sx, y + 40, { color: statusColors[st] || '#ff4455', size: 8 });
      sx += 44;
    }
  }

  drawDialog(lines, x, y, w, h) {
    this.drawPanel(x, y, w, h);
    let ty = y + 14;
    for (const line of lines) {
      this.drawText(line, x + 12, ty, { color: '#dde3ff', size: 10 });
      ty += 14;
      if (ty > y + h - 14) break;
    }
    this.drawText('▼', x + w - 18, y + h - 14, { color: '#ffc300', size: 9 });
  }

  drawMenu(items, x, y, w, selected = 0) {
    const h = items.length * 18 + 20;
    this.drawPanel(x, y, w, h);
    items.forEach((item, i) => {
      const ty = y + 10 + i * 18;
      const isSelected = i === selected;
      if (isSelected) {
        this.ctx.fillStyle = '#1a1a30';
        this.ctx.fillRect(x + 1, ty - 2, w - 2, 18);
      }
      this.drawText(isSelected ? '▶ ' + item.label : '  ' + item.label,
        x + 8, ty, { color: isSelected ? '#39ff14' : '#dde3ff', size: 10 });
      if (item.value !== undefined) {
        this.drawText(String(item.value), x + w - 10, ty, { color: '#ffc300', size: 10, align: 'right' });
      }
    });
  }

  drawBattleBackground(world = 1) {
    const gradColors = ['#0a1505', '#050a1a', '#1a0505', '#0a0510'];
    const c = gradColors[Math.min(world - 1, gradColors.length - 1)];
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.H * 0.6);
    grad.addColorStop(0, c);
    grad.addColorStop(1, '#06060e');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.W, this.H);
    // Ground line
    this.ctx.strokeStyle = '#1a1a30';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, Math.floor(this.H * 0.5));
    this.ctx.lineTo(this.W, Math.floor(this.H * 0.5));
    this.ctx.stroke();
  }

  drawEnemy(enemy, x, y, size = 60, flash = false) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const familyColors = {
      insect: '#6aff00', fish: '#00aaff', plant: '#00cc44', beast: '#cc8800',
      bird: '#ffaa00', reptile: '#44aa00', demon: '#cc0044', undead: '#6633cc',
      slime: '#00cccc', dragon: '#ff3300', boss: '#ffcc00'
    };
    const color = flash ? '#ffffff' : (familyColors[enemy.family] || '#aaaaaa');
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy - 5, size * 0.32, 0, Math.PI * 2);
    this.ctx.fill();
    // Eyes
    this.ctx.fillStyle = '#06060e';
    this.ctx.fillRect(cx - 6, cy - 9, 4, 4);
    this.ctx.fillRect(cx + 3, cy - 9, 4, 4);
    // Glow on low HP
    if (enemy.currentHp !== undefined && enemy.currentHp < enemy.hp * 0.3) {
      this.ctx.shadowColor = '#ff0000';
      this.ctx.shadowBlur = 12;
    }
    this.ctx.fillStyle = color + '88';
    this.ctx.fillRect(cx - size * 0.25, cy + size * 0.1, size * 0.5, size * 0.35);
    this.ctx.shadowBlur = 0;
    // Name + HP bar
    this.drawText(enemy.name, x + size / 2, y + size + 4, { size: 9, align: 'center', color: '#dde3ff' });
    this.drawHpBar(x, y + size + 16, size, enemy.currentHp ?? enemy.hp, enemy.hp);
  }

  drawNumber(num, x, y, color = '#ff4455') {
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = 10;
    this.ctx.fillStyle = color;
    this.ctx.font = `bold 14px ${FONT_MONO}`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(num > 0 ? `-${num}` : `+${Math.abs(num)}`, x, y);
    this.ctx.shadowBlur = 0;
  }

  // Fade overlay (0=transparent, 1=black)
  drawFade(alpha) {
    if (alpha <= 0) return;
    this.ctx.fillStyle = `rgba(6,6,14,${alpha})`;
    this.ctx.fillRect(0, 0, this.W, this.H);
  }
}
