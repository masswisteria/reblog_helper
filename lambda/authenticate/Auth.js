'use strict';
var aws = require('aws-sdk');
var ddbm = require('dynamodb-marshaler');
var https = require('https');
var qs = require('querystring');
var uuid = require('uuid');

var dynamodb = new aws.DynamoDB({ apiVersion: '2012-08-10' });

function executeHttpsRequest(request, body, cb, jsonResponse) {
  var exchangeReq = https.request(request, function (res) {
    var data = '';
    res.setEncoding('utf8');
    res.on('data', function (d) {
      data += d;
    });
    res.on('error', function (err) {
      console.log('Error executing HTTPS ' + request.method + ' request to https://' + request.host + ': ' + err);
      cb('Error executing request to remote server.');
    });
    res.on('end', function () {
      console.log('Received response: ' + data.length + ' characters.');
      var response = jsonResponse ? JSON.parse(data) : data;
      cb(null, response);
    });
  });
  if (body) {
    exchangeReq.write(body);
  }
  console.log('Executing HTTPS ' + request.method + ' request to https://' + request.host + '...');
  exchangeReq.end();
}

function getCredential(name, cb) {
  var l = m(onDbFail(cb));
  dynamodb.getItem({
    TableName: 'credentials',
    Key: { name: { S: name } }
  }, l(function (data) {
    cb(null, data.Item.value.S);
  }));
}

function getTokensWithGrant(grantType, grantField, grantValue, cb) {
  console.log('Getting tokens with ' + grantType + '.');
  getCredential('lwa_client_secret', function (err, secret) {
    if (err) {
      cb(err);
    } else if (!secret) {
      console.log('No client secret found.');
      cb('Error with Login with Amazon configuration.');
    } else {
      var parameters = {
        grant_type: grantType,
        client_id: 'amzn1.application-oa2-client.c9602ff065cb46d6ac0f2fec71641330',
        client_secret: secret
      };
      parameters[grantField] = grantValue;
      var formData = qs.stringify(parameters).replace('%7C', '|');
      executeHttpsRequest({
        host: 'api.amazon.com',
        path: '/auth/o2/token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'Content-Length': formData.length
        }
      }, formData, cb, true);
    }
  });
}

function createSession(refreshToken, userId, cb) {
  var sessionId = uuid.v4();
  console.log('Creating session: ' + sessionId);

  var l = m(onDbFail(cb));
  dynamodb.putItem({
    TableName: 'sessions',
    Item: ddbm.marshalItem({
      sessionId: sessionId,
      userId: userId,
      refreshToken: refreshToken,
      requestTokens: { }
    })
  }, l(function (data) {
    cb(null, sessionId);
  }));
}

function getTokensFromSession(sessionId, cb) {
  var l = m(onDbFail(cb));
  dynamodb.getItem({
    TableName: 'sessions',
    Key: { sessionId: { S: sessionId } }
  }, l(function (data) {
    getTokensWithGrant('refresh_token', 'refresh_token', data.Item.refreshToken.S, cb);
  }));
}

function getProfileInfo(accessToken, cb) {
  executeHttpsRequest({
    host: 'api.amazon.com',
    path: '/user/profile',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + accessToken }
  }, null, cb, true);
}

function getUser(profile, cb) {
  var l = m(onDbFail(cb));
  dynamodb.getItem({
    TableName: 'users',
    Key: { userId: { S: profile.user_id } }
  }, l(function (data) {
    var user = ddbm.unmarshalItem(data.Item);
    if (user == null ||
        user.name == null || user.name != profile.name ||
        user.email == null || user.email != profile.email) {
      if (user == null || user.userId == null) {
        console.log('Creating user entry for ' + profile.user_id);
        user = { userId: profile.user_id, tumblrUsers: { } };
      } else {
        console.log('Updating user entry for ' + profile.user_id);
      }
      user.name = profile.name;
      user.email = profile.email;
      dynamodb.putItem({
        TableName: 'users',
        Item: ddbm.marshalItem(user)
      }, l(function (data) {
        cb(null, user);
      }));
    } else {
      console.log('Loaded user entry for ' + profile.user_id);
      cb(null, user);
    }
  }));
}

function getMapKeys(map) {
  var keys = [];
  for (var k in map) {
    if (map.hasOwnProperty(k)) {
      keys.push(k);
    }
  }
  return keys.sort();
}

function sendSuccessfulResponse(context, sessionId, user, accessToken) {
  context.succeed({
    sessionId: sessionId,
    accessToken: accessToken,
    user: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      tumblrUsers: getMapKeys(user.tumblrUsers)
    }
  });
}

function m(onFail) {
  return (function (onSuccess) {
    return (function (err, data) {
      if (err) {
        console.log(err);
        onFail(err);
      } else {
        onSuccess(data);
      }
    });
  });
}

function onDbFail(cb) {
  return (function (err) { cb('Error accessing database.'); });
}

exports.handler = function (event, context) {
  console.log('Received authentication event.');

  var l = m(context.fail.bind(context));
  if (event.code) {
    getTokensWithGrant('authorization_code', 'code', event.code, l(function (tokens) {
      getProfileInfo(tokens.access_token, l(function (profile) {
        getUser(profile, l(function (user) {
          createSession(tokens.refresh_token, user.userId, l(function (sessionId) {
            sendSuccessfulResponse(context, sessionId, user, tokens.access_token);
          }));
        }));
      }));
    }));
  } else if (event.sessionId) {
    console.log('Resuming session "' + event.sessionId + '"');
    getTokensFromSession(event.sessionId, l(function (tokens) {
      getProfileInfo(tokens.access_token, l(function (profile) {
        getUser(profile, l(function (user) {
          sendSuccessfulResponse(context, event.sessionId, user, tokens.access_token);
        }));
      }));
    }));
  } else {
    context.fail('Request did not contain valid authentication input.');
  }
};
