'use strict';
(function ($, RH) {
  var logger = new RH.Logger('RH.tag.TagClass');
  var tagClasses = new RH.util.Map();

  function TagClass(name, priority) {
    if (tagClasses.has(name)) {
      logger.warn('TagClass "' + name + '" already defined, being overwritten.');
    }

    this.name = name;
    this.priority = priority;
    tagClasses.set(name, this);
  }

  TagClass.prototype = $.extend(new Object(), {
    comparePriority:
      function comparePriority(other) {
        if (this.priority > other.priority) {
          return -1;
        } else if (this.priority < other.priority) {
          return 1;
        }
        return 0;
      },

    compareTo:
      function compareTo(other) {
        var result = this.comparePriority(other);
        return (result != 0 ? result : this.name.localeCompare(other.name));
      },

    hashCode:
      function hashCode() {
        return this.name;
      }
  });

  TagClass.get = function getTagClass(name) {
    if (tagClasses.has(name)) {
      return tagClasses.get(name);
    }
    logger.warn('No tag class defined for name "' + name + '"');
    return null;
  };

  RH.tag.TagClass = TagClass;
})(jQuery, window.ReblogHelper);
