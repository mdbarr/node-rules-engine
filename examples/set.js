'use strict';

const RulesEngine = require('../index');

const config = {
  ignoreModifications: false
};

const john = new Set();
john.add('third year');

const rules = [ {
  when: () => fact.has('needs a job'),
  then: () => fact.add('will become an accountant')
}, {
  when: () => fact.has('third year'),
  then: () => fact.add('needs a job')
}, {
  when: () => fact.has('third year'),
  then: () => fact.add('lives on campus')
} ];

const R = new RulesEngine(config, rules);

R.execute(john).
  then(function(result) {
    console.log(result.fact);
  });
