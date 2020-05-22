'use strict';

const RulesEngine = require('../index');

const facts = {
  a: 10,
  b: 10,
  c: 10,
};

const rules = [
  {
    when: () => facts.a === facts.b,
    then: () => {
      facts.aAndB = true;
    },
  }, {
    when: () => facts.a === facts.c,
    then: () => {
      facts.aAndC = true;
    },
  }, {
    when: () => facts.aAndB && facts.aAndC,
    then: () => {
      result = true;
    },
  },
];

const engine = new RulesEngine(rules, { asValue: true });

console.log(engine.execute(facts));
