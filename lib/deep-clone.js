'use strict';

function deepClone(object, seen = new WeakMap()) {
  // Primitives (treat Functions as primitives)
  if (Object(object) !== object || object instanceof Function) {
    return object;
  }

  // Cyclic references
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
    object.forEach((value, key) => result.set(key, deepClone(value, seen)));
  } else if (object instanceof Set) {
    object.forEach(value => result.add(deepClone(value, seen)));
  } else {
    for (const key in object) {
      result[key] = deepClone(object[key], seen);
    }
  }

  return result;
}

module.exports = deepClone;
