function activateBookmarkFindModeToOpenInNewTab() {
  BookmarkMode.openInNewTab(true);
  BookmarkMode.enable();
}

function activateBookmarkFindMode() {
  BookmarkMode.openInNewTab(false);
  BookmarkMode.enable();
}

(function() {
  // so when they let go of shift after hitting capital "B" it won't
  // untoggle it
  var shiftWasPressedWhileToggled = false;

  var BookmarkMode = {
    isEnabled: function() {
      return this.enabled;
    },
    openInNewTab: function(newTab) {
      this.newTab = newTab;
    },
    invertNewTabSetting: function() {
      this.newTab = !this.newTab;
      if(this.isEnabled()) {
        this.renderHUD();
      }
    },
    enable: function() {
      this.enabled = true;

      if(!this.initialized) {
        initialize.call(this);
      }

      handlerStack.push({
        keydown: this.onKeydown,
        keypress: this.onKeypress,
        keyup: this.onKeyup
      });

      this.renderHUD();
      this.completionDialog.show();
    },
    disable: function() {
      this.enabled = false;
      this.completionDialog.hide();
      handlerStack.pop();
      HUD.hide();
    },
    renderHUD: function() {
      if (this.newTab)
        HUD.show("Open bookmark in new tab");
      else
        HUD.show("Open bookmark in current tab");
    }

  }

  // private method
  var initialize = function() {
    var self = this;
    self.initialized = true;

    self.completionDialog = new CompletionDialog({
      source: findBookmarks,

      onSelect: function(selection) {
        if (selection.type === "tab") {
          chrome.extension.sendRequest({handler:"selectTabById", tabId:selection.id});
        }
        else {
          var url = utils.ensureUrl(selection.url);

          var isABookmarklet = function(url) { return url.indexOf("javascript:") === 0; }

          if (!self.newTab || isABookmarklet(url))
            window.location = url;
          else
            window.open(url);
        }

        self.disable();
      },

      renderOption: function(searchString, selection) {
        var displaytext = selection.title + " (" + selection.url + ")"
        if (selection.type === "tab")
          displaytext = "[Switch] " + displaytext;
        return displaytext.split(new RegExp(searchString, "i")).join("<strong>"+searchString+"</strong>")
      },

      selectionToText: function(selection) {
        return selection.url;
      },

      initialSearchText: "Type a bookmark name or URL"
    })

    self.onKeydown = function(event) {
      // shift key will toggle between new tab/same tab
      if (event.keyCode == keyCodes.shiftKey) {
        self.invertNewTabSetting();
        shiftWasPressedWhileToggled = true;
        return;
      }

      var keyChar = getKeyChar(event);
      if (!keyChar)
        return;

      // TODO(philc): Ignore keys that have modifiers.
      if (isEscape(event))
        self.disable();
    };

    self.onKeypress = function(event) { return false; }

    self.onKeyup = function(event) {
      // shift key will toggle between new tab/same tab
      if (event.keyCode == keyCodes.shiftKey && shiftWasPressedWhileToggled) {
        self.invertNewTabSetting();
        shiftWasPressedWhileToggled = false;
      }
    };
  }

  var findBookmarks = function(queryId, searchString, callback) {
    if (searchString === "") {
      callback(queryId, []);
      return;
    }

    var port = chrome.extension.connect({ name: "getBookmarks" });
    var expectedResponses = 3;
    port.onMessage.addListener(function(msg) {
      for (var i in msg.records)
        msg.records[i].type = msg.recordType;
      callback(msg.queryId, msg.records);
      if (--expectedResponses == 0)
        port = null;
    })
    port.postMessage({query:searchString, queryId: queryId});
  };

  window.BookmarkMode = BookmarkMode;
}())
