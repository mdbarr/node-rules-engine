'use strict';

const RulesEngine = require('../index');

const john = new Map();
john.set('year', 'three');

const rules = [
  {
    when: () => facts.get('needs a job') === true,
    then: () => { result = 'accountant'; },
  }, {
    when: () => facts.get('year') === 'three',
    then: () => facts.set('needs a job', true),
  }, {
    when: () => facts.get('year') === 'three',
    then: () => facts.set('lives', 'on campus'),
  },
];

const engine = new RulesEngine(rules);

console.log(engine.execute(john));
