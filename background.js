// Copyright 2013 Andrey Logvinov

function readState() {
  var tab, i, domain;
  chrome.tabs.query({}, function(tabs) {
    for(i = 0; i < tabs.length; i++) {
      tab = tabs[i];
      domain = extractDomain(tab.url);
      setDomain(tab.id, domain);
    }
  });
}

function init() {
  data.domains = {};
  data.removing = [];
  readState();
}

function extractDomain(url) {
  if(!url) return null;
  urlParser.href = url;
  if(!allowedProtocols[urlParser.protocol]) return null;
  return urlParser.hostname;
}

function getDomain(tabId) {
  return data.domains[tabId];
}

function setDomain(tabId, domain) {
  if(domain) {
    data.domains[tabId] = domain;
  } else {
    removeDomain(tabId);
  }
}

function removeDomain(tabId) {
  var domain = data.domains[tabId];
  delete data.domains[tabId];
  return domain;
}

function updateDomain(tab) {
  var domain = extractDomain(tab.url);
  setDomain(tab.id, domain);
}

function queryTabs(windowId, domain, callback) {
  var queryInfo = {windowId: windowId, url: "*://" + domain + "/*", pinned: false};
  chrome.tabs.query(queryInfo, callback);
}

function highlightTabs(windowId, domain) {
  queryTabs(windowId, domain, function(tabs) {
    var i, tab, indices = [], highlightInfo;
    for(i = 0; i < tabs.length; i++) {
      tab = tabs[i];
      indices.push(tab.index);
    }
    highlightInfo = {windowId: windowId, tabs: indices};
    chrome.tabs.highlight(highlightInfo, function() {});
  });
}

function getOrCreateRemoving(windowId) {
  return data.removing[windowId] || (data.removing[windowId] = {});
}

function forgetRemoving(windowId) {
  delete data.removing[windowId];
}

function resetRemoving(removing, domain) {
  removing.domain = domain;
  removing.count = 0;
  removing.time = Date.now();
}

function incrementRemoving(windowId, removing) {
  removing.count++;
  if(removing.count === removeTreshold) {
    highlightTabs(windowId, removing.domain);
  }
}

function isTimeout(removing) {
  return removing.time && Date.now() - removing.time > timeWindow;
}

urlParser = document.createElement("a");
allowedProtocols = {"http:": true, "https:": true};
data = {};
removeTreshold = 2;
timeWindow = 15000;
init();

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  var windowId = removeInfo.windowId;
  var domain = removeDomain(tabId);
  var removing;
  if(!removeInfo.isWindowClosing) {
    if(!domain) {
      forgetRemoving(windowId);
    } else {
      removing = getOrCreateRemoving(windowId);
      if(removing.domain !== domain || isTimeout(removing)) {
          resetRemoving(removing, domain);
      }
      incrementRemoving(windowId, removing);
    }
  }
});

chrome.tabs.onCreated.addListener(function(tab) {
  updateDomain(tab);
  forgetRemoving(tab.windowId);
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if(tab.url !== changeInfo.url) {
    updateDomain(tab);
  }
});

chrome.windows.onRemoved.addListener(function(windowId) {
  forgetRemoving(windowId);
});
