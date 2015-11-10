'use strict';
(function ($, RH) {
  function Map(input) {
    this.clear();
    if (input) {
      this.merge(input);
    }
  }

  function getHashCode(key) {
    if (key == null) {
      return null;
    } else if (typeof key['hashCode'] == 'function') {
      return key['hashCode']();
    } else if (typeof key['hashCode'] == 'string') {
      return key['hashCode'];
    } else {
      return key.toString();
    }
  }

  Map.prototype = {
    clear: function clear() {
      this.keyList = [];
      this.items = {};
      this.size = 0;
      return this;
    },

    remove: function remove(key) {
      delete this.items[getHashCode(key)];
      for (var i = 0; i < this.keyList.length; i++) {
        if (this.keyList[i] == key) {
          this.keyList.splice(i, 1);
          break;
        }
      }
      this.size -= 1;
      return this;
    },

    entries: function entries() {
      var result = [];
      for (var i = 0; i < this.keyList.length; i++) {
        result.push([ this.keyList[i], this.get(this.keyList[i]) ]);
      }
      return result;
    },

    forEach: function forEach(fn, thisArg) {
      for (var i = 0; i < this.keyList.length; i++) {
        fn.apply(thisArg, [ this.get(this.keyList[i]), this.keyList[i], this ]);
      }
    },

    get: function get(key) {
      return this.items[getHashCode(key)];
    },

    has: function has(key) {
      return this.items.hasOwnProperty(getHashCode(key));
    },

    keys: function keys() {
      return this.keyList;
    },

    merge: function merge(map) {
      if (typeof map['keys'] == 'function') {
        var keys = map.keys();
        for (var i = 0; i < keys.length; i++) {
          this.set(keys[i], map[keys[i]]);
        }
      } else if (typeof map['length'] == 'number') {
        for (var i = 0; i < map.length; i++) {
          this.set(map[i][0], map[i][1]);
        }
      } else {
        for (var key in map) {
          if (map.hasOwnProperty(key)) {
            this.set(key, map[key]);
          }
        }
      }

      return this;
    },

    set: function set(key, value) {
      var hashCode = getHashCode(key);
      if (!this.items.hasOwnProperty(hashCode)) {
        this.items[getHashCode(key)] = value;
        this.keyList.push(key);
        this.size += 1;
      }
      return this;
    },

    values: function values() {
      var arr = [];
      for (var i = 0; i < this.keyList.length; i++) {
        arr.push(this.get(this.keyList[i]));
      }
      return arr;
    }
  };

  RH.util.Map = Map;
})(jQuery, window.ReblogHelper);

