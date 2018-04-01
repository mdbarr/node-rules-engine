'use strict';

class TrackedMap extends Map {
  constructor (map, context, seen) {
    super(map);

    this.context = context;
    this.seen = seen;

    seen.set(map, this);
    seen.set(this, this);
  }

  clear () {
    if (this.context && !super.size > 0) {
      this.context.modified = true;
    }
    return super.clear();
  }

  delete (key) {
    if (this.context && super.has(key)) {
      this.context.modified = true;
    }
    return super.delete(key);
  }

  set (key, value) {
    if (this.context && (!super.has(key) || super.get(key) !== value)) {
      this.context.modified = true;
    }
    return super.set(key, value);
  }
}

class TrackedSet extends Set {
  constructor (set, context, seen) {
    super(set);

    this.context = context;
    this.seen = seen;

    seen.set(set, this);
    seen.set(this, this);
  }

  add (value) {
    if (this.context && !super.has(value)) {
      this.context.modified = true;
    }
    return super.add(value);
  }

  clear () {
    if (this.context && !super.size > 0) {
      this.context.modified = true;
    }
    return super.clear();
  }

  delete (value) {
    if (this.context && super.has(value)) {
      this.context.modified = true;
    }
    return super.delete(value);
  }
}

function trackedObject(object, context, seen) {
  const result = new Proxy(object, {
    set (target, key, value) {
      value = track(value, context, seen);

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

  seen.set(object, result);
  seen.set(result, result);

  for (const item in object) {
    object[item] = track(object[item], context, seen);
  }

  return result;
}

function track(anything, context, seen = new WeakMap()) {
  if (seen.has(anything)) {
    return seen.get(anything);
  }

  if (anything instanceof Map) {
    return new TrackedMap(anything, context, seen);
  } else if (anything instanceof Set) {
    return new TrackedSet(anything, context, seen);
  } else if (typeof anything === 'object' && anything !== null && anything !== undefined) {
    return trackedObject(anything, context, seen);
  }

  return anything;
}

track.untrack = function(anything) {
  if (anything instanceof TrackedMap) {
    return new Map(anything);
  } else if (anything instanceof TrackedSet) {
    return new Set(anything);
  } else if (typeof anything === 'object' && anything !== null && anything !== undefined) {
    let untracked;
    if (anything.constructor) {
      untracked = new anything.constructor();
    } else {
      untracked = Object.create(null);
    }

    for (const item in anything) {
      untracked[item] = track.untrack(anything[item]);
    }

    return untracked;
  } else {
    return anything;
  }
};

module.exports = track;
