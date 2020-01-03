'use strict';

const RulesEngine = require('../index');

const john = new Set();
john.add('third year');

const rules = [ {
  when: () => { return facts.has('needs a job'); },
  then: () => { result = 'will become an accountant'; }
}, {
  when: () => { return facts.has('lives on campus'); },
  then: () => { return facts.add('needs a job'); }
}, {
  when: () => { return facts.has('third year'); },
  then: () => { return facts.add('lives on campus'); }
} ];

const engine = new RulesEngine(rules);

console.log(engine.execute(john));
