// Atlas Coaching - frontend app (MVP)
// Legge ?c=TOKEN, fetch ad Apps Script, renderizza dashboard.

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxk6zNcjWmoU_W6I7xATcDjjAOUH9U6oxqS1DuacSS6LTlsa7RMOCiZ9Tgdh7hwgC675A/exec"
};

const $ = (id) => document.getElementById(id);

function show(id) { $(id).classList.remove("hidden"); }
function hide(id) { $(id).classList.add("hidden"); }

function showError(msg) {
  hide("loading"); hide("welcome"); hide("dashboard");
  show("error");
  if (msg) $("errorMsg").textContent = msg;
}

function getToken() {
  const params = new URLSearchParams(window.location.search);
  return params.get("k") || params.get("token") || params.get("c");
}

function ytEmbedUrl(url) {
  if (!url) return null;
  // youtu.be/XXX or youtube.com/watch?v=XXX or youtube.com/shorts/XXX
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([\w-]{6,})/);
  if (m) return "https://www.youtube.com/embed/" + m[1];
  return null;
}

async function fetchStatus(token) {
  const url = `${CONFIG.APPS_SCRIPT_URL}?token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  return res.json();
}

async function startJourney(token) {
  const res = await fetch(CONFIG.APPS_SCRIPT_URL, {
    method: "POST",
    body: JSON.stringify({ token: token, action: "start" })
  });
  return res.json();
}

function renderWelcome(data) {
  hide("loading"); hide("error"); hide("dashboard");
  $("welcomeName").textContent = data.nome || "";
  show("welcome");
  $("btnStart").onclick = async () => {
    $("btnStart").disabled = true;
    $("btnStart").textContent = "Attivazione in corso...";
    const token = getToken();
    const res = await startJourney(token);
    if (res.error) { showError(res.error); return; }
    // reload status
    init();
  };
}

function renderDashboard(data) {
  hide("loading"); hide("error"); hide("welcome");
  show("dashboard");

  $("userName").textContent = data.nome || "—";
  $("dayCount").textContent = (data.giorni_trascorsi ?? 0) + 1;
  $("weekCount").textContent = data.settimana_corrente || 1;
  $("footerStart").textContent = "Inizio percorso: " + (data.data_start || "—");

  // Lezione oggi
  const lez = data.lezione_oggi;
  if (lez && lez.youtube_url) {
    $("lessonTitle").textContent = `Lezione ${lez.giorno} - ${lez.titolo || ""}`.trim();
    const embed = ytEmbedUrl(lez.youtube_url);
    if (embed) {
      $("lessonIframe").src = embed;
      show("lessonPlayer");
      hide("lessonEmpty");
    } else {
      hide("lessonPlayer"); show("lessonEmpty");
    }
  } else {
    $("lessonTitle").textContent = "Modulo 1 - in arrivo";
    hide("lessonPlayer"); show("lessonEmpty");
  }

  // Allenamento corrente
  renderDelivery("allen", data.allenamento_corrente, (item) => `Settimana ${item.settimana} - ${item.titolo || "Allenamento"}`);
  renderArchive("allenList", data.allenamenti_precedenti, (item) => ({
    label: `Settimana ${item.settimana} - ${item.titolo || "Allenamento"}`,
    url: item.pdf_url
  }));

  // Dieta corrente
  renderDelivery("diet", data.dieta_corrente, (item) => `Settimana ${item.settimana} - ${item.fase || "Piano"}`);
  renderArchive("dietList", data.diete_precedenti, (item) => ({
    label: `Settimana ${item.settimana} - ${item.fase || "Piano"}`,
    url: item.pdf_url
  }));

  // Lista spesa corrente
  renderDelivery("spesa", data.spesa_corrente, (item) => `Settimana ${item.settimana} - ${item.fase || "Spesa"}`);
  renderArchive("spesaList", data.spesa_precedenti, (item) => ({
    label: `Settimana ${item.settimana} - ${item.fase || "Spesa"}`,
    url: item.pdf_url
  }));

  // Lezioni sbloccate
  const lezList = $("lessonsList");
  lezList.innerHTML = "";
  const lezioni = data.lezioni_sbloccate || [];
  if (lezioni.length === 0) {
    show("lessonsListEmpty");
  } else {
    hide("lessonsListEmpty");
    lezioni.sort((a, b) => Number(a.giorno) - Number(b.giorno));
    for (const l of lezioni) {
      const li = document.createElement("li");
      const ytLink = l.youtube_url ? `<a href="${l.youtube_url}" target="_blank" rel="noopener">Lezione ${l.giorno} - ${l.titolo || ""}</a>` : `Lezione ${l.giorno} - ${l.titolo || ""}`;
      li.innerHTML = `${ytLink} <span class="meta">Modulo ${l.modulo}</span>`;
      lezList.appendChild(li);
    }
  }
}

function renderDelivery(prefix, item, labelFn) {
  const titleEl = $(prefix + "Title");
  const linkEl = $(prefix + "Link");
  const emptyEl = $(prefix + "Empty");
  if (item && item.pdf_url) {
    titleEl.textContent = labelFn(item);
    linkEl.href = item.pdf_url;
    linkEl.classList.remove("hidden");
    emptyEl.classList.add("hidden");
  } else {
    titleEl.textContent = "Non disponibile per la settimana corrente";
    linkEl.classList.add("hidden");
    emptyEl.classList.remove("hidden");
  }
}

function renderArchive(listId, items, mapFn) {
  const ul = $(listId);
  ul.innerHTML = "";
  if (!items || items.length === 0) return;
  items.sort((a, b) => Number(a.settimana) - Number(b.settimana));
  for (const it of items) {
    const m = mapFn(it);
    if (!m.url) continue;
    const li = document.createElement("li");
    li.innerHTML = `<a href="${m.url}" target="_blank" rel="noopener">${m.label}</a>`;
    ul.appendChild(li);
  }
}

async function init() {
  const token = getToken();
  if (!token) { showError("URL incompleto. Manca il tuo codice di accesso."); return; }
  if (CONFIG.APPS_SCRIPT_URL.indexOf("REPLACE_WITH") === 0) {
    showError("Backend non configurato. Aggiorna CONFIG.APPS_SCRIPT_URL in app.js.");
    return;
  }
  try {
    const data = await fetchStatus(token);
    if (data.error) { showError(data.error); return; }
    if (data.status === "not_started") { renderWelcome(data); return; }
    renderDashboard(data);
  } catch (err) {
    showError("Errore di rete: " + err.message);
  }
}

init();
