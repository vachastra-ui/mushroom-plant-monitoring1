/* VACHASTRA installable monitoring PWA.
   Reads the existing Apps Script dashboard data using a JSONP endpoint.
   See README.md for the small Code.gs change required. */
(() => {
  "use strict";
  const STORAGE_KEY = "vachastra_apps_script_url";
  const STALE_AFTER_MS = 5 * 60 * 1000;
  const $ = (id) => document.getElementById(id);
  let endpoint = localStorage.getItem(STORAGE_KEY) || "";
  let data = { readings: [], latestByRoom: {} };
  let selectedRoom = "";
  let refreshTimer = null;

  const setupPanel = $("setupPanel");
  const appContent = $("appContent");
  const endpointInput = $("endpointInput");
  const message = $("message");

  function setMessage(text, isError = false) {
    message.textContent = text;
    message.classList.toggle("error", isError);
  }

  function cleanEndpoint(value) {
    const url = String(value || "").trim().replace(/\/+$/, "");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
      throw new Error("Please enter the full deployed Apps Script web app URL ending in /exec.");
    }
    return url;
  }

  function showSetup() {
    setupPanel.hidden = false;
    appContent.hidden = true;
    endpointInput.value = endpoint;
  }

  function showApp() {
    setupPanel.hidden = true;
    appContent.hidden = false;
  }

  function saveEndpoint() {
    try {
      endpoint = cleanEndpoint(endpointInput.value);
      localStorage.setItem(STORAGE_KEY, endpoint);
      showApp();
      setMessage("Connecting to your cloud readings…");
      loadData();
      startRefresh();
    } catch (err) {
      setMessage(err.message, true);
    }
  }

  function loadData() {
    if (!endpoint) return;
    $("connectionBadge").className = "status-pill status-wait";
    $("connectionBadge").textContent = "Updating…";
    const callbackName = "vachastraCallback_" + Date.now() + "_" + Math.floor(Math.random() * 100000);
    let script;
    let timeout;
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
    };

    window[callbackName] = (payload) => {
      cleanup();
      if (!payload || !Array.isArray(payload.readings)) {
        setMessage("The cloud endpoint returned an unexpected response. Check the Apps Script update in README.md.", true);
        $("connectionBadge").className = "status-pill status-stale";
        $("connectionBadge").textContent = "Data error";
        return;
      }
      data = payload;
      render();
      $("lastRefresh").textContent = new Date().toLocaleString();
      $("connectionBadge").className = "status-pill status-ok";
      $("connectionBadge").textContent = "Cloud connected";
      setMessage("Updated from Google Sheets.");
    };

    script = document.createElement("script");
    script.src = endpoint + "?action=dashboard&callback=" + encodeURIComponent(callbackName) + "&_=" + Date.now();
    script.async = true;
    script.onerror = () => {
      cleanup();
      $("connectionBadge").className = "status-pill status-stale";
      $("connectionBadge").textContent = "Connection error";
      setMessage("Could not reach the cloud endpoint. Check your URL, deployment, internet connection, and Code.gs JSONP update.", true);
    };
    timeout = setTimeout(() => {
      cleanup();
      $("connectionBadge").className = "status-pill status-stale";
      $("connectionBadge").textContent = "Timed out";
      setMessage("The cloud request timed out. Check the Apps Script deployment and internet connection.", true);
    }, 20000);
    document.head.appendChild(script);
  }

  function startRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(loadData, 30000);
  }

  function parseDate(value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function fmtDate(value) {
    const d = parseDate(value);
    return d ? d.toLocaleString([], { year:"numeric", month:"short", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit" }) : String(value || "—");
  }

  function ageMs(value) {
    const d = parseDate(value);
    return d ? Date.now() - d.getTime() : Infinity;
  }

  function num(value, digits = 1) {
    if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return "—";
    return Number(value).toLocaleString([], { maximumFractionDigits: digits });
  }

  function roomIsStale(reading) {
    return !reading || ageMs(reading.timestamp) > STALE_AFTER_MS;
  }

  function render() {
    const latestByRoom = data.latestByRoom || {};
    const rooms = Object.keys(latestByRoom).sort();
    if (!selectedRoom || !latestByRoom[selectedRoom]) selectedRoom = rooms[0] || "";
    renderCards(rooms, latestByRoom);
    renderRoomSelect(rooms);
    renderCharts();
    renderTable();
    if (!rooms.length) {
      setMessage("No readings found yet. Confirm that the Arduino is uploading data to the Google Sheet.");
    }
  }

  function renderCards(rooms, latestByRoom) {
    const root = $("roomCards");
    root.replaceChildren();
    if (!rooms.length) {
      const empty = document.createElement("div");
      empty.className = "empty-card";
      empty.textContent = "No room readings found yet.";
      root.appendChild(empty);
      return;
    }
    rooms.forEach(room => {
      const r = latestByRoom[room];
      const stale = roomIsStale(r);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "room-card" + (room === selectedRoom ? " selected" : "");
      card.style.textAlign = "left";
      card.style.color = "inherit";
      card.innerHTML = `
        <div class="room-head">
          <span class="room-name"></span>
          <span class="room-state ${stale ? "stale" : ""}">${stale ? "STALE" : "ONLINE"}</span>
        </div>
        <div class="metric"><div class="metric-label">CO₂ concentration</div><div class="metric-value">${num(r.co2,0)} <small>ppm</small></div></div>
        <div class="metric"><div class="metric-label">Temperature</div><div class="metric-value">${num(r.temperature,1)} <small>°C</small></div></div>
        <div class="metric"><div class="metric-label">Relative humidity</div><div class="metric-value">${num(r.humidity,1)} <small>%</small></div></div>
        <div class="last-seen">Last reading<br>${fmtDate(r.timestamp)}</div>`;
      card.querySelector(".room-name").textContent = room;
      card.addEventListener("click", () => {
        selectedRoom = room;
        render();
      });
      root.appendChild(card);
    });
  }

  function renderRoomSelect(rooms) {
    const select = $("roomSelect");
    const previous = selectedRoom;
    select.replaceChildren();
    rooms.forEach(room => {
      const option = document.createElement("option");
      option.value = room;
      option.textContent = room;
      select.appendChild(option);
    });
    select.value = previous;
    select.disabled = rooms.length === 0;
  }

  function svgChart(items, key, stroke) {
    const vals = items.map(r => Number(r[key])).filter(v => Number.isFinite(v));
    if (items.length < 2 || vals.length < 2) return '<div class="muted">Not enough readings to plot a trend yet.</div>';
    const W = 600, H = 110, left = 8, right = 8, top = 10, bottom = 20;
    let min = Math.min(...vals), max = Math.max(...vals);
    if (min === max) { min -= 1; max += 1; }
    const usableW = W-left-right, usableH = H-top-bottom;
    const pts = [];
    items.forEach((r, i) => {
      const v = Number(r[key]);
      if (!Number.isFinite(v)) return;
      const x = left + (items.length === 1 ? 0 : i * usableW/(items.length-1));
      const y = top + (max-v)/(max-min)*usableH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    const last = pts[pts.length-1].split(",");
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Historical line chart">
      <line x1="${left}" y1="${H-bottom}" x2="${W-right}" y2="${H-bottom}" stroke="#dfe8e2" stroke-width="1"/>
      <line x1="${left}" y1="${top+usableH/2}" x2="${W-right}" y2="${top+usableH/2}" stroke="#edf1ee" stroke-width="1"/>
      <polyline points="${pts.join(" ")}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="4" fill="${stroke}"/>
      <text x="${left}" y="${H-4}" font-size="10" fill="#687871">${min.toFixed(1)}</text>
      <text x="${W-right}" y="${H-4}" text-anchor="end" font-size="10" fill="#687871">${max.toFixed(1)}</text>
    </svg>`;
  }

  function renderCharts() {
    const all = (data.readings || []).filter(r => r.room === selectedRoom && parseDate(r.timestamp));
    const items = all.slice().sort((a,b) => new Date(a.timestamp) - new Date(b.timestamp)).slice(-60);
    $("chartHint").textContent = selectedRoom ? `${selectedRoom} · showing up to the latest ${items.length} available readings` : "No room data available.";
    $("co2Chart").innerHTML = svgChart(items, "co2", "#276553");
    $("tempChart").innerHTML = svgChart(items, "temperature", "#d08b34");
    $("humChart").innerHTML = svgChart(items, "humidity", "#4985c3");
  }

  function renderTable() {
    const tbody = $("readingsBody");
    tbody.replaceChildren();
    const readings = (data.readings || []).slice().sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,30);
    if (!readings.length) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 5;
      td.className = "muted";
      td.textContent = "No readings loaded.";
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }
    readings.forEach(r => {
      const tr = document.createElement("tr");
      [fmtDate(r.timestamp), r.room || "—", num(r.co2,0), num(r.temperature,1), num(r.humidity,1)].forEach(value => {
        const td = document.createElement("td");
        td.textContent = value;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  function exportCsv() {
    const rows = [["Date & Time","Room ID","CO2 (ppm)","Temperature (C)","Humidity (%)","Arduino IP"]];
    (data.readings || []).slice().sort((a,b) => new Date(a.timestamp)-new Date(b.timestamp)).forEach(r => {
      rows.push([fmtDate(r.timestamp), r.room || "", r.co2 ?? "", r.temperature ?? "", r.humidity ?? "", r.ip || ""]);
    });
    const csv = rows.map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(",")).join("\r\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vachastra-readings.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  $("saveEndpointBtn").addEventListener("click", saveEndpoint);
  $("refreshBtn").addEventListener("click", loadData);
  $("csvBtn").addEventListener("click", exportCsv);
  $("roomSelect").addEventListener("change", (e) => { selectedRoom = e.target.value; render(); });
  $("changeEndpointBtn").addEventListener("click", () => {
    if (refreshTimer) clearInterval(refreshTimer);
    showSetup();
    setMessage("Enter the deployed Apps Script URL to reconnect.");
  });

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
  }

  if (endpoint) {
    showApp();
    loadData();
    startRefresh();
  } else {
    showSetup();
  }
})();
