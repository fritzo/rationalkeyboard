/**
 * The Rational Keyboard
 * http://fritzo.org/keys
 * http://github.com/fritzo/rationalkeyboard
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

importScripts('workerlogger.js');
importScripts('safety.js');
importScripts('wavencoder.js');

//------------------------------------------------------------------------------
// Commands

var init = function (data) {
  self.gain = data['gain'];
  self.freqs = data['freqs'];
  self.centerFreq = self.freqs[(self.freqs.length - 1) / 2];
  self.numVoices = data['numVoices'];
  self.F = self.freqs.length;
  self.T = data['numSamples'];

  self.wavEncoder = new WavEncoder(data['numSamples']);
  self.samples = new Array(self.T);
  self.amps = new Array(self.F);
  self.best = new Array(self.F);
  self.bestAmps = new Array(self.numVoices);
  self.bestFreqs = new Array(self.numVoices);

  self.initialized = true;
};

var synthesize = function (mass) {
  var profileStartTime = Date.now();

  assert(self.initialized, 'worker has not been initialized');
  assert(mass.length === self.freqs.length,
      'mass,freqs have different length');

  var freqs = self.freqs;
  var F = self.F;
  var T = self.T;

  var amps = self.amps;
  var best = self.best;
  var normalizeEnvelope = 4 / ((T+1) * (T+1));
  var gain = self.gain * normalizeEnvelope * self.centerFreq;
  for (var f = 0; f < F; ++f) {
    amps[f] = gain * Math.sqrt(mass[f]);
    best[f] = f;
  }
  best.sort(function(i,j){ return amps[j] - amps[i]; });

  var G = self.numVoices;
  var bestAmps = self.bestAmps;
  var bestFreqs = self.bestFreqs;
  for (var g = 0; g < G; ++g) {
    var f = best[g];
    bestAmps[g] = amps[f] / freqs[f];
    bestFreqs[g] = freqs[f];
  }

  var samples = self.samples;
  for (var t = 0; t < T; ++t) {
    var chord = 0;
    for (var g = 0; g < G; ++g) {
      chord += bestAmps[g] * Math.sin(bestFreqs[g] * t);
    }
    chord *= (t + 1) * (T - t); // envelope
    chord *= 0.5 / Math.sqrt(1 + chord * chord); // clip to [-0.5,0.5]
    samples[t] = chord;
  }

  var uri = self.wavEncoder.encode(samples);

  var profileElapsed = Date.now() - profileStartTime;
  self.postMessage({
        'type': 'wave',
        'data': uri,
        'profileElapsed': profileElapsed
      });
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

      case 'synthesize':
        synthesize(data['data']);
        break;

      default:
        throw 'unknown command: ' + data['cmd'];
    }
  }
  catch (err) {
    self.postMessage({'type':'error', 'data':err.toString()});
  }
}, false);

