export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/devices") {
      const devices = await env.DB
        .prepare("SELECT * FROM devices")
        .all();

      return Response.json(devices.results);
    }

    if (url.pathname === "/api/locations") {
      const locations = await env.DB
        .prepare(`
          SELECT lp.*
          FROM location_points lp
          INNER JOIN (
            SELECT device_id, MAX(created_at) AS max_created_at
            FROM location_points
            GROUP BY device_id
          ) latest
          ON lp.device_id = latest.device_id
          AND lp.created_at = latest.max_created_at
        `)
        .all();

      return Response.json(locations.results);
    }

    if (url.pathname === "/") {
      return new Response(`<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>atf.sys</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />
<style>
body{margin:0;background:#111;color:white;font-family:Arial,sans-serif}
header{padding:18px 24px;background:#181818;font-size:24px;font-weight:bold}
main{display:grid;grid-template-columns:340px 1fr;height:calc(100vh - 64px)}
#sidebar{padding:20px;background:#151515;overflow:auto}
.device{background:#222;padding:14px;margin-bottom:12px;border-radius:10px}
#map{height:100%;width:100%}
.small{color:#aaa;font-size:13px}
</style>
</head>
<body>
<header>atf.sys</header>
<main>
  <section id="sidebar">
    <h2>Cihazlar</h2>
    <div id="devices">Yükleniyor...</div>
  </section>
  <section id="map"></section>
</main>

<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
const map = L.map('map').setView([41.0082, 28.9784], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

async function loadPanel() {
  const devices = await fetch('/api/devices').then(r => r.json());
  const locations = await fetch('/api/locations').then(r => r.json());

  const deviceBox = document.getElementById('devices');
  deviceBox.innerHTML = '';

  devices.forEach(device => {
    const loc = locations.find(x => x.device_id === device.id);

    deviceBox.innerHTML += \`
      <div class="device">
        <b>\${device.name}</b><br>
        <span class="small">ID: \${device.id}</span><br>
        <span class="small">Son görülme: \${device.last_seen_at ?? 'Yok'}</span><br>
        <span class="small">Konum: \${loc ? loc.latitude + ', ' + loc.longitude : 'Yok'}</span>
      </div>
    \`;

    if (loc) {
      L.marker([loc.latitude, loc.longitude])
        .addTo(map)
        .bindPopup(\`\${device.name}<br>\${loc.latitude}, \${loc.longitude}\`);
    }
  });

  if (locations.length > 0) {
    map.setView([locations[0].latitude, locations[0].longitude], 13);
  }
}

loadPanel();
</script>
</body>
</html>`, {
        headers: { "content-type": "text/html;charset=UTF-8" }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
