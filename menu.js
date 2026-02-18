// ═══════════════════════════════════════════════════════════════════════════
//  GLOBALS
// ═══════════════════════════════════════════════════════════════════════════

const triPoly = document.getElementById('tri');
const mouse   = { x: -9999, y: -9999 };

document.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

function rectContains(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
  const d1 = (px - bx) * (ay - by) - (ax - bx) * (py - by);
  const d2 = (px - cx) * (by - cy) - (bx - cx) * (py - cy);
  const d3 = (px - ax) * (cy - ay) - (cx - ax) * (py - ay);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

let triangleVisible = true;

function setTri(ax, ay, bx, by, cx, cy) {
  if (!triangleVisible) return;
  triPoly.setAttribute('points', `${ax},${ay} ${bx},${by} ${cx},${cy}`);
}

function clearTri() {
  triPoly.setAttribute('points', '');
}

// ═══════════════════════════════════════════════════════════════════════════
//  MENU — LEFT (sem triângulo)
// ═══════════════════════════════════════════════════════════════════════════

function setupNaiveSubmenu(triggerEl, submenuEl) {
  let open  = false;
  let rafId = null;

  function doOpen() {
    if (open) return;
    open = true;
    triggerEl.classList.add('open');
    const menuRect = submenuEl.parentElement.getBoundingClientRect();
    const trigRect = triggerEl.getBoundingClientRect();
    submenuEl.style.top = (trigRect.top - menuRect.top) + 'px';
    submenuEl.classList.add('visible');
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  function doClose() {
    if (!open) return;
    open = false;
    triggerEl.classList.remove('open');
    submenuEl.classList.remove('visible');
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  function tick() {
    const mx = mouse.x;
    const my = mouse.y;
    const trigRect = triggerEl.getBoundingClientRect();
    const r        = submenuEl.getBoundingClientRect();
    // Cover the full gap: from the right edge of the trigger to the right edge of the submenu
    const subRect  = { left: trigRect.right, right: r.right, top: r.top, bottom: r.bottom };
    if (!rectContains(trigRect, mx, my) && !rectContains(subRect, mx, my)) {
      doClose();
      return;
    }
    rafId = requestAnimationFrame(tick);
  }

  triggerEl.addEventListener('mouseenter', doOpen);
  submenuEl.addEventListener('click', e => e.stopPropagation());
}

setupNaiveSubmenu(
  document.getElementById('naive-move-trigger'),
  document.getElementById('naive-submenu-move')
);
setupNaiveSubmenu(
  document.getElementById('naive-share-trigger'),
  document.getElementById('naive-submenu')
);

// ═══════════════════════════════════════════════════════════════════════════
//  MENU — RIGHT (triangle safe zone)
// ═══════════════════════════════════════════════════════════════════════════

const allSubmenus = [];

function anotherIsProtectingMouse(exclude) {
  return allSubmenus.some(s => s !== exclude && s.isProtectingPoint(mouse.x, mouse.y));
}

function isAnyFrozen() {
  return allSubmenus.some(s => s.isFrozen());
}

function syncFrozenClass() {
  const frozen = isAnyFrozen();
  document.querySelectorAll('.safe .ctx-menu').forEach(m => m.classList.toggle('safe-zone-active', frozen));
}

function setupSafeSubmenu(triggerEl, submenuEl) {
  let state     = 'closed';
  let rafId     = null;
  let frozenTri = null;

  const ctrl = {
    isOpen:   () => state !== 'closed',
    isFrozen: () => state === 'frozen',
    isProtectingPoint: (px, py) => {
      if (state === 'closed') return false;
      const subRect = submenuEl.getBoundingClientRect();
      if (rectContains(subRect, px, py)) return true;
      if (frozenTri) {
        const { ax, ay, bx, by, cx, cy } = frozenTri;
        if (inTriangle(px, py, ax, ay, bx, by, cx, cy)) return true;
      }
      return false;
    },
    close: () => doClose()
  };
  allSubmenus.push(ctrl);

  function getApex() {
    const labelEl   = triggerEl.querySelector('.menu-item-label');
    const labelRect = labelEl ? labelEl.getBoundingClientRect() : triggerEl.getBoundingClientRect();
    const trigRect  = triggerEl.getBoundingClientRect();
    return { x: labelRect.right, y: (trigRect.top + trigRect.bottom) / 2 };
  }

  function getSubmenuCorners() {
    const r = submenuEl.getBoundingClientRect();
    return { bx: r.left, by: r.top - 12, cx: r.left, cy: r.bottom + 12 };
  }

  function doOpen() {
    triggerEl.classList.add('open');
    const menuRect = submenuEl.parentElement.getBoundingClientRect();
    const trigRect = triggerEl.getBoundingClientRect();
    submenuEl.style.top = (trigRect.top - menuRect.top) + 'px';
    submenuEl.classList.add('visible');
  }

  function doClose() {
    triggerEl.classList.remove('open');
    submenuEl.classList.remove('visible');
    clearTri();
    frozenTri = null;
    cancelAnimationFrame(rafId);
    rafId = null;
    state = 'closed';
    syncFrozenClass();
  }

  function tick() {
    const mx = mouse.x;
    const my = mouse.y;
    const subRect  = submenuEl.getBoundingClientRect();
    const trigRect = triggerEl.getBoundingClientRect();

    if (state === 'on_item') {
      const apex = getApex();
      const sc   = getSubmenuCorners();
      setTri(apex.x, apex.y, sc.bx, sc.by, sc.cx, sc.cy);
      frozenTri = { ax: apex.x, ay: apex.y, bx: sc.bx, by: sc.by, cx: sc.cx, cy: sc.cy };

      if (rectContains(subRect, mx, my)) {
        state = 'on_sub'; syncFrozenClass();
        rafId = requestAnimationFrame(tick); return;
      }
      if (!rectContains(trigRect, mx, my)) {
        state = 'frozen'; syncFrozenClass();
      }
      rafId = requestAnimationFrame(tick); return;
    }

    if (state === 'frozen') {
      const { ax, ay, bx, by, cx, cy } = frozenTri;
      setTri(ax, ay, bx, by, cx, cy);

      if (rectContains(subRect, mx, my)) {
        state = 'on_sub'; syncFrozenClass();
        rafId = requestAnimationFrame(tick); return;
      }
      if (rectContains(trigRect, mx, my)) {
        state = 'on_item'; syncFrozenClass();
        rafId = requestAnimationFrame(tick); return;
      }
      if (!inTriangle(mx, my, ax, ay, bx, by, cx, cy)) {
        doClose(); return;
      }
      rafId = requestAnimationFrame(tick); return;
    }

    if (state === 'on_sub') {
      if (frozenTri) {
        const { ax, ay, bx, by, cx, cy } = frozenTri;
        setTri(ax, ay, bx, by, cx, cy);
      }
      if (rectContains(trigRect, mx, my)) {
        state = 'on_item';
        rafId = requestAnimationFrame(tick); return;
      }
      if (!rectContains(subRect, mx, my)) {
        doClose(); return;
      }
      rafId = requestAnimationFrame(tick); return;
    }
  }

  triggerEl.addEventListener('mouseenter', () => {
    if (state === 'on_item') return;
    if (anotherIsProtectingMouse(ctrl)) return;
    allSubmenus.forEach(s => { if (s !== ctrl) s.close(); });
    if (state !== 'closed') doClose();
    doOpen();
    state = 'on_item';
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  });

  submenuEl.addEventListener('click', e => e.stopPropagation());
  return ctrl;
}

setupSafeSubmenu(
  document.getElementById('safe-move-trigger'),
  document.getElementById('safe-submenu-move')
);
setupSafeSubmenu(
  document.getElementById('safe-share-trigger'),
  document.getElementById('safe-submenu')
);

// ── Triangle toggle ───────────────────────────────────────────────────────────

document.getElementById('tri-toggle').addEventListener('change', function() {
  triangleVisible = this.checked;
  if (!triangleVisible) clearTri();
});