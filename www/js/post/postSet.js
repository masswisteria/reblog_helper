'use strict';
(function ($, RH) {
  var logger = new RH.Logger('RH.post.PostSet');
  var postDb = new RH.data.IndexedDbAccessor('posts');

  function PostSet(doLoad) {
    this.doLoad = doLoad;
    this.orderedPosts = [];
    this.tagPostMap = new RH.util.Map();
    this.tagPosts = [];
    this.postIndex = null;
    this.tagIndex = null;
    this.pendingPostCallbacks = [];
    this.onTagAdded = new RH.util.Observable();
    this.isLoading = false;
    logger.debug('Starting initial load...');
    loadMore.call(this);
  }

  function tryGetNextPost(fn) {
    var index = (this.postIndex == null ? 0 : this.postIndex + 1);

    logger.debug('Trying to go to post ' + index);
    var post;
    if (index < this.orderedPosts.length) {
      post = this.orderedPosts[index];
    } else {
      logger.debug('Need to find next post.');
      for (var i = 0; i < this.tagPosts.length; i++) {
        this.tagIndex = (this.tagIndex == null ? 0 : this.tagIndex + 1) % this.tagPosts.length;
        var curPosts = this.tagPosts[this.tagIndex];
        logger.debug('Pulling post from ' + curPosts.tag.name);
        if (curPosts.index >= curPosts.posts.length) {
          logger.debug('Skipping empty tag', curPosts.tag.name);
          continue;
        }
        post = curPosts.posts.get(curPosts.index++);
        post.tagSetTag = curPosts.tag;
        this.orderedPosts.push(post);
        this.onTagAdded.fire({
          tag: curPosts.tag,
          postCount: curPosts.posts.length,
          postIndex: curPosts.index
        });
        if (curPosts.index >= curPosts.posts.length) {
          logger.debug('No more posts from ' + curPosts.tag.name);
        }
        break;
      }
    }

    if (post) {
      this.postIndex = index;
      setTimeout(function () { fn(null, post); }, 0);
      return true;
    }

    logger.debug('No more posts to show.');
    return false;
  }

  function loadMore() {
    if (this.isLoading) {
      logger.debug('Already loading more.');
      return;
    }
    logger.debug('Loading more posts...');
    this.isLoading = true;
    this.doLoad(onLoad.bind(this));
  }

  function onLoad(err, result) {
    this.isLoading = !result.isComplete;
    logger.debug('Post load complete:', err, result);
    if (err) {
      while (this.pendingPostCallbacks.length > 0) {
        var cb = this.pendingPostCallbacks.shift();
        cb(err);
      }
      return;
    } else if (result.posts.length == 0) {
      logger.debug('Post load result contained no posts for', result.tag.name);
      return;
    }

    var posts = [];
    var checkPost = function checkPost(index, cb) {
      var post = result.posts[index];
      postDb.get(post.id, function (err, res) {
        res = null;
        if (err) {
          logger.error('Error querying database for post', post, err);
        } else if (!res) {
          posts.push(new RH.post.Post(post));
        } else {
          logger.debug('Post seen before', post, res);
        }
        if (index + 1 < result.posts.length) {
          checkPost(index + 1, cb);
        } else {
          cb();
        }
      });
    };
    checkPost(0, RH.Functions.bind(this, function () {
      var tagPosts;
      if (this.tagPostMap.has(result.tag)) {
        tagPosts = this.tagPostMap.get(result.tag);
        tagPosts.posts = tagPosts.posts.addAll(posts);
      } else {
        tagPosts = { tag: result.tag, posts: new RH.util.Set(posts), index: 0 };
        this.tagPostMap.set(result.tag, tagPosts);
        this.tagPosts.push(tagPosts);
      }

      this.onTagAdded.fire({
        tag: result.tag,
        postCount: tagPosts.posts.length,
        postIndex: tagPosts.index
      });

      for (var i = 0; i < result.posts.length && this.pendingPostCallbacks.length > 0; i++) {
        var fn = this.pendingPostCallbacks.shift();
        if (!tryGetNextPost.call(this, fn)) {
          this.pendingPostCallbacks.unshift(fn);
          break;
        }
      }
    }));
  }

  function getNextPost(fn) {
    if (this.pendingPostCallbacks.length > 0) {
      logger.debug('Waiting for more posts to load, putting callback in pending.');
      this.pendingPostCallbacks.push(fn);
    } else if (!tryGetNextPost.call(this, fn)) {
      logger.debug('No next post yet, need to load more.');
      this.pendingPostCallbacks.push(fn);
      setTimeout(loadMore.bind(this), 0);
    }
  }

  function getPreviousPost() {
    if (this.postIndex > 0) {
      this.postIndex -= 1;
      return this.orderedPosts[this.postIndex];
    }

    return null;
  }

  function getTags() {
    return this.tagPostMap.keys();
  }

  PostSet.prototype = $.extend(new Object(), {
    getNextPost: getNextPost,
    getPreviousPost: getPreviousPost,
    getTags: getTags
  });

  RH.post.PostSet = PostSet;
})(jQuery, window.ReblogHelper);
