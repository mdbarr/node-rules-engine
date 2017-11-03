'use strict';

const RulesEngine = require('../index');

const config = {
  ignoreModifications: false,
  resultAsValue: true
};

const fact = {
  a: 10,
  b: 10,
  c: 10
};

const rules = [ {
  when: function() {
    return fact.a === fact.b;
  },
  then: function() {
    fact.aAndB = true;
  }
}, {
  when: function() {
    return fact.a === fact.c;
  },
  then: function() {
    fact.aAndC = true;
  }
}, {
  when: function() {
    return fact.aAndB && fact.aAndC;
  },
  then: function() {
    result = true;
  }
} ];

const R = new RulesEngine(config, rules);

R.execute(fact, false).
  then(function(result) {
    console.log(result);
  });
