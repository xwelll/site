const STORE_KEY = "exam_trainer_v3";

const state = {
  questions: [],
  mode: "all",
  ticket: [],
  ticketIndex: 0,
  submittedInSession: new Set(),
  sessionCorrect: 0,
  sessionAttempts: 0,
  stats: loadStats(),
  blockOrder: [],
  sectionOrderByBlock: {},
  searchQuery: "",
  searchIndex: {},
  wrongOnly: false,
  filters: {
    block: "",
    section: "",
    type: "",
    unanswered: false,
  },
};

const el = {
  tabAll: document.getElementById("tab-all"),
  tabTicket: document.getElementById("tab-ticket"),
  newSessionBtn: document.getElementById("new-session-btn"),
  shuffleAllBtn: document.getElementById("shuffle-all-btn"),
  shuffleTicketBtn: document.getElementById("shuffle-ticket-btn"),
  wrongOnlyBtn: document.getElementById("wrong-only-btn"),
  actions: document.querySelector(".actions"),
  feedback: document.getElementById("feedback"),
  answerBox: document.querySelector(".answer-box"),
  modeBadge: document.getElementById("mode-badge"),
  progressBadge: document.getElementById("progress-badge"),
  sessionScoreBadge: document.getElementById("session-score-badge"),
  blockTag: document.getElementById("block-tag"),
  sectionTag: document.getElementById("section-tag"),
  typeTag: document.getElementById("type-tag"),
  questionTitle: document.getElementById("question-title"),
  allSearchBox: document.getElementById("all-search-box"),
  allSearchInput: document.getElementById("all-search-input"),
  allSearchClear: document.getElementById("all-search-clear"),
  allSearchCount: document.getElementById("all-search-count"),
  filterBlock: document.getElementById("filter-block"),
  filterSection: document.getElementById("filter-section"),
  filterType: document.getElementById("filter-type"),
  filterUnanswered: document.getElementById("filter-unanswered"),
  questionBody: document.getElementById("question-body"),
  correctAnswer: document.getElementById("correct-answer"),
  checkBtn: document.getElementById("check-btn"),
  showAnswerBtn: document.getElementById("show-answer-btn"),
  nextBtn: document.getElementById("next-btn"),
  resetStatsBtn: document.getElementById("reset-stats-btn"),
  statAttempts: document.getElementById("stat-attempts"),
  statCorrect: document.getElementById("stat-correct"),
  statAccuracy: document.getElementById("stat-accuracy"),
  statCovered: document.getElementById("stat-covered"),
  statStreak: document.getElementById("stat-streak"),
  statBestStreak: document.getElementById("stat-best-streak"),
  statsTableBody: document.querySelector("#stats-table tbody"),
  blockProgressList: document.getElementById("block-progress-list"),
  weakList: document.getElementById("weak-list"),
};

init();

async function init() {
  registerServiceWorker();
  const response = await fetch("./data/questions.json");
  const payload = await response.json();
  state.questions = payload.questions || [];
  buildOrders(state.questions);
  buildSearchIndex(state.questions);
  fillFilterControls();

  bindEvents();
  startSession("all");
  renderStats();
}

function bindEvents() {
  el.tabAll.addEventListener("click", () => startSession("all"));
  el.tabTicket.addEventListener("click", () => startSession("ticket"));
  el.newSessionBtn.addEventListener("click", () => startSession(state.mode));
  el.shuffleAllBtn.addEventListener("click", () => {
    if (state.mode !== "all") startSession("all");
    else renderAllMode();
  });
  el.shuffleTicketBtn.addEventListener("click", () => {
    if (state.mode !== "ticket") startSession("ticket");
    else shuffleTicketOnly();
  });
  el.wrongOnlyBtn.addEventListener("click", () => {
    if (state.mode !== "all") startSession("all");
    state.wrongOnly = !state.wrongOnly;
    updateWrongOnlyButton();
    applyAllSearch();
  });

  el.checkBtn.addEventListener("click", submitTicketAnswer);
  el.showAnswerBtn.addEventListener("click", () => {
    const q = currentTicketQuestion();
    el.correctAnswer.textContent = q ? q.correctAnswer : "-";
  });
  el.nextBtn.addEventListener("click", nextTicketQuestion);
  el.questionBody.addEventListener("click", handleAllModeClick);
  el.questionBody.addEventListener("change", handleMatchingSelectChange);

  el.resetStatsBtn.addEventListener("click", () => {
    state.stats = createEmptyStats();
    saveStats();
    renderStats();
  });

  el.allSearchInput.addEventListener("input", () => {
    state.searchQuery = el.allSearchInput.value || "";
    applyAllSearch();
  });
  el.allSearchClear.addEventListener("click", () => {
    state.searchQuery = "";
    el.allSearchInput.value = "";
    state.filters = { block: "", section: "", type: "", unanswered: false };
    syncFilterControls();
    applyAllSearch();
  });
  el.filterBlock.addEventListener("change", () => {
    state.filters.block = el.filterBlock.value;
    state.filters.section = "";
    fillSectionFilter();
    applyAllSearch();
  });
  el.filterSection.addEventListener("change", () => {
    state.filters.section = el.filterSection.value;
    applyAllSearch();
  });
  el.filterType.addEventListener("change", () => {
    state.filters.type = el.filterType.value;
    applyAllSearch();
  });
  el.filterUnanswered.addEventListener("change", () => {
    state.filters.unanswered = el.filterUnanswered.checked;
    applyAllSearch();
  });

  el.weakList.addEventListener("click", handleWeakListClick);
}

function buildOrders(questions) {
  const blockOrder = [];
  const sectionMap = {};
  for (const q of questions) {
    if (!blockOrder.includes(q.block)) {
      blockOrder.push(q.block);
      sectionMap[q.block] = [];
    }
    if (!sectionMap[q.block].includes(q.section)) {
      sectionMap[q.block].push(q.section);
    }
  }
  state.blockOrder = blockOrder;
  state.sectionOrderByBlock = sectionMap;
}

function buildSearchIndex(questions) {
  const index = {};
  for (const q of questions) {
    const blob = [
      q.id,
      q.sourceNumber,
      q.block,
      q.section,
      q.question,
      q.correctAnswer,
      ...(q.options || []),
    ].join(" ");
    index[q.id] = normalizeSearchText(blob);
  }
  state.searchIndex = index;
}

function fillFilterControls() {
  el.filterBlock.innerHTML = `<option value="">Все блоки</option>${state.blockOrder
    .map((block) => `<option value="${escapeHtml(block)}">${escapeHtml(block)}</option>`)
    .join("")}`;
  fillSectionFilter();
  el.filterType.innerHTML = [
    ["", "Все типы"],
    ["single_choice", "Закрытые"],
    ["matching_or_order", "Соответствие/последовательность"],
    ["open", "Открытые"],
  ]
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join("");
}

function fillSectionFilter() {
  const sections = state.filters.block
    ? state.sectionOrderByBlock[state.filters.block] || []
    : [...new Set(state.blockOrder.flatMap((block) => state.sectionOrderByBlock[block] || []))];
  el.filterSection.innerHTML = `<option value="">Все разделы</option>${sections
    .map((section) => `<option value="${escapeHtml(section)}">${escapeHtml(section)}</option>`)
    .join("")}`;
}

function syncFilterControls() {
  el.filterBlock.value = state.filters.block;
  fillSectionFilter();
  el.filterSection.value = state.filters.section;
  el.filterType.value = state.filters.type;
  el.filterUnanswered.checked = state.filters.unanswered;
}

function startSession(mode) {
  state.mode = mode;
  state.ticket = [];
  state.ticketIndex = 0;
  state.submittedInSession = new Set();
  state.sessionCorrect = 0;
  state.sessionAttempts = 0;
  setFeedback("", "");

  el.tabAll.classList.toggle("active", mode === "all");
  el.tabTicket.classList.toggle("active", mode === "ticket");

  if (mode === "ticket") {
    state.wrongOnly = false;
    updateWrongOnlyButton();
    state.ticket = buildTicket(state.questions);
    renderTicketMode();
  } else {
    renderAllMode();
  }
}

function shuffleTicketOnly() {
  state.ticket = shuffle([...state.ticket]);
  state.ticketIndex = 0;
  state.submittedInSession = new Set();
  state.sessionCorrect = 0;
  state.sessionAttempts = 0;
  setFeedback("", "");
  renderTicketMode();
}

function renderAllMode() {
  setTicketLayoutVisible(false);
  el.allSearchBox.classList.remove("hide");
  updateWrongOnlyButton();
  renderSessionBadges();

  el.blockTag.textContent = "Все блоки";
  el.sectionTag.textContent = "Все разделы";
  el.typeTag.textContent = `${state.questions.length} вопросов`;
  el.questionTitle.textContent = "Все вопросы сгруппированы по блокам";

  const grouped = groupQuestionsShuffledBySection(state.questions);
  const html = state.blockOrder
    .map((block) => {
      const sections = grouped.get(block) || new Map();
      const sectionHtml = (state.sectionOrderByBlock[block] || [])
        .map((section) => {
          const questions = sections.get(section) || [];
          const qHtml = questions.map((q) => renderAllQuestion(q)).join("");
          return `
            <section class="all-section">
              <h4>${escapeHtml(section)} <span class="count">(${questions.length})</span></h4>
              ${qHtml}
            </section>
          `;
        })
        .join("");
      const blockCount = (state.sectionOrderByBlock[block] || [])
        .reduce((sum, section) => sum + (sections.get(section)?.length || 0), 0);

      return `
        <details class="all-block" open>
          <summary class="all-block-summary">
            <span class="all-block-title">${escapeHtml(block)}</span>
            <span class="all-block-count">${blockCount} вопросов</span>
          </summary>
          <div class="all-block-content">
            ${sectionHtml}
          </div>
        </details>
      `;
    })
    .join("");

  el.questionBody.innerHTML = `
    <div class="all-groups">${html}</div>
    <div id="all-empty-state" class="empty-state hide">
      Ничего не найдено. Попробуйте убрать фильтр, изменить запрос или нажать "Очистить".
    </div>
  `;
  applyAllSearch();
}

function groupQuestionsShuffledBySection(questions) {
  const groups = new Map();
  for (const block of state.blockOrder) {
    const secMap = new Map();
    for (const section of state.sectionOrderByBlock[block] || []) {
      secMap.set(section, []);
    }
    groups.set(block, secMap);
  }

  const shuffled = shuffle(questions);
  for (const q of shuffled) {
    const secMap = groups.get(q.block);
    if (!secMap) continue;
    if (!secMap.has(q.section)) secMap.set(q.section, []);
    secMap.get(q.section).push(q);
  }
  return groups;
}

function renderAllQuestion(q) {
  const body = renderQuestionInput(q, "all");
  return `
    <article class="all-question" id="all-q-${q.id}" data-qid="${q.id}" data-block="${escapeHtml(q.block)}" data-section="${escapeHtml(q.section)}" data-type="${q.type}">
      <div class="all-q-head">
        <span class="chip question-number">Вопрос №${escapeHtml(questionNumber(q))}</span>
        <span class="chip">${escapeHtml(questionTypeLabel(q.type))}</span>
      </div>
      <p class="all-q-title">${escapeHtml(q.question)}</p>
      ${body}
      <div class="all-q-actions">
        <button class="btn ghost small" data-action="check-all" data-id="${q.id}">Проверить</button>
        <button class="btn ghost small" data-action="show-all" data-id="${q.id}">Показать ответ</button>
      </div>
      <div class="all-q-feedback" id="all-feedback-${q.id}"></div>
      <details>
        <summary>Верный ответ</summary>
        <p>${escapeHtml(q.correctAnswer)}</p>
      </details>
    </article>
  `;
}

function renderAllChoiceInput(q) {
  const multi = extractLetters(q.correctAnswer).length > 1;
  const type = multi ? "checkbox" : "radio";
  const options = q.options || [];

  return `
    <div class="question-body">
      ${options
        .map((raw, idx) => {
          const option = splitOption(raw, idx);
          const name = multi ? `all_answer_${q.id}_${idx}` : `all_answer_${q.id}`;
          return `
            <div class="option">
              <label>
                <input type="${type}" name="${name}" value="${escapeHtml(option.label)}">
                <span><b>${escapeHtml(option.label)})</b> ${escapeHtml(option.text)}</span>
              </label>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderQuestionInput(q, scope) {
  if (q.type === "single_choice") return renderChoiceInput(q, scope);
  if (q.type === "matching_or_order") return renderMatchingInput(q, scope);
  return renderTextInput(q, scope);
}

function renderChoiceInput(q, scope) {
  const multi = extractLetters(q.correctAnswer).length > 1;
  const type = multi ? "checkbox" : "radio";
  const options = q.options || [];

  return `
    <div class="question-body">
      ${options
        .map((raw, idx) => {
          const option = splitOption(raw, idx);
          const name = multi ? `${scope}_answer_${q.id}_${idx}` : `${scope}_answer_${q.id}`;
          return `
            <div class="option">
              <label>
                <input type="${type}" name="${name}" value="${escapeHtml(option.label)}">
                <span><b>${escapeHtml(option.label)})</b> ${escapeHtml(option.text)}</span>
              </label>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderAllTextInput(q) {
  return renderTextInput(q, "all");
}

function renderTextInput(q, scope) {
  const hint = "Свободный ответ.";
  return `
    <p class="hint">${escapeHtml(hint)}</p>
    <textarea id="${scope}-text-${q.id}" placeholder="Ваш ответ"></textarea>
  `;
}

function renderMatchingInput(q, scope) {
  const model = buildMatchingModel(q);
  if (model.kind === "matching" && model.left.length && model.right.length) {
    return `
      <div class="match-layout">
        <div class="match-bank">
          ${model.right.map((item) => `
            <div class="match-bank-item">
              <b>${escapeHtml(item.label)})</b>
              <span>${escapeHtml(item.text)}</span>
            </div>
          `).join("")}
        </div>
        <div class="match-rows">
          ${model.left.map((item) => `
            <label class="match-row">
              <span class="match-left"><b>${escapeHtml(item.label)}.</b> ${escapeHtml(item.text)}</span>
              <select data-match-select="${scope}" data-match-left="${escapeHtml(item.label)}">
                <option value="">Выберите</option>
                ${model.right.map((right) => `<option value="${escapeHtml(right.label)}">${escapeHtml(right.label)}</option>`).join("")}
              </select>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }

  const sequence = model.sequence.length ? model.sequence : model.right;
  const positions = Math.max(extractLetters(q.correctAnswer).length, sequence.length);
  if (sequence.length && positions) {
    return `
      <div class="match-layout">
        <div class="match-bank">
          ${sequence.map((item) => `
            <div class="match-bank-item">
              <b>${escapeHtml(item.label)})</b>
              <span>${escapeHtml(item.text)}</span>
            </div>
          `).join("")}
        </div>
        <div class="match-rows">
          ${Array.from({ length: positions }, (_, index) => `
            <label class="match-row compact">
              <span class="match-left"><b>${index + 1} место</b></span>
              <select data-sequence-select="${scope}">
                <option value="">Выберите</option>
                ${sequence.map((item) => `<option value="${escapeHtml(item.label)}">${escapeHtml(item.label)}</option>`).join("")}
              </select>
            </label>
          `).join("")}
        </div>
      </div>
    `;
  }

  return renderTextInput(q, scope);
}

function buildMatchingModel(q) {
  const model = {
    kind: "sequence",
    left: [],
    right: [],
    sequence: [],
  };

  for (const raw of q.options || []) {
    const numbered = parseNumberedOption(raw);
    if (numbered) {
      model.left.push(numbered);
      continue;
    }

    const lettered = parseLetteredOption(raw);
    if (lettered) {
      model.right.push(lettered);
    }
  }

  if (model.left.length && model.right.length) {
    model.kind = "matching";
    return model;
  }

  model.sequence = model.right.length
    ? model.right
    : (q.options || []).map((raw, index) => splitOption(raw, index));
  return model;
}

function parseNumberedOption(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^(\d+)\s*[\).]\s*(.*)$/u);
  if (!match) return null;
  return { label: match[1], text: cleanOptionText(match[2]) };
}

function parseLetteredOption(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/^([A-Za-zА-Яа-яЁё])\s*[\).]\s*(.*)$/u);
  if (!match) return null;
  return {
    label: normalizeLetter(normalizeLetters(match[1])),
    text: cleanOptionText(match[2]),
  };
}

function cleanOptionText(value) {
  return String(value || "").replace(/[;,.]\s*$/u, "").trim();
}

function getMatchingAnswer(container, scope) {
  const pairSelects = [...container.querySelectorAll(`select[data-match-select="${scope}"]`)];
  if (pairSelects.length) {
    const values = pairSelects.map((select) => select.value);
    if (values.some((value) => !value)) return "";
    if (new Set(values).size !== values.length) return "";
    return pairSelects.map((select) => `${select.dataset.matchLeft}-${select.value}`).join(", ");
  }

  const sequenceSelects = [...container.querySelectorAll(`select[data-sequence-select="${scope}"]`)];
  if (sequenceSelects.length) {
    const values = sequenceSelects.map((select) => select.value);
    if (values.some((value) => !value)) return "";
    if (new Set(values).size !== values.length) return "";
    return values.join(", ");
  }

  return "";
}

function handleMatchingSelectChange(event) {
  const select = event.target.closest("select[data-match-select], select[data-sequence-select]");
  if (!select) return;

  const rows = select.closest(".match-rows");
  if (!rows) return;

  const selector = select.matches("[data-match-select]")
    ? "select[data-match-select]"
    : "select[data-sequence-select]";
  const selects = [...rows.querySelectorAll(selector)];
  const selected = new Set(selects.map((item) => item.value).filter(Boolean));

  for (const item of selects) {
    for (const option of item.options) {
      if (!option.value) continue;
      option.disabled = item.value !== option.value && selected.has(option.value);
    }
  }
}

function handleAllModeClick(event) {
  if (state.mode !== "all") return;
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const qid = Number(button.dataset.id);
  const q = state.questions.find((x) => x.id === qid);
  if (!q) return;

  if (button.dataset.action === "show-all") {
    setAllFeedback(qid, `Ответ: ${q.correctAnswer}`, "warn");
    return;
  }
  if (button.dataset.action === "check-all") submitAllQuestion(q);
}

function submitAllQuestion(q) {
  if (state.submittedInSession.has(q.id)) {
    setAllFeedback(q.id, "Этот вопрос уже засчитан в текущей сессии.", "warn");
    return;
  }

  const user = getAllModeAnswer(q);
  if (!user.valid) {
    setAllFeedback(q.id, user.message, "bad");
    return;
  }

  const ok = evaluateAnswer(q, user.value);
  if (ok) state.submittedInSession.add(q.id);
  state.sessionAttempts += 1;
  if (ok) state.sessionCorrect += 1;

  applyStats(q, ok);
  saveStats();
  renderSessionBadges();
  renderStats();
  setAllFeedback(q.id, ok ? "Верно." : "Неверно. Можно исправить и проверить этот вопрос еще раз.", ok ? "ok" : "bad");
  markAllQuestionStatus(q.id, ok);
  applyAllSearch();
}

function getAllModeAnswer(q) {
  const scope = document.getElementById(`all-q-${q.id}`);
  if (!scope) return { valid: false, message: "Не найден блок вопроса." };

  if (q.type === "single_choice") {
    const inputs = [...scope.querySelectorAll("input[type='radio'], input[type='checkbox']")];
    const selected = inputs.filter((i) => i.checked).map((i) => i.value);
    if (!selected.length) return { valid: false, message: "Выберите вариант ответа." };
    return { valid: true, value: selected.join(", ") };
  }

  if (q.type === "matching_or_order") {
    const value = getMatchingAnswer(scope, "all");
    if (!value) return { valid: false, message: "Выберите варианты соответствия." };
    return { valid: true, value };
  }

  const text = (document.getElementById(`all-text-${q.id}`)?.value || "").trim();
  if (!text) return { valid: false, message: "Введите ответ." };
  return { valid: true, value: text };
}

function setAllFeedback(id, message, tone) {
  const row = document.getElementById(`all-feedback-${id}`);
  if (!row) return;
  row.textContent = message;
  row.className = `all-q-feedback ${tone}`;
}

function markAllQuestionStatus(id, ok) {
  const card = document.getElementById(`all-q-${id}`);
  if (!card) return;
  card.classList.remove("is-correct", "is-wrong");
  card.classList.add(ok ? "is-correct" : "is-wrong");
}

function renderTicketMode() {
  setTicketLayoutVisible(true);
  el.allSearchBox.classList.add("hide");
  renderTicketQuestion();
}

function setTicketLayoutVisible(visible) {
  el.actions.classList.toggle("hide", !visible);
  el.feedback.classList.toggle("hide", !visible);
  el.answerBox.classList.toggle("hide", !visible);
}

function currentTicketQuestion() {
  return state.ticket[state.ticketIndex] || null;
}

function renderTicketQuestion() {
  renderSessionBadges();
  const q = currentTicketQuestion();
  if (!q) {
    el.blockTag.textContent = "-";
    el.sectionTag.textContent = "-";
    el.typeTag.textContent = "-";
    el.questionTitle.textContent = "Билет завершен";
    el.questionBody.innerHTML = "<p>Нажмите «Новая сессия», чтобы сформировать новый билет.</p>";
    el.correctAnswer.textContent = "";
    return;
  }

  el.blockTag.textContent = q.block;
  el.sectionTag.textContent = q.section;
  el.typeTag.textContent = questionTypeLabel(q.type);
  el.questionTitle.textContent = `Вопрос №${questionNumber(q)}. ${q.question}`;
  el.correctAnswer.textContent = q.correctAnswer;
  setFeedback("", "");

  el.questionBody.innerHTML = renderQuestionInput(q, "ticket");
}

function submitTicketAnswer() {
  if (state.mode !== "ticket") return;
  const q = currentTicketQuestion();
  if (!q) return;

  if (state.submittedInSession.has(q.id)) {
    setFeedback("Этот вопрос уже засчитан в текущей сессии.", "warn");
    return;
  }

  const user = getTicketAnswer(q);
  if (!user.valid) {
    setFeedback(user.message, "bad");
    return;
  }

  const ok = evaluateAnswer(q, user.value);
  state.submittedInSession.add(q.id);
  state.sessionAttempts += 1;
  if (ok) state.sessionCorrect += 1;

  applyStats(q, ok);
  saveStats();
  renderSessionBadges();
  renderStats();
  setFeedback(ok ? "Верно." : "Неверно.", ok ? "ok" : "bad");
}

function getTicketAnswer(q) {
  if (q.type === "single_choice") {
    const inputs = [...el.questionBody.querySelectorAll("input[type='radio'], input[type='checkbox']")];
    const selected = inputs.filter((i) => i.checked).map((i) => i.value);
    if (!selected.length) return { valid: false, message: "Выберите вариант ответа." };
    return { valid: true, value: selected.join(", ") };
  }

  if (q.type === "matching_or_order") {
    const value = getMatchingAnswer(el.questionBody, "ticket");
    if (!value) return { valid: false, message: "Выберите варианты соответствия." };
    return { valid: true, value };
  }

  const text = (document.getElementById(`ticket-text-${q.id}`)?.value || "").trim();
  if (!text) return { valid: false, message: "Введите ответ." };
  return { valid: true, value: text };
}

function nextTicketQuestion() {
  if (state.mode !== "ticket") return;
  if (state.ticketIndex < state.ticket.length) state.ticketIndex += 1;
  renderTicketQuestion();
}

function renderSessionBadges() {
  const total = state.mode === "ticket" ? state.ticket.length : state.questions.length;
  const current = state.mode === "ticket" ? Math.min(state.ticketIndex + 1, total || 0) : total;
  el.modeBadge.textContent = state.mode === "ticket" ? "Режим: Билет" : "Режим: Все вопросы";
  el.progressBadge.textContent = state.mode === "ticket" ? `Вопрос ${current}/${total}` : `Всего вопросов: ${total}`;
  el.sessionScoreBadge.textContent = `Сессия: ${state.sessionCorrect}/${state.sessionAttempts}`;
}

function applyAllSearch() {
  if (state.mode !== "all") return;
  const query = normalizeSearchText(state.searchQuery || "");
  const cards = [...el.questionBody.querySelectorAll(".all-question")];
  let visibleCount = 0;
  let wrongCount = 0;

  for (const card of cards) {
    const qid = Number(card.dataset.qid || 0);
    const searchable = state.searchIndex[qid] || "";
    const isWrong = isLastWrong(qid);
    const isAnswered = hasAnyAttempt(qid);
    if (isWrong) wrongCount += 1;
    const visibleBySearch = !query || searchable.includes(query);
    const visibleByWrong = !state.wrongOnly || isWrong;
    const visibleByBlock = !state.filters.block || card.dataset.block === state.filters.block;
    const visibleBySection = !state.filters.section || card.dataset.section === state.filters.section;
    const visibleByType = !state.filters.type || card.dataset.type === state.filters.type;
    const visibleByUnanswered = !state.filters.unanswered || !isAnswered;
    const visible = visibleBySearch && visibleByWrong && visibleByBlock && visibleBySection && visibleByType && visibleByUnanswered;
    card.classList.toggle("hide", !visible);
    if (visible) visibleCount += 1;
  }

  const sections = [...el.questionBody.querySelectorAll(".all-section")];
  for (const section of sections) {
    const hasVisible = section.querySelector(".all-question:not(.hide)");
    section.classList.toggle("hide", !hasVisible);
  }

  const blocks = [...el.questionBody.querySelectorAll(".all-block")];
  for (const block of blocks) {
    const hasVisible = block.querySelector(".all-section:not(.hide)");
    block.classList.toggle("hide", !hasVisible);
  }

  const emptyState = document.getElementById("all-empty-state");
  if (emptyState) emptyState.classList.toggle("hide", visibleCount > 0);

  const total = state.questions.length;
  if (state.wrongOnly) {
    el.allSearchCount.textContent = query
      ? `Ошибки: ${visibleCount} / ${wrongCount}`
      : `Ошибок для повторения: ${wrongCount}`;
  } else {
    el.allSearchCount.textContent = hasActiveAllFilters() || query ? `Показано: ${visibleCount} / ${total}` : `Показаны все: ${total}`;
  }
}

function updateWrongOnlyButton() {
  el.wrongOnlyBtn.classList.toggle("active-filter", state.wrongOnly);
  el.wrongOnlyBtn.textContent = state.wrongOnly ? "Показать все" : "Только ошибки";
}

function isLastWrong(qid) {
  const item = state.stats.questions[String(qid)];
  return Boolean(item && item.lastCorrect === false);
}

function hasAnyAttempt(qid) {
  const item = state.stats.questions[String(qid)];
  return Boolean(item && item.attempts > 0);
}

function hasActiveAllFilters() {
  return Boolean(state.filters.block || state.filters.section || state.filters.type || state.filters.unanswered || state.wrongOnly);
}

function handleWeakListClick(event) {
  const button = event.target.closest("button[data-jump-id]");
  if (!button) return;

  const id = button.dataset.jumpId;
  if (state.mode !== "all") startSession("all");

  state.wrongOnly = false;
  state.searchQuery = id;
  state.filters = { block: "", section: "", type: "", unanswered: false };
  syncFilterControls();
  updateWrongOnlyButton();
  el.allSearchInput.value = id;
  applyAllSearch();

  requestAnimationFrame(() => {
    const card = document.getElementById(`all-q-${id}`);
    if (!card) return;
    card.closest("details")?.setAttribute("open", "");
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    card.classList.add("pulse");
    window.setTimeout(() => card.classList.remove("pulse"), 1200);
  });
}

function evaluateAnswer(q, userRaw) {
  if (q.type === "single_choice") {
    const expected = extractLetters(q.correctAnswer).sort().join(",");
    const user = extractLetters(userRaw).sort().join(",");
    return Boolean(expected) && expected === user;
  }

  if (q.type === "matching_or_order") {
    const expectedPairs = normalizePairAnswer(q.correctAnswer);
    const userPairs = normalizePairAnswer(userRaw);
    if (expectedPairs && userPairs) return expectedPairs === userPairs;
    const expectedSeq = normalizeLetterSequence(q.correctAnswer);
    const userSeq = normalizeLetterSequence(userRaw);
    return Boolean(expectedSeq) && expectedSeq === userSeq;
  }

  const expected = normalizeLooseText(q.correctAnswer);
  const user = normalizeLooseText(userRaw);
  return expected === user || expected.includes(user) || user.includes(expected);
}

function normalizePairAnswer(value) {
  const text = normalizeLetters(value);
  const matches = [...text.matchAll(/(\d+)\s*[-=:.]?\s*([A-ZА-Я])/g)];
  if (!matches.length) return "";
  return matches
    .map((m) => `${Number(m[1])}-${normalizeLetter(m[2])}`)
    .sort((a, b) => Number(a.split("-")[0]) - Number(b.split("-")[0]))
    .join(",");
}

function normalizeLetterSequence(value) {
  return extractLetters(value).join(",");
}

function extractLetters(value) {
  const normalized = normalizeLetters(value);
  const out = [];
  for (const ch of normalized) {
    const mapped = normalizeLetter(ch);
    if (/[А-Я]/.test(mapped)) out.push(mapped);
  }
  return out;
}

function normalizeLetters(value) {
  return String(value || "")
    .toUpperCase()
    .replaceAll("Ё", "Е")
    .replace(/[ÀÁÂÃÄÅ]/g, (ch) => ({ À: "А", Á: "Б", Â: "В", Ã: "Г", Ä: "Д", Å: "Е" }[ch] || ch));
}

function normalizeLetter(ch) {
  return ({ A: "А", B: "Б", C: "В", D: "Г", E: "Е", F: "Ж", G: "З" }[ch] || ch);
}

function normalizeLooseText(value) {
  return normalizeLetters(value)
    .replace(/[.,;:!?()[\]{}"'`«»]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitOption(raw, index) {
  const text = String(raw || "").trim();
  const m = text.match(/^\s*([A-Za-zА-Яа-яÀÁÂÃÄÅ])\s*[\).]\s*(.*)$/u);
  if (m) return { label: normalizeLetter(normalizeLetters(m[1])), text: m[2].trim() };
  return { label: "АБВГДЕЖЗ"[index] || String(index + 1), text };
}

function questionTypeLabel(type) {
  if (type === "single_choice") return "Закрытый";
  if (type === "matching_or_order") return "Соответствие/последовательность";
  return "Открытый";
}

function buildTicket(questions) {
  const groups = new Map();
  for (const q of questions) {
    const key = `${q.block}___${q.section}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(q);
  }
  const out = [];
  for (const items of groups.values()) {
    out.push(items[Math.floor(Math.random() * items.length)]);
  }
  return shuffle(out);
}

function setFeedback(message, tone) {
  el.feedback.textContent = message;
  el.feedback.className = tone ? `feedback ${tone}` : "feedback";
}

function applyStats(q, ok) {
  const s = state.stats;
  const id = String(q.id);
  if (!s.questions[id]) {
    s.questions[id] = { attempts: 0, correct: 0, wrong: 0, block: q.block, section: q.section, type: q.type, lastCorrect: null };
  }
  s.questions[id].attempts += 1;
  if (ok) s.questions[id].correct += 1;
  else s.questions[id].wrong += 1;
  s.questions[id].lastCorrect = ok;

  s.attempts += 1;
  if (ok) {
    s.correct += 1;
    s.currentStreak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.currentStreak);
  } else {
    s.wrong += 1;
    s.currentStreak = 0;
  }
}

function renderStats() {
  const s = state.stats;
  const covered = Object.keys(s.questions).length;
  const total = state.questions.length;
  const acc = s.attempts ? Math.round((s.correct / s.attempts) * 100) : 0;

  el.statAttempts.textContent = String(s.attempts);
  el.statCorrect.textContent = String(s.correct);
  el.statAccuracy.textContent = `${acc}%`;
  el.statCovered.textContent = `${covered} / ${total}`;
  el.statStreak.textContent = String(s.currentStreak);
  el.statBestStreak.textContent = String(s.bestStreak);

  renderStatsTable();
  renderBlockProgress();
  renderWeakList();
}

function renderBlockProgress() {
  const rows = state.blockOrder.map((block) => {
    const questions = state.questions.filter((q) => q.block === block);
    const total = questions.length;
    let covered = 0;
    let correct = 0;
    let wrong = 0;

    for (const q of questions) {
      const item = state.stats.questions[String(q.id)];
      if (!item || item.attempts === 0) continue;
      covered += 1;
      correct += item.correct;
      wrong += item.wrong;
    }

    const progress = total ? Math.round((covered / total) * 100) : 0;
    const accuracy = correct + wrong ? Math.round((correct / (correct + wrong)) * 100) : 0;
    return { block, total, covered, correct, wrong, progress, accuracy };
  });

  el.blockProgressList.innerHTML = rows
    .map((row) => `
      <div class="progress-row">
        <div class="progress-row-head">
          <span>${escapeHtml(row.block)}</span>
          <b>${row.covered}/${row.total}</b>
        </div>
        <div class="progress-track">
          <span style="width: ${row.progress}%"></span>
        </div>
        <div class="progress-row-foot">
          <span>Точность ${row.accuracy}%</span>
          <span>Ошибок ${row.wrong}</span>
        </div>
      </div>
    `)
    .join("");
}

function renderStatsTable() {
  const rowsMap = new Map();
  for (const q of state.questions) {
    const key = `${q.block}___${q.section}`;
    if (!rowsMap.has(key)) {
      rowsMap.set(key, {
        block: q.block,
        section: q.section,
        total: 0,
        attempts: 0,
        correct: 0,
        wrong: 0,
        covered: 0,
      });
    }
    rowsMap.get(key).total += 1;
  }

  for (const qStat of Object.values(state.stats.questions)) {
    const key = `${qStat.block}___${qStat.section}`;
    const row = rowsMap.get(key);
    if (!row) continue;
    row.attempts += qStat.attempts;
    row.correct += qStat.correct;
    row.wrong += qStat.wrong;
    if (qStat.attempts > 0) row.covered += 1;
  }

  const orderedRows = [];
  for (const block of state.blockOrder) {
    for (const section of state.sectionOrderByBlock[block] || []) {
      const row = rowsMap.get(`${block}___${section}`);
      if (row) orderedRows.push(row);
    }
  }

  el.statsTableBody.innerHTML = orderedRows
    .map((r) => {
      const answeredStatus = r.correct > 0 ? "Да" : "Нет";
      const statusClass = r.correct > 0 ? "good" : r.wrong > 0 ? "bad" : "neutral";
      const accuracyPct = r.attempts ? Math.round((r.correct / r.attempts) * 100) : 0;
      const masteryPct = r.total ? Math.round((r.correct / r.total) * 100) : 0;
      return `
        <tr>
          <td>${escapeHtml(r.block)}</td>
          <td>${escapeHtml(r.section)}</td>
          <td>${r.correct}</td>
          <td>${r.wrong}</td>
          <td><span class="status-pill ${statusClass}">${answeredStatus}</span></td>
          <td>${accuracyPct}%</td>
          <td>${masteryPct}%</td>
          <td>${r.covered}/${r.total}</td>
        </tr>
      `;
    })
    .join("");
}

function renderWeakList() {
  const list = Object.entries(state.stats.questions)
    .map(([id, data]) => ({ id, ...data, rate: data.attempts ? data.correct / data.attempts : 0 }))
    .filter((x) => x.attempts >= 2)
    .sort((a, b) => (a.rate !== b.rate ? a.rate - b.rate : b.wrong - a.wrong))
    .slice(0, 8);

  if (!list.length) {
    el.weakList.innerHTML = "<li>Пока мало данных. Решите вопросы и проверьте статистику повторно.</li>";
    return;
  }

  el.weakList.innerHTML = list
    .map((item) => {
      const q = state.questions.find((x) => String(x.id) === item.id);
      const title = q ? q.question.slice(0, 110) : `Вопрос ${item.id}`;
      const number = q ? questionNumber(q) : item.id;
      return `
        <li>
          <div>
            <b>Вопрос №${escapeHtml(number)}</b>
            <span>${Math.round(item.rate * 100)}%, ошибок: ${item.wrong}</span>
            <p>${escapeHtml(title)}</p>
          </div>
          <button class="btn ghost small weak-jump" data-jump-id="${item.id}">Открыть</button>
        </li>
      `;
    })
    .join("");
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return createEmptyStats();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return createEmptyStats();
    const questions = parsed.questions || {};
    for (const item of Object.values(questions)) {
      if (!Object.prototype.hasOwnProperty.call(item, "lastCorrect")) {
        item.lastCorrect = item.correct > 0 && item.wrong === 0 ? true : item.wrong > 0 ? false : null;
      }
    }
    return {
      attempts: Number(parsed.attempts || 0),
      correct: Number(parsed.correct || 0),
      wrong: Number(parsed.wrong || 0),
      currentStreak: Number(parsed.currentStreak || 0),
      bestStreak: Number(parsed.bestStreak || 0),
      questions,
    };
  } catch {
    return createEmptyStats();
  }
}

function saveStats() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state.stats));
}

function createEmptyStats() {
  return {
    attempts: 0,
    correct: 0,
    wrong: 0,
    currentStreak: 0,
    bestStreak: 0,
    questions: {},
  };
}

function questionNumber(q) {
  return q?.sourceNumber || q?.wordNumber || q?.docNumber || q?.id || "-";
}

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeSearchText(value) {
  return normalizeLetters(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
