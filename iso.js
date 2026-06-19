/* ============================================================
   iso.js — minimal isometric (axonometric) projection helper
   Converts 3D world coordinates (x: east, y: north, z: up) into
   2D screen coordinates using a true isometric projection, plus
   helpers for drawing "boxes" as three visible faces (top, left,
   right) so simple primitives can be composed into a believable
   3D-looking site model without any WebGL / 3D library.
   ============================================================ */

(function(){
  'use strict';

  // classic isometric angles: 30 degrees from horizontal on both axes
  const COS30 = Math.cos(Math.PI / 6);
  const SIN30 = Math.sin(Math.PI / 6);

  // project world (x,y,z) -> screen (sx,sy)
  // x: +east, y: +north, z: +up
  function project(x, y, z, scale){
    scale = scale || 1;
    const sx = (x - y) * COS30 * scale;
    const sy = (x + y) * SIN30 * scale - z * scale;
    return { x: sx, y: sy };
  }

  // Build an SVG path string for a box's three visible faces given its
  // footprint center (x,y), footprint width/depth (w,d) and height (h).
  // Returns { top, left, right } path strings in local (unshifted) space,
  // already projected — caller translates the resulting <g> to place it.
  function boxFaces(w, d, h, scale){
    const hw = w/2, hd = d/2;
    // 8 corners in world space, base at z=0, top at z=h
    const c = {
      b0: project(-hw, -hd, 0, scale),
      b1: project( hw, -hd, 0, scale),
      b2: project( hw,  hd, 0, scale),
      b3: project(-hw,  hd, 0, scale),
      t0: project(-hw, -hd, h, scale),
      t1: project( hw, -hd, h, scale),
      t2: project( hw,  hd, h, scale),
      t3: project(-hw,  hd, h, scale),
    };
    function pathOf(pts){
      return pts.map((p,i)=> (i===0?'M':'L') + p.x.toFixed(2) + ',' + p.y.toFixed(2)).join(' ') + ' Z';
    }
    return {
      top:   pathOf([c.t0, c.t1, c.t2, c.t3]),
      left:  pathOf([c.b0, c.b3, c.t3, c.t0]),
      right: pathOf([c.b1, c.b2, c.t2, c.t1]),
      corners: c
    };
  }

  window.Iso = { project, boxFaces, COS30, SIN30 };
})();
