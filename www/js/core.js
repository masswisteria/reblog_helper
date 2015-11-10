'use strict';
(function ($) {
  var RH = {
    aws: {},
    post: {},
    tag: {},
    ui: {},
    util: {}
  };

  RH.Classes = {
    define:
      function define(fullClassPath, constructor, members) {
        if (members) {
          constructor.prototype = $.extend(new Object(), members);
        }

        var pathParts = fullClassPath.split('.');
        var className = pathParts.splice(pathParts.length - 1);
        var contents = {};
        contents[className] = constructor;

        RH.Namespaces.extend(pathParts, contents);
      }
  };

  RH.Functions = {
    bind:
      function bind(thisValue, fn) {
        return Function.bind.call(fn, thisValue);
      }
  };

  RH.Namespaces = {
    extend:
      function extend(path, contents) {
        var pathParts = (typeof path == 'string' ? path.split('.') : path);
        var ns = RH;
        for (var i = 0; i < pathParts.length; i++) {
          if (!ns.hasOwnProperty(pathParts[i])) {
            ns[pathParts[i]] = {};
          }
          ns = ns[pathParts[i]];
        }

        $.extend(ns, contents);
      }
  };

  RH.Logger = (function () {
    var LogLevel = {
      Debug: { value: 1, label: 'DEBUG' },
      Info: { value: 2, label: 'INFO' },
      Warn: { value: 3, label: 'WARN' },
      Error: { value: 4, label: 'ERROR' }
    };

    var globalLogLevel = LogLevel.Warn;
    var loggerLogLevels = {};

    function Logger(contextName, logLevel) {
      this.contextName = contextName;
      if (logLevel) {
        loggerLogLevels[contextName] = logLevel;
      }
    }

    var callerRegEx = /^\s*at\s*([^\(]+)\s+\(/;
    function getCaller() {
      var caller = null;
      var stackTrace = (new Error()).stack;
      if (stackTrace) {
        var line = stackTrace.split('\n')[4];
        var match = callerRegEx.exec(line);
        if (match) {
          caller = match[1];
        }
      }

      return caller || '<unknown>';
    }

    function log(logger, level, args) {
      var currentLevel = loggerLogLevels[logger.contextName] || globalLogLevel;
      if (level.value >= currentLevel.value) {
        if (args.length == 3 && typeof args[2] == 'function') {
          args = args[2].call(null);
          if (!$.isArray(args)) {
            args = [ args ];
          }
        } else {
          args = $.makeArray(args);
        }

        args = [
          (new Date()).toString(),
          '[', level.label, ']',
          logger.contextName, getCaller(), '-'
        ].concat(args);
        console.log.apply(console, args);
      }
    }

    Logger.prototype = $.extend(new Object(), {
      debug:
        function debug(/* arguments */) {
          return log(this, LogLevel.Debug, arguments);
        },

      error:
        function error(/* arguments */) {
          return log(this, LogLevel.Error, arguments);
        },

      info:
        function info(/* arguments */) {
          return log(this, LogLevel.Info, arguments);
        },

      warn:
        function warn(/* arguments */) {
          return log(this, LogLevel.Warn, arguments);
        }
    });

    Logger.LogLevel = LogLevel;
    Logger.setGlobalLogLevel = function setGlobalLogLevel(level) {
      if (level != LogLevel.Debug && level != LogLevel.Info && level != LogLevel.Warn &&
          level != LogLevel.Error) {
        throw new Error('Invalid log level: ' + (level == null ? '<null>' : level.toString()));
      }

      globalLogLevel = level;
    };
    Logger.setLogLevels = function setLogLevels(levels) {
      for (var loggerName in levels) {
        if (levels.hasOwnProperty(loggerName)) {
          loggerLogLevels[loggerName] = levels[loggerName];
        }
      }
    };

    return Logger;
  })();

  window.ReblogHelper = RH;
})(jQuery);
