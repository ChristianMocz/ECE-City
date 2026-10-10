// src/ui/kit.js
//
// Shared helpers for the pop-up screens. Each screen is a layer at depth 500
// that blocks taps from reaching the board. Screens only draw and report
// taps through callbacks. Every tappable thing has a `tag` so tests can find
// it, like "build:HOUSE" or "shop:building:bakery".
//
// Main pieces: openScreen(), screenButton(), screenText(), fitImage(),
// coinLine(), tileGrid(), scrollGrid(), scrollPane().
// Uses: src/ui/hud.js (pixelButton, closeLayer). Used by: the other src/ui/ screens.

const SCREEN_DEPTH = 500;

// A titled panel with a dimmed backdrop and a ✕ button. Tapping the backdrop
// or ✕ closes it. Returns helpers to fill it.
function openScreen(scene, { title, width, height, onClose }) {
  const W = scene.scale.width, H = scene.scale.height;
  const layer = scene.add.container(0, 0).setDepth(SCREEN_DEPTH);
  const cx = W / 2, cy = H / 2;
  const top = cy - height / 2, left = cx - width / 2;
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, UI_INK, 0.55).setInteractive();
  layer.add(dim);
  layer.add(panelShadow(scene, cx, cy, width, height));
  layer.add(blockingPanel(scene, cx, cy, width, height));
  layer.add(scene.add.rectangle(cx, top + 28, width - 8, 44, PALN["8"]));
  layer.add(scene.add.text(cx, top + 28, title, { fontFamily: GAME_FONT, fontSize: "22px", color: "#ffcd75", fontStyle: "bold" }).setOrigin(0.5));
  let closed = false;
  const close = () => { if (closed) return; closed = true; closeLayer(scene, layer); if (onClose) onClose(); };
  dim.on("pointerdown", (p, lx, ly, e) => { e.stopPropagation(); close(); });
  const x = screenButton(scene, layer, left + width - 26, top + 28, 34, 30, "✕", { fill: PALN["3"], fontSize: 16 }, close);
  x.hit.tag = "close";
  return { layer, cx, cy, top, left, width, height, close, isOpen: () => !closed };
}

// A pixel button inside a screen layer that stops the tap and plays a click.
function screenButton(scene, layer, x, y, w, h, label, opts, onTap) {
  const btn = pixelButton(scene, x, y, w, h, label, opts || {});
  layer.add(btn.parts);
  btn.hit.on("pointerdown", (p, lx, ly, e) => { e.stopPropagation(); noteOverlayTap(scene); Sfx.play("tap"); onTap(); });
  return btn;
}

// A text added to a screen layer.
function screenText(scene, layer, x, y, text, { size = 14, color = "#1a1c2c", bold = false, wrap = null, originX = 0.5, originY = 0.5, align = "center" } = {}) {
  const t = scene.add.text(x, y, text, {
    fontFamily: GAME_FONT, fontSize: `${size}px`, color, fontStyle: bold ? "bold" : "normal", align,
    wordWrap: wrap ? { width: wrap } : undefined, lineSpacing: 1,
  }).setOrigin(originX, originY);
  layer.add(t);
  return t;
}

// An image scaled to fit inside a box.
function fitImage(scene, layer, x, y, key, boxW, boxH) {
  const img = scene.add.image(x, y, key);
  const s = Math.min(boxW / img.width, boxH / img.height, 1.5);
  img.setScale(s);
  layer.add(img);
  return img;
}

// A coin icon followed by an amount.
function coinLine(scene, layer, x, y, amount, { size = 13, color = "#1a1c2c" } = {}) {
  layer.add(scene.add.image(x - 4, y, "coin").setOrigin(1, 0.5));
  return screenText(scene, layer, x, y, String(amount), { size, color, bold: true, originX: 0 });
}

// A grid of tiles: each { tag, icon (texture key or fn(layer, x, y)), name,
// sub, locked, dim, onTap }.
function tileGrid(scene, s, items, { cols, tileW, tileH, top, gap = 10 }) {
  const gridW = cols * tileW + (cols - 1) * gap;
  const x0 = s.cx - gridW / 2 + tileW / 2;
  items.forEach((it, i) => {
    const x = x0 + (i % cols) * (tileW + gap);
    const y = top + Math.floor(i / cols) * (tileH + gap) + tileH / 2;
    const fill = it.selected ? PALN["5"] : it.locked ? PALN["D"] : 0xe8f6ff;
    const btn = screenButton(scene, s.layer, x, y, tileW, tileH, "", { fill }, () => it.onTap && it.onTap());
    btn.hit.tag = it.tag;
    if (typeof it.icon === "function") it.icon(s.layer, x, y - 12);
    else if (it.icon) { const img = fitImage(scene, s.layer, x, y - 12, it.icon, tileW - 30, tileH - 44); if (it.locked) img.setTint(0x6b7280); }
    const nm = screenText(scene, s.layer, x, y + tileH / 2 - 26, it.name, { size: 13, bold: true });
    for (const size of [12, 11, 10]) { if (nm.width <= tileW - 8) break; nm.setFontSize(size); }
    if (nm.width > tileW - 8) nm.setScale((tileW - 8) / nm.width);
    if (it.sub != null) {
      if (typeof it.sub === "number") coinLine(scene, s.layer, x - 6, y + tileH / 2 - 11, it.sub, { size: 12 });
      else {
        const sub = screenText(scene, s.layer, x, y + tileH / 2 - 11, it.sub, { size: 11, color: it.locked ? "#566c86" : "#333c57" });
        if (sub.width > tileW - 6) { sub.setFontSize(10); if (sub.width > tileW - 6) sub.setScale((tileW - 6) / sub.width); }
      }
    }
    if (it.locked) s.layer.add(scene.add.image(x + tileW / 2 - 12, y - tileH / 2 + 12, "lock"));
  });
}

// A tile grid that scrolls when it's taller than its box: mouse wheel,
// ▲ / ▼ buttons, or drag the handle. Tiles scrolled out of the box can't be
// tapped. `height` is the box height; returns { pane, scrollTo(tag) }.
function scrollGrid(scene, s, items, { cols, tileW, tileH, top, height, gap = 10, cx = s.cx, memKey = null }) {
  const pane = scene.add.container(0, 0);
  s.layer.add(pane);
  tileGrid(scene, { layer: pane, cx }, items, { cols, tileW, tileH, top, gap });
  const rows = Math.ceil(items.length / cols);
  const full = rows * (tileH + gap) - gap;
  const maxScroll = Math.max(0, full - height);
  const gridW = cols * tileW + (cols - 1) * gap;
  const left = cx - gridW / 2 - 4, right = cx + gridW / 2 + 4;
  const mask = scene.make.graphics({ add: false });
  mask.fillStyle(0xffffff).fillRect(left - 6, top - 4, gridW + 20, height + 8);
  pane.setMask(mask.createGeometryMask());
  scene.__scrollMem ??= {};
  let off = memKey ? Math.min(maxScroll, scene.__scrollMem[memKey] || 0) : 0;
  const update = () => {
    pane.y = -off;
    if (memKey) scene.__scrollMem[memKey] = off;
    for (const o of pane.list) {
      if (!o.input) continue;
      const y = o.y - off, h = o.height || 0;
      const inside = y + h / 2 > top + 4 && y - h / 2 < top + height - 4;
      o.input.enabled = inside;
    }
    if (thumb) thumb.y = top + 18 + (height - 36 - thumbH) * (maxScroll ? off / maxScroll : 0) + thumbH / 2;
  };
  const scrollBy = (d) => { off = Math.max(0, Math.min(maxScroll, off + d)); update(); };
  let thumb = null, thumbH = 0;
  if (maxScroll > 0) {
    const bx = right + 22;
    const up = screenButton(scene, s.layer, bx, top + 14, 30, 28, "▲", { fill: PALN["B"], fontSize: 13 }, () => scrollBy(-(tileH + gap)));
    const down = screenButton(scene, s.layer, bx, top + height - 14, 30, 28, "▼", { fill: PALN["B"], fontSize: 13 }, () => scrollBy(tileH + gap));
    up.hit.tag = "scroll:up"; down.hit.tag = "scroll:down";
    s.layer.add(scene.add.rectangle(bx, top + height / 2, 10, height - 64, PALN["D"]).setStrokeStyle(2, UI_INK));
    thumbH = Math.max(30, (height - 64) * height / full);
    thumb = scene.add.rectangle(bx, top + 18, 16, thumbH, PALN["4"]).setStrokeStyle(2, UI_INK).setInteractive({ useHandCursor: true, draggable: true });
    thumb.tag = "scroll:thumb";
    s.layer.add(thumb);
    thumb.on("pointerdown", (p, lx, ly, e) => e.stopPropagation());
    thumb.on("drag", (p, dx, dy) => { const t = Math.max(0, Math.min(1, (dy - top - 18 - thumbH / 2) / Math.max(1, height - 36 - thumbH))); off = t * maxScroll; update(); });
    const wheel = (p, over, dx, dy) => { if (s.isOpen?.() !== false && p.x > left - 10 && p.x < right + 40 && p.y > top && p.y < top + height) scrollBy(dy > 0 ? 40 : -40); };
    scene.input.on("wheel", wheel);
    pane.once("destroy", () => scene.input.off("wheel", wheel));
    // Lets tests (and "jump to" links) scroll a tile into view.
    pane.__scrollInto = (o) => { if (o.y - off < top + tileH / 2 || o.y - off > top + height - tileH / 2) { off = Math.max(0, Math.min(maxScroll, o.y - top - tileH / 2 - gap)); update(); } };
  }
  update();
  return { pane, maxScroll, scrollBy, scrollTo: (tag) => { const o = pane.list.find(x => x.tag === tag); if (o && pane.__scrollInto) pane.__scrollInto(o); } };
}

// A box of free content (text, pictures) that scrolls when it's too tall:
// mouse wheel, drag the content, ▲ / ▼, or drag the handle. `fill(pane)`
// adds things to `pane` (y starts at `top`) and returns the content height.
function scrollPane(scene, s, { left, top, width, height, fill }) {
  const pane = scene.add.container(0, 0);
  s.layer.add(pane);
  const full = fill(pane);
  const maxScroll = Math.max(0, full - height);
  const mask = scene.make.graphics({ add: false });
  mask.fillStyle(0xffffff).fillRect(left - 4, top - 4, width + 8, height + 8);
  pane.setMask(mask.createGeometryMask());
  let off = 0, thumb = null, thumbH = 0;
  const bx = left + width + 18;
  const update = () => {
    pane.y = -off;
    if (thumb) thumb.y = top + 32 + (height - 64 - thumbH) * (maxScroll ? off / maxScroll : 0) + thumbH / 2;
  };
  const scrollBy = (d) => { off = Math.max(0, Math.min(maxScroll, off + d)); update(); };
  if (maxScroll > 0) {
    const up = screenButton(scene, s.layer, bx, top + 14, 30, 28, "▲", { fill: PALN["B"], fontSize: 13 }, () => scrollBy(-120));
    const down = screenButton(scene, s.layer, bx, top + height - 14, 30, 28, "▼", { fill: PALN["B"], fontSize: 13 }, () => scrollBy(120));
    up.hit.tag = "scroll:up"; down.hit.tag = "scroll:down";
    s.layer.add(scene.add.rectangle(bx, top + height / 2, 10, height - 64, PALN["D"]).setStrokeStyle(2, UI_INK));
    thumbH = Math.max(30, (height - 64) * height / full);
    thumb = scene.add.rectangle(bx, top + 18, 16, thumbH, PALN["4"]).setStrokeStyle(2, UI_INK).setInteractive({ useHandCursor: true, draggable: true });
    thumb.tag = "scroll:thumb";
    s.layer.add(thumb);
    thumb.on("pointerdown", (p, lx, ly, e) => e.stopPropagation());
    thumb.on("drag", (p, dx, dy) => { const t = Math.max(0, Math.min(1, (dy - top - 32 - thumbH / 2) / Math.max(1, height - 64 - thumbH))); off = t * maxScroll; update(); });
    // Drag the content itself (phones and tablets).
    const grab = scene.add.rectangle(left + width / 2, top + height / 2, width, height, 0xffffff, 0.001).setInteractive();
    s.layer.add(grab);
    let lastY = null;
    grab.on("pointerdown", (p, lx, ly, e) => { e.stopPropagation(); lastY = p.y; });
    const move = (p) => { if (lastY === null || !p.isDown) { lastY = null; return; } scrollBy(lastY - p.y); lastY = p.y; };
    const wheel = (p, over, dx, dy) => { if (s.isOpen?.() !== false && p.x > left - 10 && p.x < bx + 20 && p.y > top && p.y < top + height) scrollBy(dy > 0 ? 50 : -50); };
    scene.input.on("pointermove", move);
    scene.input.on("wheel", wheel);
    pane.once("destroy", () => { scene.input.off("pointermove", move); scene.input.off("wheel", wheel); });
  }
  update();
  return { pane, maxScroll, scrollBy };
}
