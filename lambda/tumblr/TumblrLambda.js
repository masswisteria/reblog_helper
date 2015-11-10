'use strict';
var aws = require('aws-sdk');
var ddbm = require('dynamodb-marshaler');
var https = require('https');
var extend = require('extend');
var OAuth = require('oauth-1.0a');
var oauthSig = require('oauth-signature');
var qs = require('querystring');
var tumblr = require('tumblr.js');
var urlparse = require('url').parse;
var uuid = require('uuid');

var dynamodb = new aws.DynamoDB({ apiVersion: '2012-08-10' });

function m(onFail) {
  var withFail = (function (onSuccess) {
    return (function (err, data) {
      if (err) {
        withFail.fail(err);
      } else {
        onSuccess(data);
      }
    });
  });

  withFail.fail = function fail(err) {
    console.log(err);
    onFail(err);
  };

  return withFail;
}

function mForDb(cb) {
  return m(function (err) { cb('Error accessing database.'); });
}

function mForTumblr(cb) {
  return m(function (err) { cb('Error communicating with Tumblr.'); });
}

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

var getCredential = (function () {
  var cache = {};

  return (function getCredential(name, cb) {
    if (cache.hasOwnProperty(name)) {
      setTimeout(function () { cb(null, cache[name]); }, 0);
      return;
    }

    var l = mForDb(cb);
    dynamodb.getItem({
      TableName: 'credentials',
      Key: { name: { S: name } }
    }, l(function (data) {
      cb(null, data.Item.value.S);
    }));
  });
})();

function getSession(sessionId, cb) {
  console.log('Loading session "' + sessionId + '"');
  var l = mForDb(cb);
  dynamodb.getItem({
    TableName: 'sessions',
    Key: { sessionId: { S: sessionId } },
    ProjectionExpression: 'sessionId, userId, requestTokens'
  }, l(function (data) {
    cb(null, ddbm.unmarshalItem(data.Item));
  }));
}

function getUser(userId, cb) {
  console.log('Loading user "' + userId + '"');
  var l = mForDb(cb);
  dynamodb.getItem({
    TableName: 'users',
    Key: { userId: { S: userId } },
    ProjectionExpression: 'userId, tumblrUsers'
  }, l(function (data) {
    cb(null, ddbm.unmarshalItem(data.Item));
  }));
}

function linkTumblrAccount(userId, tokens, userInfo, cb) {
  var l = mForDb(cb);
  getUser(userId, l(function (user) {
    user.tumblrUsers[userInfo.name] = {
      token: tokens.oauth_token,
      secret: tokens.oauth_token_secret
    };
    console.log('User with linked Tumblr: ' + JSON.stringify(user));
    var marshaledUser = ddbm.marshalItem(user);
    console.log('User Item with linked Tumblr: ' + JSON.stringify(marshaledUser));
    dynamodb.putItem({
      TableName: 'users',
      Item: marshaledUser
    }, l(function (data) {
      cb(null, null);
    }));
  }));
}

function doOAuthRequest(url, extraParameters, token, cb) {
  var l = mForTumblr(cb);
  getCredential('tumblr_consumer_key', l(function (consumerKey) {
    getCredential('tumblr_consumer_secret', l(function (consumerSecret) {
      var urlParts = urlparse(url);
      /*

      var parameters = extend({
        oauth_consumer_key: consumerKey,
        oauth_nonce: uuid.v4(),
        oauth_timestamp: Date.now() / 1000,
        oauth_signature_method: 'HMAC-SHA1',
        oauth_version: '1.0'
      }, oauthParams);

      console.log('OAuth parameters: ' + JSON.stringify(parameters));
      var signature = oauthSig.generate(
        'POST',
        url,
        parameters, consumerSecret);
      var authorization = 'OAuth oauth_signature=' + signature + ',' +
        qs.stringify(parameters, ',');
      console.log('Authorization: ' + authorization);
      */

      var oauth = OAuth({
        consumer: { public: consumerKey, secret: consumerSecret },
        signature_method: 'HMAC-SHA1'
      });
      var requestData = {
        url: url,
        method: 'POST',
        data: extraParameters
      };
      var headers = oauth.toHeader(oauth.authorize(requestData, token));
      headers['Content-Length'] = '0';

      console.log('Host: "' + urlParts.host + '", Path: "' + urlParts.path + '"');
      console.log('Headers: ' + JSON.stringify(headers));
      executeHttpsRequest({
        host: urlParts.host,
        path: urlParts.path,
        method: 'POST',
        headers: headers
      }, null, cb);
    }));
  }));
}

function getTumblrRequestToken(cb) {
  var l = mForTumblr(cb);
  doOAuthRequest('https://www.tumblr.com/oauth/request_token', {
    oauth_callback: 'http://localhost:8000/tumblr_callback.html'
  }, null, l(function (data) {
    var response = qs.parse(data);
    if (!response.oauth_callback_confirmed) {
      l.fail('Tumblr failed to confirm callback URL.');
    } else {
      cb(null, response);
    }
  }));
}

function saveRequestTokenSecret(session, tokenResponse, cb) {
  session.requestTokens[tokenResponse.oauth_token] = tokenResponse.oauth_token_secret;

  var l = mForDb(cb);
  dynamodb.putItem({
    TableName: 'sessions',
    Item: ddbm.marshalItem(session)
  }, l(function (data) {
    cb(null, null);
  }));
}


function getTumblrAccessToken(session, requestToken, verifier, cb) {
  var l = mForTumblr(cb);
  var tokenSecret = session.requestTokens[requestToken];
  if (!tokenSecret) {
    l.fail('No token secret found for request token "' + token + '"');
  }
  var token = { public: requestToken, secret: tokenSecret };
  console.log('Request Token: ' + JSON.stringify(token));

  doOAuthRequest('https://www.tumblr.com/oauth/access_token', {
    oauth_token: requestToken,
    oauth_verifier: verifier
  }, token, l(function (data) {
    var response = qs.parse(data);
    console.log('Access token response: ' + JSON.stringify(response));
    if (!response.oauth_token) {
      l.fail('Failed to acquire access token from Tumblr.');
    } else {
      cb(null, { token: response.oauth_token, secret: response.oauth_token_secret });
    }
  }));
}

function getTumblrClient(token, cb) {
  var l = mForTumblr(cb);
  getCredential('tumblr_consumer_key', l(function (consumerKey) {
    getCredential('tumblr_consumer_secret', l(function (consumerSecret) {
      console.log('Creating tumblr client');
      var credentials = {
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        token: token.token,
        token_secret: token.secret
      };
      console.log('Tumblr credentials: ' + JSON.stringify(credentials));
      cb(null, tumblr.createClient(credentials));
    }));
  }));
}

function getTumblrClientFromUser(userId, tumblrUserName, cb) {
  var l = mForTumblr(cb);
  getUser(userId, l(function (user) {
    var tokens = user.tumblrUsers[tumblrUserName];
    if (!tokens) {
      l.fail('No tokens found for Tumblr user "' + tumblrUserName + '"');
    } else {
      getTumblrClient(tokens, cb);
    }
  }));
}

function getUserInfo(client, cb) {
  var l = mForTumblr(cb);
  console.log('Retreiving Tumblr user info...');
  client.userInfo(l(function (data) {
    console.log('Tumblr user info: ' + JSON.stringify(data));
    var blogs = [];
    data.user.blogs.forEach(function (blog) {
      blogs.push({
        name: blog.name,
        title: blog.title,
        url: blog.url,
        description: blog.description,
        primary: blog.primary,
        isNsfw: blog.is_nsfw,
        queue: blog.queue,
        drafts: blog.drafts
      });
    });
    var userInfo = {
      name: data.user.name,
      blogs: blogs
    };
    console.log('Trimmed user info: ' + JSON.stringify(userInfo));
    cb(null, userInfo);
  }));
}

function invokeTumblrClientApi(client, methodName, args, cb) {
  var l = mForTumblr(cb);

  args.push(l(function (data) {
    console.log('Tumblr client API "' + methodName + '" returned successfully.');
    cb(null, data);
  }));

  console.log('Invoking Tumblr client API "' + methodName + '" with "' + JSON.stringify(args) + '"...');
  client[methodName].apply(client, args);
}

function getPostsByTag(client, tag, options, cb) {
  var l = mForTumblr(cb);
  console.log('Retreiving Tumblr posts tagged "' + tag + '"...');
  client.tagged(tag, options, l(function (data) {
    console.log('Retreived ' + data.length + ' posts tagged "' + tag + '".');
    cb(null, data);
  }));
}

function getQueuedPosts(client, blogName, options, cb) {
  invokeTumblrClientApi(client, 'queue', [ blogName, options ], cb);
}

function reblogPost(client, parameters, cb) {
  var l = mForTumblr(cb);
  console.log('Reblogging post ' + parameters.postId + '...');
  client.reblog(parameters.blogName, {
    type: parameters.type,
    state: parameters.state,
    tags: parameters.tags,
    id: parameters.postId,
    reblog_key: parameters.reblogKey
  }, l(function (data) {
    console.log('Reblogged post: ' + JSON.stringify(data));
    cb(null, data);
  }));
}

exports.handler = function (event, context) {
  var l = m(function (err) { context.fail(err); });
  if (event.action == 'request_token') {
    getTumblrRequestToken(l(function (tokenResponse) {
      getSession(event.sessionId, l(function (session) {
        saveRequestTokenSecret(session, tokenResponse, l(function (r) {
          context.succeed({ oauthToken: tokenResponse.oauth_token });
        }));
      }));
    }));
  } else if (event.action == 'link_account') {
    getSession(event.sessionId, l(function (session) {
      getTumblrAccessToken(session, event.token, event.verifier, l(function (tokens) {
        getTumblrClient(tokens, l(function (client) {
          getUserInfo(client, l(function (userInfo) {
            linkTumblrAccount(session.userId, tokens, userInfo, l(function (data) {
              context.succeed(userInfo);
            }));
          }));
        }));
      }));
    }));
  } else if (event.action == 'get_user_info') {
    getSession(event.sessionId, l(function (session) {
      getTumblrClientFromUser(session.userId, event.userName, l(function (client) {
        getUserInfo(client, l(function (userInfo) {
          context.succeed(userInfo);
        }));
      }));
    }));
  } else if (event.action == 'get_tag_posts') {
    getSession(event.sessionId, l(function (session) {
      getTumblrClientFromUser(session.userId, event.userName, l(function (client) {
        getPostsByTag(client, event.tag, event.options, l(function (posts) {
          context.succeed(posts);
        }));
      }));
    }));
  } else if (event.action == 'reblog_post') {
    getSession(event.sessionId, l(function (session) {
      getTumblrClientFromUser(session.userId, event.userName, l(function (client) {
        reblogPost(client, event.parameters, l(function (response) {
          context.succeed(response);
        }));
      }));
    }));
  } else if (event.action == 'get_queued_posts') {
    getSession(event.sessionId, l(function (session) {
      getTumblrClientFromUser(session.userId, event.userName, l(function (client) {
        getQueuedPosts(client, event.blogName, event.options, l(function (posts) {
          console.log('Retrieved ' + posts.length + ' queued posts.');
          context.succeed(posts);
        }));
      }));
    }));
  } else if (event.action == 'call_api') {
    getSession(event.sessionId, l(function (session) {
      getTumblrClientFromUser(session.userId, event.userName, l(function (client) {
        invokeTumblrClientApi(client, event.api, event.args, l(function (result) {
          context.succeed(result);
        }));
      }));
    }));
  } else {
    context.fail('Unknown action: "' + event.action + '"');
  }
};
