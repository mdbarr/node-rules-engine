'use strict';

const RulesEngine = require('../index');

const john = new Set();
john.add('third year');

const rules = [
  {
    when: () => facts.has('needs a job'),
    then: () => { result = 'will become an accountant'; },
  }, {
    when: () => facts.has('lives on campus'),
    then: () => facts.add('needs a job'),
  }, {
    when: () => facts.has('third year'),
    then: () => facts.add('lives on campus'),
  },
];

const engine = new RulesEngine(rules);

console.log(engine.execute(john));
