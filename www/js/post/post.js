'use strict';
(function ($, RH) {

  function Post(fields) {
    $.extend(this, fields);
  }

  RH.Classes.define('post.Post', Post, {
    compareTo:
      function compareTo(b) {
        if (b == null) {
          return 1;
        }

        aCode = this.hashCode();
        bCode = b.hashCode();
        if (aCode < bCode) {
          return -1;
        } else if (aCode == bCode) {
          return 0;
        } else {
          return 1;
        }
      },

    hashCode:
      function hashCode() {
        return this.id;
      }
  });
})(jQuery, window.ReblogHelper);
