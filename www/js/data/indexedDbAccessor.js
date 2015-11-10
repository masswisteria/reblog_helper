'use strict';
(function ($, RH) {
  var logger = new RH.Logger('IndexedDbAccessor', RH.Logger.LogLevel.Info);
  var DB_NAME = 'ReblogHelper';
  var CURRENT_VERSION = 1;
  var db = null;
  var onReady = new RH.util.Observable(new Object());

  (function () {
    var request = window.indexedDB.open(DB_NAME, CURRENT_VERSION);
    request.onupgradeneeded = function (ev) {
      logger.info('Upgrading database:', ev);
      var db = ev.target.result;
      if (ev.oldVersion == 0) {
        db.createObjectStore('posts', { keyPath: 'id' });
      }
    };

    request.onsuccess = function (ev) {
      logger.info('Database opened successfully:', ev);
      db = ev.target.result;
      onReady.fire({});
    };

    request.onerror = function (ev) {
      logger.error('Failed to open the database:', ev);
    };
  })();

  var whenReady = (function () {
    var pending = [];
    var isReady = false;

    function whenReady(fn) {
      function callFn() {
        logger.debug('Invoking whenReady argument');
        fn.call(null);
      }

      if (isReady) {
        logger.debug('DB is ready, triggering request execution.');
        setTimeout(callFn, 0);
      } else {
        logger.debug('DB not ready yet, queueing request.');
        onReady.addObserver(callFn);
      }
    }

    onReady.addObserver(function () {
      logger.info('DB is now ready.');
      isReady = true;
    });

    return whenReady;
  })();

  function IndexedDbAccessor(model) {
    this.model = model;
  }

  function executeRequest(me, fn, cb, forReadWrite) {
    forReadWrite = !!forReadWrite;
    whenReady(RH.Functions.bind(me, function () {
      var result = null;
      var tx = db.transaction(me.model, forReadWrite ? 'readwrite' : 'readonly');

      function sendResult() {
        cb && cb.call(null, tx.error, result);
      }
      tx.oncomplete = function () {
        logger.debug('tx complete');
        sendResult();
      };
      tx.onerror = function () {
        logger.debug('tx error');
        sendResult();
      };

      var store = tx.objectStore(me.model);
      var request = fn.call(me, store);
      request.onerror = function (ev) {
        logger.debug('request error', ev);
        tx.abort();
        sendResult();
      };
      request.onsuccess = function (ev) {
        logger.debug('request success', ev);
        result = ev.target.result || null;
      };
    }));
  }

  RH.Classes.define('data.IndexedDbAccessor', IndexedDbAccessor, {
    add:
      function add(instance, cb) {
        executeRequest(this, function (store) {
          return store.add(instance);
        }, cb, true);

        return this;
      },

    get:
      function get(id, cb) {
        executeRequest(this, function (store) {
          return store.get(id);
        }, cb);

        return this;
      }
  });
})(jQuery, window.ReblogHelper);
