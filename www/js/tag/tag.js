'use strict';
var Tag = (function ($, RH) {
  var logger = new RH.Logger('RH.tag.Tag');
  var matches = new RH.util.Map();
  var tags = new RH.util.Map();

  function Tag(name, tagClass) {
    if (tags.has(name)) {
      logger.warn('Tag "' + name + '" already defined, being overwritten.');
    }

    this.name = name;
    this.tagClass = tagClass;
    this.matchTags = new RH.util.Set();
    this.matchTags.add(this.name);
    this.synonymTags = new RH.util.Set();
    this.impliedTags = new RH.util.Set();
    tags.set(name, this);
  }

  Tag.prototype = {
    compareTo:
      function compareTo(other) {
        var result = this.tagClass.comparePriority(other.tagClass);
        return (result != 0 ? result : this.name.localeCompare(other.name));
      },

    hashCode:
      function hashCode() {
        return this.name;
      },

    implies:
      function implies(/* tagNames */) {
        this.impliedTags.addAll(arguments);
        return this;
      },

    matchOn:
      function matchOn(/* tagNames */) {
        for (var i = 0; i < arguments.length; i++) {
          var tagName = arguments[i];
          this.matchTags.add(tagName);
          if (!matches.has(tagName)) {
            matches.set(tagName, new RH.util.Set());
          }
          matches.get(tagName).add(this);
        }

        return this;
      },

    synonyms:
      function synonyms(tagClass/*, [shouldMatch,] tagName1, tagName2, ... tagNameN */) {
        var tagNames = $.makeArray(arguments).slice(1);
        var shouldMatch = (typeof tagNames[0] == 'boolean' ? tagNames.shift() : true);
        for (var i = 0; i < tagNames.length; i++) {
          this.synonymTags.add(new RH.tag.Tag(tagNames[i], tagClass));
        }

        if (shouldMatch) {
          this.matchOn.apply(this, tagNames);
        }

        return this;
      }
  };

  Tag.get = function getTag(name) {
    if (tags.has(name)) {
      return tags.get(name);
    }
    logger.warn('No tag defined for name "' + name + '"');
    return null;
  };

  RH.tag.Tag = Tag;
})(jQuery, window.ReblogHelper);

