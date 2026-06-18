'use strict';
/* Canonical MT19937 (32-bit). Reproducible given the same seed and call order. */
function MT19937(seed) {
  this.mt = new Array(624);
  this.index = 624;
  this.mt[0] = seed >>> 0;
  for (let i = 1; i < 624; i++) {
    const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
    this.mt[i] = ((((((s & 0xffff0000) >>> 16) * 1812433253) << 16) >>> 0) +
                  (s & 0x0000ffff) * 1812433253 + i) >>> 0;
  }
}
MT19937.prototype._generate = function () {
  for (let i = 0; i < 624; i++) {
    const y = (((this.mt[i] & 0x80000000) >>> 0) + (this.mt[(i + 1) % 624] & 0x7fffffff)) >>> 0;
    this.mt[i] = (this.mt[(i + 397) % 624] ^ (y >>> 1)) >>> 0;
    if (y & 1) this.mt[i] = (this.mt[i] ^ 2567483615) >>> 0;
  }
  this.index = 0;
};
MT19937.prototype.u32 = function () {
  if (this.index >= 624) this._generate();
  let y = this.mt[this.index++];
  y ^= y >>> 11;
  y = (y ^ ((y << 7) & 2636928640)) >>> 0;
  y = (y ^ ((y << 15) & 4022730752)) >>> 0;
  y ^= y >>> 18;
  return y >>> 0;
};
MT19937.prototype.f64 = function () { return this.u32() / 4294967296; }; // [0,1)
module.exports = MT19937;
