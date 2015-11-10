'use strict';
(function ($, RH) {
  var logger = new RH.Logger('RH.tag.TagSet');
  var tumblrLambda = new RH.aws.Lambda('Tumblr');

  var TagSearchTerm = (function () {
    function TagSearchTerm(tag, searchTerm) {
      this.tag = tag;
      this.searchTerm = searchTerm;
    }

    TagSearchTerm.prototype = $.extend(new Object(), {
      hashCode:
        function hashCode() {
          return this.searchTerm;
        }
    });

    return TagSearchTerm;
  })();

  function TagSet(tags) {
    logger.debug('TagSet tags:', tags);
    this.nextIndex = null;
    this.loadCount = 0;
    this.tags = constructSearchTerms(this, tags);
    logger.debug('TagSet search terms:', JSON.stringify(this.tags.map(
            function (a) { return a.searchTerm; })));
  }

  function constructSearchTerms(tagSet, tags) {
    var terms = new RH.util.Set();
    for (var i = 0; i < tags.length; i++) {
      var tag = tags[i];
      terms.add(new TagSearchTerm(tag, tag.name));
      tag.matchTags.forEach(function (matchTagName) {
        terms.add(new TagSearchTerm(tag, matchTagName));
      });
      tag.synonymTags.forEach(function (synonymTag) {
        terms.add(new TagSearchTerm(tag, synonymTag.name));
      });
    }
    return terms.values();
  }

  function getPostsForTag(tagSet, sessionId, tumblrUserName, fn) {
    var tag = tagSet.tags[tagSet.nextIndex];
    if (!tag) {
      return;
    }

    tagSet.nextIndex += 1;
    tagSet.loadCount += 1;

    logger.debug('Getting posts tagged #' + tag.searchTerm, 'Next Index now', tagSet.nextIndex);
    tumblrLambda.invoke({
      action: 'get_tag_posts',
      sessionId: sessionId,
      userName: tumblrUserName,
      tag: tag.searchTerm,
      options: {
        limit: 20
      }
    }, function get_tag_postsLambdaCallback(err, posts) {
      tagSet.loadCount -= 1;
      var isComplete = tagSet.loadCount == 0 && tagSet.nextIndex == tagSet.tags.length;
      if (err) {
        fn(err, { isComplete: isComplete });
      } else {
        logger.debug('Got ' + posts.length + ' posts tagged #' + tag.searchTerm);
        fn(null, { posts: posts, tag: tag.tag, isComplete: isComplete });
        if (tagSet.nextIndex < tagSet.tags.length) {
          if (tagSet.loadCount < 5) {
            logger.debug('Queueing next load...');
            setTimeout(function () {
              getPostsForTag(tagSet, sessionId, tumblrUserName, fn);
            }, 3000);
          }
        } else {
          logger.info('Finished loading ' + tagSet.nextIndex + ' tag search terms.');
        }
      }
    });
  }

  TagSet.prototype = $.extend(new Object(), {
    getPosts:
      function getPosts(sessionId, tumblrUser) {
        this.nextIndex = 0;
        var me = this;
        return new RH.post.PostSet(RH.Functions.bind(this, function (cb) {
          while (this.loadCount < 5 && this.nextIndex < this.tags.length) {
            getPostsForTag(this, sessionId, tumblrUser.name, cb);
          }
        }));
      }
  });

  RH.tag.TagSet = TagSet;
})(jQuery, window.ReblogHelper);
