/**
 * The Rational Keyboard
 * http://fritzo.org/keys
 * http://github.com/fritzo/rationalkeyboard
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

importScripts('safety.js');
importScripts('wavencoder.js');

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  self.gain = data['gain'];
  self.freqs = data['freqs'];
  self.centerFreq = self.freqs[(self.freqs.length - 1) / 2];
  self.T = data['numSamples'];

  self.wavEncoder = new WavEncoder(data['numSamples'], {clip:false});
  self.samples = new Array(self.T);

  var tasks = data['tasks'];
  assertEqual(tasks.length, self.freqs.length,
      'tasks.length does not match freqs.length');

  var startTime = Date.now();
  for (var f = 0, F = self.freqs.length; f < F; ++f) {
    self.synthesize(tasks[f]);
  }
  var endTime = Date.now();

  log('synthesized ' + self.freqs.length + ' onsets in '
      + (endTime - startTime) + 'ms');

  self.close();
};

var synthesize = function (f) {

  var freq = self.freqs[f];
  var T = self.T;
  var gain = self.gain * self.centerFreq / freq / T;
  var samples = self.samples;

  for (var t = 0; t < T; ++t) {
    var tone = gain * (T - t) * Math.sin(freq * t);
    tone *= 0.5 / Math.sqrt(1 + tone * tone); // clip to [-0.5,0.5]
    samples[t] = tone;
  }

  var uri = self.wavEncoder.encode(samples);
  self.postMessage({'type':'wave', 'index':f, 'data':uri});
};

//------------------------------------------------------------------------------
// Main message handler

self.addEventListener('message', function (e) {
  try {
    var data = e['data'];
    switch (data['cmd']) {

      case 'init':
        init(data['data']);
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    self.postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

