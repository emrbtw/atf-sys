function getCookie(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  const parts = cookie.split(";").map(function (x) {
    return x.trim();
  });

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;

    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);

    if (key === name) return value;
  }

  return null;
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map(function (b) {
      return b.toString(16).padStart(2, "0");
    })
    .join("");
}

async function makeSession(env) {
  return await sha256(env.SESSION_SECRET + ":" + env.ADMIN_PASSWORD);
}

async function isLoggedIn(request, env) {
  const session = getCookie(request, "atf_session");
  if (!session) return false;

  const expected = await makeSession(env);
  return session === expected;
}

function redirect(to) {
  return new Response(null, {
    status: 302,
    headers: {
      Location: to
    }
  });
}

function loginPage(error) {
  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8">',
    "<title>atf.sys login</title>",
    "<style>",
    "body{margin:0;background:#111;color:white;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}",
    ".card{background:#1c1c1c;padding:28px;border-radius:14px;width:320px}",
    "h1{margin-top:0}",
    "input{width:100%;box-sizing:border-box;padding:12px;margin:12px 0;border-radius:8px;border:1px solid #333;background:#111;color:white}",
    "button{width:100%;padding:12px;border:0;border-radius:8px;background:white;color:#111;font-weight:bold;cursor:pointer}",
    ".error{color:#ff6b6b;font-size:14px}",
    ".small{color:#aaa;font-size:13px}",
    "</style>",
    "</head>",
    "<body>",
    '<form class="card" method="POST" action="/login">',
    "<h1>atf.sys</h1>",
    '<div class="small">Admin panel girişi</div>',
    error ? '<p class="error">' + error + "</p>" : "",
    '<input type="password" name="password" placeholder="Şifre" autofocus>',
    "<button type=\"submit\">Giriş yap</button>",
    "</form>",
    "</body>",
    "</html>"
  ].join("");

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8"
    }
  });
}

function panelPage() {
  const html = [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    '<meta charset="UTF-8">',
    "<title>atf.sys</title>",
    '<link rel="stylesheet" href="https://unpkg.com/leaflet/dist/leaflet.css" />',
    "<style>",
    "body{margin:0;background:#111;color:white;font-family:Arial,sans-serif}",
    "header{padding:18px 24px;background:#181818;font-size:24px;font-weight:bold;display:flex;justify-content:space-between;align-items:center}",
    "header a{color:#aaa;font-size:14px;text-decoration:none}",
    "main{display:grid;grid-template-columns:360px 1fr;height:calc(100vh - 64px)}",
    "#sidebar{padding:20px;background:#151515;overflow:auto}",
    ".device{background:#222;padding:14px;margin-bottom:12px;border-radius:10px;line-height:1.55}",
    ".device b{font-size:16px}",
    "#map{height:100%;width:100%}",
    ".small{color:#aaa;font-size:13px}",
    "</style>",
    "</head>",
    "<body>",
    "<header>",
    "<span>atf.sys</span>",
    '<a href="/logout">Çıkış</a>',
    "</header>",
    "<main>",
    '<section id="sidebar">',
    "<h2>Cihazlar</h2>",
    '<div id="devices">Yükleniyor...</div>',
    "</section>",
    '<section id="map"></section>',
    "</main>",
    '<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>',
    "<script>",
    "const map = L.map('map').setView([41.0082, 28.9784], 12);",
    "L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {",
    "  maxZoom: 19,",
    "  attribution: '&copy; OpenStreetMap'",
    "}).addTo(map);",
    "",
    "async function loadPanel(){",
    "  const devices = await fetch('/api/devices').then(function(r){ return r.json(); });",
    "  const locations = await fetch('/api/locations').then(function(r){ return r.json(); });",
    "  const deviceBox = document.getElementById('devices');",
    "  deviceBox.innerHTML = '';",
    "",
    "  devices.forEach(function(device){",
    "    const loc = locations.find(function(x){ return x.device_id === device.id; });",
    "",
    "    let batteryText = device.battery_level === null || device.battery_level === undefined ? 'Yok' : device.battery_level + '%';",
    "    let chargingText = 'Yok';",
    "    if (device.is_charging === 1) chargingText = 'Evet';",
    "    if (device.is_charging === 0) chargingText = 'Hayır';",
    "    let locationText = loc ? loc.latitude + ', ' + loc.longitude : 'Yok';",
    "",
    "    deviceBox.innerHTML += ",
    "      '<div class=\"device\">' +",
    "      '<b>' + device.name + '</b><br>' +",
    "      '<span class=\"small\">ID: ' + device.id + '</span><br>' +",
    "      '🔋 Pil: ' + batteryText + '<br>' +",
    "      '⚡ Şarj: ' + chargingText + '<br>' +",
    "      '🌐 Bağlantı: ' + (device.connection_type ?? 'Yok') + '<br>' +",
    "      '📶 Sinyal: ' + (device.connection_strength ?? 'Yok') + '<br>' +",
    "      '🕒 Son görülme: ' + (device.last_seen_at ?? 'Yok') + '<br>' +",
    "      '📍 Konum: ' + locationText +",
    "      '</div>';",
    "",
    "    if (loc) {",
    "      L.marker([loc.latitude, loc.longitude])",
    "        .addTo(map)",
    "        .bindPopup(device.name + '<br>Son konum<br>' + loc.latitude + ', ' + loc.longitude);",
    "",
    "      fetch('/api/devices/' + device.id + '/history?hours=24')",
    "        .then(function(r){ return r.json(); })",
    "        .then(function(history){",
    "          if (history.length >= 2) {",
    "            const points = history.map(function(p){ return [p.latitude, p.longitude]; });",
    "",
    "            L.polyline(points, { weight: 4 }).addTo(map);",
    "",
    "            const first = points[0];",
    "            const last = points[points.length - 1];",
    "",
    "            L.circleMarker(first, {",
    "              radius: 8,",
    "              color: 'green',",
    "              fillColor: 'green',",
    "              fillOpacity: 0.8",
    "            }).addTo(map).bindPopup('Başlangıç');",
    "",
    "            L.circleMarker(last, {",
    "              radius: 10,",
    "              color: 'red',",
    "              fillColor: 'red',",
    "              fillOpacity: 0.9",
    "            }).addTo(map).bindPopup('Son Konum');",
    "          }",
    "        });",
    "    }",
    "  });",
    "",
    "  if (locations.length > 0) {",
    "    map.setView([locations[0].latitude, locations[0].longitude], 13);",
    "  }",
    "}",
    "",
    "loadPanel();",
    "</script>",
    "</body>",
    "</html>"
  ].join("");

  return new Response(html, {
    headers: {
      "content-type": "text/html;charset=UTF-8"
    }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/login") {
      if (await isLoggedIn(request, env)) {
        return redirect("/");
      }

      return loginPage("");
    }

    if (request.method === "POST" && url.pathname === "/login") {
      const form = await request.formData();
      const password = form.get("password");

      if (password !== env.ADMIN_PASSWORD) {
        return loginPage("Şifre yanlış.");
      }

      const session = await makeSession(env);

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": "atf_session=" + session + "; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800"
        }
      });
    }

    if (request.method === "GET" && url.pathname === "/logout") {
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/login",
          "Set-Cookie": "atf_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0"
        }
      });
    }

    const protectedPath =
      url.pathname === "/" ||
      url.pathname.startsWith("/api/");

    if (protectedPath && !(await isLoggedIn(request, env))) {
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      }

      return redirect("/login");
    }

    if (request.method === "GET" && url.pathname === "/api/devices") {
      const devices = await env.DB.prepare(
        "SELECT d.id, d.name, d.created_at, d.last_seen_at, r.battery_level, r.is_charging, r.connection_type, r.connection_strength, r.created_at AS report_created_at FROM devices d LEFT JOIN device_reports r ON r.id = (SELECT id FROM device_reports WHERE device_id = d.id ORDER BY created_at DESC LIMIT 1) ORDER BY d.created_at DESC"
      ).all();

      return Response.json(devices.results);
    }

    if (request.method === "GET" && url.pathname === "/api/locations") {
      const locations = await env.DB.prepare(
        "SELECT lp.* FROM location_points lp INNER JOIN (SELECT device_id, MAX(created_at) AS max_created_at FROM location_points GROUP BY device_id) latest ON lp.device_id = latest.device_id AND lp.created_at = latest.max_created_at"
      ).all();

      return Response.json(locations.results);
    }

    if (
      request.method === "GET" &&
      url.pathname.match(/^\/api\/devices\/[^/]+\/history$/)
    ) {
      const deviceId = url.pathname.split("/")[3];
      const hours = Number(url.searchParams.get("hours") || "24");

      const history = await env.DB.prepare(
        "SELECT id, device_id, latitude, longitude, accuracy_m, created_at FROM location_points WHERE device_id = ? AND datetime(created_at) >= datetime('now', ?) ORDER BY created_at ASC"
      ).bind(
        deviceId,
        "-" + hours + " hours"
      ).all();

      return Response.json(history.results);
    }

    if (
      request.method === "POST" &&
      url.pathname.match(/^\/api\/devices\/[^/]+\/report$/)
    ) {
      const deviceId = url.pathname.split("/")[3];
      const body = await request.json();

      await env.DB.prepare(
        "INSERT INTO device_reports (device_id, battery_level, is_charging, connection_type, connection_strength) VALUES (?, ?, ?, ?, ?)"
      ).bind(
        deviceId,
        body.battery_level ?? null,
        body.is_charging ? 1 : 0,
        body.connection_type ?? null,
        body.connection_strength ?? null
      ).run();

      await env.DB.prepare(
        "UPDATE devices SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).bind(deviceId).run();

      return Response.json({ ok: true });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return panelPage();
    }

    return new Response("Not Found", {
      status: 404
    });
  }
};
