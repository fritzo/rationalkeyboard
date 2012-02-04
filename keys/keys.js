/**
 * The Rational Keyboard
 * http://fritzo.org/keys
 * http://github.com/fritzo/rationalkeyboard
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

/** @const */
var config = {
  harmony: {
    //maxRadius: 11.44, // 63 keys
    //maxRadius: 13, // 77 keys
    //maxRadius: 14.25, // 99 keys
    //maxRadius: 16.45, // 127 keys
    //maxRadius: 20, // 191 keys
    //maxRadius: 21, // 207 keys
    maxRadius: Math.sqrt(24*24 + 1*1 + 1e-4), // 279 keys
    priorSec: 8.0,
    acuity: 3,
    sustainSec: 1.0,
    attackSec: 0.1,
    backgroundGain: 0.3,
    updateHz: 60,
    randomizeRate: 0,
  },

  synth: {
    sampleRateHz: 22050,
    centerFreqHz: 261.625565, // middle C
    windowSec: 0.2,
    windowPadding: 0.1, // for better performance in firefox
    onsetGain: 1.0,
    sustainGain: 0.3,
    clickGain: 1.0,
    swipeGain: 0.3,
    numVoices: 32
  },

  keyboard: {
    updateHz: 30,
    piano: {
      keyThresh: 1e-4,
      temperature: 3,
      cornerRadius: 1/3
    },
    wedges: {
      keyThresh: 1e-4,
      temperature: 3,
      cornerRadius: 1/3,
      textHeight: 28
    },
    defaultStyle: 'piano'
  }
};

var verifyBrowser = function () {
  var missing = [];
  if (!Modernizr.canvas) missing.push('canvas element');
  if (!Modernizr.audio) missing.push('audio element');
  if (!Modernizr.webworkers) missing.push('web workers');

  if (missing.length) {
    var message = [
        '<p>The Rational Keyboard ',
        'needs features not available in your browser: ',
        '<ul><li>',
        missing.join('</li><li>'),
        '</li></ul>',
        '</p>',
        '<p>',
        'User Agent String = ',
        navigator.userAgent,
        '</p>'].join('');

    $(document.body).empty().html(message).attr('class', 'warning');

    return false;
  } else {
    return true;
  }
};

//------------------------------------------------------------------------------
// Harmony

/** @constructor */
var Harmony = function (radius) {
  this.priorRateKhz = 1e-3 / config.harmony.priorSec;
  this.sustainRateKhz = 1e-3 / config.harmony.sustainSec;
  this.attackKhz = 1e-3 / config.harmony.attackSec;
  this.backgroundGain = config.harmony.backgroundGain;
  this.acuity = config.harmony.acuity;
  this.delayMs = 1000 / config.harmony.updateHz;
  this.randomizeRate = config.harmony.randomizeRate;

  this.points = Rational.ball(radius);
  this.length = this.points.length;

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dissonance(this.points[i], this.points[j]);
    }
  }

  assert(this.length % 2, 'harmony does not have an odd number of points');
  this.mass = MassVector.degenerate((this.length - 1) / 2, this.length);
  this.dmass = MassVector.zero(this.length);
  this.prior = MassVector.boltzmann(this.getEnergy(this.mass));

  this.running = false;
};

Harmony.prototype = {

  start: function () {
    if (this.running) return;
    this.running = true;

    this.profileTime = Date.now();
    this.profileCount = 0;

    this.lastTime = Date.now();
    this.updateTask = undefined;
    this.updateDiffusion();
  },
  stop: function () {
    this.running = false;
    if (this.updateTask !== undefined) {
      clearTimeout(this.updateTask);
      this.updateTask = undefined;
    }

    if (!testing) {
      var profileRate =
        this.profileCount * 1e3 / (Date.now() - this.profileTime);
      log('Harmony update rate = ' + profileRate + ' Hz');
    }
  },
  updateDiffusion: function () {
    var now = Date.now();
    assert(this.lastTime <= now, 'Harmony.lastTime is in future');
    var dt = now - this.lastTime;
    this.lastTime = now;

    var priorRate = 1 - Math.exp(-dt * this.priorRateKhz);
    var newPrior = MassVector.boltzmann(this.getEnergy(this.mass));
    this.prior.shiftTowards(newPrior, priorRate);

    var sustainRate = 1 - Math.exp(-dt * this.sustainRateKhz);
    newPrior.scale(this.backgroundGain);
    this.mass.shiftTowards(newPrior, sustainRate);

    var attackDecay = Math.exp(-dt * this.attackKhz);
    var attackRate = 1 / attackDecay - 1;
    var likes = this.mass.likes;
    var dlikes = this.dmass.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] += attackRate * (dlikes[i] *= attackDecay);
    }

    if (this.randomizeRate) {
      var sigma = this.randomizeRate * Math.sqrt(dt / 1000) * Math.sqrt(12);
      var total = this.mass.total();
      for (var i = 0, I = likes.length; i < I; ++i) {
        likes[i] *= Math.exp(sigma * (Math.random() - 0.5));
      }
    }

    if (this.running) {
      var harmony = this;
      this.updateTask = setTimeout(function(){
            harmony.updateTask = undefined;
            harmony.updateDiffusion();
          }, this.delayMs);
    }

    this.profileCount += 1;
  },

  updateAddMass: function (index, mass) {
    this.dmass.likes[index] += mass;
  },

  getEnergy: function (mass) {
    var energyMatrix = this.energyMatrix;
    var radiusScale = 1 / mass.total() / this.acuity;
    var energy = [];
    for (var i = 0, I = this.length; i < I; ++i) {
      energy[i] = radiusScale * mass.dot(energyMatrix[i]);
    }
    return energy;
  }
};

test('Harmony.getEnergy', function(){
  var harmony = new Harmony(8);
  for (var i = 0; i < harmony.length; ++i) {
    harmony.mass.likes[i] = i;
  }
  harmony.mass.normalize();

  var energy = harmony.getEnergy(harmony.mass);
  assertEqual(energy.length, harmony.length, 'energy has wrong size');
  for (var i = 0; i < energy.length; ++i) {
    assert(-1/0 < energy[i], 'bad energy: ' + energy[i]);
    assert(energy[i] < 1/0, 'bad energy: ' + energy[i]);
  }
});

test('Harmony.updateDiffusion', function(){
  var harmony = new Harmony(8);
  var likes = harmony.mass.likes;
  assert(likes.length === harmony.length,
      'harmony.likes has wrong length before update');

  harmony.lastTime = Date.now() - 500;
  harmony.updateDiffusion();

  var likes = harmony.mass.likes;
  assert(likes.length === harmony.length,
      'harmony.likes has wrong length after update');
  for (var i = 0; i < likes.length; ++i) {
    assert(likes[i] > 0, 'likes is not positive: ' + JSON.stringify(likes));
  }
});

//------------------------------------------------------------------------------
// Synthesis

/** @constructor */
var Synthesizer = function (harmony) {
  var windowMs = 1000 * config.synth.windowSec;
  var windowSamples = config.synth.windowSec * config.synth.sampleRateHz;

  this.harmony = harmony;
  this.delayMs = windowMs / 2;
  this.synthSamples = Math.round(
      windowSamples * (1 - config.synth.windowPadding));
  this.onsetSamples = Math.round(2 * windowSamples);
  this.sustainGain = config.synth.sustainGain;
  this.onsetGain = config.synth.onsetGain;
  this.numVoices = Math.min(harmony.length, config.synth.numVoices);

  var centerFreq = this.centerFreq =
    2 * Math.PI * config.synth.centerFreqHz / config.synth.sampleRateHz;
  var freqs = this.freqs = harmony.points.map(function(q){
        return centerFreq * q.toNumber();
      });

  this.initOnsets();

  this.profileCount = 0;
  this.profileElapsed = 0;

  var synth = this;
  this.synthworker = new Worker('synthworker.js');
  this.synthworker.addEventListener('message', function (e) {
        var data = e['data'];
        switch (data['type']) {
          case 'wave':
            synth.play(data['data']);
            synth.profileCount += 1;
            synth.profileElapsed += data['profileElapsed'];
            break;

          case 'log':
            log('Synth Worker: ' + data['data']);
            break;

          case 'error':
            log('Synth Worker Error: ' + data['data']);
            break;
        }
      }, false);
  this.synthworker.postMessage({
    'cmd': 'init',
    'data': {
        'gain': this.sustainGain,
        'freqs': this.freqs,
        'numVoices': this.numVoices,
        'numSamples': this.synthSamples
      }
    });

  this.running = false;
  this.targetTime = Date.now();
};

Synthesizer.prototype = {

  start: function () {
    if (this.running) return;
    this.running = true;

    this.targetTime = Date.now() + this.delayMs;
    this.updateTask = undefined;
    this.update();
  },
  stop: function () {
    this.running = false;
    if (this.updateTask !== undefined) {
      clearTimeout(this.updateTask);
      this.updateTask = undefined;
    }

    if (!testing) {
      var profileMean = 1e-3 * this.profileElapsed / this.profileCount;
      log('Synthesizer mean time = ' + profileMean + ' sec');
    }
  },

  update: function () {
    this.synthworker.postMessage({
          'cmd': 'synthesize',
          'data': this.harmony.mass.likes
        });
  },
  play: function (uri) {

    // XXX FIXME TODO there seems to be a bug in chrome here.
    //   about 5sec after app starts, audio gets choppy.
    //   goes away when pause-resume (sometimes comes back)
    //   does not go away when switching screens

    // see
    // http://www.w3.org/TR/html5/the-iframe-element.html#the-audio-element
    // http://www.w3.org/TR/html5/the-iframe-element.html#media-elements

    // Version 1. garbage collected
    //   This sounds better in chrome, but starts clipping after 10s.
    var audio = new Audio(uri);

    // Version 2. double buffer
    //   This clips continuously in chrome.
    //   This crashes firefox after 15s.
    //if (this.doubleBuffer === undefined) {
    //  this.doubleBuffer = [new Audio(), new Audio()];
    //  this.doubleBuffer[0].preload = true;
    //  this.doubleBuffer[1].preload = true;
    //}
    //this.doubleBuffer.reverse();
    //var audio = this.doubleBuffer[0];
    //audio.pause();
    //audio.src = uri;
    //audio.load();

    var now = Date.now();
    var delay = Math.min(this.delayMs, this.targetTime - now);
    this.targetTime = Math.max(now, this.targetTime + this.delayMs);

    if (this.running) {
      var synth = this;
      this.updateTask = setTimeout(function () {
            synth.updateTask = undefined;
            audio.play();
            synth.update();
          }, delay);
    }
  },

  initOnsets: function () {

    var onsets = this.onsets = [];
  
    var tasks = [];
    var norms = this.harmony.points.map(function(q){ return q.norm(); });
    for (var f = 0, F = norms.length; f < F; ++f) {
      tasks[f] = f;
    }
    tasks.sort(function(i,j){ return norms[i] - norms[j]; });

    var onsetworker = new Worker('onsetworker.js');
    onsetworker.addEventListener('message', function (e) {
          var data = e['data'];
          switch (data['type']) {
            case 'wave':
              // Version 1. new audio object each onset
              onsets[data['index']] = data['data'];

              // Version 2. cached audio objects
              // This locks up chrome after a while
              //onsets[data['index']] = new Audio(data['data']);
              break;

            case 'log':
              log('Onset Worker: ' + data['data']);
              break;

            case 'error':
              log('Onset Worker Error: ' + data['data']);
              break;
          }
        }, false);
    onsetworker.postMessage({
      'cmd': 'init',
      'data': {
          'gain': this.onsetGain,
          'freqs': this.freqs,
          'numSamples': this.onsetSamples,
          'tasks': tasks
        }
      });
  },
  playOnset: function (index, volume) {
    var audio = this.onsets[index];
    if (audio instanceof Audio) {
      audio.currentTime = 0;
    } else { // audio is data uri of wav file
      audio = new Audio(audio);
    }
    audio.volume = volume;
    audio.play();
  }
};

test('web worker echo', function(){
  var message = {'a':0, 'b':[0,1,2], 'c':'asdf', d:{}}; // just some JSON
  var received = false;
  var error = null;

  var worker = new Worker('testworker.js');
  var timeout = setTimeout(function () {
    log('FAILED web worker test: no message was received from web worker');
    worker.terminate();
  }, 4000);
  worker.addEventListener('message', function (e) {
    clearTimeout(timeout);
    try {
      assert(e.data, 'echoed message has no data');
      assertEqual(e.data, message, 'echoed data does not match');
      log('PASSED web worker test');
    }
    catch (err) {
      log('FAILED web worker test: ' + err);
    }
  }, false);

  log('deferring decision on web worker test...');
  worker.postMessage(message);
});

//------------------------------------------------------------------------------
// Visualization

/** @constructor */
var Keyboard = function (harmony, synthesizer) {

  var mockSynthesizer = {playOnset : function(){}};

  this.harmony = harmony;
  this.synthesizer = synthesizer || mockSynthesizer;
  this.delayMs = 1000 / config.keyboard.updateHz;

  this.canvas = $('#canvas')[0];
  this.context = this.canvas.getContext('2d');

  this.running = false;
};

Keyboard.prototype = {

  start: function () {
    if (this.running) return;
    this.running = true;

    this.profileTime = Date.now();
    this.profileCount = 0;

    this.updateTask = undefined;
    this.update();

    var keyboard = this;
    $(window).off('resize.keyboard').on('resize.keyboard', function () {
          keyboard.updateGeometry(); // used by .draw() and .click()
          keyboard.draw();
        });

    var $canvas = $(this.canvas);
    if (this.updateSwipe === null) {

      $canvas.on('click.keyboard', function (e) {
            keyboard.click(
                e.pageX / window.innerWidth,
                e.pageY / window.innerHeight);
          });

    } else {

      var move = function (e) {
        keyboard.swipeX1 = e.pageX / innerWidth;
        keyboard.swipeY1 = e.pageY / innerHeight;
      };

      $canvas.on('mousedown.keyboard', function (e) {
            keyboard._swiped = false;
            keyboard.swipeX0 = keyboard.swipeX1 = e.pageX / innerWidth;
            keyboard.swipeY0 = keyboard.swipeY1 = e.pageY / innerHeight;
            $canvas.off('mousemove.keyboard').on('mousemove.keyboard', move);
            e.preventDefault(); // avoid selecting buttons
          });
      $canvas.on('mouseover.keyboard', function (e) {
            if (e.which) {
              keyboard._swiped = false;
              keyboard.swipeX0 = keyboard.swipeX1 = e.pageX / innerWidth;
              keyboard.swipeY0 = keyboard.swipeY1 = e.pageY / innerHeight;
              $canvas.off('mousemove.keyboard').on('mousemove.keyboard', move);
            }
            e.preventDefault(); // avoid selecting buttons
          });
      $canvas.on('mouseup.keyboard', function (e) {
            $canvas.off('mousemove.keyboard');
            if (!keyboard._swiped) {
              keyboard.click(
                  e.pageX / innerWidth,
                  e.pageY / innerHeight);
            }
            keyboard._swiped = true;
            e.preventDefault(); // avoid selecting buttons
          });
      $canvas.on('mouseout.keyboard', function (e) {
            $canvas.off('mousemove.keyboard');
            e.preventDefault(); // avoid selecting buttons
          });
    }
  },

  stop: function () {
    this.running = false;
    if (this.updateTask !== undefined) {
      clearTimeout(this.updateTask);
      this.updateTask = undefined;
    }

    if (!testing) {
      var profileRate =
        this.profileCount * 1e3 / (Date.now() - this.profileTime);
      log('Keyboard update rate = ' + profileRate + ' Hz');
    }

    var $canvas = $(this.canvas);
    if (this.updateSwipe === null) {

      $canvas.off('click.keyboard');

    } else {

      $canvas.off('mousedown.keyboard');
      $canvas.off('mousemove.keyboard');
      $canvas.on('mouseup.keyboard');
      $canvas.off('mouseout.keyboard');
    }
  },

  update: function () {
    if (this.updateSwipe !== null) {
      this.updateSwipe();
    }
    this.updateGeometry();
    this.draw();

    if (this.running) {
      var keyboard = this;
      this.updateTask = setTimeout(function(){
            keyboard.updateTask = undefined;
            keyboard.update();
          }, this.delayMs);
    }

    this.profileCount += 1;
  },

  onclick: function (index) {
    var gain = config.synth.clickGain;
    this.harmony.updateAddMass(index, gain);
    this.synthesizer.playOnset(index, gain);
  },
  onswipe: function (indices) {
    this._swiped = true;
    var gain = config.synth.swipeGain;
    for (var i = 0, I = indices.length; i < I; ++i) {
      var index = indices[i];
      this.synthesizer.playOnset(index, gain); // works poorly in firefox
      this.harmony.updateAddMass(index, gain);
    }
  },

  fracBars: '\u2013\u2014\u2015' // narrow, medium, wide
};

Keyboard.styles = {};

Keyboard.setStyle = function (style) {
  assert(style in Keyboard.styles, 'unknown keyboard style: ' + style);
  $.extend(Keyboard.prototype, Keyboard.styles[style]);
  log('setting keyboard style = ' + style);
};

test('Keyboard.update', function(){
  var harmony = new Harmony(4);

  for (var style in Keyboard.styles) {
    Keyboard.setStyle(style);

    harmony.start();
    harmony.stop();

    var keyboard = new Keyboard(harmony);
    keyboard.update();
  }
});

test('Keyboard.click', function(){
  var harmony = new Harmony(4);

  for (var style in Keyboard.styles) {
    Keyboard.setStyle(style);

    var keyboard = new Keyboard(harmony);

    harmony.start();
    keyboard.start();
    keyboard.stop();
    harmony.stop();

    for (var i = 0; i < 10; ++i) {
      keyboard.click(Math.random(), Math.random());
      harmony.updateDiffusion();
      keyboard.update();
    }
  }
});

test('Keyboard.swipe', function(){
  var harmony = new Harmony(4);

  for (var style in Keyboard.styles) {
    if (Keyboard.styles[style].updateSwipe === null) continue;
    Keyboard.setStyle(style);

    var keyboard = new Keyboard(harmony);

    harmony.start();
    keyboard.start();
    keyboard.stop();
    harmony.stop();

    keyboard._swiped = false;
    keyboard.swipeX0 = keyboard.swipeX1 = Math.random();
    keyboard.swipeY0 = keyboard.swipeY1 = Math.random();

    for (var i = 0; i < 10; ++i) {

      keyboard._swiped = false;
      keyboard.swipeX1 = Math.random();
      keyboard.swipeY1 = Math.random();

      harmony.updateDiffusion();
      keyboard.update();
    }
  }
});

//----------------------------------------------------------------------------
// Visualization: Temperature

Keyboard.styles['thermal'] = {

  /** @this {Keyboard} */
  updateGeometry: function () {
    var X = this.harmony.length;
    var Y = Math.floor(2 + Math.sqrt(window.innerHeight));

    var energy = this.harmony.getEnergy(this.harmony.prior);

    // vertical bands with height-varying temperature
    var geometryYX = [];
    for (var y = 0; y < Y; ++y) {
      var temperature = 1 / (1 - 0.8 * y / (Y-1));
      var width = MassVector.boltzmann(energy, temperature).likes;

      var geom = geometryYX[y] = [0];
      for (var x = 0; x < X; ++x) {
        geom[x+1] = geom[x] + width[x];
      }
      geom[X] = 1;
    }

    // transpose
    var geometryXY = this.geometry = [];
    for (var x = 0; x <= X; ++x) {
      var geom = geometryXY[x] = [];
      for (var y = 0; y < Y; ++y) {
        geom[y] = geometryYX[y][x];
      }
    }

    var colorParam = this.harmony.prior.likes.map(Math.sqrt);
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.harmony.dmass.likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var x = 0; x < X; ++x) {
      color[x] = Math.sqrt(colorScale * colorParam[x]);
      active[x] = 1 - Math.exp(-activeParam[x]);
    }
  },

  /** @this {Keyboard} */
  draw: function () {
    var geom = this.geometry;
    var color = this.color;
    var points = this.harmony.points;
    var context = this.context;

    var X = geom.length - 1;
    var Y = geom[0].length;
    var W = window.innerWidth - 1;
    var H = window.innerHeight - 1;

    context.clearRect(0, 0, W+1, H+1);

    for (var x = 0; x < X; ++x) {
      var r = Math.round(255 * Math.min(1, color[x] + this.active[x]));
      var g = Math.round(255 * Math.max(0, color[x] - this.active[x]));
      if (r < 2) continue;
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';

      var lhs = geom[x];
      var rhs = geom[x+1];
      if (rhs[Y-1] - lhs[Y-1] < 2 / W) continue;
      context.beginPath();
      context.moveTo(W * lhs[Y-1], 0);
      for (y = Y-2; y > 0; --y) {
        context.lineTo(W * lhs[y], H * (1 - y / (Y - 1)));
      }
      context.bezierCurveTo(
          W * lhs[0], H * (1 + 1/3 / (Y - 1)),
          W * rhs[0], H * (1 + 1/3 / (Y - 1)),
          W * rhs[1], H * (1 - 1 / (Y - 1)));
      for (y = 2; y < Y; ++y) {
        context.lineTo(W * rhs[y], H * (1 - y / (Y - 1)));
      }
      context.closePath();
      context.fill();
    }

    var textThresh = 0.4;
    var fracBars = this.fracBars;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';
    for (var x = 0; x < X; ++x) {
      var c = color[x];
      if (c > textThresh) {
        var opacity = Math.sqrt((c - textThresh) / (1 - textThresh));
        context.fillStyle = 'rgba(0,0,0,' + opacity + ')';

        var posX0 = W * (geom[x][Y-1] + geom[x+1][Y-1]) / 2;
        var posdX = W * (geom[x][Y-2] + geom[x+1][Y-2]) / 2 - posX0;
        var posXnumer = posX0 + posdX * 0.3;
        var posXbar = posX0 + posdX * 0.8;
        var posXdenom = posX0 + posdX * 1.1;
        var posY = 18;

        var point = points[x];
        var bar = fracBars[(point.numer > 9) + (point.denom > 9)];
        context.fillText(point.numer, posXnumer, posY - 7);
        context.fillText(bar, posXbar, posY - 1);
        context.fillText(point.denom, posXdenom, posY + 7);
      }
    }
  },

  /** @this {Keyboard} */
  click: function (x01, y01) {
    var geom = this.geometry;
    var X = geom.length - 1;
    var Y = geom[0].length;

    var y = (1 - y01) * (Y - 1);
    var y0 = Math.max(0, Math.min(Y - 2, Math.floor(y)));
    var y1 = y0 + 1;
    assert(y1 < Y);
    var w0 = y1 - y;
    var w1 = y - y0;

    for (var x = 0; x < X; ++x) {
      if (x01 <= w0 * geom[x+1][y0] + w1 * geom[x+1][y1]) {
        this.onclick(x);
        break;
      }
    }
  },
  updateSwipe: null
};

//----------------------------------------------------------------------------
// Visualization: Flow graph

Keyboard.styles['flow'] = {

  /** @this {Keyboard} */
  updateGeometry: function () {
    var keyThresh = 1e-3;
    var keyExponent = 8;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = MassVector.boltzmann(energy);

    var keys = this.keys = probs.truncate(keyThresh);
    var K = keys.length;
    probs.normalize();

    probs.scale((1 - 0.5 / keyExponent) / Math.max.apply(Math, probs.likes));
    probs = this.probs = probs.likes;

    // vertical bands of varying width
    var geometryYX = [];
    var width = new MassVector();
    var widthLikes = width.likes;
    for (var y = 0; y < Y; ++y) {
      var y01 = (y + 0.5) / Y * (1 - 0.5 / keyExponent);

      for (var k = 0; k < K; ++k) {
        var p = probs[k];
        widthLikes[k] = Math.pow(p, keyExponent * (1 - y01))
                      * Math.pow(1-p, keyExponent * y01);
      }
      width.normalize();

      var geom = geometryYX[y] = [0];
      for (var k = 0; k < K; ++k) {
        geom[k+1] = geom[k] + widthLikes[k];
      }
      geom[K] = 1;
    }

    // transpose
    var geometryXY = this.geometry = [];
    for (var k = 0; k <= K; ++k) {
      var geom = geometryXY[k] = [];
      for (var y = 0; y < Y; ++y) {
        geom[y] = geometryYX[y][k];
      }
    }

    var colorParam = this.harmony.prior.likes;
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.harmony.dmass.likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var k = 0; k < K; ++k) {
      var x = keys[k];
      color[k] = Math.sqrt(colorScale * colorParam[x]);
      active[k] = 1 - Math.exp(-activeParam[x]);
    }
  },

  /** @this {Keyboard} */
  draw: function () {
    var geom = this.geometry;
    var color = this.color;
    var active = this.active;
    var points = this.harmony.points;
    var context = this.context;
    var probs = this.probs;
    var keys = this.keys;

    var K = geom.length - 1;
    var Y = geom[0].length;
    var W = window.innerWidth - 1;
    var H = window.innerHeight - 1;

    context.clearRect(0, 0, W+1, H+1);
    var colorThresh = 2;

    for (var k = 0; k < K; ++k) {
      var r = Math.round(255 * Math.min(1, color[k] + active[k]));
      var g = Math.round(255 * Math.max(0, color[k] - active[k]));
      if (r < colorThresh) continue;
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';

      var lhs = geom[k];
      var rhs = geom[k+1];
      //if (rhs[Y-1] - lhs[Y-1] < 2 / W) continue;
      context.beginPath();
      context.moveTo(W * lhs[Y-1], 0);
      for (y = Y-2; y >= 0; --y) {
        context.lineTo(W * lhs[y], H * (1 - y / (Y - 1)));
      }
      //context.bezierCurveTo(
      //    W * lhs[0], H * (1 + 1/3 / (Y - 1)),
      //    W * rhs[0], H * (1 + 1/3 / (Y - 1)),
      //    W * rhs[1], H * (1 - 1 / (Y - 1)));
      for (y = 0; y < Y; ++y) {
        context.lineTo(W * rhs[y], H * (1 - y / (Y - 1)));
      }
      //context.closePath();
      context.fill();
    }

    var textThresh = 1/4;
    var fracBars = this.fracBars;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';
    for (var k = 0; k < K; ++k) {
      var c = color[k];
      if (c < textThresh) continue;

      var opacity = Math.sqrt((c - textThresh) / (1 - textThresh));
      context.fillStyle = 'rgba(0,0,0,' + opacity + ')';

      var p = probs[k];
      var py = (1-p) * (Y-1);
      var y0 = Math.floor(py);
      var y1 = 1 + y0;
      var w0 = y1 - py;
      var w1 = py - y0;
      var lhs = (w0 * geom[k][y0] + w1 * geom[k][y1]);
      var rhs = (w0 * geom[k+1][y0] + w1 * geom[k+1][y1]);
      var posX = W * (lhs + rhs) / 2;
      var posY = H * p + 8;

      var point = points[keys[k]];
      var bar = fracBars[(point.numer > 9) + (point.denom > 9)];
      context.fillText(point.numer, posX, posY - 8);
      context.fillText(bar, posX, posY - 1);
      context.fillText(point.denom, posX, posY + 8);
    }
  },

  /** @this {Keyboard} */
  click: function (x01, y01) {
    var geom = this.geometry;
    var K = geom.length - 1;
    var Y = geom[0].length;

    var y = (1 - y01) * (Y - 1);
    var y0 = Math.max(0, Math.min(Y - 2, Math.floor(y)));
    var y1 = y0 + 1;
    assert(y1 < Y);
    var w0 = y1 - y;
    var w1 = y - y0;

    for (var k = 0; k < K; ++k) {
      if (x01 <= w0 * geom[k+1][y0] + w1 * geom[k+1][y1]) {
        this.onclick(this.keys[k]);
        break;
      }
    }
  },
  updateSwipe: null
};

//----------------------------------------------------------------------------
// Visualization: piano

Keyboard.styles['piano'] = {

  /** @this {Keyboard} */
  updateGeometry: function () {
    var keyThresh = config.keyboard['piano'].keyThresh;
    var temperature = config.keyboard['piano'].temperature;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = MassVector.boltzmann(energy);

    var keys = probs.truncate(keyThresh);
    var K = keys.length;
    if (testing) {
      assert(probs.likes.length === keys.length, 'probs,keys length mismatch');
      for (var k = 0; k < K; ++k) {
        assert(0 <= probs.likes[k],
            'bad prob: probs.likes[' + k + '] = ' + probs.likes[k]);
      }
    }

    var ypos = probs.likes.map(function(p){
          return Math.log(p + keyThresh);
          //return Math.pow(p, 1/temperature);
        });
    var ymin = Math.log(keyThresh);
    var ymax = Math.max.apply(Math, ypos); // TODO use soft max
    ypos = ypos.map(function(y){ return (y - ymin) / (ymax - ymin); });
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= ypos[k] && ypos[k] <= 1,
            'bad y position: ypos[' + k + '] = ' + ypos[k]);
      }
    }

    var radii = ypos.map(function(y){ return 1 - Math.pow(1 - y, 3); });

    // Pass 1: hard constrain to left
    var xposLeft = [];
    var xmaxLeft = 0;
    for (var k = 0; k < K; ++k) {
      var r = radii[k];
      var x = r;
      var y = ypos[k];

      for (var k2 = 0; k2 < k; ++k2) {
        var r2 = radii[k2];
        var x2 = xposLeft[k2];
        var y2 = ypos[k2];

        //var padding = y2 < y ? r2 + r * Math.pow(y2 / y, 2)
        //                     : r2 * Math.pow(y / y2, 2) + r;
        var padding = (r2 + r) * Math.pow(2 / (y2 / y + y / y2), 8);
        x = Math.max(x, x2 + padding);
      }

      xposLeft[k] = x;
      xmaxLeft = Math.max(xmaxLeft, x + r);
    }

    // Pass 2: hard constrain to right
    var xposRight = [];
    var xmaxRight = 0;
    for (var k = K-1; k >= 0; --k) {
      var r = radii[k];
      var x = r;
      var y = ypos[k];

      for (var k2 = K-1; k2 > k; --k2) {
        var r2 = radii[k2];
        var x2 = xposRight[k2];
        var y2 = ypos[k2];

        //var padding = y2 < y ? r2 + r * Math.pow(y2 / y, 2)
        //                     : r2 * Math.pow(y / y2, 2) + r;
        var padding = (r2 + r) * Math.pow(2 / (y2 / y + y / y2), 8);
        x = Math.max(x, x2 + padding);
      }

      xposRight[k] = x;
      xmaxRight = Math.max(xmaxRight, x + r);
    }

    // Fuse passes 1 & 2
    var xpos = xposLeft;
    var radiusScale = 0.5 / xmaxLeft + 0.5 / xmaxRight;
    for (var k = 0; k < K; ++k) {
      radii[k] = radii[k] * radiusScale;
      xpos[k] = 0.5 * (1 + xposLeft[k] / xmaxLeft - xposRight[k] / xmaxRight);
    }
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= xpos[k] && xpos[k] <= 1,
            'bad x position: xpos[' + k + '] = ' + xpos[k]);
        assert(0 <= radii[k] && radii[k] <= 1,
            'bad radius: radii[' + k + '] = ' + radii[k]);
      }
    }

    var depthSorted = [];
    for (var k = 0; k < K; ++k) {
      depthSorted[k] = k;
    }
    depthSorted.sort(function(k1,k2){ return ypos[k2] - ypos[k1]; });

    this.keys = keys;
    this.depthSorted = depthSorted;
    this.radii = radii;
    this.xpos = xpos;
    this.ypos = ypos;

    var colorParam = this.harmony.prior.likes;
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.harmony.dmass.likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var k = 0; k < K; ++k) {
      var i = keys[k];
      color[k] = Math.sqrt(colorScale * colorParam[i]);
      active[k] = 1 - Math.exp(-activeParam[i]);
    }
  },

  /** @this {Keyboard} */
  draw: function () {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xpos = this.xpos;
    var ypos = this.ypos;

    var color = this.color;
    var active = this.active;

    var points = this.harmony.points;
    var context = this.context;
    var probs = this.probs;
    var keys = this.keys;

    var K = keys.length;
    var W = window.innerWidth;
    var H = window.innerHeight;
    var R = config.keyboard['piano'].cornerRadius;

    context.clearRect(0, 0, W, H);
    var fracBars = this.fracBars;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';
    context.strokeStyle = 'rgba(0,0,0,0.25)';

    for (var d = 0; d < K; ++d) {
      var k = depthSorted[d];

      var r = Math.round(255 * Math.min(1, color[k] + active[k]));
      var g = Math.round(255 * Math.max(0, color[k] - active[k]));
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';
      var Wx = W * xpos[k];
      var Hy = H * ypos[k];
      var Wr = W * radii[k];

      // Version 1. box w/outline
      //context.fillRect(Wx - Wr, 0, Wr + Wr, Hy);
      //context.strokeRect(Wx - Wr, 0, Wr + Wr, Hy);

      // Version 2. curved region
      //context.fillRect(Wx - Wr, 0 - Wr, Wr + Wr, Hy);

      //context.beginPath();
      //context.moveTo(Wx - Wr, Hy - Wr - 2);
      //context.lineTo(Wx - Wr, Hy - Wr);
      //context.bezierCurveTo(
      //    Wx - Wr, Hy + Wr/3,
      //    Wx + Wr, Hy + Wr/3,
      //    Wx + Wr, Hy - Wr);
      //context.lineTo(Wx + Wr, Hy - Wr - 2);
      //context.fill();

      //context.beginPath();
      //context.moveTo(Wx - Wr, 0);
      //context.lineTo(Wx - Wr, Hy - Wr);
      //context.bezierCurveTo(
      //    Wx - Wr, Hy + Wr/3,
      //    Wx + Wr, Hy + Wr/3,
      //    Wx + Wr, Hy - Wr);
      //context.lineTo(Wx + Wr, 0);
      //context.stroke();

      // Version 3. piano keys
      context.fillRect(Wx - Wr, 0, Wr + Wr, Hy - Wr * R);

      context.beginPath();
      context.moveTo(Wx - Wr, Hy - Wr * R - 2);
      context.lineTo(Wx - Wr, Hy - Wr * R);
      context.quadraticCurveTo(Wx - Wr, Hy, Wx - Wr * (1-R), Hy);
      context.lineTo(Wx + Wr * (1-R), Hy);
      context.quadraticCurveTo(Wx + Wr, Hy, Wx + Wr, Hy - Wr * R);
      context.lineTo(Wx + Wr, Hy - Wr * R - 2);
      context.fill();

      context.beginPath();
      context.moveTo(Wx - Wr, 0);
      context.lineTo(Wx - Wr, Hy - Wr * R);
      context.quadraticCurveTo(Wx - Wr, Hy, Wx - Wr * (1-R), Hy);
      context.lineTo(Wx + Wr * (1-R), Hy);
      context.quadraticCurveTo(Wx + Wr, Hy, Wx + Wr, Hy - Wr * R);
      context.lineTo(Wx + Wr, 0);
      context.stroke();

      if (Wr < 6) continue;
      Hy -= 2/3 * (Wr - 6);
      var point = points[keys[k]];
      var bar = fracBars[(point.numer > 9) + (point.denom > 9)];
      context.fillStyle = 'rgb(0,0,0)';
      context.fillText(point.numer, Wx, Hy - 16);
      context.fillText(bar, Wx, Hy - 10);
      context.fillText(point.denom, Wx, Hy - 2);
    }
  },

  /** @this {Keyboard} */
  click: function (x01, y01) {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xpos = this.xpos;
    var ypos = this.ypos;

    for (var d = depthSorted.length - 1; d >= 0; --d) {
      var k = depthSorted[d];

      if (y01 <= ypos[k]) {
        var r = Math.abs(x01 - xpos[k]);
        if (r <= radii[k]) {
          this.onclick(keys[k]);
          break;
        }
      }
    }
  },
  /** @this {Keyboard} */
  updateSwipe: function () {
    var x0 = this.swipeX0;
    var y0 = this.swipeY0;
    var x1 = this.swipeX1;
    var y1 = this.swipeY1;
    this.swipeX0 = x1;
    this.swipeY0 = y1;

    // TODO compute old,new vectors using old,new geometry (not new,new)
    if (x0 === x1) return; // only works for new,new geometry

    var keys = this.keys;
    var ypos = this.ypos;
    var xpos = this.xpos
    var radii = this.radii;
    var dir = x0 < x1 ? -1 : 1;

    var indices = [];
    for (var k = 0, K = keys.length; k < K; ++k) {
      var y = ypos[k];
      var x = xpos[k];
      var r = radii[k];

      if (y0 <= y && y1 <= y) { // approximate
        x += dir * r;
        if ((x0 - x) * (x - x1) > 0) {
          indices.push(keys[k]); // sideways swipe
        }
      } else if (x - r <= x1 && x1 <= x + r && y1 <= y && y < y0) {
        indices.push(keys[k]); // upward swipe
      }
    }

    if (indices.length > 0) {
      this.onswipe(indices);
    }
  }
};

//----------------------------------------------------------------------------
// Visualization: wedges

Keyboard.styles['wedges'] = {

  /** @this {Keyboard} */
  updateGeometry: function () {
    var keyThresh = config.keyboard['wedges'].keyThresh;
    var temperature = config.keyboard['wedges'].temperature;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = MassVector.boltzmann(energy);

    if (this.pitches === undefined) {
      var pitches = this.harmony.points.map(function(q){
            return Math.log(q.toNumber());
          });
      var minPitch = pitches[0];
      var maxPitch = pitches[pitches.length - 1];
      this.pitches = pitches.map(function(p){
            return (p - minPitch) / (maxPitch - minPitch);
          });
    }
    var pitches = this.pitches;

    var keys = probs.truncate(keyThresh);
    var K = keys.length;
    if (testing) {
      assert(probs.likes.length === keys.length, 'probs,keys length mismatch');
      for (var k = 0; k < K; ++k) {
        assert(0 <= probs.likes[k],
            'bad prob: probs.likes[' + k + '] = ' + probs.likes[k]);
      }
    }

    var ypos = probs.likes.map(function(p){
          return Math.log(p + keyThresh);
        });
    var ymin = Math.log(keyThresh);
    var ymax = Math.max.apply(Math, ypos);
    ypos = ypos.map(function(y){ return (y - ymin) / (ymax - ymin) + 1e-20; });
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= ypos[k] && ypos[k] <= 1,
            'bad y position: ypos[' + k + '] = ' + ypos[k]);
      }
    }

    var makeRoomForText = 1 - config.keyboard['wedges'].textHeight / innerHeight;
    for (var k = 0; k < K; ++k) {
      ypos[k] *= makeRoomForText;
    }

    var depthSorted = [];
    for (var k = 0; k < K; ++k) {
      depthSorted[k] = k;
    }
    depthSorted.sort(function(k1,k2){ return ypos[k1] - ypos[k2]; });

    var xtop = keys.map(function(f){ return pitches[f]; });
    if (testing) {
      for (var k = 0; k < K; ++k) {
        assert(0 <= xtop[k] && xtop[k] <= 1,
            'bad y position: xtop[' + k + '] = ' + xtop[k]);
      }
    }

    var radii = [];
    var width = 0;
    for (var k = 0; k < K; ++k) {
      width += radii[k] = Math.pow(probs.likes[k], 1 / temperature);
    }
    for (var k = 0; k < K; ++k) {
      radii[k] *= 0.5 / width;
    }

    var xbot = [radii[0]];
    for (var k = 1; k < K; ++k) {
      xbot[k] = xbot[k-1] + radii[k-1] + radii[k];
    }

    for (var k = 0; k < K; ++k) {
      var y = ypos[k];
      xbot[k] = xtop[k] + y * (xbot[k] - xtop[k]);
      radii[k] *= y;
    }

    this.keys = keys;
    this.depthSorted = depthSorted;
    this.radii = radii;
    this.xtop = xtop;
    this.xbot = xbot;
    this.ypos = ypos;

    var colorParam = this.harmony.prior.likes;
    var colorScale = 1 / Math.max.apply(Math, colorParam);
    var activeParam = this.harmony.dmass.likes;
    var color = this.color = [];
    var active = this.active = [];
    for (var k = 0; k < K; ++k) {
      var i = keys[k];
      color[k] = Math.sqrt(colorScale * colorParam[i]);
      active[k] = 1 - Math.exp(-activeParam[i]);
    }
  },

  /** @this {Keyboard} */
  draw: function () {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xtop = this.xtop;
    var xbot = this.xbot;
    var ypos = this.ypos;

    var color = this.color;
    var active = this.active;

    var points = this.harmony.points;
    var context = this.context;
    var probs = this.probs;
    var keys = this.keys;

    var K = keys.length;
    var W = window.innerWidth;
    var H = window.innerHeight;
    var R = config.keyboard['wedges'].cornerRadius;

    context.clearRect(0, 0, W, H);
    var fracBars = this.fracBars;
    context.font = '10pt Helvetica';
    context.textAlign = 'center';

    for (var d = 0; d < K; ++d) {
      var k = depthSorted[d];

      var r = Math.round(255 * Math.min(1, color[k] + active[k]));
      var g = Math.round(255 * Math.max(0, color[k] - active[k]));
      context.fillStyle = 'rgb(' + r + ',' + g + ',' + g + ')';

      var Hy = H * ypos[k];
      var Wxt = W * xtop[k];
      var Wxb = W * xbot[k];
      var Wr = W * radii[k];

      // Version 1: triangles
      context.beginPath();
      context.moveTo(Wxt, 0);
      context.lineTo(Wxb - Wr, Hy);
      context.lineTo(Wxb + Wr, Hy);
      context.lineTo(Wxt, 0);
      context.fill();

      // Version 2: curved triangles
      //var Wxl = Wxb - Wr;
      //var Wxr = Wxb + Wr;
      //var Rx = R;
      //var Ry = Rx * Wr / Hy;
      //context.beginPath();
      //context.moveTo(Wxt - 0.5, 0);
      //context.lineTo(Wxl + (Wxt - Wxl) * Ry, Hy * (1-Ry));
      //context.quadraticCurveTo(Wxl, Hy, Wxl + Wr * Rx, Hy);
      //context.lineTo(Wxr - Wr * Rx, Hy);
      //context.quadraticCurveTo(Wxr, Hy, Wxr + (Wxt - Wxr) * Ry, Hy * (1-Ry));
      //context.lineTo(Wxt + 0.5, 0);
      //context.fill();

      if (color[k] < 0.1) continue;
      var point = points[keys[k]];
      var bar = fracBars[(point.numer > 9) + (point.denom > 9)];
      context.fillText(point.numer, Wxb, Hy + 12);
      context.fillText(bar, Wxb, Hy + 18);
      context.fillText(point.denom, Wxb, Hy + 26);
    }
  },

  /** @this {Keyboard} */
  click: function (x01, y01) {
    var keys = this.keys;
    var depthSorted = this.depthSorted;
    var radii = this.radii;
    var xtop = this.xtop;
    var xbot = this.xbot;
    var ypos = this.ypos;

    for (var d = depthSorted.length - 1; d >= 0; --d) {
      var k = depthSorted[d];

      if (y01 <= ypos[k]) {
        var y = y01 / ypos[k];
        var r = Math.abs(y * xbot[k] + (1-y) * xtop[k] - x01);
        if (r <= y * radii[k]) {
          this.onclick(keys[k]);
          break;
        }
      }
    }
  },
  /** @this {Keyboard} */
  updateSwipe: function () {
    var x0 = this.swipeX0;
    var y0 = this.swipeY0;
    var x1 = this.swipeX1;
    var y1 = this.swipeY1;
    this.swipeX0 = x1;
    this.swipeY0 = y1;

    // TODO compute old,new vectors using old,new geometry (not new,new)
    if ((x0 === x1) && (y0 === y1)) return; // only works for new,new geometry

    var keys = this.keys;
    var ypos = this.ypos;
    var xtop = this.xtop;
    var xbot = this.xbot;

    var indices = [];
    for (var k = 0, K = keys.length; k < K; ++k) {
      var y = ypos[k];
      if ((y0 > y) || (y1 > y)) continue; // approximate

      var xt = xtop[k];
      var xb = xbot[k];
      var a = (xb - xt) / y;
      var a0 = (x0 - xt) / y0;
      var a1 = (x1 - xt) / y1;
      if ((a0 - a) * (a - a1) > 0) {
        indices.push(keys[k]);
      }
    }

    if (indices.length > 0) {
      this.onswipe(indices);
    }
  }
};

//------------------------------------------------------------------------------
// Main

test('main', function(){
  var harmony = new Harmony(8);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

  harmony.start();
  synthesizer.start();
  keyboard.start();

  keyboard.stop();
  synthesizer.stop();
  harmony.stop();
});

var main = function () {

  var canvas = $('#canvas')[0];
  var $style = $('#style');
  var style = config.keyboard.defaultStyle;

  if (window.location.hash) {
    if (window.location.hash.substr(1,6) === 'style=') {
      style = window.location.hash.substr(7);
    }
    else if (window.location.hash.substr(1,7) === 'random=') {
      var randomizeRate = parseFloat(window.location.hash.substr(8))
      log('setting randomize rate = ' + randomizeRate);
      config.harmony.randomizeRate = randomizeRate;
    }
  }

  $style.val(style);
  window.location.hash = 'style=' + style;
  Keyboard.setStyle(style);

  $(window).hashchange(function(){
        if (window.location.hash.substr(1,6) === 'style=') {
          style = window.location.hash.substr(7);
          $style.val(style);
          Keyboard.setStyle(style);
        }
      });

  var harmony = new Harmony(config.harmony.maxRadius);
  var synthesizer = new Synthesizer(harmony);
  var keyboard = new Keyboard(harmony, synthesizer);

  log('using ' + harmony.length + ' keys');

  var running = false;
  var startRunning = function () {
    if (!running) {
      document.title = 'The Rational Keyboard';
      harmony.start();
      keyboard.start();
      synthesizer.start();
      running = true;
    }
  };
  var stopRunning = function () {
    if (running) {
      document.title = 'The Rational Keyboard (paused)';
      synthesizer.stop();
      keyboard.stop();
      harmony.stop();
      running = false;
    }
  };
  var toggleRunning = function () {
    running ? stopRunning() : startRunning();
  };

  $('#pauseButton').on('click', toggleRunning);
  $(document).on('keyup', function (e) {
        switch (e.which) {
          case 27:
            toggleRunning();
            break;
        }
      });

  $style.on('change', function(){
        var wasRunning = running;
        stopRunning();

        var style = $style.val();
        window.location.hash = 'style=' + style;
        Keyboard.setStyle(style);

        wasRunning ? startRunning() : $(window).resize();
      });

  setTimeout(startRunning, 1000);
};

$(function(){

  if (!verifyBrowser()) return;

  var canvas = $('#canvas')[0];
  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();

  if (window.location.hash && window.location.hash.substr(1) === 'test') {

    document.title = 'The Rational Keyboard - Unit Test';
    test.runAll(function(){
          document.title = 'The Rational Keyboard';
          window.location.hash = '';
          main();
        });

  } else {

    main();

  }
});

