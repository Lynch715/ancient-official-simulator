import assert from 'node:assert/strict';
import {validateSave} from '../../src/engine.js';
import {countyCase} from '../../src/case-content.js';
import {act} from './career.js';

// Only public commands: preserve the failed assessment and earn a new qualification.
export function recover(s) {
  assert.equal(s.accountability.current?.status, 'notice');
  const role = s.accountability.current.role;
  const original = structuredClone(role === 'county' ? s.outcome : s[role].outcome);
  s = act(s, 'ac_begin');
  let weeks = 0;
  while (['remedy', 'retest'].includes(s.accountability.current.status)) {
    let p = s.accountability.current;
    const load = () => p.pending.length + Object.values(p.caseReviews).filter(f => f.status === 'checking').length;
    for (const [id, f] of Object.entries(p.caseReviews)) {
      if (f.status !== 'open') continue;
      for (const clue of countyCase(s, id).clues) {
        if (p.ap && !p.caseReviews[id].clues.includes(clue.id)) {
          s = act(s, 'ac_case_clue', {case: id, clue: clue.id}); p = s.accountability.current;
        }
      }
      if (p.ap && load() < 2 && p.week + 2 <= p.deadline && p.caseReviews[id].clues.length === countyCase(s, id).clues.length) {
        s = act(s, 'ac_case_handover', {case: id}); p = s.accountability.current;
      }
    }
    for (const t of p.targets) {
      if (p.ap && load() < 2 && p.week + 2 <= p.deadline && t.done + p.pending.filter(x => x.topic === t.id).length < t.required) {
        s = act(s, 'ac_work', {topic: t.id}); p = s.accountability.current;
      }
    }
    s = validateSave(JSON.parse(JSON.stringify(act(s, 'ac_advance'))));
    assert(++weeks <= 65, 'Recovery must terminate');
  }
  assert.equal(s.accountability.current.status, 'cleared');
  assert(s.accountability.qualifications[role]);
  assert.deepEqual(role === 'county' ? s.outcome : s[role].outcome, original);
  return s;
}
