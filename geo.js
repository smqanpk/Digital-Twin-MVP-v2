/* ============================================================
   geo.js — minimal equirectangular projection helper
   No external mapping library required. Good enough accuracy
   for a regional extent (a few degrees of lat/lon), which is
   exactly the scale of this SMDB extract.
   ============================================================ */

(function(){
  'use strict';

  function makeProjector(sites, viewW, viewH, padding){
    padding = padding || 40;
    const lats = sites.map(s => s.lat);
    const lons = sites.map(s => s.lon);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats);
    let minLon = Math.min(...lons), maxLon = Math.max(...lons);

    // guard against a degenerate (single-point or collinear) bounding box
    if (maxLat - minLat < 0.01) { maxLat += 0.05; minLat -= 0.05; }
    if (maxLon - minLon < 0.01) { maxLon += 0.05; minLon -= 0.05; }

    // latitude compresses longitude distance; correct so circles look like circles
    const midLat = (minLat + maxLat) / 2;
    const lonScaleCorrection = Math.cos(midLat * Math.PI / 180);

    const lonSpan = (maxLon - minLon) * lonScaleCorrection;
    const latSpan = (maxLat - minLat);

    const availW = viewW - padding * 2;
    const availH = viewH - padding * 2;

    // uniform scale so the projection doesn't stretch distances differently per axis
    const scale = Math.min(availW / Math.max(lonSpan, 1e-6), availH / Math.max(latSpan, 1e-6));

    const usedW = lonSpan * scale;
    const usedH = latSpan * scale;
    const offsetX = padding + (availW - usedW) / 2;
    const offsetY = padding + (availH - usedH) / 2;

    function project(lat, lon){
      const x = offsetX + (lon - minLon) * lonScaleCorrection * scale;
      const y = offsetY + (maxLat - lat) * scale; // invert: north is up
      return {x, y};
    }

    function unproject(x, y){
      const lon = minLon + (x - offsetX) / (lonScaleCorrection * scale);
      const lat = maxLat - (y - offsetY) / scale;
      return {lat, lon};
    }

    // approximate km-per-pixel at the projection's mid-latitude, for a scale bar
    const kmPerDegLat = 111.32;
    const pxPerKm = scale / kmPerDegLat;

    return { project, unproject, minLat, maxLat, minLon, maxLon, scale, pxPerKm, midLat };
  }

  window.GeoProjector = { makeProjector };
})();
