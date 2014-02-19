# The Rationa Keyboard

A browser app to demonstrate harmony in just intonation.
http://fritzo.org/keys

The Rational Keyboard is a browser app to play with harmony on the rational number line.
Imagine a piano with infinitely many keys,
[one for each rational number](http://en.wikipedia.org/wiki/Just_intonation),
and the keys move around and resize based on
[what sounds good](http://en.wikipedia.org/wiki/Consonance_and_dissonance),
using some
[really cool math](https://www.google.com/search?q=arnold+tongues).

Audio is synthesized in background
[Web Workers](https://developer.mozilla.org/en-US/docs/Web/Guide/Performance/Using_web_workers)
and played with
[HTML5 Audio objects](https://developer.mozilla.org/En/HTML/Element/Audio),
and the interactive visualizations use a
[2D HTML5 Canvas](https://developer.mozilla.org/en/HTML/Canvas).
Check out the source at [github](http://github.com/fritzo/rationalkeyboard),
or just grab the [audio encoder](http://github.com/fritzo/wavencoderjs) for your own apps.

Audio seems to work best in recent Firefox and Chrome releases,
but HTML5 audio is still a young technology.
Sometimes pausing helps to unglitch audio.
