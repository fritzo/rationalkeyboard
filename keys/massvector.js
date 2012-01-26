/**
 * Mass vectors.
 * For probability and likelihood.
 *
 * Copyright (c) 2012, Fritz Obermeyer
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://www.opensource.org/licenses/MIT
 * http://www.opensource.org/licenses/GPL-2.0
 */

/** @constructor */
var MassVector = function (initProbs) {
  if (initProbs instanceof Array) {
    this.likes = initProbs.slice();
  } else {
    assert(initProbs === undefined,
        'bad initial masses: ' + JSON.stringify(initProbs));
    this.likes = [];
  }
};

MassVector.prototype = {

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
    assert(0 < total, 'cannont normalize MassVector with zero mass');
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
    //assert(values.length === likes.length, 'mismatched length in MassVector.dot');
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
        'mismatched lengths in MassVector.shiftTowards');
    assert(0 <= rate && rate <= 1,
        'bad rate in MassVector.shiftTowards: ' + rate);

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

MassVector.zero = function (N) {
  assert(0 < N, 'bad length in MassVector.zero: ' + N);
  var result = new MassVector();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  return result;
};

MassVector.degenerate = function (n, N) {
  assert(0 <= n && n < N,
      'bad indices in MassVector.denerate: ' + n + ', ' + N);
  var result = new MassVector();
  var likes = result.likes;
  for (var i = 0; i < N; ++i) {
    likes[i] = 0;
  }
  likes[n] = 1;
  return result;
};

MassVector.multiply = function (lhs, rhs) {
  assert(lhs.length === rhs.length,
      'length mismatch in MassVector.multiply');

  var result = new MassVector();
  x = lhs.likes;
  y = rhs.likes;
  var xy = result.likes;
  for (var i = 0, I = x.length; i < I; ++i) {
    xy[i] = x[i] * y[i];
  }
  return result;
};

MassVector.boltzmann = function (energy, temperature) {
  if (temperature === undefined) temperature = 1;
  assert(0 < temperature, 'temperature is not positive: ' + temperature);
  var result = new MassVector();
  var likes = result.likes;
  for (var i = 0, I = energy.length; i < I; ++i) {
    likes[i] = Math.exp(-energy[i] / temperature);
  }
  result.normalize();
  return result;
};

test('MassVector.normalize', function(){
  var pmf = new MassVector();
  for (var i = 0; i < 3; ++i) {
    pmf.likes[i] = i;
  }
  pmf.normalize();
  assertEqual(pmf.likes, [0,1/3,2/3]);
});

test('assertEqual(MassVector.zero(3).likes, [0,0,0])');
test('assertEqual(MassVector.degenerate(1,4).likes, [0,1,0,0])');
test('MassVector.multiply', function(){
  var x = new MassVector([0,1,2,3]);
  var y = new MassVector([3,2,1,0]);
  assertEqual(MassVector.multiply(x,y).likes, [0,2,2,0]);
});

test('new MassVector(init)', function(){
  var init = [1,2,3];
  var pmf = new MassVector(init);
  pmf.normalize();
  assertEqual(init, [1,2,3], 'init was changed');
  assertEqual(pmf.likes, [1/6,2/6,3/6], 'likes is invalid');
});

test('MassVector.shiftTowards', function(){
  var p0 = new MassVector([0,0,1]);
  var p1 = new MassVector([0,1/2,1/2]);
  var rate = 1/3;
  p0.shiftTowards(p1, rate);
  assertEqual(p0.likes, [0, 1/6, 5/6]);
});

