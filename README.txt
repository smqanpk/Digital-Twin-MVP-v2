TMS-Twin v2 — Tower Management & Digital Twin MVP
==================================================

WHAT THIS IS
------------
A fully self-contained web application that demonstrates what an in-house
Tower Management System with digital twins could look like, built directly
from your Site Master Database (SMDB) export.

Zero external runtime dependencies: no mapping tile server, no CDN, no API
key, no Google Fonts, no backend, no build step. The entire app is seven
plain static files that open directly in a browser or deploy to GitHub
Pages in under five minutes.

This is a proof-of-concept, not a production system. The goal is to show
management concretely what "digital twin visibility" means using your own
real data, so you can make the case for investing in a proper in-house build.

What was fixed in v2
--------------------
v1 used Leaflet.js (a mapping library loaded from the unpkg CDN) plus Esri
satellite tiles and Google Fonts — three external services that could not
be verified to work in restricted corporate networks, and which caused the
specific layering bug you reported (Leaflet's internal stacking contexts
caused map tiles to paint over the legend and map controls after a zoom).

v2 replaces all of that with purpose-built modules:

  • geo.js       — lightweight equirectangular projection (no library)
  • cluster.js   — greedy pixel-space marker clustering with zoom-aware
                   declustering and a named-site fallback picker for towers
                   that are genuinely too close to separate by zoom alone
  • mapview.js   — full interactive SVG map (pan, pinch-zoom, wheel-zoom,
                   double-click zoom, touch support) with explicit CSS
                   isolation that permanently fixes the layering bug
  • iso.js       — isometric (axonometric) projection math
  • twin-rig-3d.js — 3D-style site digital twin with tower-type-specific
                   mast models (see "Digital twin" section below)

Every interaction was tested live in a real headless Chromium browser
(not just code review), and bugs were fixed against actual rendered output.


FILE MANIFEST
-------------
index.html       App shell
styles.css       Dark NOC/command-centre design system (system fonts)
app.js           Application logic — map, twin, directory, network, ticker
geo.js           Equirectangular lat/lon projection
cluster.js       Marker clustering algorithm
mapview.js       Self-contained interactive SVG map renderer
iso.js           Isometric projection helper
twin-rig-3d.js   3D-style isometric digital twin builder
data.js          Your SMDB data, embedded directly in the page as JSON
data/sites.json  Same data in readable JSON (reference / for regeneration)
data/network.json Computed network topology (links, clusters)


HOW TO VIEW — FASTEST (no setup at all)
----------------------------------------
1. Unzip / copy this entire folder to your computer.
2. Double-click index.html.

It opens in your browser and works fully offline. No install, no server,
no internet required. The only things loaded from the internet are nothing
— this version has zero external dependencies.


HOW TO DEPLOY TO GITHUB PAGES (free, shareable URL)
----------------------------------------------------
Step 1  Create a free GitHub account at https://github.com if you do not
        already have one.

Step 2  Create a new public repository.
        Click + (top right) → New repository.
        Name it: tms-digital-twin-demo
        Set visibility: Public
        Click: Create repository

Step 3  Upload the files.
        On the new repository's page, click "uploading an existing file".
        Drag in ALL files from inside this folder (not the folder itself):
            index.html  styles.css  app.js  geo.js  cluster.js
            mapview.js  iso.js  twin-rig-3d.js  data.js
            and the entire data/ subfolder (sites.json, network.json)

        IMPORTANT: index.html must sit at the repository root, not inside
        a subfolder, so the published URL points straight to it.

        Scroll down and click "Commit changes".

Step 4  Enable GitHub Pages.
        In the repository → Settings → Pages
        Source: "Deploy from a branch"
        Branch: main (or master), folder: / (root)
        Click Save.

Step 5  Open your link.
        After 30–60 seconds the page turns green and shows a URL like:
        https://<your-username>.github.io/tms-digital-twin-demo/
        Share that URL with management. It is permanent and free.

Tip: every time you commit updated files to the repository, the live page
     updates automatically within a minute.


HOW TO USE THE APP
------------------

MAP PANE (left)
  Six marker groups are shown on initial load (this is not a bug — several
  sites are close enough that they cluster together at the zoom-out level).

  • Scroll / pinch to zoom in — clusters separate into individual site
    markers as you zoom.
  • Drag to pan.
  • Double-click to zoom in centred on the click point.
  • Click a cluster badge to zoom to that cluster automatically.
  • If two sites are genuinely less than ~200 m apart (ALC3447 and ALC8810
    are 215 m apart), they will always appear as a cluster at any reasonable
    zoom. Clicking that badge opens a named picker so you can still reach
    each site by name, not just by pixel-hunting.

  Site directory (≡ button top-right of map pane):
  A scrollable list of all 11 sites, always visible regardless of zoom level.
  Click any entry to jump directly to its digital twin. Active site is
  highlighted. This is the most reliable way to navigate between sites.

  Search (top-left):
  Type a site code, city, or district and press Enter to jump to that site.
  Partial matches work (e.g. "AHM", "Alipur", "Ahmedabad").

  Zoom buttons (+  −  ⤢):
  Button zoom in/out, and reset to full-extent view.

  Legend (bottom-left):
  Always visible, always on top of the map regardless of zoom — this is the
  explicit fix for the layering bug reported in v1.


DIGITAL TWIN PANE (right — Digital Twin tab)
  Select any site to see its isometric digital twin.

  The twin model matches the real structure type from the SMDB:
    • Self-Supported Lattice Tower — 4-leg tapering truss with cross-bracing
    • Monopole / Tubular Tower    — single tapering pole with slim profile
    • Guyed Mast / other          — slim mast with guy wires (fallback)

  The model label is shown below the site code (e.g. "Self-Supported Lattice
  Tower" or "Monopole / Tubular Tower") so it is immediately clear which
  structure type you are looking at.

  Asset colour semantics (deliberately restrained and consistent):
    CYAN  = asset is present and operating normally (the default)
    GREY  = asset not present / not deployed at this site
    AMBER = advisory — something needs attention (obsolete battery,
            poor/bad grid, DG missing or non-operational)
    GREEN = reserved only for fiber connectivity (the one signal that
            also determines network hub status) and the On-Air chip

  Clicking any glowing hotspot opens the inspector panel on the right,
  showing the actual SMDB fields for that specific asset: vendor, capacity,
  install date, status, contact names — all real data from your spreadsheet.

  The inspector also shows a tower capacity utilisation bar for the shelter
  asset, with real available/used/design capacity values.


NETWORK TOPOLOGY (right — Network Topology tab)
  A node-and-link diagram of all sites.

  Violet nodes with HUB labels = cluster hub sites (the site chosen as the
  aggregation point for its geographic cluster — fiber-connected sites are
  preferred hubs, otherwise the site with the most tenants is chosen).

  Cyan nodes = access/leaf sites.

  Solid cyan lines = intra-cluster access links.
  Dashed violet lines with animated pulse = backbone links between hubs.

  Clicking any node jumps to that site's digital twin.

  Meta-bar (bottom-left): shows total nodes, links, and cluster count.


BOTTOM TICKER
  Scrolling status strip showing each site's on-air status, any tower
  loading advisories (sites where the used capacity exceeds design capacity),
  and which sites have active fiber. Hover to pause.


WHAT THE STATUS SIGNALS MEAN
------------------------------
The three advisories shown in the header (and highlighted amber in the
digital twin) are real data signals from your SMDB:

  TOWER LOADING ADVISORY  The site's capacity used exceeds its design
                          capacity (negative available capacity figure
                          in the SMDB). In this dataset: AHM8025, ALC3447,
                          ALC9648 are all over their design capacity.

  BATTERY ALERT (amber)   Sites where batteryBank1Type = "Obsolete" —
                          meaning the installed battery technology is
                          flagged as outdated. Affects: AHM8024, AHM8025,
                          AKA7571, ALI7332.

  DG ALERT (amber)        Sites where DG status is None or non-operational
                          — meaning there is no confirmed working generator.
                          Affects: AKA7571, ALC3049.

  GRID ALERT (amber)      Sites where gridType is "Poor Grid" or "Bad Grid".
                          Affects: ALC3447 (Poor Grid), AMG8795 (Bad Grid).


UPDATING THE DATA
-----------------
All site data lives in two places that must be kept in sync:
  data.js          — what the live page reads
  data/sites.json  — same data in human-readable form (reference / edit)
  data/network.json — computed network topology

If you receive a fuller SMDB export (more sites, or real microwave/fiber
link data instead of the distance-based approximation used here):

Option A — Quick update (non-coder):
  Share the updated SMDB Excel file with the person who built this (or with
  any AI assistant that understands this codebase). Ask for an updated
  data.js. The rest of the app files stay unchanged.

Option B — Python (if you are comfortable with it):
  The extraction logic that produced data/sites.json and data/network.json
  from the original Excel file is straightforward Python using openpyxl.
  Re-run the same extraction on the new file, then update data.js to embed
  the new JSON directly into the two window.SMDB_SITES and window.SMDB_NETWORK
  variable assignments. No other file needs to change.

The network topology is currently inferred from geographic proximity
(sites within ~15 km form a cluster; the fiber-connected site in each
cluster becomes the hub; hubs are chained by nearest-neighbour). If your
SMDB ever includes actual microwave/fiber link records, those can replace
the distance-based inference for a much more accurate topology view.


TOWER STRUCTURE TYPE MAPPING
-----------------------------
The digital twin currently has explicit 3D models for:
  "Self-Supported Tower" → Self-Supported Lattice Tower (4-leg truss)
  "Tubular"              → Monopole / Tubular Tower (tapered pole)
  "Monopole"             → same as Tubular
  "Guyed Mast"           → Guyed mast with three wire anchors
  "Rooftop"              → Treated as monopole

Any structure type not in the above list falls back to the lattice model.
If your full SMDB introduces a new type (e.g. "Palm Tree", "Stealth"),
add it to the TOWER_MODELS dictionary in twin-rig-3d.js.


ADDING A SATELLITE LAYER (future enhancement)
----------------------------------------------
The map currently uses a schematic contour/graticule backdrop — an honest
tactical aesthetic that makes no claims about real terrain. If you want
actual satellite imagery in a future version, you can add an optional
Leaflet layer (re-introducing the CDN dependency only as an opt-in) or
use MapTiler / OpenStreetMap tiles — but note this will re-introduce the
layering bug class unless you wrap the Leaflet container in an
`isolation: isolate` CSS rule, which is documented in the code comment
at `.map-stage` in styles.css.


KNOWN LIMITATIONS (intentional for MVP scope)
----------------------------------------------
• 11 sites only (partial SMDB extract). The app scales to any number
  without code changes — just provide more rows in data.js.

• Network links are inferred from distance, not real transmission records.
  The topology tab is an accurate *representation* of what a real link map
  could look like, not a certified picture of the actual network.

• No live telemetry. All "live" values are a static snapshot from the
  SMDB at the time this was generated. A production TMS would connect to
  a real RMS/NMS feed for live alarms and KPIs.

• No authentication. Treat this as an internal demo artefact. Before
  putting it on a public URL with a full SMDB export, consult your
  security and compliance team.


QUESTIONS THIS DEMO IS DESIGNED TO ANSWER FOR MANAGEMENT
----------------------------------------------------------
"What would map-based site visibility actually look like using our own data?"
  → The map pane, plotting all 11 sites from real SMDB coordinates.

"What does 'digital twin' mean for a tower site in practice?"
  → The isometric twin pane, wired to real SMDB fields, showing the right
    structure type for each site — self-supported vs monopole.

"Would it surface real operational signals, not just a pretty diagram?"
  → Yes. The amber hotspots (obsolete batteries, poor grid, missing DG)
    and the tower loading advisories are all real flags from your SMDB,
    not synthetic demo data.

"Could we see the network holistically?"
  → The network topology tab.

"Could we build this ourselves instead of buying a platform?"
  → This entire MVP was built with open, free technology (HTML, CSS,
    JavaScript, no libraries) and your own spreadsheet export. The
    answer to the investment question is yes — and this is what the
    first milestone would look like.
