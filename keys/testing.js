/**
 * Active unit testing.
 * (see notesting.js for inactive testing)
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var testing = false;

/** @const */
var test = function (title, callback) {
  callback = callback || function(){ globalEval(title); };
  callback.title = title;
  test._all.push(callback);
};
test._all = [];
test.runAll = function (onExit) {

  var $log = $('<div>')
    .attr({id:'testLog'})
    .css({
          'position': 'absolute',
          'width': '100%',
          'top': '0%',
          'left': '0%',
          'text-align': 'left',
          'color': 'black',
          'background-color': 'white',
          'border': 'solid 8px white',
          'font-size': '10pt',
          'font-family': 'Courier,Courier New,Nimbus Mono L,fixed,monospace',
          'z-index': '99'
        })
    .appendTo(document.body);

  var oldLog = log;
  log = function (message) {
    $('<pre>').text(message).appendTo($log);
    oldLog(message);
  };

  if (onExit !== undefined) {

    $log.css({
          'width': '80%',
          'left': '10%',
          'border-radius': '16px',
          });

    var $shadow = $('<div>')
      .css({
            'position': 'fixed',
            'width': '100%',
            'height': '100%',
            'top': '0%',
            'left': '0%',
            'background-color': 'black',
            'opacity': '0.5',
            'z-index': '98'
          })
      .attr({title:'click to exit test results'})
      .click(function(){
            $log.remove();
            $shadow.remove();
            testing = false;
            onExit();
          })
      .appendTo(document.body);
  }

  log('[ Running ' + test._all.length + ' unit tests ]');
  testing = true;

  var failed = [];
  for (var i = 0; i < test._all.length; ++i) {
    var callback = test._all[i];
    try {
      callback($log);
    }
    catch (err) {
      log('FAILED ' + callback.title + '\n  ' + err);
      failed.push(callback);
    }
  }

  if (failed.length) {
    log('[ failed ' + failed.length + ' tests ]');
    $log.css({
          'background-color': '#ffaaaa',
          'border-color': '#ffaaaa'
        });
  } else {
    log('[ passed all tests :) ]');
    $log.css({
          'background-color': '#aaffaa',
          'border-color': '#aaffaa'
        });
  }

  // call all failed tests to get stack traces
  for (var i = 0; i < failed.length; ++i) {
    (function(i){
      setTimeout(failed[i], 0);
    })(i);
  }
};

