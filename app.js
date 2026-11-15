import { MEETING, createMeeting, dateKey, monthLabel, monthOffsetFor, isMeetingDate, validAnswers, aggregateDate, rankDates } from './core.js';

(() => {
  const root = document.getElementById('meet-calendar-prototype');
  const find = selector => root.querySelector(selector);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const start = MEETING.start;
  const end = MEETING.end;
  const prefix = 'nalmatch-demo-v1';
  const STORAGE_KEY = 'nalmatch-demo:v1';
  const sampleDate = day => dateKey(new Date(MEETING.year, MEETING.minMonth, day));
  function sampleAnswers(yesDays, noDays, nextMonthYes = []) {
    return Object.fromEntries([
      ...yesDays.map(day => [sampleDate(day), 'yes']),
      ...noDays.map(day => [sampleDate(day), 'no']),
      ...nextMonthYes.map(day => [dateKey(new Date(MEETING.year, MEETING.maxMonth, day)), 'yes']),
    ]);
  }
  let state = { participantId: '', name: '', mode: 'yes', month: MEETING.minMonth, resultsMonth: MEETING.minMonth, resultDate: sampleDate(20), selections: {}, savedSelections: {}, view: 'calendar' };
  let nameOpen = true;
  let pickerAccepted = false;
  let hasUnsavedChanges = false;
  let participants = [
    { id: 'sample-garam', name: '가람', answers: sampleAnswers([20, 27], [19, 24, 26]) },
    { id: 'sample-narae', name: '나래', answers: sampleAnswers([20, 21, 27, 28], [19, 25], [3]) },
    { id: 'sample-daon', name: '다온', answers: sampleAnswers([20, 21, 26, 27], [18, 24], [3]) },
    { id: 'sample-raon', name: '라온', answers: sampleAnswers([18, 20, 26, 28], [19, 27], [3]) }
  ];
  const datesFor = status => Object.keys(state.selections).filter(key => state.selections[key] === status).sort();
  const shortDate = key => {
    const [year, month, day] = key.split('-').map(Number);
    return `${month}.${day} ${weekdays[new Date(year, month - 1, day).getDay()]}`;
  };
  function restore(snapshot) {
    const saved = snapshot && snapshot.privateContent;
    if (!saved || saved.kind !== prefix) return false;
    const valid = validAnswers(saved.selections);
    if (Array.isArray(saved.participants)) {
      const seen = new Set();
      const restored = [];
      for (const person of saved.participants) {
        if (!person || typeof person.id !== 'string' || typeof person.name !== 'string' || !person.name.trim() || seen.has(person.id)) continue;
        seen.add(person.id); restored.push({ id: person.id, name: person.name.trim().slice(0, 20), answers: validAnswers(person.answers) });
      }
      if (restored.length) participants = restored;
    }
    const restoredName = typeof saved.name === 'string' ? saved.name.slice(0, 20).trim() : '';
    let active = participants.find(person => person.id === saved.participantId) || participants.find(person => person.name === restoredName);
    if (!active && restoredName) { active = addParticipant(restoredName); }
    if (active && !Array.isArray(saved.participants)) active.answers = validAnswers(saved.savedSelections || valid);
    state = {
      participantId: active ? active.id : '',
      name: active ? active.name : restoredName,
      mode: saved.mode === 'no' ? 'no' : 'yes',
      month: MEETING.minMonth,
      resultsMonth: saved.resultsMonth === MEETING.maxMonth ? MEETING.maxMonth : MEETING.minMonth,
      resultDate: isMeetingDate(saved.resultDate) ? saved.resultDate : sampleDate(20),
      selections: valid,
      savedSelections: active ? { ...active.answers } : validAnswers(saved.savedSelections || valid),
      view: ['saved', 'results'].includes(saved.view) ? 'results' : 'calendar'
    };
    hasUnsavedChanges = Boolean(saved.hasUnsavedChanges);
    nameOpen = !pickerAccepted || !state.name;
    return true;
  }
  function remember() {
    const snapshot = { privateContent: { kind: prefix, period: MEETING.period, ...state, participants, hasUnsavedChanges } };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      document.querySelector('[data-storage-status]').textContent = '';
    } catch (_) {
      document.querySelector('[data-storage-status]').textContent = '이 브라우저에서는 저장을 유지할 수 없어요. 새로고침하면 입력이 사라질 수 있어요.';
    }
  }
  function renderDateList(selector, dates) {
    const container = find(selector);
    container.replaceChildren();
    if (!dates.length) {
      const empty = document.createElement('span'); empty.className = 'meet-empty'; empty.textContent = '아직 표시한 날짜가 없어요.'; container.append(empty); return;
    }
    for (const key of dates) {
      const chip = document.createElement('span'); chip.className = 'meet-date-chip'; chip.textContent = shortDate(key); container.append(chip);
    }
  }
  function renderSummary() {
    const yes = datesFor('yes'); const no = datesFor('no'); const total = yes.length + no.length;
    for (const [status, dates] of [['yes', yes], ['no', no]]) {
      find(`[data-${status}-count]`).textContent = `${dates.length}일`;
      renderDateList(`[data-${status}-dates]`, dates);
    }
    find('[data-selected-total]').textContent = total ? `총 ${total}일을 표시했어요.${hasUnsavedChanges ? ' 결과에 반영해 주세요.' : ''}` : '달력에서 날짜를 선택해 주세요.';
    find('[data-save]').disabled = !state.participantId;
  }
  function aggregate(key) { return aggregateDate(participants, key); }
  function rankedDates() { return rankDates(participants); }
  function renderResults() {
    const ranked = rankedDates(); const full = ranked.filter(day => day.full);
    find('[data-results-subtitle]').textContent = `${state.name || '나'}님 포함 등록된 ${participants.length}명 기준이에요.`;
    find('[data-best-date]').textContent = full.length ? `✓ 등록된 참여자 모두 가능한 날: ${shortDate(full[0].key)}${full.length > 1 ? ` 외 ${full.length - 1}일` : ''}` : '등록된 참여자 모두 가능한 날은 아직 없어요.';
    find('[data-best-detail]').textContent = full.length ? `${participants.length}명 기준 · 카카오톡 명단 연동 없음` : '가능 인원과 미정 응답을 함께 확인해 보세요.';
    const monthName = monthLabel(state.resultsMonth);
    find('[data-results-month-title]').textContent = monthName;
    find('[data-results-prev-month]').disabled = state.resultsMonth === MEETING.minMonth;
    find('[data-results-next-month]').disabled = state.resultsMonth === MEETING.maxMonth;
    const grid = find('[data-results-grid]'); grid.replaceChildren(); grid.setAttribute('aria-label', `${monthName} 날짜별 응답 집계`);
    const offset = new Date(MEETING.year, state.resultsMonth, 1).getDay();
    const days = new Date(MEETING.year, state.resultsMonth + 1, 0).getDate();
    for (let index = 0; index < Math.ceil((offset + days) / 7) * 7; index++) {
      const day = index - offset + 1;
      if (day < 1 || day > days) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
      const key = dateKey(new Date(MEETING.year, state.resultsMonth, day));
      const button = document.createElement('button'); button.type = 'button'; button.className = 'meet-day meet-result-day'; button.dataset.resultDate = key;
      const number = document.createElement('span'); number.className = 'meet-day-number'; number.textContent = day;
      const count = document.createElement('span'); count.className = 'meet-day-status'; count.setAttribute('aria-hidden', 'true'); button.append(number, count);
      if (key < start || key > end) { button.disabled = true; button.setAttribute('aria-label', `${shortDate(key)}, 모임 기간 밖`); }
      else {
        const summary = aggregate(key);
        button.dataset.intensity = Math.ceil(summary.yes.length / summary.total * 3); button.dataset.full = String(summary.full);
        button.setAttribute('aria-pressed', String(key === state.resultDate));
        count.textContent = `${summary.yes.length}/${summary.total}`;
        button.setAttribute('aria-label', `${shortDate(key)}, 가능 ${summary.yes.length}명, 불가 ${summary.no.length}명, 미정 ${summary.unknown.length}명${summary.full ? ', 전원 가능' : ''}`);
      }
      grid.append(button);
    }
    const selected = aggregate(state.resultDate);
    const [year, month, day] = state.resultDate.split('-').map(Number);
    find('[data-result-date-title]').textContent = `${month}월 ${day}일 ${weekdays[new Date(year, month - 1, day).getDay()]}요일`;
    find('[data-result-status]').textContent = selected.full ? '등록된 참여자가 모두 가능한 날이에요.' : selected.no.length ? '불가 응답이 있는 날이에요.' : selected.unknown.length ? '아직 미정인 사람이 있어요.' : '';
    for (const status of ['yes', 'no', 'unknown']) {
      const people = selected[status]; find(`[data-result-${status}-count]`).textContent = `${people.length}명`;
      const names = find(`[data-result-${status}-names]`); names.replaceChildren();
      if (!people.length) { const empty = document.createElement('span'); empty.className = 'meet-empty'; empty.textContent = '없어요'; names.append(empty); }
      for (const name of people) { const chip = document.createElement('span'); chip.className = 'meet-date-chip'; chip.textContent = name === state.name ? `${name} (선택 중)` : name; names.append(chip); }
    }
    const candidates = find('[data-candidates]'); candidates.replaceChildren();
    for (const candidate of ranked.filter(date => date.yes.length).slice(0, 3)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'meet-candidate'; button.dataset.candidateDate = candidate.key; button.setAttribute('aria-pressed', String(candidate.key === state.resultDate));
      const label = document.createElement('span'); label.textContent = shortDate(candidate.key);
      const count = document.createElement('span'); count.className = 'meet-candidate-count'; count.textContent = candidate.full ? '전원 가능' : `${candidate.yes.length}/${candidate.total} 가능`;
      button.append(label, count); candidates.append(button);
    }
  }
  function updateDay(button, key) {
    const status = state.selections[key] || '';
    const [year, month, day] = key.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    button.dataset.state = status;
    button.setAttribute('aria-pressed', String(Boolean(status)));
    button.setAttribute('aria-label', `${date.getMonth() + 1}월 ${date.getDate()}일 ${weekdays[date.getDay()]}요일, ${status === 'yes' ? '되는 날' : status === 'no' ? '안 되는 날' : '미정'}`);
    button.querySelector('.meet-day-status').textContent = status === 'yes' ? '✓ 가능' : status === 'no' ? '× 불가' : '';
  }
  function renderCalendar() {
    const monthName = monthLabel(state.month);
    find('[data-month-title]').textContent = monthName;
    const grid = find('[data-calendar-grid]'); grid.setAttribute('aria-label', `${monthName} 날짜`); grid.replaceChildren();
    find('[data-prev-month]').disabled = state.month === MEETING.minMonth;
    find('[data-next-month]').disabled = state.month === MEETING.maxMonth;
    const firstWeekday = new Date(MEETING.year, state.month, 1).getDay();
    const monthDays = new Date(MEETING.year, state.month + 1, 0).getDate();
    const slots = Math.ceil((firstWeekday + monthDays) / 7) * 7;
    for (let index = 0; index < slots; index++) {
      const day = index - firstWeekday + 1;
      if (day < 1 || day > monthDays) { const blank = document.createElement('span'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
      const date = new Date(MEETING.year, state.month, day); const key = dateKey(date);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'meet-day'; button.dataset.date = key;
      const number = document.createElement('span'); number.className = 'meet-day-number'; number.textContent = day;
      const status = document.createElement('span'); status.className = 'meet-day-status'; status.setAttribute('aria-hidden', 'true');
      button.append(number, status);
      if (key < start || key > end) { button.disabled = true; button.setAttribute('aria-label', `${date.getMonth() + 1}월 ${day}일, 모임 기간 밖`); }
      else { updateDay(button, key); }
      grid.append(button);
    }
  }
  function renderModes() {
    for (const button of root.querySelectorAll('[data-mode]')) button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode));
    find('[data-mode-hint]').textContent = state.mode === 'yes' ? '‘되는 날’을 누른 뒤 날짜를 선택해 주세요.' : '‘안 되는 날’을 누른 뒤 날짜를 선택해 주세요.';
  }
  function addParticipant(name) {
    let number = participants.length + 1;
    while (participants.some(person => person.id === `p-new-${number}`)) number++;
    const person = { id: `p-new-${number}`, name, answers: {} }; participants.push(person); return person;
  }
  function renderParticipantList() {
    const list = find('[data-participant-list]'); list.replaceChildren();
    find('[data-existing-count]').textContent = `${participants.length}명`;
    for (const person of participants) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'meet-existing-person'; button.dataset.participantId = person.id; button.setAttribute('aria-pressed', String(person.id === state.participantId));
      const avatar = document.createElement('span'); avatar.className = 'meet-existing-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = Array.from(person.name)[0];
      const info = document.createElement('span'); info.className = 'meet-existing-info';
      const name = document.createElement('span'); name.className = 'meet-existing-name'; name.textContent = person.name;
      const detail = document.createElement('span'); detail.className = 'meet-existing-detail';
      const answers = Object.values(person.answers); detail.textContent = `${answers.filter(value => value === 'yes').length}일 가능 / ${answers.filter(value => value === 'no').length}일 불가`;
      const action = document.createElement('span'); action.className = 'meet-existing-action'; action.textContent = '선택';
      info.append(name, detail); button.append(avatar, info, action); list.append(button);
    }
  }
  function enterParticipant(person) {
    state.participantId = person.id; state.name = person.name; state.selections = { ...person.answers }; state.savedSelections = { ...person.answers };
    state.month = MEETING.minMonth;
    state.view = 'calendar'; state.mode = 'yes'; hasUnsavedChanges = false; nameOpen = false; pickerAccepted = true;
    find('[data-name-input]').value = ''; find('[data-name-error]').textContent = ''; find('[data-name-input]').removeAttribute('aria-invalid');
    renderAll(); remember(); find('[data-mode="yes"]').focus({ preventScroll: true });
  }
  function renderScreen() {
    find('[data-main-content]').inert = nameOpen;
    find('[data-name-overlay]').hidden = !nameOpen;
    find('[data-cancel-name]').hidden = !state.name;
    find('[data-calendar-view]').hidden = state.view === 'results';
    find('[data-results-view]').hidden = state.view !== 'results';
    find('[data-display-name]').textContent = state.name || '참여자';
    find('[data-avatar]').textContent = state.name ? Array.from(state.name)[0] : '?';
    for (const step of root.querySelectorAll('[data-step]')) {
      const current = step.dataset.step === (nameOpen ? 'name' : state.view);
      step.classList.toggle('current', current);
      if (current) step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
    }
  }
  function renderAll() { renderParticipantList(); renderModes(); renderCalendar(); renderSummary(); renderResults(); renderScreen(); }
  find('[data-participant-list]').addEventListener('click', event => {
    const button = event.target.closest('button[data-participant-id]'); if (!button) return;
    const person = participants.find(person => person.id === button.dataset.participantId); if (person) enterParticipant(person);
  });
  find('[data-name-form]').addEventListener('submit', event => {
    event.preventDefault();
    const name = find('[data-name-input]').value.trim();
    if (!name) { find('[data-name-error]').textContent = '참여할 이름을 입력해 주세요.'; find('[data-name-input]').setAttribute('aria-invalid', 'true'); find('[data-name-input]').focus(); return; }
    const existing = participants.find(person => person.name === name);
    enterParticipant(existing || addParticipant(name));
  });
  find('[data-name-input]').addEventListener('input', () => { find('[data-name-error]').textContent = ''; find('[data-name-input]').removeAttribute('aria-invalid'); });
  find('[data-edit-name]').addEventListener('click', () => { if (hasUnsavedChanges && !window.confirm('아직 결과에 반영하지 않은 날짜가 있어요. 참여자를 바꾸면 저장된 응답을 다시 불러옵니다. 계속할까요?')) return; nameOpen = true; find('[data-name-input]').value = ''; renderParticipantList(); renderScreen(); const first = find('[data-participant-list]').querySelector('button'); if (first) first.focus({ preventScroll: true }); });
  find('[data-cancel-name]').addEventListener('click', () => { nameOpen = false; pickerAccepted = true; renderScreen(); find('[data-edit-name]').focus({ preventScroll: true }); });
  find('[data-name-overlay]').addEventListener('keydown', event => {
    if (event.key === 'Escape' && state.name) { nameOpen = false; pickerAccepted = true; renderScreen(); return; }
    if (event.key !== 'Tab') return;
    const fields = Array.from(find('[data-name-overlay]').querySelectorAll('button, input')).filter(element => !element.hidden && !element.disabled);
    const first = fields[0]; const last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  for (const button of root.querySelectorAll('[data-mode]')) button.addEventListener('click', () => { state.mode = button.dataset.mode; renderModes(); remember(); });
  find('[data-calendar-grid]').addEventListener('click', event => {
    const button = event.target.closest('button[data-date]'); if (!button || button.disabled || nameOpen) return;
    const key = button.dataset.date;
    if (state.selections[key] === state.mode) delete state.selections[key]; else state.selections[key] = state.mode;
    hasUnsavedChanges = true; updateDay(button, key); renderSummary(); remember();
  });
  find('[data-prev-month]').addEventListener('click', () => { if (state.month > MEETING.minMonth) { state.month--; renderCalendar(); remember(); } });
  find('[data-next-month]').addEventListener('click', () => { if (state.month < MEETING.maxMonth) { state.month++; renderCalendar(); remember(); } });
  find('[data-save]').addEventListener('click', () => {
    if (!state.name) return;
    const person = participants.find(person => person.id === state.participantId); if (!person) return;
    person.answers = { ...state.selections };
    state.savedSelections = { ...state.selections };
    hasUnsavedChanges = false; state.view = 'results';
    const best = rankedDates().find(date => date.yes.length);
    state.resultDate = best ? best.key : start; state.resultsMonth = monthOffsetFor(state.resultDate);
    renderParticipantList(); renderSummary(); renderResults(); renderScreen(); remember();
    find('[data-edit-dates]').focus({ preventScroll: true });
  });
  find('[data-edit-dates]').addEventListener('click', () => { state.view = 'calendar'; renderScreen(); remember(); find(`[data-mode="${state.mode}"]`).focus({ preventScroll: true }); });
  function selectResultDate(key) {
    state.resultDate = key; state.resultsMonth = monthOffsetFor(key); renderResults(); remember();
    const selectedButton = find(`[data-result-date="${key}"]`); if (selectedButton) selectedButton.focus({ preventScroll: true });
  }
  find('[data-results-grid]').addEventListener('click', event => { const button = event.target.closest('button[data-result-date]'); if (button && !button.disabled) selectResultDate(button.dataset.resultDate); });
  find('[data-candidates]').addEventListener('click', event => { const button = event.target.closest('button[data-candidate-date]'); if (button) selectResultDate(button.dataset.candidateDate); });
  function changeResultsMonth(direction) {
    const month = state.resultsMonth + direction;
    if (month < MEETING.minMonth || month > MEETING.maxMonth) return;
    state.resultsMonth = month;
    const best = rankedDates().find(date => monthOffsetFor(date.key) === month);
    state.resultDate = best ? best.key : dateKey(new Date(MEETING.year, month, 1)); renderResults(); remember();
  }
  find('[data-results-prev-month]').addEventListener('click', () => changeResultsMonth(-1));
  find('[data-results-next-month]').addEventListener('click', () => changeResultsMonth(1));
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    // shortcut: 정적 데모는 접속 시에만 정리한다. 공용 DB를 도입할 때 서버 보존 정책으로 옮긴다.
    if (saved && restore(JSON.parse(saved))) remember();
  } catch (_) {
    document.querySelector('[data-storage-status]').textContent = '저장된 데모 데이터를 읽지 못했어요. 새로 체험할 수 있어요.';
  }
  find('[data-name-input]').value = '';
  find('[data-meeting-period]').textContent = `예시 기간 ${MEETING.start.replaceAll('-', '.')} ~ ${MEETING.end.replaceAll('-', '.')} (한국 시간)`;
  renderAll();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && createMeeting().period !== MEETING.period) window.location.reload();
  });
  document.querySelector('[data-reset-demo]').addEventListener('click', () => {
    if (!window.confirm('이 브라우저의 데모 응답을 초기화할까요?')) return;
    try { localStorage.removeItem(STORAGE_KEY); window.location.reload(); }
    catch (_) { document.querySelector('[data-storage-status]').textContent = '브라우저 설정으로 초기화하지 못했어요.'; }
  });
})();
