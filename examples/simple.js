'use strict';

const RulesEngine = require('../index');

const config = {
  ignoreModifications: false,
  resultAsArray: true
};

const fact = {
  awesomeness: 0
};

const rules = [ {
  enabled: true,
  priority: 10,
  when: function() {
    return fact.awesomeness >= 10;
  },
  then: function() {
    fact.isAwesome = true;
    result.push(10);
    stop();
  }
}, {
  enabled: true,
  priority: 10,
  when: function() {
    return fact.awesomeness < 100;
  },
  then: function() {
    fact.awesomeness++;
    next();
  }
} ];

const R = new RulesEngine(config, rules);

R.execute(fact).
  then(function(result) {
    console.log('execute', result);
  });

R.execute.chain([ fact, fact ], true).
  then(function(results) {
    console.log('chain', results);
  });
