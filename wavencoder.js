/*
  The Rational Keybard: version (2012-01-07)
  http://fritzo.org/keys

  Copyright (c) 2012, Fritz Obermeyer
  Licensed under the MIT license:
  http://www.opensource.org/licenses/mit-license.php
*/

//------------------------------------------------------------------------------
// WaveEncoder
// Converts [0,1]-valued array |-> base64-encoded data uri.
// The base64 encoding is implemented using 16-bit words.

var WavEncoder = function (numSamples) {

  this.numSamples = numSamples;

  var PCM_FORMAT = 1;
  var bytesPerSample = 2;
  var bitsPerSample = bytesPerSample * 8;
  var numChannels = 1; // mono
  var sampleRateHz = 22050;
  var byteRateHz = sampleRateHz * bytesPerSample * numChannels;
  var byteAlignment = numChannels * bytesPerSample;

  var formatBytes = 16;
  var dataBytes = numSamples * bytesPerSample * numChannels;
  var chunkBytes = 4 + (8 + formatBytes) + (8 + dataBytes);

  var getString = this._getString;
  var getUint16 = this._getUint16;
  var getUint32 = this._getUint32;

  switch (bytesPerSample) {
    case 1:
      this.encode = this.encode8;
      break;

    case 2:
      this.encode = this.encode16;
      break;

    default: throw 'unsupported bytesPerSamp;e: ' + bytesPerSample;
  }

  // we encode using 16-bit words
  var words = this.words = [].concat(
      getString('RIFF'),

      // only one chunk
      getUint32(chunkBytes),
      getString('WAVE'),

      // format subchunk
      getString('fmt '),
      getUint32(formatBytes),
      getUint16(PCM_FORMAT),
      getUint16(numChannels),
      getUint32(sampleRateHz),
      getUint32(byteRateHz),
      getUint16(byteAlignment),
      getUint16(bitsPerSample),

      // data subchunk
      getString('data'),
      getUint32(dataBytes),
      []);

  var h = this.headerWords;
  var bytesPerWord = 2;
  var dataWords = dataBytes / bytesPerWord;
  for (var t = 0, T = dataWords; t < T; ++t) {
    words[h++] = 0;
  }
  while (words.length % 3) words.push(0);
};

WavEncoder.prototype = {

  headerBytes: 44,
  headerWords: 22,

  _getString: function (s) {
    assert(s.length % 2 === 0, 'expected a string length to be even');
    var result = [];
    for (var i = 0, I = s.length; i < I; i += 2) {
      var c1 = s.charCodeAt(i + 0);
      var c2 = s.charCodeAt(i + 1);
      assert(c1 < 256, 'bad character: ' + c1);
      assert(c2 < 256, 'bad character: ' + c2);
      result.push((c1 << 8) | c2);
    }
    return result;
  },
  _getUint16: function (i) {
    var swapBytes = function (j) { return ((j >> 8) | (j << 8)) & 65535; };
    return [i & 65535].map(swapBytes);
  },
  _getUint32: function (i) {
    var swapBytes = function (j) { return ((j >> 8) | (j << 8)) & 65535; };
    return [i & 65535, (i >> 16) & 65535].map(swapBytes);
  },

  encode8: function (samples) {
    // this is hard-coded for 8-bit mono

    assertEqual(samples.length, this.numSamples, 'Wrong number of samples');

    var words = this.words;
    var h = this.headerWords;
    for (var t = 0, T = this.numSamples - 1; t < T; t += 2) {
      var x1 = samples[t + 0];
      var x2 = samples[t + 1];
      // 8-bit samples are unsigned
      var sample1 = Math.floor(128 * (x1 + 1));
      var sample2 = Math.floor(128 * (x2 + 1));
      words[h++] = (sample1 << 8) | sample2;
    }
    if (this.numSamples % 2) {
      var x1 = samples[t + 0];
      var sample1 = Math.floor(128 * (x1 + 1));
      words[h++] = sample1 << 8;
    }

    return this._encodeWords();
  },

  encode16: function (samples) {
    // this is hard-coded for 16-bit mono

    assertEqual(samples.length, this.numSamples, 'Wrong number of samples');

    var words = this.words;
    var h = this.headerWords;
    for (var t = 0, T = this.numSamples; t < T; ++t) {
      var x = samples[t];
      // 16-bit samples are signed
      var sample = Math.floor(32768 * x);
      if (sample < 0) sample += 65536; // 2's compliment
      words[h++] = ((sample >> 8) | (sample << 8)) & 65535;
    }

    return this._encodeWords();
  },

  _encodeWords: function () {
    var words = this.words;
    var pairTable = WavEncoder.pairTable;

    var result = 'data:audio/wav;base64,';
    for (var t = 0, T = words.length; t < T; t += 3) {
      var a16 = words[t + 0];
      var b16 = words[t + 1];
      var c16 = words[t + 2];

      // with 4 bits per letter:
      // A A A A B B B B C C C C 
      // A A A B B B C C C D D D 

      var a12 = (a16 >> 4) & 4095;
      var b12 = ((a16 << 8) | (b16 >> 8)) & 4095;
      var c12 = ((b16 << 4) | (c16 >> 12)) & 4095;
      var d12 = c16 & 4095;

      result += ( pairTable[a12]
                + pairTable[b12]
                + pairTable[c12]
                + pairTable[d12] );
    }
    return result;
  }
};

(function(){

  var charTable =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  var pairTable = [];
  for (var ij = 0, IJ = 64*64; ij < IJ; ++ij) {
    pairTable[ij] = charTable[ij >> 6] + charTable[ij & 63];
  }

  WavEncoder.pairTable = pairTable;
})();

