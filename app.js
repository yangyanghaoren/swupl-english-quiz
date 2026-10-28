(() => {
  "use strict";

  const payload = window.SWUPL_EXAMS;
  if (!payload || !Array.isArray(payload.exams)) {
    document.body.innerHTML = "<p style='padding:2rem'>题库数据载入失败，请重新运行数据构建脚本。</p>";
    return;
  }

  const $ = (selector) => document.querySelector(selector);
  const els = {
    examList: $("#examList"),
    yearSearch: $("#yearSearch"),
    examTitle: $("#examTitle"),
    examBadge: $("#examBadge"),
    examMeta: $("#examMeta"),
    paperTitle: $("#paperTitle"),
    paperScore: $("#paperScore"),
    paperText: $("#paperText"),
    sectionChips: $("#sectionChips"),
    answerSections: $("#answerSections"),
    progressRing: $("#progressRing"),
    progressValue: $("#progressValue"),
    saveStatus: $("#saveStatus"),
    resultCard: $("#resultCard"),
    timerValue: $("#timerValue"),
    timerToggle: $("#timerToggle"),
    submitButton: $("#submitButton"),
    resetButton: $("#resetButton"),
    toast: $("#toast"),
  };

  const state = {
    exam: payload.exams[0],
    elapsed: 0,
    timerRunning: true,
    timerStarted: Date.now(),
    largeText: false,
  };

  function storageKey(examId) { return `swupl-quiz:${examId}`; }
  function readSaved(examId) {
    try { return JSON.parse(localStorage.getItem(storageKey(examId))) || { answers: {}, elapsed: 0 }; }
    catch { return { answers: {}, elapsed: 0 }; }
  }
  function writeSaved() {
    const current = readSaved(state.exam.id);
    current.elapsed = currentElapsed();
    current.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(state.exam.id), JSON.stringify(current));
    els.saveStatus.classList.add("saved");
    els.saveStatus.innerHTML = "<span></span>已自动保存到本机";
    renderExamList(els.yearSearch.value);
  }
  function setAnswer(key, value) {
    const saved = readSaved(state.exam.id);
    saved.answers[key] = value;
    saved.elapsed = currentElapsed();
    saved.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(state.exam.id), JSON.stringify(saved));
    els.saveStatus.classList.add("saved");
    els.saveStatus.innerHTML = "<span></span>已自动保存到本机";
    updateProgress();
  }

  function examProgress(exam) {
    const saved = readSaved(exam.id);
    const answerable = exam.sections.reduce((sum, section) => sum + (section.kind === "choice" ? section.count : 1), 0);
    const answered = Object.values(saved.answers || {}).filter((value) => String(value).trim()).length;
    return answerable ? Math.min(100, Math.round(answered / answerable * 100)) : 0;
  }

  function renderExamList(filter = "") {
    const query = filter.trim();
    const exams = payload.exams.filter((exam) => !query || String(exam.year).includes(query));
    els.examList.innerHTML = exams.map((exam) => {
      const progress = examProgress(exam);
      return `<button type="button" class="${exam.id === state.exam.id ? "active" : ""}" data-exam-id="${exam.id}">
        <span class="exam-year">${exam.year}</span>
        <span><b>${exam.kind === "full" ? "完整套卷" : "题型回忆"}</b><small>${exam.sections.length} 个题型</small></span>
        <span class="exam-progress">${progress ? progress + "%" : "未做"}</span>
      </button>`;
    }).join("");
    els.examList.querySelectorAll("button").forEach((button) => {
      button.addEventListener("click", () => selectExam(button.dataset.examId));
    });
  }

  function choiceKey(section, number) { return `${section.id}:${number}`; }
  function writtenKey(section) { return `${section.id}:text`; }

  function renderChoiceSection(section, saved) {
    const items = Array.from({ length: section.count }, (_, offset) => {
      const number = section.start + offset;
      const key = choiceKey(section, number);
      const selected = saved.answers[key] || "";
      return `<div class="choice-item" data-key="${key}" data-index="${offset}">
        <span class="choice-number">${number}</span>
        <div class="choice-options">${["A", "B", "C", "D"].map((letter) =>
          `<label><input type="radio" name="${key}" value="${letter}" ${selected === letter ? "checked" : ""}>${letter}</label>`
        ).join("")}</div>
      </div>`;
    }).join("");
    const keyStatus = section.key ? "可自动评分" : "无标准答案";
    return `<section class="answer-section" data-section-id="${section.id}">
      <h4>${section.title}<span>${section.score} 分 · ${keyStatus}</span></h4>
      <div class="choice-grid">${items}</div>
    </section>`;
  }

  function renderWrittenSection(section, saved) {
    const key = writtenKey(section);
    const value = saved.answers[key] || "";
    return `<section class="answer-section" data-section-id="${section.id}">
      <h4>${section.title}<span>${section.score} 分 · 主观题</span></h4>
      <div class="written-wrap">
        <textarea data-key="${key}" placeholder="在这里输入答案…">${escapeHtml(value)}</textarea>
        <p class="written-hint">${section.hint}</p>
      </div>
    </section>`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
  }

  function parseInlineOptions(line) {
    const marker = /(?:^|\s)([A-D])\s*[.．、)）]\s*/g;
    const matches = [...line.matchAll(marker)];
    if (!matches.length) return null;
    const stem = line.slice(0, matches[0].index).trim();
    const options = matches.map((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < matches.length ? matches[index + 1].index : line.length;
      return { label: match[1], text: line.slice(start, end).trim() };
    });
    return { stem, options };
  }

  function renderPaperContent(text) {
    const lines = String(text).replace(/\r/g, "").split("\n");
    const html = [];
    let paragraph = [];
    let question = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p class="paper-paragraph">${escapeHtml(paragraph.join(" "))}</p>`);
      paragraph = [];
    };
    const flushQuestion = () => {
      if (!question) return;
      const optionHtml = question.options.length
        ? `<div class="paper-options">${question.options.map((option) => `<div class="paper-option"><span>${option.label}</span><p>${escapeHtml(option.text)}</p></div>`).join("")}</div>`
        : "";
      html.push(`<section class="paper-question"><div class="question-stem"><span class="question-number">${question.number}</span><p>${escapeHtml(question.stem.join(" "))}</p></div>${optionHtml}</section>`);
      question = null;
    };
    const appendOptions = (options) => {
      options.forEach((option) => {
        const existing = question.options.find((item) => item.label === option.label);
        if (existing) existing.text += ` ${option.text}`;
        else question.options.push(option);
      });
    };

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        flushParagraph();
        if (question?.options.length) flushQuestion();
        continue;
      }
      if (/^─+$/.test(line) || /^第\s*\d+\s*页$/.test(line)) {
        flushParagraph();
        continue;
      }

      const sectionLike = /^(Part|PART|Section|SECTION)\s+/i.test(line) || /^(基础英语部分|法律英语部分)/.test(line);
      const passageLike = /^(Passage\s+|Questions?\s+\d+|Directions?:|考生注意|学科专业|考试科目)/i.test(line);
      const documentTitle = /^西南政法大学.*(英语试题|入学考试试题)$/.test(line);
      const questionMatch = line.match(/^(\d{1,2})\s*[.．、)）]\s*(.*)$/);
      const optionLine = parseInlineOptions(line);

      if (sectionLike || passageLike || documentTitle) {
        flushParagraph();
        flushQuestion();
        const className = documentTitle ? "paper-doc-title" : sectionLike ? "paper-section-heading" : "paper-passage-label";
        html.push(`<div class="${className}">${escapeHtml(line)}</div>`);
        continue;
      }

      if (questionMatch) {
        flushParagraph();
        flushQuestion();
        const parsed = parseInlineOptions(questionMatch[2]);
        question = {
          number: questionMatch[1],
          stem: [parsed ? parsed.stem : questionMatch[2]],
          options: [],
        };
        if (parsed) appendOptions(parsed.options);
        continue;
      }

      if (optionLine && optionLine.stem === "") {
        flushParagraph();
        if (!question) question = { number: "", stem: [], options: [] };
        appendOptions(optionLine.options);
        continue;
      }

      if (question) {
        if (question.options.length) question.options[question.options.length - 1].text += ` ${line}`;
        else question.stem.push(line);
      } else {
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushQuestion();
    return html.join("");
  }

  function renderExam() {
    const exam = state.exam;
    const saved = readSaved(exam.id);
    state.elapsed = Number(saved.elapsed) || 0;
    state.timerStarted = Date.now();
    state.timerRunning = true;
    els.timerToggle.textContent = "暂停";
    document.querySelector(".timer").classList.remove("paused");

    els.examTitle.textContent = exam.title;
    els.examBadge.textContent = exam.kind === "full" ? "完整套卷" : "题型回忆";
    els.examBadge.className = `badge ${exam.kind === "memory" ? "memory" : ""}`;
    els.examMeta.textContent = `${exam.source} · 原资料第 ${exam.sourcePages} 页 · ${exam.sections.length} 个题型`;
    els.paperTitle.textContent = exam.title;
    els.paperScore.textContent = `满分 ${exam.score} 分`;
    els.paperText.innerHTML = renderPaperContent(exam.paper);
    els.sectionChips.innerHTML = exam.sections.map((section) => `<span class="section-chip">${section.title}</span>`).join("");
    els.answerSections.innerHTML = exam.sections.map((section) => section.kind === "choice" ? renderChoiceSection(section, saved) : renderWrittenSection(section, saved)).join("");
    els.resultCard.hidden = true;

    els.answerSections.querySelectorAll("input[type=radio]").forEach((input) => {
      input.addEventListener("change", () => setAnswer(input.name, input.value));
    });
    els.answerSections.querySelectorAll("textarea").forEach((textarea) => {
      let debounce;
      textarea.addEventListener("input", () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => setAnswer(textarea.dataset.key, textarea.value), 180);
      });
    });
    els.saveStatus.className = `save-status ${Object.keys(saved.answers || {}).length ? "saved" : ""}`;
    els.saveStatus.innerHTML = Object.keys(saved.answers || {}).length ? "<span></span>已载入本机进度" : "<span></span>尚未作答";
    updateProgress();
    renderExamList(els.yearSearch.value);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function selectExam(id) {
    const exam = payload.exams.find((item) => item.id === id);
    if (!exam) return;
    state.exam = exam;
    document.body.classList.remove("menu-open", "mobile-answer");
    document.querySelectorAll("[data-mobile-view]").forEach((button) => button.classList.toggle("active", button.dataset.mobileView === "paper"));
    renderExam();
  }

  function updateProgress() {
    const progress = examProgress(state.exam);
    els.progressRing.style.setProperty("--progress", progress);
    els.progressValue.textContent = `${progress}%`;
  }

  function submitExam() {
    const saved = readSaved(state.exam.id);
    let scored = 0;
    let correct = 0;
    let totalAutoScore = 0;
    let answeredAuto = 0;
    els.answerSections.querySelectorAll(".choice-item").forEach((item) => item.classList.remove("correct", "incorrect"));

    state.exam.sections.filter((section) => section.kind === "choice" && section.key).forEach((section) => {
      const perQuestion = section.score / section.count;
      const knownAnswerCount = [...section.key].filter((answer) => answer !== "?").length;
      totalAutoScore += perQuestion * knownAnswerCount;
      Array.from({ length: section.count }, (_, offset) => {
        const number = section.start + offset;
        const key = choiceKey(section, number);
        const answer = saved.answers[key];
        const expected = section.key[offset];
        const item = els.answerSections.querySelector(`[data-key="${CSS.escape(key)}"]`);
        if (answer) answeredAuto += 1;
        if (expected === "?") return;
        if (answer === expected) {
          correct += 1;
          scored += perQuestion;
          item?.classList.add("correct");
        } else {
          item?.classList.add("incorrect");
          item?.setAttribute("data-correct", expected);
        }
      });
    });

    if (!totalAutoScore) {
      els.resultCard.innerHTML = `<strong>已保存答卷</strong><p>本套资料没有附可核验的客观题答案，因此不自动判分。你仍可继续修改，答案会留在本机。</p>`;
    } else {
      els.resultCard.innerHTML = `<strong>${scored.toFixed(1).replace(".0", "")} / ${totalAutoScore} 分</strong><p>客观题答对 ${correct} 题；已作答 ${answeredAuto} 题。主观题请另行对照资料或请老师批阅。</p>`;
    }
    els.resultCard.hidden = false;
    writeSaved();
    els.resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    showToast("交卷完成，客观题结果已标记");
  }

  function currentElapsed() {
    return state.elapsed + (state.timerRunning ? Math.floor((Date.now() - state.timerStarted) / 1000) : 0);
  }
  function formatTime(seconds) {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor(seconds % 3600 / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }
  function updateTimer() { els.timerValue.textContent = formatTime(currentElapsed()); }
  function toggleTimer() {
    if (state.timerRunning) {
      state.elapsed = currentElapsed();
      state.timerRunning = false;
      els.timerToggle.textContent = "继续";
      document.querySelector(".timer").classList.add("paused");
    } else {
      state.timerStarted = Date.now();
      state.timerRunning = true;
      els.timerToggle.textContent = "暂停";
      document.querySelector(".timer").classList.remove("paused");
    }
    writeSaved();
  }

  function resetExam() {
    if (!confirm(`确认清空 ${state.exam.year} 年的全部作答和计时吗？`)) return;
    localStorage.removeItem(storageKey(state.exam.id));
    renderExam();
    showToast("本卷进度已清空");
  }

  let toastTimer;
  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.classList.add("show");
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
  }

  $("#examCount").textContent = payload.exams.length;
  $("#sourceNotice").textContent = payload.sourceNotice;
  els.yearSearch.addEventListener("input", () => renderExamList(els.yearSearch.value));
  els.submitButton.addEventListener("click", submitExam);
  els.resetButton.addEventListener("click", resetExam);
  els.timerToggle.addEventListener("click", toggleTimer);
  $("#fontButton").addEventListener("click", () => {
    state.largeText = !state.largeText;
    els.paperText.classList.toggle("large", state.largeText);
    $("#fontButton").textContent = state.largeText ? "字号 A−" : "字号 A+";
  });
  $("#aboutButton").addEventListener("click", () => $("#aboutDialog").showModal());
  $("#closeAbout").addEventListener("click", () => $("#aboutDialog").close());
  $("#menuButton").addEventListener("click", () => document.body.classList.add("menu-open"));
  $("#mobileBackdrop").addEventListener("click", () => document.body.classList.remove("menu-open"));
  document.querySelectorAll("[data-mobile-view]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-mobile-view]").forEach((item) => item.classList.toggle("active", item === button));
      document.body.classList.toggle("mobile-answer", button.dataset.mobileView === "answer");
    });
  });
  window.addEventListener("beforeunload", () => writeSaved());
  setInterval(updateTimer, 1000);
  setInterval(() => { if (state.timerRunning) writeSaved(); }, 30000);

  renderExamList();
  renderExam();
  updateTimer();
})();
