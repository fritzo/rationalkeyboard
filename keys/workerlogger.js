/**
 * Logging in Web Workers.
 * (see logger.js for analogs in the main window)
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

var log = function (message) {
  self.postMessage({type:'log', data:message});
};

