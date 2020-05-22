'use strict';

const RulesEngine = require('../index');

const config = { result: Array };

const facts = { awesomeness: 0 };

const rules = [
  {
    enabled: true,
    priority: 10,
    when: () => facts.awesomeness >= 10,
    then: () => {
      facts.isAwesome = true;
      result.push(10);
      stop();
    },
  }, {
    enabled: true,
    priority: 10,
    when: () => facts.awesomeness < 100,
    then: () => facts.awesomeness++,
  },
];

const engine = new RulesEngine(rules, config);

console.log(engine.execute(facts));
console.log(engine.chain([ facts, facts ]));
