'use strict';
(function ($, RH) {
  var logger = new RH.Logger('RH.tag.AutoTagger');

  function AutoTagger(tagList) {
    this.tags = new RH.util.Map();
    this.matchRules = new RH.util.Map();

    var me = this;
    tagList.forEach(function (tag) {
      logger.debug('Examining match rules for ' + tag.name);
      me.tags.set(tag.name, tag);
      for (var i = 0; i < tag.matchTags.length; i++) {
        var matchTag = tag.matchTags.get(i);
        logger.debug('\t' + tag.name + ' matches on ' + matchTag);
        if (!me.matchRules.has(matchTag)) {
          me.matchRules.set(matchTag, new RH.util.Set());
        }
        me.matchRules.get(matchTag).add(tag);
      }
    });
  }

  AutoTagger.prototype = $.extend(new Object(), {
    computeTags:
      function computeTags(sourceTags) {
        logger.debug('Source tags: #' + sourceTags.join(' #'));
        var outputTags = new RH.util.Set();

        for (var i = 0; i < sourceTags.length; i++) {
          var matches = this.matchRules.get(sourceTags[i]);
          if (matches) {
            logger.debug('Tag "' + sourceTags[i] + '" matches ' + matches.length + ' tags.');
            var me = this;
            matches.forEach(function (tag) {
              logger.debug('"' + sourceTags[i] + '" matches "' + tag.name + '"');
              outputTags.add(tag);
              tag.impliedTags.forEach(function (impliedTagName) {
                var impliedTag = me.tags.get(impliedTagName);
                if (impliedTag == null) {
                  logger.warn('Tag "' + tag.name + '" implies unknown tag "' +
                    impliedTagName + '"');
                } else {
                  outputTags.add(impliedTag);
                }
              });
            });
          }
        }

        var outputTagNames = new RH.util.Set();
        var prioritizedTags = outputTags.reduce(function (set, tag) {
          set.add(tag);
          set.addAll(tag.synonymTags.values());
          return set;
        }, new RH.util.Set());
        prioritizedTags.sort(function (a, b) { return a.compareTo(b); });
        return prioritizedTags.reduce(function (arr, tag) {
          arr.push(tag.name);
          return arr;
        }, []);
      }
  });

  RH.tag.AutoTagger = AutoTagger;
})(jQuery, window.ReblogHelper);
