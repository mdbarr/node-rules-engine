'use strict';

const RulesEngine = require('../index');

const john = new Map();
john.set('year', 'three');

const rules = [ {
  when: () => { return facts.get('needs a job') === true; },
  then: () => { result = 'accountant'; }
}, {
  when: () => { return facts.get('year') === 'three'; },
  then: () => { return facts.set('needs a job', true); }
}, {
  when: () => { return facts.get('year') === 'three'; },
  then: () => { return facts.set('lives', 'on campus'); }
} ];

const engine = new RulesEngine(rules);

console.log(engine.execute(john));
