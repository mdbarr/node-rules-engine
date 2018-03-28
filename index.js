'use strict';

const vm = require('vm');
const track = require('./lib/track');
const deepClone = require('./lib/deep-clone');

function RulesEngine(config, rules) {
  const self = this;

  const INITIAL_RULE_INDEX = 0;

  self.config = {
    defaultPriority: 100,
    ignoreModifications: false,
    environment: {}
  };

  Object.assign(self.config, config || {});

  //////////////////////////////////////////////////

  function configureRules() {
    self.rules = deepClone(rules);

    self.rules = self.rules.filter(function(rule) {
      if (rule.enabled !== undefined && !rule.enabled) {
        return false;
      }

      if (!rule.when || !rule.then) {
        return false;
      }

      return true;
    });

    self.rules.forEach(function (rule, index) {
      rule.name = rule.name || `rule-${ index }`;

      if (typeof rule.when === 'function') {
        rule.when = `(${ rule.when.toString() })();`;
      }

      if (typeof rule.then === 'function') {
        rule.then = `(${ rule.then.toString() })();`;
      }

      rule.priority = rule.priority || config.defaultPriority;
    });

    self.rules.sort((a, b) => a.priority - b.priority);
  }

  configureRules();

  //////////////////////////////////////////////////

  function cloneFact(fact, context) {
    fact = deepClone(fact);
    return track(fact, context);
  }

  //////////////////////////////////////////////////

  function initializeResult(initial) {
    if (self.config.resultAsArray) {
      if (Array.isArray(initial)) {
        return initial.slice();
      } else {
        return [];
      }
    } else if (self.config.resultAsMap) {
      if (initial instanceof Map) {
        return new Map(initial);
      } else {
        return new Map();
      }
    } else if (self.config.resultAsSet) {
      if (initial instanceof Set) {
        return new Set(initial);
      } else {
        return new Set();
      }
    } else if (self.config.resultAsValue) {
      return initial;
    }

    const result = {
      value: undefined,
      array: [],
      set: new Set(),
      map: new Map()
    };

    if (initial !== undefined) {
      if (typeof initial === 'object') {
        if (initial instanceof Set) {
          result.set = new Set(initial);
        } else if (initial instanceof Map) {
          result.map = new Map(initial);
        } else if (initial instanceof Array) {
          result.array = initial.slice();
        } else {
          Object.assign(result, initial);
        }
      } else {
        result.value = initial;
      }
    }
    return result;
  }

  //////////////////////////////////////////////////

  self.execute = function(fact, initialResult) {
    const context = {
      modified: false,
      result: initializeResult(initialResult),
      sequence: [ ],
      stop: false
    };

    fact = cloneFact(fact, context);
    context.modified = false;

    function evaluateConditional(rule, sandbox) {
      return new Promise(function(resolve) {
        const when = vm.runInContext(rule.when, sandbox);
        return resolve(when);
      });
    }

    function evaluateConsequence(rule, sandbox) {
      return new Promise(function(resolve) {
        const then = vm.runInContext(rule.then, sandbox);
        return resolve(then);
      });
    }

    function ruleExecutor(index) {
      if (index >= rules.length) {
        return Promise.resolve(fact);
      }

      const rule = self.rules[index];

      const environment = {};

      Object.assign(environment, self.config.environment);
      Object.assign(environment, {
        rule: rule,
        stop: () => context.stop = true,
        next: () => {},
        fact: fact,
        result: context.result
      });

      Object.defineProperty(environment, 'result', {
        get: function() {
          return context.result;
        },
        set: function(y) {
          if (typeof context.result === 'object') {
            context.result.value = y;
          } else {
            context.result = y;
          }
        },
        configurable: false,
        enumerable: true
      });

      const sandbox = vm.createContext(environment);

      return evaluateConditional(rule, sandbox).
        then(function(when) {
          if (when) {
            context.sequence.push(rule.name);
            return evaluateConsequence(rule, sandbox);
          }
          return true;
        });
    }

    function executeLoop(index) {
      return ruleExecutor(index).
        then(function() {
          if (context.stop) {
            return fact;
          } else if (context.modified && !self.config.ignoreModifications) {
            context.modified = false;
            index = 0;
          } else {
            index++;
          }

          if (index >= self.rules.length) {
            return fact;
          } else {
            return executeLoop(index);
          }
        });
    }

    return executeLoop(INITIAL_RULE_INDEX).
      then(function(final) {
        return {
          fact: track.untrack(final),
          result: context.result,
          sequence: context.sequence
        };
      }).
      catch(function(error) {
        console.log('Error processing fact', error);
      });
  };

  self.execute.chain = function(facts, initialResult) {
    if (!Array.isArray(facts)) {
      return self.execute(facts);
    }

    const results = {
      facts: [],
      sequences: []
    };
    if (!initialResult) {
      results.results = [];
    }

    let chain = Promise.resolve();
    facts.forEach(function(fact) {
      chain = chain.then(function() {
        return self.execute(fact, initialResult).
          then(function(result) {
            if (initialResult !== undefined) {
              initialResult = result.result;
            }
            results.facts.push(result.fact);
            results.sequences.push(result.sequence);
            if (initialResult) {
              results.result = result.result;
            } else {
              results.results.push(result.result);
            }
          });
      });
    });
    return chain.then(function() {
      return results;
    });
  };

  return self;
}

module.exports = RulesEngine;
