'use strict';
(function ($, RH) {
  function Set(input) {
    this.existingItems = new RH.util.Map();
    this.clear();
    if (input) {
      this.addAll(input);
    }
  }

  Set.prototype = {
    add:
      function add(item) {
        if (!this.includes(item)) {
          this.existingItems.set(item, true);
          this.items.push(item);
          this.length += 1;
        }
        return this;
      },

    addAll:
      function addAll(items) {
        for (var i = 0; i < items.length; i++) {
          this.add(items[i]);
        }
        return this;
      },

    clear:
      function clear() {
        this.existingItems.clear();
        this.items = [];
        this.length = 0;
        return this;
      },

    get:
      function get(index) {
        return this.items[index];
      },

    has:
      function has(item) {
        return this.existingItems.has(item);
      },
    includes:
      function includes(item) {
        return this.has(item);
      },

    remove:
      function remove(item) {
        if (this.includes(item)) {
          this.existingItems.remove(item);
          for (var i = 0; i < this.items.length; i++) {
            if (this.items[i] == item) {
              this.items.splice(i, 1);
              break;
            }
          }
          this.length -= 1;
        }
        return this;
      },

    removeAll:
      function removeAll(items) {
        var toRemove = new RH.util.Map();
        for (var i = 0; i < items.length; i++) {
          this.existingItems.remove(items[i]);
          toRemove.set(items[i], true);
        }
        for (var i = 0; i < this.items.length; i++) {
          if (toRemove.has(this.items[i])) {
            this.items.splice(i, 1);
          }
        }
        this.length -= toRemove.size;
        return this;
      },

    sort:
      function sort(fn) {
        this.items.sort(fn);
        return this;
      },

    values:
      function values() {
        return this.items;
      }
  };

  /* Methods that exactly wrap Array methods. */
  [ 'forEach', 'every', 'indexOf', 'lastIndexOf', 'reduce', 'reduceRight', 'some',
    'toString', 'toLocaleString' ].forEach(function (fnName) {
    if (Array.prototype.hasOwnProperty(fnName)) {
      Set.prototype[fnName] = function (/* args */) {
        return Array.prototype[fnName].apply(this.items, arguments);
      };
    }
  });

  /* Methods that wrap Array methods but return a Set instead of an Array. */
  [ 'filter', 'map' ].forEach(function (fnName) {
    if (Array.prototype.hasOwnProperty(fnName)) {
      Set.prototype[fnName] = function (/* args */) {
        var result = Array.prototype[fnName].apply(this.items, arguments);
        return new Set(result);
      };
    }
  });

  /* Methods that wrap Array methods that add items. */
  [ 'push', 'unshift' ].forEach(function (fnName) {
    if (Array.prototype.hasOwnProperty(fnName)) {
      Set.prototype[fnName] = function (/* args */) {
        var args = $.makeArray(arguments);
        var uniqueArgs = new Set();
        for (var i = 0; i < args.length; i++) {
          if (!this.includes(args[i])) {
            uniqueArgs.add(args[i]);
            this.existingItems.set(args[i], true);
          }
        }

        return Array.prototype[fnName].apply(this.items, uniqueArgs.values());
      };
    }
  });

  /* Methods that wrap Array methods that remove items. */
  [ 'pop', 'shift' ].forEach(function (fnName) {
    if (Array.prototype.hasOwnProperty(fnName)) {
      Set.prototype[fnName] = function () {
        var item = Array.prototype[fnName].apply(this.items, arguments);
        this.existingItems.remove(item);
        return item;
      };
    }
  });

  RH.util.Set = Set;
})(jQuery, window.ReblogHelper);

