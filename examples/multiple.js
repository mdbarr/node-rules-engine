'use strict';

const RulesEngine = require('../index');

const facts = {
  a: 10,
  b: 10,
  c: 10
};

const rules = [ {
  when () {
    return facts.a === facts.b;
  },
  then () {
    facts.aAndB = true;
  }
}, {
  when () {
    return facts.a === facts.c;
  },
  then () {
    facts.aAndC = true;
  }
}, {
  when () {
    return facts.aAndB && facts.aAndC;
  },
  then () {
    result = true;
  }
} ];

const engine = new RulesEngine(rules, { asValue: true });

console.log(engine.execute(facts));
