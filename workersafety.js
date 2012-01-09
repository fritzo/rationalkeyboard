/*
  The Rational Keybard
  http://fritzo.org/keys
  git://github.com/fritzo/rationalkeyboard.git

  Copyright (c) 2012, Fritz Obermeyer
  Licensed under the MIT license:
  http://www.opensource.org/licenses/mit-license.php
*/

//------------------------------------------------------------------------------
// Global safety

var globalEval = eval;

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

var log = function (message) {
  self.postMessage({type:'log', data:message});
};

var testing = false;
var test = function (title, callback) {}; // ignore

