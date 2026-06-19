/* ============================================================
   cluster.js — simple greedy pixel-space marker clustering
   Given projected screen positions and a pixel radius, groups
   markers that would visually overlap into cluster bubbles.
   Pure function, no DOM dependency — independently testable.
   ============================================================ */

(function(){
  'use strict';

  // points: [{ id, x, y, ...anything }]
  // radius: pixel distance under which two points are considered overlapping
  // returns: [{ x, y, members: [point, ...] }]  (single-member groups included)
  function clusterPoints(points, radius){
    const n = points.length;
    const parent = Array.from({length:n}, (_,i)=>i);
    function find(a){ while(parent[a]!==a){ a = parent[a]; } return a; }
    function union(a,b){ const ra=find(a), rb=find(b); if(ra!==rb) parent[ra]=rb; }

    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const dx = points[i].x - points[j].x;
        const dy = points[i].y - points[j].y;
        if(Math.sqrt(dx*dx+dy*dy) <= radius) union(i,j);
      }
    }

    const groups = {};
    for(let i=0;i<n;i++){
      const r = find(i);
      groups[r] = groups[r] || [];
      groups[r].push(points[i]);
    }

    return Object.values(groups).map(members => {
      const x = members.reduce((a,m)=>a+m.x,0) / members.length;
      const y = members.reduce((a,m)=>a+m.y,0) / members.length;
      return { x, y, members };
    });
  }

  window.MarkerCluster = { clusterPoints };
})();
