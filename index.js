'use strict';

const vm = require('vm');

function RulesEngine(config, rules) {
  const self = this;

  self.config = {
    ignoreModifications: false
  };
  Object.assign(self.config, config || {});

  self.rules = clone(rules);

  //////////////////////////////////////////////////

  function stringify(object) {
    return JSON.stringify(object, function(key, value) {
      if (typeof value === 'function') {
        value = value.toString();
        value = `(${ value })();`;
      }
      return value;
    }, 2);
  }

  function clone(object) {
    return JSON.parse(stringify(object));
  }

  function proxyObject(object, context, seen) {
    if (seen && seen.has(object)) {
      return object;
    }

    return new Proxy(object, {
      set (target, key, value) {
        if (typeof value === 'object') {
          value = proxyObject(value, context, seen);
        }
        if (target[key] !== value) {
          target[key] = value;
          context.modified = true;
        }
        return true;
      },
      deleteProperty(target, property) {
        context.modified = true;
        delete target[property];
        return true;
      }
    });
  }

  function cloneFact(fact, context, seen) {
    seen = seen || new Set();
    fact = clone(fact);

    for (const property in fact) {
      if (typeof property === 'object') {
        fact[property] = proxyObject(fact[property], context, seen);
      }
    }
    return proxyObject(fact, context, seen);
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
      modified: 0,
      result: initializeResult(initialResult),
      stop: false
    };

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
      fact = cloneFact(fact, context);

      if (index >= rules.length) {
        return Promise.resolve(fact);
      }

      const rule = self.rules[index];

      const environment = {
        rule: rule,
        rules: self.rules,
        stop: () => context.stop = true,
        next: () => {},
        fact: fact,
        result: context.result
      };

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

    return executeLoop(0).
      then(function(final) {
        return {
          fact: final,
          result: context.result
        };
      }).
      catch(function(error) {
        console.log('Error processing fact', error);
      });
  };

  self.execute.chain = function(facts, initialResult) {
    if (!Array.isArray(facts)) {
      return self.execute(fact);
    }

    const results = [ ];

    let chain = Promise.resolve();
    facts.forEach(function(fact) {
      chain = chain.then(function() {
        return self.execute(fact, initialResult).
          then(function(result) {
            if (initialResult !== undefined) {
              initialResult = result.result;
            }
            results.push(result);
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
