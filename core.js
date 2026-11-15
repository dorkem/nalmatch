export function dateKey(date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

export function createMeeting(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const year = Number(values.year);
  const month = Number(values.month);
  return Object.freeze({
    year,
    start: `${values.year}-${values.month}-01`,
    end: dateKey(new Date(year, month + 1, 0)),
    minMonth: month - 1,
    maxMonth: month,
    period: `${values.year}-${values.month}`,
  });
}

export const MEETING = createMeeting();

export function monthLabel(offset, meeting = MEETING) {
  const date = new Date(meeting.year, offset, 1);
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function monthOffsetFor(key, meeting = MEETING) {
  const [year, month] = key.split('-').map(Number);
  return (year - meeting.year) * 12 + month - 1;
}

export function isMeetingDate(key, meeting = MEETING) {
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || key < meeting.start || key > meeting.end) return false;
  const [year, month, day] = key.split('-').map(Number);
  return dateKey(new Date(year, month - 1, day)) === key;
}

export function validAnswers(answers, meeting = MEETING) {
  const valid = {};
  for (const [key, value] of Object.entries(answers || {})) {
    if (isMeetingDate(key, meeting) && ['yes', 'no'].includes(value)) valid[key] = value;
  }
  return valid;
}

export function aggregateDate(participants, key) {
  const groups = { yes: [], no: [], unknown: [] };
  for (const person of participants) {
    const answer = person.answers[key];
    groups[answer === 'yes' ? 'yes' : answer === 'no' ? 'no' : 'unknown'].push(person.name);
  }
  return { key, ...groups, total: participants.length, full: participants.length > 0 && groups.yes.length === participants.length };
}

export function rankDates(participants, meeting = MEETING) {
  const result = [];
  const [year, month, day] = meeting.start.split('-').map(Number);
  for (let date = new Date(year, month - 1, day); dateKey(date) <= meeting.end; date.setDate(date.getDate() + 1)) {
    result.push(aggregateDate(participants, dateKey(date)));
  }
  return result.sort((a, b) => b.yes.length - a.yes.length || a.no.length - b.no.length || a.key.localeCompare(b.key));
}
