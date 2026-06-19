/* ============================================================
   mapview.js — self-contained tactical map renderer
   No external mapping library, no tile server, no API key.
   Projects real SMDB lat/lon onto an SVG canvas, supports
   pan + zoom (wheel / drag / pinch), and declusters markers
   that would otherwise overlap at the current zoom level.
   ============================================================ */

(function(){
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  function mk(tag, attrs){
    const n = document.createElementNS(NS, tag);
    for(const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function createMapView(opts){
    const {
      container,
      sites,
      edges,
      onSelect,
      onHover,
      onClusterExpand
    } = opts;

    const svg = mk('svg', {});
    svg.setAttribute('class', 'tactical-map-svg');
    container.appendChild(svg);

    const VIEW_W = 1000, VIEW_H = 1000;
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    const proj = window.GeoProjector.makeProjector(sites, VIEW_W, VIEW_H, 70);

    const byCode = {};
    sites.forEach(s => byCode[s.siteCode] = s);

    const basePos = {};
    sites.forEach(s => { basePos[s.siteCode] = proj.project(s.lat, s.lon); });

    const worldGroup = mk('g', {class:'map-world'});
    svg.appendChild(worldGroup);

    const terrainLayer = mk('g', {class:'map-terrain'});
    const gridLayer = mk('g', {class:'map-grid'});
    const linkLayer = mk('g', {class:'map-links'});
    const markerLayer = mk('g', {class:'map-markers'});
    worldGroup.appendChild(terrainLayer);
    worldGroup.appendChild(gridLayer);
    worldGroup.appendChild(linkLayer);
    worldGroup.appendChild(markerLayer);

    let zoom = 1, panX = 0, panY = 0;
    const MIN_ZOOM = 0.8, MAX_ZOOM = 40;
    const CLUSTER_RADIUS_PX = 24;

    function applyTransform(){
      worldGroup.setAttribute('transform', `translate(${panX},${panY}) scale(${zoom})`);
      render();
    }

    function screenToWorld(px, py){
      return { x: (px - panX) / zoom, y: (py - panY) / zoom };
    }

    function clientToSvgPoint(clientX, clientY){
      const rect = svg.getBoundingClientRect();
      const scaleFactor = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      const dispW = VIEW_W * scaleFactor, dispH = VIEW_H * scaleFactor;
      const offX = (rect.width - dispW) / 2;
      const offY = (rect.height - dispH) / 2;
      const sx = (clientX - rect.left - offX) / scaleFactor;
      const sy = (clientY - rect.top - offY) / scaleFactor;
      return { x: sx, y: sy };
    }

    function buildTerrain(){
      terrainLayer.innerHTML = '';
      terrainLayer.appendChild(mk('rect', {x:-4000, y:-4000, width:10000, height:10000, fill:'#0b1119'}));

      // Stylised topographic contour rings — deliberately schematic (this is not
      // satellite imagery; it's an elevation-contour aesthetic consistent with a
      // tactical ops map). Each ring cluster suggests high ground.
      const hills = [
        {cx:120, cy:80, rings:[60,100,145,195]},
        {cx:860, cy:120, rings:[70,115,165]},
        {cx:900, cy:820, rings:[80,130,185,245]},
        {cx:60, cy:760, rings:[55,95,140]},
        {cx:480, cy:920, rings:[50,90]},
      ];
      hills.forEach(h => {
        h.rings.forEach((r, i) => {
          let d = '';
          const pts = 28;
          for(let p=0;p<=pts;p++){
            const a = (p/pts) * Math.PI * 2;
            const wob = 1 + 0.06*Math.sin(a*4 + h.cx*0.1) + 0.04*Math.cos(a*7 + h.cy*0.1);
            const x = h.cx + Math.cos(a)*r*wob;
            const y = h.cy + Math.sin(a)*r*wob;
            d += (p===0?'M':'L') + x.toFixed(1) + ',' + y.toFixed(1) + ' ';
          }
          d += 'Z';
          terrainLayer.appendChild(mk('path', {
            d, fill:'none', stroke:'#16212c', 'stroke-width': i===0?1.2:0.8,
            opacity: 0.8 - i*0.12, 'vector-effect':'non-scaling-stroke'
          }));
        });
        // faint fill at the core to suggest elevation without looking like a stain
        terrainLayer.appendChild(mk('circle', {cx:h.cx, cy:h.cy, r:h.rings[0]*0.5, fill:'#101c24', opacity:0.5}));
      });

      // Note: deliberately no rivers/roads are drawn here. Unlike the contour
      // rings above (which are explicitly schematic), a drawn waterway could be
      // mistaken for real geography we have not verified. Lat/lon graticule and
      // real site positions remain the only claims this map makes about the world.
    }

    function buildGrid(){
      gridLayer.innerHTML = '';
      const latStep = niceStep(proj.maxLat - proj.minLat);
      const lonStep = niceStep(proj.maxLon - proj.minLon);

      const startLat = Math.floor(proj.minLat / latStep) * latStep;
      for(let lat = startLat; lat <= proj.maxLat + latStep; lat += latStep){
        const p1 = proj.project(lat, proj.minLon - 1);
        const p2 = proj.project(lat, proj.maxLon + 1);
        gridLayer.appendChild(mk('line', {x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, stroke:'#1d2733', 'stroke-width':1, 'vector-effect':'non-scaling-stroke'}));
        const lbl = mk('text', {x:p1.x+4, y:p1.y-4, fill:'#3a4756', 'font-size':9, 'font-family':'IBM Plex Mono, monospace'});
        lbl.textContent = lat.toFixed(2) + '°N';
        gridLayer.appendChild(lbl);
      }
      const startLon = Math.floor(proj.minLon / lonStep) * lonStep;
      for(let lon = startLon; lon <= proj.maxLon + lonStep; lon += lonStep){
        const p1 = proj.project(proj.minLat - 1, lon);
        const p2 = proj.project(proj.maxLat + 1, lon);
        gridLayer.appendChild(mk('line', {x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, stroke:'#1d2733', 'stroke-width':1, 'vector-effect':'non-scaling-stroke'}));
        const lbl = mk('text', {x:p1.x+4, y:p1.y+12, fill:'#3a4756', 'font-size':9, 'font-family':'IBM Plex Mono, monospace'});
        lbl.textContent = lon.toFixed(2) + '°E';
        gridLayer.appendChild(lbl);
      }
    }
    function niceStep(span){
      if(span <= 0) return 0.1;
      const raw = span / 5;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const norm = raw / mag;
      let step;
      if(norm < 1.5) step = 1*mag;
      else if(norm < 3.5) step = 2*mag;
      else if(norm < 7.5) step = 5*mag;
      else step = 10*mag;
      return step;
    }

    function buildLinks(){
      linkLayer.innerHTML = '';
      (edges||[]).forEach(edge => {
        const a = byCode[edge.from], b = byCode[edge.to];
        if(!a || !b) return;
        const pa = basePos[edge.from], pb = basePos[edge.to];
        const isBackbone = edge.type === 'backbone';
        const line = mk('line', {
          x1:pa.x, y1:pa.y, x2:pb.x, y2:pb.y,
          stroke: isBackbone ? '#8b7cf6' : '#3ddbd9',
          'stroke-width': isBackbone ? 1.6 : 1.1,
          'stroke-dasharray': isBackbone ? '5 4' : 'none',
          opacity: 0.5,
          'vector-effect': 'non-scaling-stroke'
        });
        linkLayer.appendChild(line);
      });
    }

    let hoveredCode = null;
    let selectedCode = null;
    let lastGroups = [];

    function render(){
      markerLayer.innerHTML = '';

      const screenPts = sites.map(s => ({
        id: s.siteCode,
        x: basePos[s.siteCode].x * zoom,
        y: basePos[s.siteCode].y * zoom
      }));
      const groups = window.MarkerCluster.clusterPoints(screenPts, CLUSTER_RADIUS_PX);
      lastGroups = groups;

      groups.forEach(group => {
        const worldX = group.x / zoom;
        const worldY = group.y / zoom;

        if(group.members.length === 1){
          const code = group.members[0].id;
          drawSingleMarker(byCode[code], worldX, worldY);
        } else {
          drawClusterBadge(group.members.map(m=>byCode[m.id]), worldX, worldY);
        }
      });
    }

    // re-render is needed when zoom/pan/selection changes (group membership can change),
    // but hover should NEVER tear down the DOM mid-gesture — that detaches the very
    // listener that's about to receive the click. Hover only toggles a CSS-driven
    // visual state on the existing node.
    function setHoverVisual(g, isHovered){
      const core = g.querySelector('.m-core');
      const halo = g.querySelector('.m-halo');
      const ring = g.querySelector('.m-ring');
      const dot = g.querySelector('.m-dot');
      const baseR = parseFloat(g.dataset.baseR || '7');
      const scaleHover = isHovered ? 1.25 : 1;
      if(core) core.setAttribute('r', baseR*scaleHover);
      if(halo) halo.setAttribute('r', (baseR+8)*scaleHover);
      if(ring) ring.setAttribute('r', (baseR+3)*scaleHover);
      if(dot) dot.setAttribute('r', 2.2*scaleHover);
    }

    function drawSingleMarker(site, wx, wy){
      const isHub = !!site.isHub;
      const isSelected = site.siteCode === selectedCode;
      const color = isSelected ? '#f5a623' : (isHub ? '#8b7cf6' : '#3ddbd9');

      const g = mk('g', {class:'map-node', 'data-code':site.siteCode, style:'cursor:pointer;'});
      g.dataset.x = wx; g.dataset.y = wy;
      g.setAttribute('transform', `translate(${wx},${wy}) scale(${1/zoom})`);

      const r = isHub ? 9 : 7;
      g.dataset.baseR = r;
      const scaleHover = isSelected ? 1.25 : 1;

      const halo = mk('circle', {class:'m-halo', cx:0, cy:0, r:(r+8)*scaleHover, fill:color, opacity:0.12});
      const ring = mk('circle', {class:'m-ring', cx:0, cy:0, r:(r+3)*scaleHover, fill:'none', stroke:color, 'stroke-width':1, opacity:0.4});
      const core = mk('circle', {class:'m-core', cx:0, cy:0, r:r*scaleHover, fill:'#10151d', stroke:color, 'stroke-width':2});
      const dot = mk('circle', {class:'m-dot', cx:0, cy:0, r:2.2*scaleHover, fill:color});
      g.appendChild(halo); g.appendChild(ring); g.appendChild(core); g.appendChild(dot);

      if(isHub){
        const t = mk('text', {x:0, y:-(r+12), 'text-anchor':'middle', fill:'#8b7cf6', 'font-size':8, 'font-family':'IBM Plex Mono, monospace', 'letter-spacing':'0.06em'});
        t.textContent = 'HUB';
        g.appendChild(t);
      }

      const labelText = mk('text', {class:'m-label', x:0, y:r+13, 'text-anchor':'middle', fill:'#9fb0c2', 'font-size':9, 'font-family':'IBM Plex Mono, monospace'});
      labelText.textContent = site.siteCode;
      labelText.style.opacity = (isSelected || zoom > 6) ? '1' : '0';
      g.appendChild(labelText);

      g.addEventListener('mouseenter', () => {
        hoveredCode = site.siteCode;
        setHoverVisual(g, true);
        labelText.style.opacity = '1';
        if(onHover) onHover(site.siteCode);
      });
      g.addEventListener('mouseleave', () => {
        hoveredCode = null;
        setHoverVisual(g, false);
        labelText.style.opacity = (isSelected || zoom > 6) ? '1' : '0';
        if(onHover) onHover(null);
      });
      g.addEventListener('click', (e) => { e.stopPropagation(); if(onSelect) onSelect(site.siteCode); });

      markerLayer.appendChild(g);
    }

    function drawClusterBadge(members, wx, wy){
      const g = mk('g', {class:'map-node map-cluster', style:'cursor:pointer;'});
      g.dataset.x = wx; g.dataset.y = wy;
      g.setAttribute('transform', `translate(${wx},${wy}) scale(${1/zoom})`);

      const hasHub = members.some(m=>m.isHub);
      const color = hasHub ? '#8b7cf6' : '#3ddbd9';
      const r = 13;

      g.appendChild(mk('circle', {cx:0, cy:0, r:r+9, fill:color, opacity:0.14}));
      g.appendChild(mk('circle', {cx:0, cy:0, r, fill:'#161f2a', stroke:color, 'stroke-width':2}));
      const t = mk('text', {x:0, y:4, 'text-anchor':'middle', fill:'#e7edf3', 'font-size':11, 'font-weight':'600', 'font-family':'Space Grotesk, sans-serif'});
      t.textContent = String(members.length);
      g.appendChild(t);

      const lbl = mk('text', {x:0, y:r+13, 'text-anchor':'middle', fill:'#9fb0c2', 'font-size':8.5, 'font-family':'IBM Plex Mono, monospace'});
      lbl.textContent = members.length + ' SITES — CLICK TO EXPAND';
      g.appendChild(lbl);

      g.addEventListener('click', (e) => {
        e.stopPropagation();
        zoomToSites(members);
        // Some towers are so close together (under ~150-200m) that no sane zoom
        // level can separate them into individually clickable dots. Detect that
        // case after the zoom decision and offer a quick name-based picker instead
        // of forcing the user to pixel-hunt.
        const stillTooClose = wouldStayClustered(members);
        if(stillTooClose && onClusterExpand) onClusterExpand(members.map(m=>m.siteCode), wx, wy);
      });

      markerLayer.appendChild(g);
    }

    function wouldStayClustered(members){
      if(members.length < 2) return false;
      for(let i=0;i<members.length;i++){
        for(let j=i+1;j<members.length;j++){
          const dx = basePos[members[i].siteCode].x - basePos[members[j].siteCode].x;
          const dy = basePos[members[i].siteCode].y - basePos[members[j].siteCode].y;
          const pxAtMaxZoom = Math.sqrt(dx*dx+dy*dy) * MAX_ZOOM;
          if(pxAtMaxZoom <= CLUSTER_RADIUS_PX) return true;
        }
      }
      return false;
    }

    function setZoom(newZoom, focalSvgX, focalSvgY){
      newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
      if(focalSvgX === undefined){ focalSvgX = VIEW_W/2; focalSvgY = VIEW_H/2; }
      const worldBefore = screenToWorld(focalSvgX, focalSvgY);
      zoom = newZoom;
      panX = focalSvgX - worldBefore.x * zoom;
      panY = focalSvgY - worldBefore.y * zoom;
      applyTransform();
    }

    function zoomToSites(siteList){
      if(!siteList.length) return;
      const xs = siteList.map(s => basePos[s.siteCode].x);
      const ys = siteList.map(s => basePos[s.siteCode].y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const spanX = Math.max(maxX-minX, 4);
      const spanY = Math.max(maxY-minY, 4);

      // find the closest pair within this group — that pair is what determines
      // whether a single click fully separates everyone. Zoom enough that even
      // the closest pair clears the cluster radius, with margin, not just enough
      // to fit the bounding box.
      let minPairDist = Infinity;
      for(let i=0;i<siteList.length;i++){
        for(let j=i+1;j<siteList.length;j++){
          const dx = basePos[siteList[i].siteCode].x - basePos[siteList[j].siteCode].x;
          const dy = basePos[siteList[i].siteCode].y - basePos[siteList[j].siteCode].y;
          const d = Math.sqrt(dx*dx+dy*dy);
          if(d > 0 && d < minPairDist) minPairDist = d;
        }
      }
      const zoomForSeparation = isFinite(minPairDist) && minPairDist > 0
        ? (CLUSTER_RADIUS_PX * 3.2) / minPairDist
        : MAX_ZOOM;

      const zoomForFraming = Math.min((VIEW_W*0.35)/spanX, (VIEW_H*0.35)/spanY);
      const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.max(zoomForSeparation, zoomForFraming)));

      const cx = (minX+maxX)/2, cy = (minY+maxY)/2;
      zoom = targetZoom;
      panX = VIEW_W/2 - cx*zoom;
      panY = VIEW_H/2 - cy*zoom;
      applyTransform();
    }

    function focusSite(siteCode){
      const site = byCode[siteCode];
      if(!site) return;
      selectedCode = siteCode;
      const p = basePos[siteCode];
      const targetZoom = Math.max(zoom, 10);
      zoom = targetZoom;
      panX = VIEW_W/2 - p.x*zoom;
      panY = VIEW_H/2 - p.y*zoom;
      applyTransform();
    }

    function resetView(){
      zoom = 1; panX = 0; panY = 0;
      applyTransform();
    }

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const pt = clientToSvgPoint(e.clientX, e.clientY);
      const factor = e.deltaY < 0 ? 1.18 : 1/1.18;
      setZoom(zoom * factor, pt.x, pt.y);
    }, { passive:false });

    let dragging = false, lastX=0, lastY=0, dragMoved=false;
    svg.addEventListener('mousedown', (e) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY; dragMoved = false;
      svg.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
      if(!dragging) return;
      const rect = svg.getBoundingClientRect();
      const scaleFactor = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
      const dx = (e.clientX - lastX) / scaleFactor;
      const dy = (e.clientY - lastY) / scaleFactor;
      if(Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) dragMoved = true;
      panX += dx; panY += dy;
      lastX = e.clientX; lastY = e.clientY;
      applyTransform();
    });
    window.addEventListener('mouseup', () => { dragging = false; svg.style.cursor = 'grab'; });

    svg.addEventListener('dblclick', (e) => {
      const pt = clientToSvgPoint(e.clientX, e.clientY);
      setZoom(zoom * 1.8, pt.x, pt.y);
    });

    let touchState = null;
    svg.addEventListener('touchstart', (e) => {
      if(e.touches.length === 1){
        touchState = { mode:'pan', x:e.touches[0].clientX, y:e.touches[0].clientY };
      } else if(e.touches.length === 2){
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        touchState = { mode:'pinch', dist: Math.sqrt(dx*dx+dy*dy), zoomStart: zoom };
      }
    }, {passive:true});
    svg.addEventListener('touchmove', (e) => {
      if(!touchState) return;
      if(touchState.mode === 'pan' && e.touches.length === 1){
        const rect = svg.getBoundingClientRect();
        const scaleFactor = Math.min(rect.width / VIEW_W, rect.height / VIEW_H);
        panX += (e.touches[0].clientX - touchState.x) / scaleFactor;
        panY += (e.touches[0].clientY - touchState.y) / scaleFactor;
        touchState.x = e.touches[0].clientX; touchState.y = e.touches[0].clientY;
        applyTransform();
      } else if(touchState.mode === 'pinch' && e.touches.length === 2){
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        const pt = clientToSvgPoint(
          (e.touches[0].clientX+e.touches[1].clientX)/2,
          (e.touches[0].clientY+e.touches[1].clientY)/2
        );
        setZoom(touchState.zoomStart * (dist/touchState.dist), pt.x, pt.y);
      }
    }, {passive:true});
    svg.addEventListener('touchend', () => { touchState = null; });

    buildTerrain();
    buildGrid();
    buildLinks();
    render();
    svg.style.cursor = 'grab';

    return {
      svg,
      setZoom,
      focusSite,
      zoomToSites,
      resetView,
      setSelected(code){ selectedCode = code; render(); },
      getZoom(){ return zoom; },
      didDrag(){ return dragMoved; },
      project: proj.project,
      _proj: proj
    };
  }

  window.MapView = { createMapView };
})();
