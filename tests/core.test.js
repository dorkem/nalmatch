import test from 'node:test';
import assert from 'node:assert/strict';
import { createMeeting, dateKey, monthLabel, monthOffsetFor, isMeetingDate, validAnswers, aggregateDate, rankDates } from '../core.js';

const november = createMeeting(new Date('2026-11-15T12:00:00Z'));
const group = [
  { name: '가람', answers: { '2026-11-20': 'yes', '2026-11-21': 'no' } },
  { name: '나래', answers: { '2026-11-20': 'yes', '2026-11-21': 'yes' } },
  { name: '다온', answers: { '2026-11-20': 'yes' } },
];

test('한국 시간의 현재 월을 기준으로 시작한다', () => {
  assert.equal(createMeeting(new Date('2026-11-30T14:59:59Z')).start, '2026-11-01');
  assert.equal(createMeeting(new Date('2026-11-30T15:00:00Z')).start, '2026-12-01');
});

test('현재 월과 다음 월을 제공한다', () => {
  assert.equal(november.start, '2026-11-01');
  assert.equal(november.end, '2026-12-31');
  assert.equal(november.minMonth, 10);
  assert.equal(november.maxMonth, 11);
});

test('12월 다음 달은 다음 해 1월로 표시한다', () => {
  const december = createMeeting(new Date('2026-12-15T12:00:00Z'));
  assert.equal(december.end, '2027-01-31');
  assert.equal(monthLabel(december.maxMonth, december), '2027년 1월');
  assert.equal(monthOffsetFor('2027-01-10', december), december.maxMonth);
  assert.equal(isMeetingDate('2027-01-31', december), true);
});

test('윤년의 2월 말일을 올바르게 계산한다', () => {
  const leap = createMeeting(new Date('2028-01-20T00:00:00Z'));
  const ordinary = createMeeting(new Date('2027-01-20T00:00:00Z'));
  assert.equal(leap.end, '2028-02-29');
  assert.equal(isMeetingDate('2028-02-29', leap), true);
  assert.equal(isMeetingDate('2027-02-29', ordinary), false);
});

test('존재하지 않거나 형식이 다른 날짜는 거부한다', () => {
  for (const key of ['2026-11-31', '2026-13-01', '26-11-20', '', null, '<script>']) {
    assert.equal(isMeetingDate(key, november), false);
  }
});

test('지난달 응답을 제거하고 현재 월과 다음 월 응답은 유지한다', () => {
  assert.deepEqual(validAnswers({ '2026-10-31': 'yes', '2026-11-20': 'yes', '2026-12-03': 'no' }, november), {
    '2026-11-20': 'yes', '2026-12-03': 'no',
  });
});

test('연도가 바뀌어도 지난달 응답은 정리된다', () => {
  const january = createMeeting(new Date('2027-01-05T00:00:00Z'));
  assert.deepEqual(validAnswers({ '2026-12-31': 'yes', '2027-01-02': 'yes', '2027-02-04': 'no' }, january), {
    '2027-01-02': 'yes', '2027-02-04': 'no',
  });
});

test('yes/no 이외의 응답은 저장 데이터에서 제외한다', () => {
  assert.deepEqual(validAnswers({ '2026-11-20': 'maybe', '2026-11-21': true, '2026-11-22': 'no' }, november), { '2026-11-22': 'no' });
});

test('표시하지 않은 날은 불가 대신 미정으로 집계한다', () => {
  const result = aggregateDate(group, '2026-11-21');
  assert.deepEqual(result.yes, ['나래']);
  assert.deepEqual(result.no, ['가람']);
  assert.deepEqual(result.unknown, ['다온']);
  assert.equal(result.full, false);
});

test('등록된 모든 참여자가 가능할 때만 전원 가능이다', () => {
  assert.equal(aggregateDate(group, '2026-11-20').full, true);
  assert.equal(aggregateDate(group, '2026-11-22').full, false);
  assert.equal(aggregateDate([], '2026-11-20').full, false);
});

test('같은 참여자의 응답을 바꾸어도 인원은 늘어나지 않는다', () => {
  const revised = group.map((person, index) => index === 0 ? { ...person, answers: { '2026-11-20': 'no' } } : person);
  const result = aggregateDate(revised, '2026-11-20');
  assert.equal(result.total, 3);
  assert.equal(result.yes.length, 2);
  assert.equal(result.no.length, 1);
});

test('응답을 모두 해제하면 해당 참여자는 미정으로 남는다', () => {
  const revised = group.map((person, index) => index === 0 ? { ...person, answers: {} } : person);
  const result = aggregateDate(revised, '2026-11-20');
  assert.equal(result.unknown.length, 1);
  assert.equal(result.full, false);
});

test('가능 인원, 불가 인원, 날짜 순서로 후보를 정렬한다', () => {
  const ranked = rankDates(group, november);
  assert.equal(ranked[0].key, '2026-11-20');
  assert.equal(ranked[1].key, '2026-11-21');
  assert.equal(ranked.length, 61);
  assert.equal(ranked.at(-1).key, '2026-12-31');
});

test('모든 날짜에서 가능·불가·미정의 합은 등록 인원과 같다', () => {
  for (const result of rankDates(group, november)) {
    assert.equal(result.yes.length + result.no.length + result.unknown.length, group.length);
  }
  assert.equal(dateKey(new Date(2026, 10, 3)), '2026-11-03');
});
