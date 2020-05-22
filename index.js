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
    object.forEach((value, key) => result.set(key, clone(value, seen)));
  } else if (object instanceof Set) {
    object.forEach(value => result.add(clone(value, seen)));
  } else {
    for (const key in object) {
      result[key] = clone(object[key], seen);
    }
  }

  return result;
}

function asString (item) {
  return typeof item === 'function' ? `(${ item.toString() })();` : item;
}

//////////

const defaults = {
  asValue: false,
  environment: {},
  ignoreModifications: false,
  priority: 100,
  result: null,
};

class RulesEngine {
  constructor (rules, options = {}) {
    this.config = Object.assign({}, defaults, options);

    this.before = []; // before execution
    this.beforeEach = []; // before each rule

    this.after = []; // after execution
    this.afterEach = []; // after each rule

    this.rules = rules.filter((item) => {
      if (item.enabled !== undefined && item.enabled !== true) {
        return false;
      }

      if (item.before) {
        this.before.push(asString(item.before));
      }
      if (item.beforeEach) {
        this.beforeEach.push(asString(item.beforeEach));
      }

      if (item.after) {
        this.after.push(asString(item.after));
      }
      if (item.afterEach) {
        this.afterEach.push(asString(item.afterEach));
      }

      if (!item.when || !item.then) {
        return false;
      }

      return true;
    }).map((item, index) => ({
      name: item.name || `rule-${ index }`,
      when: asString(item.when),
      then: asString(item.then),
      priority: item.priority !== undefined ? item.priority : this.config.priority,
    })).
      sort((a, b) => a.priority - b.priority);
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
      },
    });
  }

  execute (facts) {
    facts = clone(facts);

    let result = this.config.result;
    if (typeof result === 'function') {
      const Constructor = result;
      result = new Constructor();
    }

    const outsideContext = vm.createContext({
      result,
      ... this.config.environment,
    });

    this.before.forEach((before) => {
      vm.runInContext(before, outsideContext);
    });

    const sequence = [];

    for (let i = 0; i < this.rules.length;) {
      const rule = this.rules[i];
      const context = {};

      const environment = {
        rule,
        stop: () => { context.stop = true; },
        facts: this.watch(facts, context),
        result,
        ...this.config.environment,
      };

      const sandbox = vm.createContext(environment);

      this.beforeEach.forEach((before) => {
        vm.runInContext(before, sandbox);
      });

      if (vm.runInContext(rule.when, sandbox)) {
        sequence.push(rule.name);

        vm.runInContext(rule.then, sandbox);
        result = sandbox.result;
      }

      this.afterEach.forEach((after) => {
        vm.runInContext(after, sandbox);
      });

      if (context.stop) {
        break;
      }

      i = context.modified && !this.config.ignoreModifications ? 0 : i + 1;
    }

    this.after.forEach((after) => {
      vm.runInContext(after, outsideContext);
    });

    return this.config.asValue ? result : {
      result,
      sequence,
      facts,
    };
  }

  chain (list) {
    return list.map(facts => this.execute(facts));
  }
}

module.exports = RulesEngine;
