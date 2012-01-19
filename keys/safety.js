/*
 * Tools for safe coding and unit testing in the main window.
 * (see workersafety.js for analogs in web workers)
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

//------------------------------------------------------------------------------
// Global safety & testing

var globalEval = eval;
'use strict';

var TodoException = function (message) {
  this.message = message || '(unfinished code)';
};
TodoException.prototype.toString = function () {
  return 'TODO: ' + this.message;
};
var TODO = function (message) {
  throw new TodoException(message);
};

var AssertException = function (message) {
  this.message = message || '(unspecified)';
};
AssertException.prototype.toString = function () {
  return 'Assertion Failed: ' + this.message;
};
var assert = function (condition, message) {
  if (!condition) {
    throw new AssertException(message);
  }
};

var assertEval = function (message) {
  assert(eval(message), message);
};
var assertEqual = function (actual, expected, message) {
  if (!(actual instanceof String) || !(expected instanceof String)) {
    actual = JSON.stringify(actual);
    expected = JSON.stringify(expected);
  }
  assert(actual === expected,
    (message || '') +
    '\n    actual = ' + actual +
    '\n    expected = ' + expected);
};

var log;
if (window.console && window.console.log) {
  log = function (message) { console.log(message); };
} else {
  log = function (message) {}; // ignore
}

var testing = false;
var test = function (title, callback) {
  callback = callback || function(){ globalEval(title); };
  callback.title = title;
  test._all.push(callback);
};
test._all = [];
test.runAll = function () {

  $('<style type=text/css>#testLog p{margin: 0px;}</style>').appendTo('head');
  var $log = $(document.createElement('div'))
    .attr('id', 'testLog')
    .css({
          position: 'absolute',
          width: '80%',
          left: '10%',
          color: 'black',
          'background-color': 'white',
          border: 'solid 8px white',
          'border-radius': '16px',
          opacity: '0.9',
          'font-size': '10pt',
          'font-family': 'Courier,Courier New,Nimbus Mono L,fixed,monospace',
          'z-index': '99'
        })
    .appendTo('body');

  var oldLog = log;
  log = function (message) {
    $(document.createElement('p')).text(message).appendTo($log);
    oldLog(message);
  };

  log('[ Running ' + test._all.length + ' unit tests ]');
  testing = true;

  var failCount = 0;
  for (var i = 0; i < test._all.length; ++i) {
    var callback = test._all[i];
    try {
      callback();
    }
    catch (err) {
      log('FAILED ' + callback.title + '\n  ' + err);
      failCount += 1;
    }
  }

  if (failCount) {
    log('[ failed ' + failCount + ' tests ]');
    $log.css({
          'background-color': '#ffaaaa',
          'border-color': '#ffaaaa',
        });
  } else {
    log('[ passed all tests :) ]');
    $log.css({
          'background-color': '#aaffaa',
          'border-color': '#aaffaa',
        });
  }
};

