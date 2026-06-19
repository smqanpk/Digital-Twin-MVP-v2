/* ============================================================
   twin-rig-3d.js
   Isometric digital twin renderer. Builds a true axonometric
   scene for a tower site, with distinct mast geometry per
   structure type (self-supported lattice tower, monopole /
   tubular, guyed mast fallback), and clickable asset hotspots
   wired to real SMDB fields — same data contract as before,
   new visual language.
   ============================================================ */

(function(){
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  function el(tag, attrs){
    const n = document.createElementNS(NS, tag);
    for(const k in (attrs||{})) n.setAttribute(k, attrs[k]);
    return n;
  }
  function text(x, y, str, attrs){
    const t = el('text', Object.assign({x, y}, attrs||{}));
    t.textContent = str;
    return t;
  }

  const SCALE = 5.6;

  function P(x, y, z){
    return window.Iso.project(x, y, z, SCALE);
  }

  function buildHotspotAt(id, wx, wy, wz, r, label, classification){
    const p = P(wx, wy, wz);
    const color = classification === 'absent' ? 'var(--text-mute)'
                : classification === 'alert' ? 'var(--amber)'
                : classification === 'good' ? 'var(--green)'
                : 'var(--cyan)';
    const g = el('g', {class:'twin-hotspot', 'data-asset': id, style:'cursor:pointer;'});
    g.appendChild(el('circle', {cx:p.x, cy:p.y, r:r+7, fill:'none', stroke:color, 'stroke-width':1, opacity:0.35, class:'hotspot-ring'}));
    g.appendChild(el('circle', {cx:p.x, cy:p.y, r:r+3, fill:color, opacity:0.14, class:'hotspot-halo'}));
    g.appendChild(el('circle', {cx:p.x, cy:p.y, r, fill:'var(--panel)', stroke:color, 'stroke-width':2, class:'hotspot-core'}));
    g.appendChild(el('circle', {cx:p.x, cy:p.y, r:2.4, fill:color, class:'hotspot-dot'}));
    g.dataset.label = label;
    g.dataset.state = classification;
    return g;
  }

  function box(cx, cy, baseZ, w, d, h, colors){
    const faces = window.Iso.boxFaces(w, d, h, SCALE);
    const base = P(cx, cy, baseZ);
    const g = el('g', {transform:`translate(${base.x.toFixed(2)},${base.y.toFixed(2)})`});
    g.appendChild(el('path', {d:faces.left, fill:colors.left, stroke:colors.stroke||'#2a3744', 'stroke-width':1}));
    g.appendChild(el('path', {d:faces.right, fill:colors.right, stroke:colors.stroke||'#2a3744', 'stroke-width':1}));
    g.appendChild(el('path', {d:faces.top, fill:colors.top, stroke:colors.stroke||'#2a3744', 'stroke-width':1}));
    return g;
  }

  function buildGround(scene){
    const groundFaces = window.Iso.boxFaces(58, 58, 0.4, SCALE);
    const base = P(0, 0, 0);
    const g = el('g', {transform:`translate(${base.x},${base.y})`});
    g.appendChild(el('path', {d:groundFaces.top, fill:'#0d1420', stroke:'#1d2733', 'stroke-width':1}));
    scene.appendChild(g);

    const fenceFaces = window.Iso.boxFaces(66, 66, 0.2, SCALE);
    const fenceG = el('g', {transform:`translate(${base.x},${base.y})`});
    fenceG.appendChild(el('path', {d:fenceFaces.top, fill:'none', stroke:'#28384a', 'stroke-width':1.1, 'stroke-dasharray':'3 5'}));
    scene.appendChild(fenceG);
  }

  function buildSelfSupportedTower(scene, opts){
    const { totalHeight, group } = opts;
    const baseHalf = 5.2, topHalf = 0.9;
    const segs = 8;
    const legsScreen = [[],[],[],[]];
    const cornerOffsets = [[-1,-1],[1,-1],[1,1],[-1,1]];

    for(let i=0;i<=segs;i++){
      const t = i/segs;
      const h = t * totalHeight;
      const half = baseHalf - t*(baseHalf-topHalf);
      cornerOffsets.forEach((off, ci) => {
        legsScreen[ci].push(P(off[0]*half, off[1]*half, h));
      });
    }

    const legColor = '#3ddbd9';
    legsScreen.forEach(pts => {
      const d = pts.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ');
      group.appendChild(el('path', {d, fill:'none', stroke:legColor, 'stroke-width':1.6, opacity:0.85}));
    });

    for(let i=0;i<segs;i++){
      [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b]) => {
        const p1 = legsScreen[a][i], p2 = legsScreen[b][i];
        group.appendChild(el('line', {x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, stroke:'#2a3744', 'stroke-width':1, opacity:0.7}));
      });
      [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b]) => {
        const p1 = legsScreen[a][i], p2 = legsScreen[b][i+1];
        const p3 = legsScreen[b][i], p4 = legsScreen[a][i+1];
        group.appendChild(el('line', {x1:p1.x, y1:p1.y, x2:p2.x, y2:p2.y, stroke:'#212d3a', 'stroke-width':0.8, opacity:0.55}));
        group.appendChild(el('line', {x1:p3.x, y1:p3.y, x2:p4.x, y2:p4.y, stroke:'#212d3a', 'stroke-width':0.8, opacity:0.55}));
      });
    }

    const topP = P(0,0,totalHeight+1.5);
    const beacon = el('circle', {cx:topP.x, cy:topP.y, r:1.6, fill:'#f15b6c'});
    beacon.appendChild(el('animate', {attributeName:'opacity', values:'1;0.25;1', dur:'1.6s', repeatCount:'indefinite'}));
    const stemTop = P(0,0,totalHeight);
    group.appendChild(el('line', {x1:stemTop.x, y1:stemTop.y, x2:topP.x, y2:topP.y, stroke:'#5c6b7d', 'stroke-width':1}));
    group.appendChild(beacon);

    return { mastTopHalf: topHalf, mastBaseHalf: baseHalf };
  }

  function buildMonopoleTower(scene, opts){
    const { totalHeight, group } = opts;
    const baseR = 1.6, topR = 0.6;
    const segs = 10;
    const leftPts = [], rightPts = [];
    for(let i=0;i<=segs;i++){
      const t = i/segs;
      const h = t * totalHeight;
      const r = baseR - t*(baseR-topR);
      leftPts.push(P(-r, 0, h));
      rightPts.push(P(r, 0, h));
    }
    const outline = [...leftPts, ...rightPts.slice().reverse()];
    const d = outline.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' ') + ' Z';
    group.appendChild(el('path', {d, fill:'#1a2733', stroke:'#3ddbd9', 'stroke-width':1.3}));
    const seam = leftPts.map((_,i)=>P(0,0,i/segs*totalHeight));
    group.appendChild(el('path', {
      d: seam.map((p,i)=>(i===0?'M':'L')+p.x.toFixed(2)+','+p.y.toFixed(2)).join(' '),
      fill:'none', stroke:'#0c1117', 'stroke-width':0.8, opacity:0.5
    }));

    const topP = P(0,0,totalHeight+1.3);
    const beacon = el('circle', {cx:topP.x, cy:topP.y, r:1.6, fill:'#f15b6c'});
    beacon.appendChild(el('animate', {attributeName:'opacity', values:'1;0.25;1', dur:'1.6s', repeatCount:'indefinite'}));
    const stemTop = P(0,0,totalHeight);
    group.appendChild(el('line', {x1:stemTop.x, y1:stemTop.y, x2:topP.x, y2:topP.y, stroke:'#5c6b7d', 'stroke-width':1}));
    group.appendChild(beacon);

    return { mastTopHalf: topR, mastBaseHalf: baseR, isPole:true };
  }

  function buildGuyedMast(scene, opts){
    const { totalHeight, group } = opts;
    const base = P(0,0,0);
    const top = P(0,0,totalHeight);
    group.appendChild(el('line', {x1:base.x, y1:base.y, x2:top.x, y2:top.y, stroke:'#3ddbd9', 'stroke-width':2}));

    const guyAnchors = [[10,0],[-7,7],[-7,-7]];
    const guyHeight = totalHeight*0.62;
    const guyTop = P(0,0,guyHeight);
    guyAnchors.forEach(([ax,ay]) => {
      const anchor = P(ax, ay, 0);
      group.appendChild(el('line', {x1:guyTop.x, y1:guyTop.y, x2:anchor.x, y2:anchor.y, stroke:'#3a4756', 'stroke-width':0.9, opacity:0.7}));
    });

    const topP = P(0,0,totalHeight+1.3);
    const beacon = el('circle', {cx:topP.x, cy:topP.y, r:1.6, fill:'#f15b6c'});
    beacon.appendChild(el('animate', {attributeName:'opacity', values:'1;0.25;1', dur:'1.6s', repeatCount:'indefinite'}));
    group.appendChild(el('line', {x1:top.x, y1:top.y, x2:topP.x, y2:topP.y, stroke:'#5c6b7d', 'stroke-width':1}));
    group.appendChild(beacon);

    return { mastTopHalf: 0.6, mastBaseHalf: 0.6, isPole:true };
  }

  const TOWER_MODELS = {
    'self-supported tower': { build: buildSelfSupportedTower, label: 'Self-Supported Lattice Tower' },
    'tubular': { build: buildMonopoleTower, label: 'Monopole / Tubular Tower' },
    'monopole': { build: buildMonopoleTower, label: 'Monopole / Tubular Tower' },
    'guyed mast': { build: buildGuyedMast, label: 'Guyed Mast' },
    'rooftop': { build: buildMonopoleTower, label: 'Rooftop Mount' },
  };

  function resolveTowerModel(structureType){
    const key = String(structureType||'').trim().toLowerCase();
    return TOWER_MODELS[key] || { build: buildSelfSupportedTower, label: structureType || 'Tower' };
  }

  function buildGroundAssets(scene, site){
    const shelterPos = { x: 8, y: 5 };
    scene.appendChild(box(shelterPos.x, shelterPos.y, 0, 7, 5, 3.2, {
      top:'#22303f', left:'#182230', right:'#141b25'
    }));
    const shelterLabel = P(shelterPos.x, shelterPos.y - 4.6, 0.2);
    scene.appendChild(text(shelterLabel.x, shelterLabel.y, 'SHELTER', {
      fill:'#7d8fa3', 'font-size':4.4, 'font-weight':'600', 'font-family':'var(--font-mono)', 'text-anchor':'middle', 'letter-spacing':'0.04em'
    }));
    const rmsState = String(site.rms||'').toLowerCase()==='yes' ? 'present' : 'absent';
    scene.appendChild(buildHotspotAt('shelter', shelterPos.x+2, shelterPos.y-1, 3.2, 2.6, 'Equipment Shelter / RMS', rmsState));
    scene.appendChild(buildHotspotAt('rectifier', shelterPos.x-2.5, shelterPos.y+1.5, 3.2, 2.2, 'Rectifier / Power Plant', (site.numRectifiers||0)>0?'present':'absent'));

    const battPos = { x: 1, y: 8 };
    const battType = String(site.batteryBank1Type||'').toLowerCase();
    const battState = !battType ? 'absent' : (battType.includes('obsolete') ? 'alert' : 'present');
    const battColor = battState === 'alert' ? '#3a2a1c' : (battState === 'absent' ? '#181f28' : '#16313a');
    scene.appendChild(box(battPos.x, battPos.y, 0, 3.6, 2.4, 1.8, {
      top: battColor, left:'#161f2a', right:'#10161e'
    }));
    scene.appendChild(buildHotspotAt('battery', battPos.x, battPos.y, 1.8, 2.4, 'Battery Bank', battState));

    const dgPos = { x: -7, y: 6 };
    const dgStatusRaw = site.dg1Status;
    const dgStatusLower = String(dgStatusRaw||'').toLowerCase();
    const dgState = (!dgStatusRaw || dgStatusLower==='none') ? 'alert' : (dgStatusLower.includes('operational') ? 'present' : 'alert');
    scene.appendChild(box(dgPos.x, dgPos.y, 0, 4.2, 2.6, 2, {
      top:'#1c2735', left:'#161f2a', right:'#10161e'
    }));
    scene.appendChild(buildHotspotAt('dg', dgPos.x, dgPos.y, 2, 2.6, 'Diesel Generator', dgState));

    const solarPresent = String(site.solarized).toLowerCase()==='yes';
    const solarPos = { x: -2, y: -8 };
    if(solarPresent){
      scene.appendChild(box(solarPos.x, solarPos.y, 0, 5, 3.4, 0.3, {
        top:'#16202c', left:'#11161c', right:'#0e1217', stroke:'#3ddbd9'
      }));
    } else {
      const gp = P(solarPos.x, solarPos.y, 0.3);
      scene.appendChild(el('circle', {cx:gp.x, cy:gp.y, r:6, fill:'none', stroke:'#28384a', 'stroke-width':1, 'stroke-dasharray':'2 4'}));
    }
    scene.appendChild(buildHotspotAt('solar', solarPos.x, solarPos.y, 1.4, 2.8, 'Solar Array', solarPresent?'present':'absent'));

    const gridPos = { x: 9, y: -5 };
    const gridTypeLower = String(site.gridType||'').toLowerCase();
    const gridState = !gridTypeLower ? 'absent' : (gridTypeLower.includes('good') ? 'present' : 'alert');
    scene.appendChild(box(gridPos.x, gridPos.y, 0, 2.6, 2.6, 3, {
      top:'#16202c', left:'#11161c', right:'#0e1217', stroke:'#3ddbd9'
    }));
    scene.appendChild(buildHotspotAt('grid', gridPos.x, gridPos.y, 3, 2.2, 'Grid / Transformer', gridState));

    const fiberPresent = String(site.fiber).toLowerCase()==='yes';
    const fiberPos = { x: -9, y: -3 };
    const fp = P(fiberPos.x, fiberPos.y, 0.6);
    scene.appendChild(el('circle', {cx:fp.x, cy:fp.y, r:3, fill:'#101822', stroke: fiberPresent ? '#4ade80' : '#3a4756', 'stroke-width':1.2}));
    scene.appendChild(buildHotspotAt('fiber', fiberPos.x, fiberPos.y, 1.2, 2.4, 'Fiber Connectivity', fiberPresent ? 'good' : 'absent'));
  }

  function buildTwinSVG(svgEl, site){
    svgEl.innerHTML = '';
    svgEl.setAttribute('viewBox', '-130 -190 260 280');

    const defs = el('defs', {});
    svgEl.appendChild(defs);

    const scene = el('g', {id:'twinScene'});
    svgEl.appendChild(scene);

    // Explicit paint-order layers rather than a global numeric depth sort.
    // A scalar "depth" heuristic is unreliable in parallel (isometric)
    // projection once both ground-height and tower-height objects mix in
    // the same list — it produced hotspots painting underneath their own
    // asset box. Instead: paint back-to-front by *logical* layer, and
    // always paint a hotspot immediately after the geometry it marks, so
    // it is guaranteed to sit visibly on top of that one object.
    const groundLayer = el('g', {class:'layer-ground'});
    const groundAssetsLayer = el('g', {class:'layer-ground-assets'});
    const towerLayer = el('g', {class:'layer-tower'});
    const towerHotspotLayer = el('g', {class:'layer-tower-hotspots'});
    scene.appendChild(groundLayer);
    scene.appendChild(groundAssetsLayer);
    scene.appendChild(towerLayer);
    scene.appendChild(towerHotspotLayer);

    buildGround(groundLayer);

    const totalHeight = Math.max(8, Math.min(40, Number(site.towerHeight) || 30)) * 0.62;
    const towerGroup = el('g', {class:'twin-tower-group'});
    const model = resolveTowerModel(site.structureType);
    model.build(towerLayer, { totalHeight, group: towerGroup, site });
    towerLayer.appendChild(towerGroup);

    const platformZ1 = totalHeight * 0.86;
    const platformZ2 = totalHeight * 0.62;
    const rruZ = totalHeight * 0.4;

    const totalRF = site.totalRFAntenna || (site.dualBandAntennas||0)+(site.tribandAntennas||0)+(site.antenna4T6S||0)+(site.mmAntenna||0);
    const rfPresent = totalRF > 0;

    [[-3.6,0],[3.6,0],[0,-3.6],[0,3.6]].forEach(([ax,ay]) => {
      towerHotspotLayer.appendChild(box(ax*0.9, ay*0.9, platformZ1-0.6, 1.1, 2.6, 1.3, {
        top: rfPresent ? '#1c3a44' : '#161b22',
        left: rfPresent ? '#16313a' : '#141920',
        right: rfPresent ? '#102127' : '#10141a',
        stroke: rfPresent ? '#3ddbd9' : '#3a4756'
      }));
    });
    towerHotspotLayer.appendChild(buildHotspotAt('rf-antennas', 0, 0, platformZ1, 3.4, 'RF Antennas', rfPresent?'present':'absent'));

    const mwPresent = (site.totalMWAntenna||0) > 0;
    if(mwPresent){
      const dishP = P(-4.5,-4.5,platformZ2);
      towerHotspotLayer.appendChild(el('circle', {cx:dishP.x, cy:dishP.y, r:2.4, fill:'#16202c', stroke:'#3ddbd9', 'stroke-width':1, opacity:0.6}));
    }
    towerHotspotLayer.appendChild(buildHotspotAt('mw-link', -4.5, -4.5, platformZ2, 2.6, 'Microwave / Backhaul', mwPresent?'present':'absent'));

    if(site.massiveMimoAAU){
      towerHotspotLayer.appendChild(box(2.4, -3.2, platformZ2-0.4, 1.4, 1.4, 1.6, {
        top:'#241c33', left:'#1d1729', right:'#15101e', stroke:'#8b7cf6'
      }));
      towerHotspotLayer.appendChild(buildHotspotAt('massive-mimo', 2.4, -3.2, platformZ2+1.2, 2.4, 'Massive MIMO AAU', site.massiveMimoAAU>0?'present':'absent'));
    }

    towerHotspotLayer.appendChild(buildHotspotAt('rru', 1.5, 1.5, rruZ, 2.6, 'RRUs', (site.totalRRUs||0)>0?'present':'absent'));

    if((site.noOfBSDDishes||0) > 0){
      const dishPos = { x:6, y:-2, z: platformZ2 };
      const dp = P(dishPos.x, dishPos.y, dishPos.z);
      towerHotspotLayer.appendChild(el('circle', {cx:dp.x, cy:dp.y, r:3.2, fill:'#1c2735', stroke:'#f5a623', 'stroke-width':1.4}));
      towerHotspotLayer.appendChild(el('circle', {cx:dp.x, cy:dp.y, r:1.1, fill:'#0c1117', stroke:'#f5a623', 'stroke-width':0.8}));
      towerHotspotLayer.appendChild(buildHotspotAt('bsd-dish', dishPos.x, dishPos.y, dishPos.z, 4.2, 'BSD Microwave Dish', 'present'));
    }

    buildGroundAssets(groundAssetsLayer, site);

    const fiberHotspot = scene.querySelector('[data-asset="fiber"]');
    if(fiberHotspot && fiberHotspot.dataset.state === 'good'){
      fiberHotspot.querySelectorAll('circle').forEach(c => {
        if(c.getAttribute('fill') && c.getAttribute('fill') !== 'var(--panel)') c.setAttribute('fill', 'var(--green)');
        if(c.getAttribute('stroke')) c.setAttribute('stroke', 'var(--green)');
      });
    }

    return scene;
  }

  function assetDetail(id, site){
    const fmtBool = v => v===undefined||v===null||v==='' ? '—' : v;
    const groups = {
      'rf-antennas': {
        title:'RF Antenna Array', sub:'Sector panel antennas',
        rows:[
          ['Dual-band antennas', fmtBool(site.dualBandAntennas)],
          ['Triband / above', fmtBool(site.tribandAntennas)],
          ['4T6S antennas', fmtBool(site.antenna4T6S)],
          ['mmWave antennas', fmtBool(site.mmAntenna)],
          ['Total RF antennas', fmtBool(site.totalRFAntenna)],
          ['Current technology', fmtBool(site.currentTech)],
        ]
      },
      'mw-link': {
        title:'Microwave Backhaul', sub:'Point-to-point link',
        rows:[
          ['Total MW antennas', fmtBool(site.totalMWAntenna)],
          ['BSD dishes', fmtBool(site.noOfBSDDishes)],
          ['Dish size', fmtBool(site.sizeOfDishes)],
          ['Fiber available', fmtBool(site.fiber)],
        ]
      },
      'massive-mimo': {
        title:'Massive MIMO AAU', sub:'Active antenna unit',
        rows:[
          ['Massive MIMO AAU count', fmtBool(site.massiveMimoAAU)],
          ['Total RRUs', fmtBool(site.totalRRUs)],
          ['Technology', fmtBool(site.currentTech)],
        ]
      },
      'rru': {
        title:'Remote Radio Units', sub:'Baseband RF front-end',
        rows:[
          ['Total RRUs installed', fmtBool(site.totalRRUs)],
          ['Vendor', fmtBool(site.vendor)],
          ['2G active cells', fmtBool(site.total2G)],
          ['4G active cells', fmtBool(site.total4G)],
        ]
      },
      'bsd-dish': {
        title:'BSD Microwave Dish', sub:'Backhaul / spur dish',
        rows:[
          ['Dishes installed', fmtBool(site.noOfBSDDishes)],
          ['Dish size', fmtBool(site.sizeOfDishes)],
        ]
      },
      'shelter': {
        title:'Equipment Shelter', sub:'Indoor / outdoor cabinet',
        rows:[
          ['Enclosure type', fmtBool(site.indoorOutdoor)],
          ['RMS deployed', fmtBool(site.rms)],
          ['RMS vendor', fmtBool(site.rmsVendor)],
          ['FLM / O&M vendor', fmtBool(site.flmVendor)],
          ['Site category', fmtBool(site.siteCategory)],
        ]
      },
      'rectifier': {
        title:'Rectifier / Power Plant', sub:'DC power conversion',
        rows:[
          ['Rectifiers installed', fmtBool(site.numRectifiers)],
          ['Rectifier #1 manufacturer', fmtBool(site.rectifier1Manufacturer)],
          ['Rectifier #1 modules', fmtBool(site.rectifier1Modules)],
          ['Rectifier #2 manufacturer', fmtBool(site.rectifier2Manufacturer)],
        ]
      },
      'battery': {
        title:'Battery Bank', sub:'DC backup storage',
        rows:[
          ['Bank #1 type', fmtBool(site.batteryBank1Type)],
          ['Bank #1 cells', fmtBool(site.batteryBank1Cells)],
          ['Bank #1 AH capacity', fmtBool(site.batteryBank1AH)],
          ['Bank #1 install age', fmtBool(site.batteryBank1Install)],
        ]
      },
      'dg': {
        title:'Diesel Generator', sub:'Backup power generation',
        rows:[
          ['DG #1 model / make', fmtBool(site.dg1ModelMake)],
          ['DG #1 rating (KVA)', fmtBool(site.dg1RatingKVA)],
          ['DG #1 status', fmtBool(site.dg1Status)],
          ['DG #1 install age', fmtBool(site.dg1InstallDate)],
        ]
      },
      'solar': {
        title:'Solar Array', sub:'Renewable supplementary power',
        rows:[
          ['Solarized', fmtBool(site.solarized)],
          ['Deployment date', fmtBool(site.solarDeployDate)],
          ['Design load (kW)', fmtBool(site.solarLoadDesign)],
        ]
      },
      'grid': {
        title:'Grid / Transformer', sub:'Utility power connection',
        rows:[
          ['Grid type', fmtBool(site.gridType)],
          ['On grid', fmtBool(site.onGrid)],
          ['Transformer entity', fmtBool(site.transformerEntity)],
          ['Transformer capacity', fmtBool(site.transformerCapacityKVA)],
        ]
      },
      'fiber': {
        title:'Fiber Connectivity', sub:'Transport medium',
        rows:[
          ['Fiber available', fmtBool(site.fiber)],
          ['Macro / TXN', fmtBool(site.macroTxn)],
          ['Hard access area', fmtBool(site.hardAccessArea)],
        ]
      },
    };
    return groups[id] || {title:id, sub:'', rows:[]};
  }

  function getTowerModelLabel(structureType){
    return resolveTowerModel(structureType).label;
  }

  window.TwinRig = { buildTwinSVG, assetDetail, getTowerModelLabel };
})();
