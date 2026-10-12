// Atlas Coaching v2 - frontend.
// Backend v0.3: per ogni voce arriva solo la riga della settimana in corso (o niente).
// Legge il token dall'indirizzo (?k= / ?c= / ?token=), chiede lo stato al backend (Apps Script v0.2)
// e disegna: la settimana (scheda, dieta, spesa) e lo storico.
// ?demo=1 mostra dati di prova senza chiamare il backend (solo per anteprima).

const CONFIG = {
  APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxk6zNcjWmoU_W6I7xATcDjjAOUH9U6oxqS1DuacSS6LTlsa7RMOCiZ9Tgdh7hwgC675A/exec"
};

const KINDS = {
  allen: { label: "Scheda", cur: "allenamento_corrente", arch: "allenamenti_precedenti", name: (x) => x.titolo || "Scheda" },
  dieta: { label: "Dieta", cur: "dieta_corrente", arch: "diete_precedenti", name: (x) => x.fase || "Dieta" },
  spesa: { label: "Lista della spesa", cur: "spesa_corrente", arch: "spesa_precedenti", name: (x) => x.fase || "Lista della spesa" }
};
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

function el(tag, attrs = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v);
  }
  for (const c of children) if (c) n.append(c);
  return n;
}
function safeUrl(u) {
  u = String(u || "").trim();
  return /^https:\/\//i.test(u) ? u : null;
}
function wk(x) { const n = Number(x && x.settimana); return Number.isFinite(n) && n > 0 ? n : null; }
function screen(id) {
  for (const s of ["loading", "error", "welcome", "dashboard"]) $(s).classList.toggle("hidden", s !== id);
}
function showError(msg) {
  if (msg) $("errorMsg").textContent = msg;
  screen("error");
}
function getToken() { return params.get("k") || params.get("c") || params.get("token"); }

function dataLunga(iso) {
  const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])} ${MESI[Number(m[2]) - 1]}` : "";
}

// ---------- settimana ----------
function renderCard(kind, item, settimana) {
  const card = document.querySelector(`.mat[data-kind="${kind}"]`);
  const t = $(kind + "Title"), meta = $(kind + "Meta"), link = $(kind + "Link");
  const url = item && safeUrl(item.pdf_url);
  card.classList.toggle("is-empty", !url);
  if (!url) {
    t.textContent = "Questa settimana non c'è ancora";
    meta.textContent = "Appena Enrico la carica, la trovi qui.";
    link.classList.add("hidden");
    return;
  }
  t.textContent = KINDS[kind].name(item).trim();
  meta.textContent = "";
  link.href = url;
  link.classList.remove("hidden");
}

// ---------- link di un materiale ----------
function itemLink({ kind, item }, showWeek) {
  const w = wk(item);
  return el("li", {}, el("a", { href: safeUrl(item.pdf_url), target: "_blank", rel: "noopener noreferrer" },
    el("i", { class: "dot", "data-kind": kind, "aria-hidden": "true" }),
    el("span", { class: "t", text: `${KINDS[kind].label}: ${KINDS[kind].name(item).trim()}` }),
    showWeek && w ? el("span", { class: "w", text: `sett. ${w}` }) : null));
}

// ---------- storico ----------
function renderHistory(data) {
  const body = $("historyBody");
  body.textContent = "";
  for (const kind of Object.keys(KINDS)) {
    const k = KINDS[kind];
    const all = [data[k.cur], ...(data[k.arch] || [])].filter((x) => x && safeUrl(x.pdf_url));
    if (!all.length) continue;
    const ul = el("ul", { class: "items" });
    for (const item of all) ul.append(itemLink({ kind, item }, true));
    body.append(el("div", { class: "hist-group" },
      el("h3", {}, el("i", { class: "dot", "data-kind": kind, "aria-hidden": "true" }), document.createTextNode(k.label === "Scheda" ? "Schede" : k.label === "Dieta" ? "Diete" : "Liste della spesa")),
      ul));
  }
}

// ---------- pagine ----------
function renderDashboard(data) {
  const settimana = data.settimana_corrente || 1;
  $("userName").textContent = (data.nome || "").split(" ")[0];
  const inizio = dataLunga(data.data_start);
  $("helloSub").textContent = `Sei alla settimana ${settimana} del tuo percorso` + (inizio ? `, iniziato il ${inizio}.` : ".");
  for (const kind of Object.keys(KINDS)) renderCard(kind, data[KINDS[kind].cur], settimana);
  renderHistory(data);
  screen("dashboard");
  document.querySelector(".cards").classList.add("enter");
}

function renderWelcome(data, token) {
  $("welcomeName").textContent = (data.nome || "").split(" ")[0];
  screen("welcome");
  const btn = $("btnStart");
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = "Attivazione in corso";
    $("startErr").textContent = "";
    try {
      const res = await api("POST", token);
      if (res.error) throw new Error(res.error);
      init();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = "Inizia il percorso";
      $("startErr").textContent = "Non è partito. Controlla la connessione e premi di nuovo.";
    }
  };
}

async function api(method, token) {
  if (method === "POST") {
    const r = await fetch(CONFIG.APPS_SCRIPT_URL, { method: "POST", body: JSON.stringify({ token, action: "start" }) });
    return r.json();
  }
  const r = await fetch(`${CONFIG.APPS_SCRIPT_URL}?token=${encodeURIComponent(token)}`);
  return r.json();
}

function demoData() {
  const d = "https://drive.google.com/file/d/demo/view";
  return {
    status: "active", nome: "Tiziano", data_start: "2026-05-17", giorni_trascorsi: 148, settimana_corrente: 22,
    allenamento_corrente: { settimana: 22, titolo: "Split 100-80% no skill v3", pdf_url: d },
    allenamenti_precedenti: [
      { settimana: 18, titolo: "Split 100-80% no skill v2", pdf_url: d },
      { settimana: 16, titolo: "Split 100-80% no skill", pdf_url: d },
      { settimana: 13, titolo: "Scarico attivo", pdf_url: d },
      { settimana: 9, titolo: "Nuovo split 100-80%", pdf_url: d }],
    dieta_corrente: { settimana: 22, fase: "Carb cycling, refill", pdf_url: d },
    diete_precedenti: [
      { settimana: 19, fase: "Carb cycling, micro-cut", pdf_url: d },
      { settimana: 13, fase: "Carb cycling cut 1", pdf_url: d },
      { settimana: "", fase: "Carb cycling deficit marcato", pdf_url: d }],
    spesa_corrente: null,
    spesa_precedenti: [{ settimana: 9, fase: "Spesa base", pdf_url: d }, { settimana: 5, fase: "Cut", pdf_url: d }]
  };
}

async function init() {
  if (params.get("demo") === "1") { renderDashboard(demoData()); return; }
  const token = getToken();
  if (!token) { showError("Nel link manca il tuo codice personale. Usa il link completo che ti ha mandato Enrico."); return; }
  screen("loading");
  try {
    const data = await api("GET", token);
    if (data.error) { const m = String(data.error).trim(); showError(/[.!]$/.test(m) ? m : m + ". Se il problema resta, scrivi a Enrico."); return; }
    if (data.status === "not_started") { renderWelcome(data, token); return; }
    renderDashboard(data);
  } catch (err) {
    showError("Non riesco a caricare i tuoi materiali. Controlla la connessione e ricarica la pagina.");
  }
}

init();
