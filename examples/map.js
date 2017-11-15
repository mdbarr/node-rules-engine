'use strict';

const RulesEngine = require('../index');

const config = {
  ignoreModifications: false
};

const john = new Map();
john.set('year', 'three');

const rules = [ {
  when: () => (fact.get('needs a job') === true),
  then: () => fact.set('job', 'accountant')
}, {
  when: () => (fact.get('year') === 'three'),
  then: () => fact.set('needs a job', true)
}, {
  when: () => (fact.get('year') === 'three'),
  then: () => fact.set('lives', 'on campus')
} ];

const R = new RulesEngine(config, rules);

R.execute(john).
  then(function(result) {
    console.log(result.fact);
  });
