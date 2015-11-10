'use strict';
(function ($, AWS, RH) {
  var logger = new RH.Logger('RH.aws.Lambda');

  var getInvocationId = (function () {
    var nextInvocationId = 0;
    return function getInvocationId() {
      return nextInvocationId++;
    };
  })();

  var lambdaApi = (function () {
    var instance = null;
    return function () {
      if (!instance) {
        instance = new AWS.Lambda({ apiVersion: '2015-03-31' });
      }
      return instance;
    };
  })();

  function handleError(message, err, callback) {
    logger.error(message, err);
    callback(message + err.toString());
  }

  var LambdaInvocation = (function () {
    function LambdaInvocation(lambda, input, callback) {
      this.lambda = lambda;
      this.input = input;
      this.callback = callback;
      this.callCount = 0;
    }

    function execute() {
      this.callCount += 1;
      var callStart = Date.now();
      var idPrefix = '[Invocation ID: ' + getInvocationId() + '] - ';
      var lambdaName = 'AWS Lambda function "' + this.lambda.functionName + '"';
      logger.info(idPrefix, 'Invoking:', lambdaName);
      logger.debug(idPrefix, 'Invoking with payload:', this.input);

      lambdaApi().invoke({
        FunctionName: this.lambda.functionName,
        Payload: JSON.stringify(this.input)
      }, RH.Functions.bind(this, function (err, data) {
        var callTime = Date.now() - callStart;
        logger.info(idPrefix, lambdaName + ' returned (' + callTime + 'ms).');
        if (err) {
          handleError(idPrefix, 'Error invoking ' + lambdaName + ':', err, this.callback);
        } else {
          var response = JSON.parse(data.Payload);
          if (response.errorMessage) {
            handleError(idPrefix, 'Error returned from ' + lambdaName + ':',
              response.errorMessage, this.callback);
          } else {
            this.callback.call(null, null, response);
          }
        }
      }));

      return this;
    }

    LambdaInvocation.prototype = $.extend(new Object(), {
      execute: execute
    });

    return LambdaInvocation;
  })();

  function Lambda(functionName) {
    this.functionName = functionName;
  }

  Lambda.setCredentials = function setCredentials(credentials) {
    lambdaApi().config.credentials = credentials;
  };

  Lambda.prototype = $.extend(new Object(), {
    invoke:
      function invoke(payload, callback) {
        var invocation = new LambdaInvocation(this, payload, callback);
        invocation.execute();
        return invocation;
      }
  });

  RH.aws.Lambda = Lambda;
})(jQuery, window.AWS, window.ReblogHelper);
