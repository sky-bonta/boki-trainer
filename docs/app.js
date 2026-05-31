const state = {
  cards: [],
  filtered: [],
  index: Number(localStorage.getItem("bokiLastIndex") || "0"),
  mode: "all",
  weak: new Set(JSON.parse(localStorage.getItem("bokiWeakCards") || "[]")),
  grades: JSON.parse(localStorage.getItem("bokiGrades") || "{}")
};

const els = {
  cardCount: document.querySelector("#cardCount"),
  weakCount: document.querySelector("#weakCount"),
  cardList: document.querySelector("#cardList"),
  searchInput: document.querySelector("#searchInput"),
  exportButton: document.querySelector("#exportButton"),
  importInput: document.querySelector("#importInput"),
  sectionLabel: document.querySelector("#sectionLabel"),
  cardTitle: document.querySelector("#cardTitle"),
  questionText: document.querySelector("#questionText"),
  hint1: document.querySelector("#hint1"),
  hint2: document.querySelector("#hint2"),
  answer: document.querySelector("#answer"),
  hint1Button: document.querySelector("#hint1Button"),
  hint2Button: document.querySelector("#hint2Button"),
  answerButton: document.querySelector("#answerButton"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  weakButton: document.querySelector("#weakButton")
};

async function loadCards() {
  const response = await fetch("./cards.json?v=20260531-2");
  state.cards = await response.json();
  applyFilter();
}

function saveProgress() {
  localStorage.setItem("bokiWeakCards", JSON.stringify([...state.weak]));
  localStorage.setItem("bokiGrades", JSON.stringify(state.grades));
  localStorage.setItem("bokiLastIndex", String(state.index));
}

function progressPayload() {
  return {
    app: "boki-trainer",
    version: 1,
    exportedAt: new Date().toISOString(),
    lastIndex: state.index,
    weak: [...state.weak],
    grades: state.grades
  };
}

function exportProgress() {
  const blob = new Blob([JSON.stringify(progressPayload(), null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `boki-trainer-progress-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function importProgress(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const data = JSON.parse(String(reader.result || "{}"));
      if (data.app !== "boki-trainer" || !Array.isArray(data.weak) || typeof data.grades !== "object") {
        throw new Error("invalid progress file");
      }
      state.weak = new Set(data.weak);
      state.grades = data.grades || {};
      state.index = Number.isInteger(data.lastIndex) ? data.lastIndex : 0;
      saveProgress();
      applyFilter();
    } catch {
      alert("進捗ファイルを読み込めませんでした。");
    } finally {
      els.importInput.value = "";
    }
  });
  reader.readAsText(file);
}

function applyFilter() {
  const query = els.searchInput.value.trim().toLowerCase();
  state.filtered = state.cards.filter(card => {
    const haystack = [
      card.section,
      card.title,
      card.question,
      (card.hints || []).join(" "),
      card.answer
    ].join(" ").toLowerCase();
    const modeOk = state.mode === "all" || state.weak.has(card.id);
    return modeOk && (!query || haystack.includes(query));
  });
  state.index = Math.min(state.index, Math.max(state.filtered.length - 1, 0));
  renderList();
  renderCard();
}

function currentCard() {
  return state.filtered[state.index];
}

function renderList() {
  els.cardList.innerHTML = "";
  state.filtered.forEach((card, index) => {
    const button = document.createElement("button");
    button.className = `list-item${index === state.index ? " is-active" : ""}`;
    if (state.grades[card.id]) button.dataset.grade = state.grades[card.id];
    button.innerHTML = `<strong>${card.title}</strong><small>${card.section}${state.weak.has(card.id) ? " / 苦手" : ""}</small>`;
    button.addEventListener("click", () => {
      state.index = index;
      saveProgress();
      renderList();
      renderCard();
    });
    els.cardList.append(button);
  });
}

function renderCard() {
  const card = currentCard();
  els.weakCount.textContent = `苦手 ${state.weak.size}`;
  els.cardCount.textContent = state.filtered.length ? `${state.index + 1} / ${state.filtered.length}` : "0 / 0";

  if (!card) {
    els.sectionLabel.textContent = "";
    els.cardTitle.textContent = "カードがありません";
    els.questionText.textContent = "検索条件を変えてください。";
    [els.hint1, els.hint2, els.answer].forEach(el => el.hidden = true);
    return;
  }

  els.sectionLabel.textContent = card.section;
  els.cardTitle.textContent = card.title;
  els.questionText.textContent = card.question;
  els.hint1.textContent = (card.hints || [])[0] || "";
  els.hint2.textContent = (card.hints || [])[1] || "";
  els.answer.textContent = card.answer;
  els.weakButton.textContent = state.weak.has(card.id) ? "★" : "☆";
  els.weakButton.classList.toggle("is-weak", state.weak.has(card.id));
  [els.hint1, els.hint2, els.answer].forEach(el => el.hidden = true);
}

function reveal(el) {
  el.hidden = false;
}

function move(delta) {
  if (!state.filtered.length) return;
  state.index = (state.index + delta + state.filtered.length) % state.filtered.length;
  saveProgress();
  renderList();
  renderCard();
}

document.querySelectorAll(".mode").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".mode").forEach(el => el.classList.remove("is-active"));
    button.classList.add("is-active");
    state.mode = button.dataset.mode;
    state.index = 0;
    applyFilter();
  });
});

els.searchInput.addEventListener("input", () => {
  state.index = 0;
  saveProgress();
  applyFilter();
});
els.exportButton.addEventListener("click", exportProgress);
els.importInput.addEventListener("change", event => importProgress(event.target.files[0]));
els.hint1Button.addEventListener("click", () => reveal(els.hint1));
els.hint2Button.addEventListener("click", () => reveal(els.hint2));
els.answerButton.addEventListener("click", () => reveal(els.answer));
els.prevButton.addEventListener("click", () => move(-1));
els.nextButton.addEventListener("click", () => move(1));
els.weakButton.addEventListener("click", () => {
  const card = currentCard();
  if (!card) return;
  state.weak.has(card.id) ? state.weak.delete(card.id) : state.weak.add(card.id);
  saveProgress();
  renderList();
  renderCard();
});
document.querySelectorAll(".self-check button").forEach(button => {
  button.addEventListener("click", () => {
    const card = currentCard();
    if (!card) return;
    state.grades[card.id] = button.dataset.grade;
    if (button.dataset.grade !== "good") state.weak.add(card.id);
    saveProgress();
    renderList();
    renderCard();
    move(1);
  });
});
loadCards();
