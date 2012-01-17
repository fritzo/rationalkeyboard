/*
 * The Rational Keybard
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Licensed under the MIT license:
 * http://www.opensource.org/licenses/mit-license.php
 */

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
    priorRadius: 3,
    priorWidthOctaves: 4.0,
    sustainSec: 1.0,
    attackSec: 0.1,
    backgroundGain: 0.3,
    updateHz: 60
  },

  synth: {
    sampleRateHz: 22050,
    centerFreqHz: 261.625565, // middle C
    windowSec: 0.2,
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
  },

  test: {
    interactive: false
  }
};

var verifyBrowser = function () {
  var missing = [];
  if (!Modernizr.canvas) missing.push('canvas element');
  if (!Modernizr.audio) missing.push('audio element');
  if (!Modernizr.webworkers) missing.push('web workers');

  if (missing.length) {
    var message = 'The Rational Keyboard ' +
        'needs some features not available in your browser: ' +
        missing.join(', ') + '.';
    $(document.body).empty().html(message).attr('class', 'warning');

    return false;
  } else {
    return true;
  }
};

//------------------------------------------------------------------------------
// Rational numbers (more precisely, extended nonnegative rational pairs)

var gcd = function (a,b)
{
  if (testing) {
    assert(a >= 0, 'gcd arg 1 is not positive: ' + a);
    assert(b >= 0, 'gcd arg 2 is not positive: ' + b);
    assert(a % 1 === 0, 'gcd arg 1 is not an integer: ' + a);
    assert(b % 1 === 0, 'gcd arg 2 is not an integer: ' + b);
  }

  if (b > a) { var temp = a; a = b; b = temp; }
  if (b === 0) return 1;

  while (true) {
    a %= b;
    if (a === 0) return b;
    b %= a;
    if (b === 0) return a;
  }
};
test('assert(gcd(0,0) === 1)');
test('assert(gcd(1,1) === 1)');
test('assert(gcd(1,2) === 1)');
test('assert(gcd(2,2) === 2)');
test('assert(gcd(4,6) === 2)');
test('assert(gcd(0,7) === 1)');

var Rational = function (m,n) {
  if (testing) {
    assert(0 <= m && m % 1 == 0, 'invalid numer: ' + m);
    assert(0 <= n && n % 1 == 0, 'invalid denom: ' + n);
    assert(m || n, '0/0 is not a Rational');
  }

  var g = gcd(m,n);
  this.numer = m / g;
  this.denom = n / g;

  if (testing) {
    assert(this.numer % 1 === 0, 'bad Rational.numer: ' + this.numer);
    assert(this.denom % 1 === 0, 'bad Rational.denom: ' + this.denom);
  }
};

Rational.prototype = {
  toNumber: function () {
    return this.numer / this.denom;
  },
  recip: function () {
    return new Rational(this.denom, this.numer);
  },
  normSquared: function () {
    return this.numer * this.numer + this.denom * this.denom;
  },
  norm: function () {
    return Math.sqrt(this.numer * this.numer + this.denom * this.denom);
  },
  isNormal: function () {
    return this.numer !== 0 && this.denom !== 0;
  }
};

Rational.ZERO = new Rational(0,1);
Rational.INF = new Rational(1,0);
Rational.ONE = new Rational(1,1);

Rational.mul = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.numer, lhs.denom * rhs.denom);
};
Rational.div = function (lhs, rhs) {
  return new Rational(lhs.numer * rhs.denom, lhs.denom * rhs.numer);
};
Rational.add = function (lhs, rhs) {
  return new Rational(
      lhs.numer * rhs.denom + lhs.denom * rhs.numer,
      lhs.denom * rhs.denom);
};

Rational.cmp = function (lhs, rhs) {
  return lhs.numer * rhs.denom - rhs.numer * lhs.denom;
};

Rational.distSquared = function (lhs, rhs) {
  return Rational.div(lhs, rhs).normSquared();
};
Rational.dist = function (lhs, rhs) {
  return Rational.div(lhs, rhs).norm();
};

Rational.ball = function (radius) {
  var result = [];
  for (var i = 1; i <= radius; ++i) {
    for (var j = 1; j*j + i*i <= radius*radius; ++j) {
      if (gcd(i,j) === 1) {
        result.push(new Rational(i,j));
      }
    }
  }
  result.sort(Rational.cmp);
  return result;
};

test('Rational.ball', function(){
  var actual = Rational.ball(4).map(function(q){ return q.toNumber(); });
  var expected = [1/3, 1/2, 2/3, 1/1, 3/2, 2/1, 3/1];
  assertEqual(actual, expected);
});

test('Rational.ball of size 88', function(){
  var target = 191; // needs to be odd; 88 is even
  var f = function(r) { return Rational.ball(r).length; }

  var r0, r1;
  for (r0 = 3; f(r0) >= target; --r0);
  for (r1 = 3; f(r1) <= target; ++r1);

  var r;
  while (r0 < r1) {
    var r = (r0 + r1) / 2;
    var n = f(r);
    if (r0 === r1) break;
    if (n === target) break;
    if (n < target) r0 = r;
    else r1 = r;
  }

  if (f(Math.round(r)) === target) r = Math.round(r);
  log('Rational.ball(' + r + ').length = ' + target);
});

//----------------------------------------------------------------------------
// Probability vectors

var Lmf = function (initProbs) {
  if (initProbs instanceof Array) {
    this.likes = initProbs.slice();
  } else {
    this.likes = [];
  }
};

Lmf.prototype = {

  total: function () {
    var likes = this.likes;
    var result = 0;
    for (var i = 0, I = likes.length; i < I; ++i) {
      result += likes[i];
    }
    return result;
  },

  normalize: function () {
    var total = this.total();
    assert(0 < total, 'cannont normalize Lmf with zero mass');
    var scale = 1.0 / total;
    var likes = this.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] *= scale;
    }
  },

  scale: function (s) {
    var likes = this.likes;
    for (var i = 0, I = likes.length; i < I; ++i) {
      likes[i] *= s;
    }
  },

  dot: function (values) {
    var likes = this.likes;
    //assert(values.length === likes.length, 'mismatched length in Lmf.dot');
    var result = 0;
    for (var i = 0, I = likes.length; i < I; ++i) {
      result += likes[i] * values[i];
    }
    return result;
  },

  shiftTowards: function (other, rate) {
    var likes0 = this.likes;
    var likes1 = other.likes;
    assert(likes0.length === likes1.length,
        'mismatched lengths in Lmf.shiftTowards');
    assert(0 <= rate && rate <= 1,
        'bad rate in Lmf.shiftTowards: ' + rate);

    var w0 = 1 - rate;
    var w1 = rate;
    for (var i = 0, I = likes0.length; i < I; ++i) {
      likes0[i] = w0 * likes0[i] + w1 * likes1[i];
    }
  },

  truncate: function (thresh) {
    var oldLikes = this.likes;
    var newLikes = this.likes = [];
    var indices = [];
    for (var i = 0, I = oldLikes.length, J = 0; i < I; ++i) {
      var like = oldLikes[i] - thresh;
      if (like > 0) {
        newLikes[J] = like;
        indices[J++] = i;
      }
    }
    return indices;
  }
};

Lmf.zero = function (N) {
  assert(0 < N, 'bad length in Lmf.zero: ' + N);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  return result;
};

Lmf.degenerate = function (n, N) {
  assert(0 <= n && n < N, 'bad indices in Lmf.denerate: ' + n + ', ' + N);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  likes[n] = 1;
  return result;
};

Lmf.multiply = function (lhs, rhs) {
  assert(lhs.length === rhs.length,
      'length mismatch in Lmf.multiply');

  var result = new Lmf();
  x = lhs.likes;
  y = rhs.likes;
  var xy = result.likes;
  for (var i = 0, I = x.length; i < I; ++i) {
    xy[i] = x[i] * y[i];
  }
  return result;
};

Lmf.boltzmann = function (energy, temperature) {
  if (temperature === undefined) temperature = 1;
  assert(0 < temperature, 'temperature is not positive: ' + temperature);
  var result = new Lmf();
  var likes = result.likes;
  for (var i = 0, I = energy.length; i < I; ++i) {
    likes[i] = Math.exp(-energy[i] / temperature);
  }
  result.normalize();
  return result;
};

test('Lmf.normalize', function(){
  var pmf = new Lmf();
  for (var i = 0; i < 3; ++i) {
    pmf.likes[i] = i;
  }
  pmf.normalize();
  assertEqual(pmf.likes, [0,1/3,2/3]);
});

test('assertEqual(Lmf.zero(3).likes, [0,0,0])');
test('assertEqual(Lmf.degenerate(1,4).likes, [0,1,0,0])');
test('Lmf.multiply', function(){
  var x = new Lmf([0,1,2,3]);
  var y = new Lmf([3,2,1,0]);
  assertEqual(Lmf.multiply(x,y).likes, [0,2,2,0]);
});

test('new Lmf(init)', function(){
  var init = [1,2,3];
  var pmf = new Lmf(init);
  pmf.normalize();
  assertEqual(init, [1,2,3], 'init was changed');
  assertEqual(pmf.likes, [1/6,2/6,3/6], 'likes is invalid');
});

test('Lmf.shiftTowards', function(){
  var p0 = new Lmf([0,0,1]);
  var p1 = new Lmf([0,1/2,1/2]);
  var rate = 1/3;
  p0.shiftTowards(p1, rate);
  assertEqual(p0.likes, [0, 1/6, 5/6]);delaySec: 0.05
});

//------------------------------------------------------------------------------
// Harmony

var Harmony = function (radius) {
  this.priorRateKhz = 1e-3 / config.harmony.priorSec;
  this.sustainRateKhz = 1e-3 / config.harmony.sustainSec;
  this.attackKhz = 1e-3 / config.harmony.attackSec;
  this.backgroundGain = config.harmony.backgroundGain;
  this.priorRadius = config.harmony.priorRadius;
  this.logFreqVariance =
    Math.pow(config.harmony.priorWidthOctaves * Math.log(2), 2);
  this.delayMs = 1000 / config.harmony.updateHz;

  this.points = Rational.ball(radius);
  this.length = this.points.length;

  var energyMatrix = this.energyMatrix = [];
  for (var i = 0; i < this.length; ++i) {
    var row = energyMatrix[i] = [];
    for (var j = 0; j < this.length; ++j) {
      row[j] = Rational.dist(this.points[i], this.points[j]);
    }
  }

  var freqEnergy = this.freqEnergy = [];
  for (var i = 0; i < this.length; ++i) {
    var logFreq = Math.log(this.points[i].toNumber());
    freqEnergy[i] = 0.5 * logFreq * logFreq / this.logFreqVariance;
  }

  assert(this.length % 2, 'harmony does not have an odd number of points');
  this.mass = Lmf.degenerate((this.length - 1) / 2, this.length);
  this.dmass = Lmf.zero(this.length);
  this.prior = Lmf.boltzmann(this.getEnergy(this.mass));

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
    var newPrior = Lmf.boltzmann(this.getEnergy(this.mass));
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
    var freqEnergy = this.freqEnergy;
    var radiusScale = 1 / mass.total() / this.priorRadius;
    var energy = [];
    for (var i = 0, I = this.length; i < I; ++i) {
      energy[i] = radiusScale * mass.dot(energyMatrix[i]) + freqEnergy[i];
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

var Synthesizer = function (harmony) {
  var windowMs = 1000 * config.synth.windowSec;

  this.harmony = harmony;
  this.delayMs = windowMs / 2;
  this.windowSamples = Math.floor(
      config.synth.windowSec * config.synth.sampleRateHz);
  this.sustainGain = config.synth.sustainGain;
  this.onsetGain = config.synth.onsetGain;
  this.numVoices = Math.min(harmony.length, config.synth.numVoices);

  var centerFreq = this.centerFreq =
    2 * Math.PI * config.synth.centerFreqHz / config.synth.sampleRateHz;
  var freqs = this.freqs = harmony.points.map(function(q){
        return centerFreq * q.toNumber();
      });

  this.initOnsets();

  this.running = false;
  this.targetTime = Date.now();
};

Synthesizer.prototype = {

  start: function () {
    if (this.running) return;
    this.running = true;
    var synth = this;

    this.profileCount = 0;
    this.profileElapsed = 0;

    this.synthworker = new Worker('synthworker.js');
    this.synthworker.addEventListener('message', function (e) {
          var data = e.data;
          switch (data.type) {
            case 'wave':
              synth.play(data.data);
              synth.profileCount += 1;
              synth.profileElapsed += data.profileElapsed;
              break;

            case 'log':
              log('Synth Worker: ' + data.data);
              break;

            case 'error':
              log('Synth Worker Error: ' + data.data);
              break;
          }
        }, false);
    this.synthworker.postMessage({
      cmd: 'init',
      data: {
          gain: this.sustainGain,
          freqs: this.freqs,
          numVoices: this.numVoices,
          numSamples: this.windowSamples
        }
      });

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

    this.synthworker.terminate();

    if (!testing) {
      var profileMean = 1e-3 * this.profileElapsed / this.profileCount;
      log('Synthesizer mean time = ' + profileMean + ' sec');
    }
  },

  update: function () {
    var mass = this.harmony.mass.likes;
    this.synthworker.postMessage({cmd:'synthesize', data:mass});
  },
  play: function (uri) {
    var audio = new Audio(uri);

    // XXX TODO there seems to be a bug here.
    //   about 20sec after app starts, audio gets choppy.
    //   goes away when pause-resume
    //   does not go away when switching screens
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
          var data = e.data;
          switch (data.type) {
            case 'wave':
              onsets[data.index] = data.data;
              break;

            case 'log':
              log('Onset Worker: ' + data.data);
              break;

            case 'error':
              log('Onset Worker Error: ' + data.data);
              break;
          }
        }, false);
    onsetworker.postMessage({
      cmd: 'init',
      data: {
          gain: this.onsetGain,
          freqs: this.freqs,
          numSamples: 2 * this.windowSamples,
          tasks: tasks
        }
      });
  },
  playOnset: function (index) {
    var uri = this.onsets[index];
    if (uri !== undefined) {
      (new Audio(uri)).play();
    }
  }
};

test('web worker echo', function(){
  var message = {a:0, b:[0,1,2], c:'asdf', d:{}}; // just some JSON
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

var Keyboard = function (harmony, synthesizer) {
  this.harmony = harmony;
  this.synthesizer = synthesizer;
  this.delayMs = 1000 / config.keyboard.updateHz;

  this.canvas = document.getElementById('canvas');
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

      $canvas.on('mousedown.keyboard', function (e) {
            keyboard._swiped = false;
            keyboard.swipeX0 = keyboard.swipeX1 = e.pageX / window.innerWidth;
            keyboard.swipeY0 = keyboard.swipeY1 = e.pageY / window.innerHeight;
            $canvas.on('mousemove.keyboard', function (e) {
                  keyboard.swipeX1 = e.pageX / window.innerWidth;
                  keyboard.swipeY1 = e.pageY / window.innerHeight;
                });
          });
      $canvas.on('mouseup.keyboard', function (e) {
            $canvas.off('mousemove.keyboard');
            if (!keyboard._swiped) {
              keyboard.click(
                  e.pageX / window.innerWidth,
                  e.pageY / window.innerHeight);
            }
            keyboard._swiped = true;
          });
      $canvas.on('mouseout.keyboard', function (e) {
            $canvas.off('mousemove.keyboard');
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
    this.harmony.updateAddMass(index, config.synth.clickGain);
    if (this.synthesizer !== undefined) {
      this.synthesizer.playOnset(index);
    }
  },
  onswipe: function (indices) {
    this._swiped = true;
    for (var i = 0, I = indices.length; i < I; ++i) {
      this.harmony.updateAddMass(indices[i], config.synth.swipeGain);
    }
  },

  fracBars: '\u2013\u2014\u2015', // narrow, medium, wide
};

// TODO add button to switch styles

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

Keyboard.styles.thermal = {

  updateGeometry: function () {
    var X = this.harmony.length;
    var Y = Math.floor(2 + Math.sqrt(window.innerHeight));

    var energy = this.harmony.getEnergy(this.harmony.prior);

    // vertical bands with height-varying temperature
    var geometryYX = [];
    for (var y = 0; y < Y; ++y) {
      var temperature = 1 / (1 - 0.8 * y / (Y-1));
      var width = Lmf.boltzmann(energy, temperature).likes;

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

Keyboard.styles.flow = {

  updateGeometry: function () {
    var keyThresh = 1e-3;
    var keyExponent = 8;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = Lmf.boltzmann(energy);

    var keys = this.keys = probs.truncate(keyThresh);
    var K = keys.length;
    probs.normalize();

    probs.scale((1 - 0.5 / keyExponent) / Math.max.apply(Math, probs.likes));
    probs = this.probs = probs.likes;

    // vertical bands of varying width
    var geometryYX = [];
    var width = new Lmf();
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

// TODO implement swiping gestures

Keyboard.styles.piano = {

  updateGeometry: function () {
    var keyThresh = config.keyboard.piano.keyThresh;
    var temperature = config.keyboard.piano.temperature;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = Lmf.boltzmann(energy);

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

    //var radii = ypos.slice();
    var radii = ypos.map(function(y){ return 1 - (1 - y) * (1 - y); });
    var xpos = [];
    var xmax = 0;
    // TODO symmetrize by averaging left- and right- constrained versions
    for (var k = 0; k < K; ++k) {
      var r = radii[k];
      var x = r;
      var y = ypos[k];

      for (var k2 = 0; k2 < k; ++k2) {
        var r2 = radii[k2];
        var x2 = xpos[k2];
        var y2 = ypos[k2];

        //var padding = y2 < y ? r2 + r * Math.pow(y2 / y, 2)
        //                     : r2 * Math.pow(y / y2, 2) + r;
        var padding = (r2 + r) * Math.pow(2 / (y2 / y + y / y2), 8);
        x = Math.max(x, x2 + padding);
      }

      xpos[k] = x;
      xmax = Math.max(xmax, x + r);
    }
    xpos = xpos.map(function(x){ return x / xmax; });
    radii = radii.map(function(r){ return r / xmax; });
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
    var R = config.keyboard.piano.cornerRadius;

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
    var xpos = this.xpos;

    var indices = [];
    for (var k = 0, K = keys.length; k < K; ++k) {
      var y = ypos[k];
      if ((y0 > y) || (y1 > y)) continue; // approximate

      var x = xpos[k];
      if ((x0 - x) * (x - x1) > 0) {
        indices.push(keys[k]);
      }
    }

    if (indices.length > 0) {
      this.onswipe(indices);
    }
  }
};

//----------------------------------------------------------------------------
// Visualization: wedges

Keyboard.styles.wedges = {

  updateGeometry: function () {
    var keyThresh = config.keyboard.wedges.keyThresh;
    var temperature = config.keyboard.wedges.temperature;

    var X = this.harmony.length;
    var Y = Math.floor(
        2 + Math.sqrt(window.innerHeight + window.innerWidth));

    var energy = this.harmony.getEnergy(this.harmony.prior);
    var probs = Lmf.boltzmann(energy);

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

    var makeRoomForText = 1 - config.keyboard.wedges.textHeight / innerHeight;
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
    var R = config.keyboard.wedges.cornerRadius;

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

  try {
    if(config.test.interactive) {
      TODO('implement an asynchronous query dialog box');
      assert(confirm('do you hear a tone?'),
          'synthesizer did not make a tone');
      assert(confirm('do you see a keyboard?'),
          'keyboard was not drawn correctly');
    }
  }

  finally {
    keyboard.stop();
    synthesizer.stop();
    harmony.stop();
  }
});

$(document).ready(function(){

  if (!verifyBrowser()) return;

  var canvas = document.getElementById('canvas');
  var $style = $('#style');
  var style = config.keyboard.defaultStyle;
  $(window).resize(function(){
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }).resize();

  if (window.location.hash) {
    if (window.location.hash.substr(1) === 'test') {
      document.title = 'The Rational Keyboard - Unit Test';
      $('#toolbar').hide();
      test.runAll();
      return;
    }
    else if (window.location.hash.substr(1) === 'test=interactive') {
      document.title = 'The Rational Keyboard - Interactive Unit Test';
      $('#toolbar').hide();
      config.test.interactive = true;
      test.runAll();
      return;
    }
    else if (window.location.hash.substr(1,6) === 'style=') {
      style = window.location.hash.substr(7);
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

  startRunning();
});

