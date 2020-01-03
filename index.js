'use strict';

const vm = require('vm');

//////////

function clone (object, seen = new WeakMap()) {
  if (Object(object) !== object || object instanceof Function) {
    return object;
  }

  if (seen.has(object)) {
    return seen.get(object);
  }

  let result;
  if (object instanceof Buffer) {
    result = Buffer.from(object);
  } else if (object instanceof Date) {
    result = new Date(object);
  } else if (object instanceof RegExp) {
    result = new RegExp(object.source, object.flags);
  } else if (object.constructor) {
    result = new object.constructor();
  } else {
    result = Object.create(null);
  }

  seen.set(object, result);

  if (object instanceof Buffer) {
    return result;
  } else if (object instanceof Map) {
    object.forEach((value, key) => { return result.set(key, clone(value, seen)); });
  } else if (object instanceof Set) {
    object.forEach(value => { return result.add(clone(value, seen)); });
  } else {
    for (const key in object) {
      result[key] = clone(object[key], seen);
    }
  }

  return result;
}

//////////

const defaults = {
  asValue: false,
  environment: {},
  ignoreModifications: false,
  priority: 100,
  result: null
};

class RulesEngine {
  constructor (rules, options = {}) {
    this.config = Object.assign({}, defaults, options);

    this.rules = rules.filter((item) => {
      if (item.enabled !== undefined && item.enabled !== true) {
        return false;
      }

      if (!item.when || !item.then) {
        return false;
      }

      return true;
    }).map((item, index) => {
      return {
        name: item.name || `rule-${ index }`,
        when: typeof item.when === 'function' ? `(${ item.when.toString() })();` : item.when,
        then: typeof item.then === 'function' ? `(${ item.then.toString() })();` : item.then,
        priority: item.priority !== undefined ? item.priority : this.config.priority
      };
    }).
      sort((a, b) => { return a.priority - b.priority; });
  }

  watch (object, context) {
    return new Proxy(object, {
      deleteProperty: (obj, prop) => {
        if (prop in obj) {
          context.modified = true;
          delete obj[prop];
        }
      },
      get: (obj, prop) => {
        if (prop in obj && typeof obj[prop] === 'object') {
          return this.watch(obj[prop], context);
        } else if (typeof obj[prop] === 'function') {
          if (prop === 'add' && object instanceof Set) {
            return function (value) {
              if (!object.has(value)) {
                context.modified = true;
              }
              return object.add(value);
            };
          } else if (prop === 'clear' && (object instanceof Map || object instanceof Set)) {
            return function () {
              if (object.size) {
                context.modified = true;
              }
              return object.clear();
            };
          } else if (prop === 'delete' && (object instanceof Map || object instanceof Set)) {
            return function (value) {
              if (object.has(value)) {
                context.modified = true;
              }
              return object.delete(value);
            };
          } else if (prop === 'set' && object instanceof Map) {
            return function (key, value) {
              if (object.get(key) !== value) {
                context.modified = true;
              }
              return object.set(key, value);
            };
          }

          return obj[prop].bind(object);
        }
        return obj[prop];
      },
      set: (obj, prop, value) => {
        if (obj[prop] !== value) {
          context.modified = true;
        }

        obj[prop] = value;
        return value;
      }
    });
  }

  execute (facts) {
    facts = clone(facts);

    let result = this.config.result;
    if (typeof result === 'function') {
      const Constructor = result;
      result = new Constructor();
    }

    const sequence = [];

    for (let i = 0; i < this.rules.length;) {
      const rule = this.rules[i];
      const context = {};

      const environment = {
        rule,
        stop: () => { context.stop = true; },
        facts: this.watch(facts, context),
        result,
        ...this.config.environment
      };

      const sandbox = vm.createContext(environment);

      if (vm.runInContext(rule.when, sandbox)) {
        sequence.push(rule.name);

        vm.runInContext(rule.then, sandbox);
        result = sandbox.result;
      }

      if (context.stop) {
        break;
      }

      i = context.modified && !this.config.ignoreModifications ? 0 : i + 1;
    }

    return this.config.asValue ? result : {
      result,
      sequence,
      facts
    };
  }

  chain (list) {
    return list.map(facts => { return this.execute(facts); });
  }
}

module.exports = RulesEngine;
