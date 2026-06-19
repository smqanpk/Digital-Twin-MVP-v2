/* ============================================================
   app.js — TMS-Twin v2 application logic
   ============================================================ */

(function(){
  'use strict';

  const SITES = window.SMDB_SITES || [];
  const NETWORK = window.SMDB_NETWORK || {edges:[], clusterCount:0};
  const byCode = {};
  SITES.forEach(s => byCode[s.siteCode] = s);

  let selectedCode = null;
  let mapView = null;
  let activeTab = 'twin';

  document.addEventListener('DOMContentLoaded', () => {
    initTopStats();
    initMap();
    initTabs();
    initInspectorClose();
    initSearch();
    initZoomControls();
    initDirectory();
    initTicker();
    buildNetworkSVG();
  });

  function initTopStats(){
    const onAir = SITES.filter(s => (s.opStatus||'').toLowerCase().includes('on air')).length;
    document.getElementById('statOnAir').textContent = onAir;
    const overloaded = SITES.filter(s => (s.towerLoadingStatus||'').toLowerCase().includes('overload') && !(s.towerLoadingStatus||'').toLowerCase().includes('not')).length;
    document.getElementById('statAlerts').textContent = overloaded;
    const cells = SITES.reduce((a,s)=> a + (Number(s.total2G)||0) + (Number(s.total4G)||0), 0);
    document.getElementById('statCells').textContent = cells;
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  /* --------------------------------------------------------
     MAP (self-contained SVG renderer, no external dependency)
  -------------------------------------------------------- */
  function initMap(){
    mapView = MapView.createMapView({
      container: document.getElementById('mapMount'),
      sites: SITES,
      edges: NETWORK.edges,
      onSelect: (code) => selectSite(code),
      onHover: (code) => { /* reserved for future hover-linked UI */ },
      onClusterExpand: (codes, x, y) => showClusterPicker(codes)
    });
  }

  function showClusterPicker(codes){
    const picker = document.getElementById('clusterPicker');
    const list = document.getElementById('clusterPickerList');
    list.innerHTML = '';
    codes.forEach(code => {
      const site = byCode[code];
      if(!site) return;
      const btn = document.createElement('button');
      btn.innerHTML = `<span>${escapeHtml(code)}</span><span style="color:var(--text-mute); font-size:10px;">${escapeHtml(site.siteName||'')}</span>`;
      btn.addEventListener('click', () => {
        picker.style.display = 'none';
        selectSite(code);
        mapView.focusSite(code);
      });
      list.appendChild(btn);
    });
    picker.style.display = 'block';
    clearTimeout(picker._hideTimer);
    picker._hideTimer = setTimeout(() => { picker.style.display = 'none'; }, 9000);
  }

  function selectSite(code){
    selectedCode = code;
    const site = byCode[code];
    if(!site) return;
    if(mapView){
      mapView.setSelected(code);
      mapView.focusSite(code);
    }
    renderTwin(site);
    updateDirectorySelection();
    document.getElementById('crumbRegion').textContent = site.region + ' · ' + site.siteCode;
  }

  /* --------------------------------------------------------
     TABS
  -------------------------------------------------------- */
  function initTabs(){
    document.querySelectorAll('.tabstrip button').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(tab){
    activeTab = tab;
    document.querySelectorAll('.tabstrip button').forEach(b => b.classList.toggle('active', b.dataset.tab===tab));
    document.getElementById('twinView').style.display = tab==='twin' ? 'flex' : 'none';
    document.getElementById('networkView').style.display = tab==='network' ? 'block' : 'none';

    const titleEl = document.getElementById('rightPaneTitle');
    const subEl = document.getElementById('rightPaneSub');
    if(tab==='twin'){
      titleEl.childNodes[0].textContent = 'Digital Twin ';
      subEl.textContent = selectedCode ? `${selectedCode} asset rig` : 'Select a site on the map';
    } else {
      titleEl.childNodes[0].textContent = 'Network Topology ';
      subEl.textContent = `${SITES.length} sites · ${NETWORK.edges.length} links · ${NETWORK.clusterCount} clusters`;
    }
  }

  /* --------------------------------------------------------
     DIGITAL TWIN RENDER (isometric, tower-type aware)
  -------------------------------------------------------- */
  function renderTwin(site){
    document.getElementById('twinEmpty').style.display = 'none';
    const svg = document.getElementById('twinSvg');
    const label = document.getElementById('twinSiteLabel');
    svg.style.display = 'block';
    label.style.display = 'block';

    TwinRig.buildTwinSVG(svg, site);

    const statusGood = (site.opStatus||'').toLowerCase().includes('on air');
    const modelLabel = TwinRig.getTowerModelLabel(site.structureType);
    label.innerHTML = `
      <div class="code">${site.siteCode}</div>
      <div class="meta">${escapeHtml(site.siteName||'')}</div>
      <div class="meta">${escapeHtml(site.district||'')}, ${escapeHtml(site.province||'')}</div>
      <div class="model-tag">${escapeHtml(modelLabel)}</div>
      <div class="status-chip" style="${statusGood?'':'background:var(--amber-dim);color:var(--amber);border-color:rgba(245,166,35,.3);'}">
        <span class="dot"></span> ${escapeHtml(site.opStatus||'Unknown')}
      </div>
    `;

    document.getElementById('rightPaneSub').textContent = `${site.siteCode} asset rig`;

    const tooltip = document.getElementById('assetTooltip');
    svg.querySelectorAll('.twin-hotspot').forEach(hs => {
      hs.addEventListener('mouseenter', () => {
        tooltip.innerHTML = `<div class="t-title">${escapeHtml(hs.dataset.label)}</div>Click for full asset detail`;
        tooltip.classList.add('show');
      });
      hs.addEventListener('mousemove', (e) => {
        const rect = document.getElementById('twinCanvas').getBoundingClientRect();
        tooltip.style.left = (e.clientX - rect.left + 14) + 'px';
        tooltip.style.top = (e.clientY - rect.top - 10) + 'px';
      });
      hs.addEventListener('mouseleave', () => tooltip.classList.remove('show'));
      hs.addEventListener('click', () => openInspector(hs.dataset.asset, site));
    });
  }

  function openInspector(assetId, site){
    const detail = TwinRig.assetDetail(assetId, site);
    const insp = document.getElementById('inspector');
    insp.classList.remove('collapsed');
    document.getElementById('inspTitle').textContent = detail.title;
    document.getElementById('inspSub').textContent = `${site.siteCode} · ${detail.sub}`;

    const body = document.getElementById('inspBody');
    let html = `<div class="field-group">
      <div class="field-group-title"><span class="bar"></span> Asset Parameters</div>`;
    detail.rows.forEach(([k,v]) => {
      html += `<div class="field-row"><span class="k">${escapeHtml(k)}</span><span class="v">${escapeHtml(String(v))}</span></div>`;
    });
    html += `</div>`;

    if(assetId === 'shelter' && site.availableCapacityPct !== undefined && site.availableCapacityPct !== null){
      const pct = Math.max(0, Math.min(100, Number(site.availableCapacityPct)*100));
      const avail = typeof site.availableCapacity === 'number' ? site.availableCapacity.toFixed(2) : site.availableCapacity;
      const loadingWarn = (site.towerLoadingStatus||'').toLowerCase().includes('overload') && !(site.towerLoadingStatus||'').toLowerCase().includes('not');
      html += `<div class="field-group">
        <div class="field-group-title"><span class="bar"></span> Tower Capacity</div>
        <div class="field-row"><span class="k">Design capacity</span><span class="v">${site.designCapacity ?? '—'} m²</span></div>
        <div class="field-row"><span class="k">Used (Jazz)</span><span class="v accent">${site.capacityUsedJazz ?? '—'} m²</span></div>
        <div class="field-row"><span class="k">Available</span><span class="v good">${avail} m²</span></div>
        <div class="capacity-bar-track"><div class="capacity-bar-fill" style="width:${pct}%"></div></div>
        <div class="field-row"><span class="k">Loading status</span><span class="v ${loadingWarn?'warn':'good'}">${escapeHtml(site.towerLoadingStatus||'—')}</span></div>
      </div>`;
    }

    html += `<div class="field-group">
      <div class="field-group-title"><span class="bar"></span> Site &amp; Ownership</div>
      <div class="field-row"><span class="k">Site code</span><span class="v accent">${site.siteCode}</span></div>
      <div class="field-row"><span class="k">Structure type</span><span class="v">${escapeHtml(site.structureType||'—')}</span></div>
      <div class="field-row"><span class="k">Tower height</span><span class="v">${site.towerHeight ?? '—'} m</span></div>
      <div class="field-row"><span class="k">Vendor</span><span class="v">${escapeHtml(site.vendor||'—')}</span></div>
      <div class="field-row"><span class="k">Total tenants</span><span class="v">${site.totalTenants ?? '—'}</span></div>
      <div class="field-row"><span class="k">MBU lead</span><span class="v">${escapeHtml(site.mbuLead||'—')}</span></div>
      <div class="field-row"><span class="k">Zonal manager</span><span class="v">${escapeHtml(site.zonalManager||'—')}</span></div>
      <div class="field-row"><span class="k">Lease expiry</span><span class="v">${escapeHtml(site.leaseExpiry||'—')}</span></div>
    </div>`;

    body.innerHTML = html;
  }

  function initInspectorClose(){
    document.getElementById('inspClose').addEventListener('click', () => {
      document.getElementById('inspector').classList.add('collapsed');
    });
  }

  /* --------------------------------------------------------
     SEARCH
  -------------------------------------------------------- */
  function initSearch(){
    const input = document.getElementById('siteSearch');
    input.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        e.preventDefault();
        const q = input.value.trim().toLowerCase();
        if(!q) return;
        const hit = SITES.find(s => (s.siteCode||'').toLowerCase()===q) ||
                    SITES.find(s => (s.siteCode||'').toLowerCase().includes(q)) ||
                    SITES.find(s => (s.city||'').toLowerCase().includes(q)) ||
                    SITES.find(s => (s.district||'').toLowerCase().includes(q)) ||
                    SITES.find(s => (s.siteName||'').toLowerCase().includes(q));
        if(hit) selectSite(hit.siteCode);
      }
    });
  }

  /* --------------------------------------------------------
     ZOOM CONTROLS
  -------------------------------------------------------- */
  function initZoomControls(){
    document.getElementById('zoomIn').addEventListener('click', () => {
      if(mapView) mapView.setZoom(mapView.getZoom() * 1.5);
    });
    document.getElementById('zoomOut').addEventListener('click', () => {
      if(mapView) mapView.setZoom(mapView.getZoom() / 1.5);
    });
    document.getElementById('zoomReset').addEventListener('click', () => {
      if(mapView) mapView.resetView();
    });
  }

  /* --------------------------------------------------------
     SITE DIRECTORY — reliable navigation regardless of how
     close together sites are on the map
  -------------------------------------------------------- */
  function initDirectory(){
    const toggleBtn = document.getElementById('toggleDirectory');
    const directory = document.getElementById('siteDirectory');
    const closeBtn = document.getElementById('directoryClose');
    const list = document.getElementById('directoryList');
    const countEl = document.getElementById('directoryCount');

    countEl.textContent = `(${SITES.length})`;

    const sorted = [...SITES].sort((a,b) => (a.siteCode||'').localeCompare(b.siteCode||''));
    sorted.forEach(site => {
      const item = document.createElement('div');
      item.className = 'directory-item';
      item.dataset.code = site.siteCode;
      const color = site.isHub ? 'var(--violet)' : 'var(--cyan)';
      item.innerHTML = `
        <span class="di-dot" style="background:${color}; box-shadow:0 0 5px ${color};"></span>
        <span class="di-code">${escapeHtml(site.siteCode)}</span>
        <span class="di-name">${escapeHtml(site.city||site.siteName||'')}</span>
      `;
      item.addEventListener('click', () => {
        selectSite(site.siteCode);
        switchTab('twin');
      });
      list.appendChild(item);
    });

    toggleBtn.addEventListener('click', () => directory.classList.toggle('open'));
    closeBtn.addEventListener('click', () => directory.classList.remove('open'));
  }

  function updateDirectorySelection(){
    document.querySelectorAll('.directory-item').forEach(item => {
      item.classList.toggle('active', item.dataset.code === selectedCode);
    });
  }

  /* --------------------------------------------------------
     NETWORK TOPOLOGY SVG VIEW (unchanged logic from v1 — this
     module was never implicated in any bug found during review)
  -------------------------------------------------------- */
  function buildNetworkSVG(){
    const svg = document.getElementById('networkSvg');
    const W = 800, H = 600;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';

    const clusters = {};
    SITES.forEach(s => {
      const cid = s.clusterId ?? 0;
      clusters[cid] = clusters[cid] || [];
      clusters[cid].push(s);
    });
    const clusterIds = Object.keys(clusters).map(Number).sort((a,b)=>a-b);

    const centerX = W/2, centerY = H/2 + 10;
    const ringR = Math.min(W,H)/2 - 110;
    const positions = {};

    clusterIds.forEach((cid, i) => {
      const angle = (i / clusterIds.length) * Math.PI * 2 - Math.PI/2;
      const cx = centerX + ringR * Math.cos(angle);
      const cy = centerY + ringR * Math.sin(angle) * 0.82;
      const members = clusters[cid];
      const hub = members.find(m => m.isHub) || members[0];
      positions[hub.siteCode] = {x: cx, y: cy};

      const others = members.filter(m => m !== hub);
      const memberR = 62;
      others.forEach((m, j) => {
        const a2 = (j / Math.max(others.length,1)) * Math.PI * 2;
        positions[m.siteCode] = {
          x: cx + memberR * Math.cos(a2),
          y: cy + memberR * Math.sin(a2)
        };
      });
    });

    const NSx = 'http://www.w3.org/2000/svg';
    function mk(tag, attrs){
      const n = document.createElementNS(NSx, tag);
      for(const k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }

    const edgesG = mk('g', {});
    const nodesG = mk('g', {});
    svg.appendChild(edgesG);
    svg.appendChild(nodesG);

    (NETWORK.edges||[]).forEach(edge => {
      const a = positions[edge.from], b = positions[edge.to];
      if(!a || !b) return;
      const isBackbone = edge.type === 'backbone';
      const line = mk('line', {
        x1:a.x, y1:a.y, x2:b.x, y2:b.y,
        stroke: isBackbone ? '#8b7cf6' : '#3ddbd9',
        'stroke-width': isBackbone ? 2 : 1.4,
        'stroke-dasharray': isBackbone ? '6 5' : 'none',
        opacity: 0.55
      });
      edgesG.appendChild(line);

      if(isBackbone){
        const dot = mk('circle', {r:2.6, fill:'#8b7cf6'});
        const animMotion = document.createElementNS(NSx, 'animateMotion');
        animMotion.setAttribute('dur', (3 + Math.random()*2).toFixed(1)+'s');
        animMotion.setAttribute('repeatCount', 'indefinite');
        animMotion.setAttribute('path', `M${a.x},${a.y} L${b.x},${b.y}`);
        dot.appendChild(animMotion);
        edgesG.appendChild(dot);
      }
    });

    SITES.forEach(site => {
      const p = positions[site.siteCode];
      if(!p) return;
      const isHub = !!site.isHub;
      const r = isHub ? 16 : 10;
      const color = isHub ? '#8b7cf6' : '#3ddbd9';

      const g = mk('g', {class:'net-node', 'data-code':site.siteCode, style:'cursor:pointer;'});

      const halo = mk('circle', {cx:p.x, cy:p.y, r:r+9, fill:color, opacity:0.10});
      const ring = mk('circle', {cx:p.x, cy:p.y, r:r+4, fill:'none', stroke:color, 'stroke-width':1, opacity:0.4});
      const core = mk('circle', {cx:p.x, cy:p.y, r, fill:'#10151d', stroke:color, 'stroke-width':2});
      g.appendChild(halo); g.appendChild(ring); g.appendChild(core);

      const label = mk('text', {x:p.x, y:p.y + r + 15, 'text-anchor':'middle', fill:'#9fb0c2', 'font-size':'10', 'font-family':'ui-monospace, monospace'});
      label.textContent = site.siteCode;
      g.appendChild(label);

      if(isHub){
        const hubLabel = mk('text', {x:p.x, y:p.y - r - 8, 'text-anchor':'middle', fill:'#8b7cf6', 'font-size':'8.5', 'font-family':'ui-monospace, monospace', 'letter-spacing':'0.06em'});
        hubLabel.textContent = 'HUB';
        g.appendChild(hubLabel);
      }

      g.addEventListener('click', () => {
        selectSite(site.siteCode);
        switchTab('twin');
      });
      g.addEventListener('mouseenter', () => core.setAttribute('r', r+2));
      g.addEventListener('mouseleave', () => core.setAttribute('r', r));

      nodesG.appendChild(g);
    });

    document.getElementById('netNodeCount').textContent = SITES.length;
    document.getElementById('netEdgeCount').textContent = (NETWORK.edges||[]).length;
    document.getElementById('netClusterCount').textContent = NETWORK.clusterCount || clusterIds.length;
  }

  /* --------------------------------------------------------
     TICKER
  -------------------------------------------------------- */
  function initTicker(){
    const items = [];
    SITES.forEach(s => {
      items.push({tag:s.siteCode, val:s.opStatus||'—', warn:false});
    });
    const overloaded = SITES.filter(s => (s.towerLoadingStatus||'').toLowerCase().includes('overload') && !(s.towerLoadingStatus||'').toLowerCase().includes('not'));
    overloaded.forEach(s => items.push({tag:s.siteCode, val:'TOWER LOADING ADVISORY', warn:true}));
    const fiberSites = SITES.filter(s => String(s.fiber).toLowerCase()==='yes');
    fiberSites.forEach(s => items.push({tag:s.siteCode, val:'FIBER LINK ACTIVE', warn:false}));

    const track = document.getElementById('tickerTrack');
    const renderItems = (arr) => arr.map(it => `
      <div class="ticker-item"><span class="tag">${it.tag}</span><span class="val ${it.warn?'warn':''}">${it.val}</span></div>
    `).join('');
    track.innerHTML = renderItems(items) + renderItems(items);
  }

})();
