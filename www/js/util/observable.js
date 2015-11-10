'use strict';
(function ($, RH) {
  function Observer(fn, data) {
    this.fn = fn;
    this.data = data;
  }

  function Event(observable, context, data) {
    $.extend(this, context);
    this.data = data;
    this.observable = observable;
  }

  function Observable(host) {
    this.host = host;
    this.observers = [];
  }

  RH.Classes.define('util.Observable', Observable, {
    addObserver:
      function addObserver(fn, data) {
        this.observers.push(new Observer(fn, data));
        return this;
      },

    fire:
      function fire(context) {
        for (var i = 0; i < this.observers.length; i++) {
          var observer = this.observers[i];
          var me = this;
          setTimeout(function () {
            observer.fn.call(null, new Event(me, context, observer.data));
          }, 0);
        }
      }
  });
})(jQuery, window.ReblogHelper);
