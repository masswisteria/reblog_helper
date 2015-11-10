'use strict';
(function ($, RH) {
  var logger = new RH.Logger('RH.ui.PostSetSelector', RH.Logger.LogLevel.Info);

  function PostSetSelector(postSet) {
    this.postSet = postSet;
    this.tags = [];
    this.enabledTags = new RH.util.Set();
    this.listNode = $('<ul></ul>');
    this.tagNodeMap = new RH.util.Map();
    this.postSet.onTagAdded.addObserver(RH.Functions.bind(this, postSet_onTagAdded));
    var tags = this.postSet.getTags();
    for (var i = 0; i < tags.length; i++) {
      addTag.call(this, tags[i].name);
    }
  }

  function buildLabel(tagName, postCount, postIndex) {
    return tagName + ' (' + postIndex + '/' + postCount + ' post' + (postCount == 1 ? '' : 's') + ')';
  }

  function addTag(tagName, postCount, postIndex) {
    var itemName = 'postSetSelector_' + tagName;
    var labelText = buildLabel(tagName, postCount, postIndex);
    var tagItem = $('<li></li>')
      .append($('<input type="checkbox" />')
        .attr('id', itemName)
        .attr('checked', 'checked')
        .data('tagName', tagName)
      )
      .append($('<label></label>').text(labelText).attr('for', itemName));
    this.tagNodeMap.set(tagName, tagItem);
    this.enabledTags.add(tagName);
    this.listNode.append(tagItem);
  }

  function updateTag(tagName, postCount, postIndex) {
    var tagItem = this.tagNodeMap.get(tagName);
    tagItem.find('label').text(buildLabel(tagName, postCount, postIndex));
  }

  function btnAll_click(ev) {
    var me = this;
    this.listNode.find('input[type=checkbox]').each(function (index, el) {
      el.checked = true;
      me.enabledTags.add($(el).data('tagName'));
    });
    logger.info('Enabled tags now', JSON.stringify(this.enabledTags.values()));
  }

  function btnNone_click(ev) {
    var me = this;
    this.listNode.find('input[type=checkbox]').each(function (index, el) {
      el.checked = false;
      me.enabledTags.remove($(el).data('tagName'));
    });
    logger.info('Enabled tags now', JSON.stringify(this.enabledTags.values()));
  }

  function chkTag_change(ev) {
    var chkTag = $(ev.target);
    var tagName = chkTag.data('tagName');
    if (ev.target.checked) {
      this.enabledTags.add(tagName);
    } else {
      this.enabledTags.remove(tagName);
    }
    logger.info('Enabled tag set is now:', JSON.stringify(this.enabledTags.values()));
  }

  function postSet_onTagAdded(ev) {
    logger.debug('Got onTagAdded event', ev.tag.name, ev.postCount);
    if (this.tagNodeMap.has(ev.tag.name)) {
      updateTag.call(this, ev.tag.name, ev.postCount, ev.postIndex);
    } else {
      addTag.call(this, ev.tag.name, ev.postCount, ev.postIndex);
    }
  }

  RH.Classes.define('ui.PostSetSelector', PostSetSelector, {
    getEnabledTags:
      function getEnabledTags() {
        return this.enabledTags;
      },

    renderTo:
      function renderTo(renderTarget) {
        var container = $('<div class="post-set-selector"></div>')
          .append($('<button type="button">All</button>').on('click', btnAll_click.bind(this)))
          .append($('<button type="button">None</button>').on('click', btnNone_click.bind(this)))
          .append(this.listNode);
        renderTarget.append(container);
        this.listNode.on('change', 'input', chkTag_change.bind(this));
      }
  });
})(jQuery, window.ReblogHelper);
