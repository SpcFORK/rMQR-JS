// === AUTHORHEADER ===
// -- rmQR.js --
// @SpcFORK
// @SpectCOW
// $Cow
// === ===

// --- src/rmqrcode
class DataTooLongError extends Error {
  constructor() {
    super(
      "A class represents an error raised when the given data is too long."
    );
  }
}

class IllegalVersionError extends Error {
  constructor() {
    super(
      "A class represents an error raised when the given version name is illegal."
    );
  }
}

class NoSegmentError extends Error {
  constructor() {
    super("A class represents an error raised when no segments are add");
  }
}
// ---

// --- src/rmqrcode/enums
const Color = {
  UNDEFINED: -1,
  WHITE: 0,
  BLACK: 1,
};

const FitStrategy = {
  MINIMIZE_WIDTH: 0,
  MINIMIZE_HEIGHT: 1,
  BALANCED: 2,
};
// ---

// --- src/rmqrcode/format
const ErrorCorrectionLevel = {
  M: 0,
  H: 1,
};

function mask(x, y) {
  return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 == 0;
}

const AlignmentPatternCoordinates = {
  27: [],
  43: [21],
  59: [19, 39],
  77: [25, 51],
  99: [23, 49, 75],
  139: [27, 55, 83, 111],
};

const GeneratorPolynomials = {
  7: [0, 87, 229, 146, 149, 238, 102, 21],
  8: [0, 175, 238, 208, 249, 215, 252, 196, 28],
  9: [0, 95, 246, 137, 231, 235, 149, 11, 123, 36],
  10: [0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45],
  12: [0, 102, 43, 98, 121, 187, 113, 198, 143, 207, 59, 22, 91],
  14: [0, 199, 249, 155, 48, 190, 124, 218, 137, 216, 87, 207, 59, 22, 91],
  16: [
    0, 120, 104, 107, 109, 102, 161, 76, 3, 91, 191, 147, 169, 182, 194, 225,
    120,
  ],
  18: [
    0, 215, 234, 158, 94, 184, 97, 118, 170, 79, 187, 152, 148, 252, 179, 5, 98,
    96, 153,
  ],
  20: [
    0, 17, 60, 79, 50, 61, 163, 26, 187, 202, 180, 221, 225, 83, 239, 156, 164,
    212, 212, 188, 190,
  ],
  22: [
    0, 210, 171, 247, 242, 93, 230, 14, 109, 221, 53, 200, 74, 8, 172, 98, 80,
    219, 134, 160, 105, 165, 231,
  ],
  24: [
    0, 229, 121, 135, 48, 211, 117, 251, 126, 159, 180, 169, 152, 192, 226, 228,
    218, 111, 1, 117, 232, 87, 96, 227, 21,
  ],
  26: [
    0, 173, 125, 158, 2, 103, 182, 118, 17, 145, 201, 111, 28, 165, 53, 161, 21,
    245, 142, 13, 102, 48, 227, 153, 145, 218, 70,
  ],
  28: [
    0, 168, 223, 200, 104, 224, 234, 108, 180, 110, 190, 195, 147, 205, 27, 232,
    201, 21, 43, 245, 87, 42, 195, 212, 119, 242, 37, 9, 123,
  ],
  30: [
    0, 41, 173, 145, 152, 216, 31, 179, 182, 50, 48, 110, 86, 239, 96, 222, 125,
    42, 173, 226, 193, 224, 130, 156, 37, 251, 216, 238, 40, 192, 180,
  ],
};

// ---

// --- src/rmqrcode/util
class GaloisFields {
  constructor() {
    // Irreducible polynomial in GF(2^8)
    let p = (1 << 8) | (1 << 4) | (1 << 3) | (1 << 2) | 1;

    this.e2i = {};
    this.i2e = {};

    this.e2i[0] = 1;
    this.e2i[255] = 1;
    this.i2e[0] = -1;
    this.i2e[1] = 0;

    let tmp = 1;
    for (let e = 1; e < 255; e++) {
      tmp <<= 1;
      if (tmp & (1 << 8)) {
        tmp ^= p;
      }
      this.e2i[e] = tmp;
      this.i2e[tmp] = e;
    }
  }
}

function msb(n) {
  return Math.floor(Math.log2(n)) + 1;
}

function to_binary(data, len) {
  return data.toString(2).padStart(len, "0");
}

function split_into_8bits(data) {
  let codewords = [];
  while (data.length >= 8) {
    codewords.push(data.substr(0, 8));
    data = data.substr(8);
  }
  if (data !== "") {
    codewords.push(data.padEnd(8, "0"));
  }
  return codewords;
}

function compute_bch(data) {
  data = data << 12n;
  let g =
    (1n << 12n) |
    (1n << 11n) |
    (1n << 10n) |
    (1n << 9n) |
    (1n << 8n) |
    (1n << 5n) |
    (1n << 2n) |
    (1n << 0n);

  let tmp_data = data;
  while (msb(tmp_data) >= 13) {
    let multiple = msb(tmp_data) - 13;
    let tmp_g = g << BigInt(multiple);
    tmp_data = tmp_data ^ tmp_g;
  }
  return tmp_data;
}

let gf = new GaloisFields();

function compute_reed_solomon(data, g, num_error_codewords) {
  let f = data.map((x) => parseInt(x, 2));

  for (let i = 0; i < num_error_codewords; i++) {
    f.push(0);
  }

  for (let i = 0; i < data.length; i++) {
    if (f[i] === 0) {
      continue;
    }
    let mult = gf.i2e[f[i]];
    for (let j = 0; j < g.length; j++) {
      f[i + j] = f[i + j] ^ gf.e2i[(g[j] + mult) % 255];
    }
  }

  let rs_codewords = [];
  for (let i = 0; i < num_error_codewords; i++) {
    rs_codewords.push(to_binary(f[f.length - num_error_codewords + i], 8));
  }

  return rs_codewords;
}

// --- src/rmqrcode/encoder
class EncoderBase {
  // Method corresponding to `mode_indicator` abstract method
  static mode_indicator() {
    throw new Error("Method 'mode_indicator' must be defined");
  }

  // Method corresponding to `encode` abstract method
  static encode(data, character_count_indicator_length) {
    if (!this.is_valid_characters(data)) {
      throw new IllegalCharacterError();
    }

    let res = this.mode_indicator();
    res += (
      "0".repeat(character_count_indicator_length) +
      this.characters_num(data).toString(2)
    ).slice(-character_count_indicator_length);
    res += this._encoded_bits(data);
    return res;
  }

  // Method corresponding to `_encoded_bits` abstract method
  static _encoded_bits(data) {
    throw new Error("Method '_encoded_bits' must be defined");
  }

  // Method corresponding to `length` abstract method
  static length(data) {
    throw new Error("Method 'length' must be defined");
  }

  // Method corresponding to `characters_num` abstract method
  static characters_num(data) {
    throw new Error("Method 'characters_num' must be defined");
  }

  // Method corresponding to `is_valid_characters` abstract method
  static is_valid_characters(data) {
    throw new Error("Method 'is_valid_characters' must be defined");
  }
}

class IllegalCharacterError extends Error {
  constructor() {
    super("Illegal character detected");
  }
}

class ByteEncoder extends EncoderBase {
  static mode_indicator() {
    return "011";
  }

  static _encoded_bits(s) {
    let res = "";
    let encoded = Buffer.from(s, "utf-8");
    for (let byte of encoded) {
      res += byte.toString(2).padStart(8, "0");
    }
    return res;
  }

  static length(data, character_count_indicator_length) {
    return (
      this.mode_indicator().length +
      character_count_indicator_length +
      8 * Buffer.byteLength(data, "utf-8")
    );
  }

  static characters_num(data) {
    return Buffer.byteLength(data, "utf-8");
  }

  static is_valid_characters(data) {
    return true; // Any characters can encode in the Byte Mode
  }
}

class AlphanumericEncoder extends EncoderBase {
  static CHARACTER_MAP = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    A: 10,
    B: 11,
    C: 12,
    D: 13,
    E: 14,
    F: 15,
    G: 16,
    H: 17,
    I: 18,
    J: 19,
    K: 20,
    L: 21,
    M: 22,
    N: 23,
    O: 24,
    P: 25,
    Q: 26,
    R: 27,
    S: 28,
    T: 29,
    U: 30,
    V: 31,
    W: 32,
    X: 33,
    Y: 34,
    Z: 35,
    " ": 36,
    $: 37,
    "%": 38,
    "*": 39,
    "+": 40,
    "-": 41,
    ".": 42,
    "/": 43,
    ":": 44,
  };

  static mode_indicator() {
    return "010";
  }

  static _bin(x) {
    return (x >>> 0)
      .toString(2)
      .padStart(x >= 0 ? 32 : 64, 0)
      .slice(x >= 0 ? -32 : -64);
  }

  static _encoded_bits(data) {
    let res = "";
    let data_grouped = this._group_by_2characters(data);
    for (let s of data_grouped) {
      if (s.length == 2) {
        let value = this.CHARACTER_MAP[s[0]] * 45 + this.CHARACTER_MAP[s[1]];
        res += this._bin(value).slice(-11);
      } else if (s.length == 1) {
        let value = this.CHARACTER_MAP[s[0]];
        res += this._bin(value).slice(-6);
      }
    }
    return res;
  }

  static _group_by_2characters(data) {
    let res = [];
    while (data !== "") {
      res.push(data.slice(0, 2));
      data = data.slice(2);
    }
    return res;
  }

  static length(data, character_count_indicator_length) {
    return (
      this.mode_indicator().length +
      character_count_indicator_length +
      11 * Math.floor(data.length / 2) +
      6 * (data.length % 2)
    );
  }

  static characters_num(data) {
    return data.length;
  }

  static is_valid_characters(data) {
    return Boolean(data.match(/^[0-9A-Z\s\$\%\*\+\-\.\/\:]*$/));
  }
}

class NumericEncoder extends EncoderBase {
  static mode_indicator() {
    return "001";
  }

  static _encoded_bits(data) {
    let res = "";
    let data_grouped = this._group_by_3characters(data);
    for (let num of data_grouped) {
      if (num.length == 3) {
        res += parseInt(num, 10).toString(2).padStart(10, "0");
      } else if (num.length == 2) {
        res += parseInt(num, 10).toString(2).padStart(7, "0");
      } else if (num.length == 1) {
        res += parseInt(num, 10).toString(2).padStart(4, "0");
      }
    }
    return res;
  }

  static _group_by_3characters(data) {
    let res = [];
    while (data != "") {
      res.push(data.substring(0, 3));
      data = data.substring(3);
    }
    return res;
  }

  static length(data, character_count_indicator_length) {
    let r = 0;
    if (data.length % 3 === 0) {
      r = 0;
    } else if (data.length % 3 === 1) {
      r = 4;
    } else if (data.length % 3 === 2) {
      r = 7;
    }
    return (
      this.mode_indicator().length +
      character_count_indicator_length +
      10 * Math.floor(data.length / 3) +
      r
    );
  }

  static characters_num(data) {
    return data.length;
  }

  static is_valid_characters(data) {
    return /^[0-9]*$/.test(data);
  }
}

class KanjiEncoder extends EncoderBase {
  static mode_indicator() {
    return "100";
  }

  static _encoded_bits(data) {
    let res = "";
    for (let i = 0; i < data.length; i++) {
      let c = data.charAt(i);
      let shift_jis = Buffer.from(c, "shift-jis");
      let hex_value = shift_jis[0] * 256 + shift_jis[1];

      let sub;
      if (hex_value >= 0x8140 && hex_value <= 0x9ffc) {
        sub = 0x8140;
      } else if (hex_value >= 0xe040 && hex_value <= 0xebbf) {
        sub = 0xc140;
      } else {
        throw new IllegalCharacterError();
      }

      let msb = (hex_value - sub) >> 8;
      let lsb = (hex_value - sub) & 255;
      let encoded_value = msb * 0xc0 + lsb;
      res += encoded_value.toString(2).padStart(13, "0");
    }
    return res;
  }

  static length(data, character_count_indicator_length) {
    return (
      this.mode_indicator().length +
      character_count_indicator_length +
      13 * data.length
    );
  }

  static characters_num(data) {
    return Buffer.byteLength(data, "shift-jis"); // 2
  }

  static is_valid_characters(data) {
    for (let i = 0; i < data.length; i++) {
      let c = data.charAt(i);
      let shift_jis;
      try {
        shift_jis = Buffer.from(c, "shift-jis");
      } catch (UnicodeEncodeError) {
        return false;
      }
      if (shift_jis.length < 2) {
        return false;
      }
      let hex_value = shift_jis[0] * 256 + shift_jis[1];
      if (
        (0x8140 > hex_value || hex_value > 0x9ffc) &&
        (0xe040 > hex_value || hex_value > 0xebbf)
      ) {
        return false;
      }
    }
    return true;
  }
}

const encoders = [
  NumericEncoder,
  AlphanumericEncoder,
  ByteEncoder,
  KanjiEncoder,
];

const rMQRVersions = {
  R7x43: {
    version_indicator: 0b00000,
    height: 7,
    width: 43,
    remainder_bits: 0,
    character_count_indicator_length: {
      [NumericEncoder]: 4,
      [AlphanumericEncoder]: 3,
      [ByteEncoder]: 3,
      [KanjiEncoder]: 2,
    },
    codewords_total: 13,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 13,
          k: 6,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 13,
          k: 3,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 48,
      [ErrorCorrectionLevel.H]: 24,
    },
  },
  R7x59: {
    version_indicator: 0b00001,
    height: 7,
    width: 59,
    remainder_bits: 3,
    character_count_indicator_length: {
      [NumericEncoder]: 5,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 4,
      [KanjiEncoder]: 3,
    },
    codewords_total: 21,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 21,
          k: 12,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 21,
          k: 7,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 96,
      [ErrorCorrectionLevel.H]: 56,
    },
  },
  R7x77: {
    version_indicator: 0b00010,
    height: 7,
    width: 77,
    remainder_bits: 5,
    character_count_indicator_length: {
      [NumericEncoder]: 6,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 4,
    },
    codewords_total: 32,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 32,
          k: 20,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 32,
          k: 10,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 160,
      [ErrorCorrectionLevel.H]: 80,
    },
  },
  R7x99: {
    version_indicator: 0b00011,
    height: 7,
    width: 99,
    remainder_bits: 6,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 5,
    },
    codewords_total: 44,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 44,
          k: 28,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 44,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 224,
      [ErrorCorrectionLevel.H]: 112,
    },
  },
  R7x139: {
    version_indicator: 0b00100,
    height: 7,
    width: 139,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 68,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 68,
          k: 44,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 34,
          k: 12,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 352,
      [ErrorCorrectionLevel.H]: 192,
    },
  },
  R9x43: {
    version_indicator: 0b00101,
    height: 9,
    width: 43,
    remainder_bits: 2,
    character_count_indicator_length: {
      [NumericEncoder]: 5,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 4,
      [KanjiEncoder]: 3,
    },
    codewords_total: 21,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 21,
          k: 12,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 21,
          k: 7,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 96,
      [ErrorCorrectionLevel.H]: 56,
    },
  },
  R9x59: {
    version_indicator: 0b00110,
    height: 9,
    width: 59,
    remainder_bits: 3,
    character_count_indicator_length: {
      [NumericEncoder]: 6,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 4,
    },
    codewords_total: 33,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 33,
          k: 21,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 33,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 168,
      [ErrorCorrectionLevel.H]: 88,
    },
  },
  R9x77: {
    version_indicator: 0b00111,
    height: 9,
    width: 77,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 5,
    },
    codewords_total: 49,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 49,
          k: 31,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 24,
          k: 8,
        },
        {
          num: 1,
          c: 25,
          k: 9,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 248,
      [ErrorCorrectionLevel.H]: 136,
    },
  },
  R9x99: {
    version_indicator: 0b01000,
    height: 9,
    width: 99,
    remainder_bits: 4,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 66,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 66,
          k: 42,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 33,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 336,
      [ErrorCorrectionLevel.H]: 176,
    },
  },
  R9x139: {
    version_indicator: 0b01001,
    height: 9,
    width: 139,
    remainder_bits: 5,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 6,
    },
    codewords_total: 99,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 49,
          k: 31,
        },
        {
          num: 1,
          c: 50,
          k: 32,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 3,
          c: 33,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 504,
      [ErrorCorrectionLevel.H]: 264,
    },
  },
  R11x27: {
    version_indicator: 0b01010,
    height: 11,
    width: 27,
    remainder_bits: 2,
    character_count_indicator_length: {
      [NumericEncoder]: 4,
      [AlphanumericEncoder]: 4,
      [ByteEncoder]: 3,
      [KanjiEncoder]: 2,
    },
    codewords_total: 15,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 15,
          k: 7,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 15,
          k: 5,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 56,
      [ErrorCorrectionLevel.H]: 40,
    },
  },
  R11x43: {
    version_indicator: 0b01011,
    height: 11,
    width: 43,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 6,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 4,
    },
    codewords_total: 31,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 31,
          k: 19,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 31,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 152,
      [ErrorCorrectionLevel.H]: 88,
    },
  },
  R11x59: {
    version_indicator: 0b01100,
    height: 11,
    width: 59,
    remainder_bits: 0,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 5,
    },
    codewords_total: 47,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 47,
          k: 31,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 23,
          k: 7,
        },
        {
          num: 1,
          c: 24,
          k: 8,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 248,
      [ErrorCorrectionLevel.H]: 120,
    },
  },
  R11x77: {
    version_indicator: 0b01101,
    height: 11,
    width: 77,
    remainder_bits: 2,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 67,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 67,
          k: 43,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 33,
          k: 11,
        },
        {
          num: 1,
          c: 34,
          k: 12,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 344,
      [ErrorCorrectionLevel.H]: 184,
    },
  },
  R11x99: {
    version_indicator: 0b01110,
    height: 11,
    width: 99,
    remainder_bits: 7,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 6,
    },
    codewords_total: 89,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 44,
          k: 28,
        },
        {
          num: 1,
          c: 45,
          k: 29,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 44,
          k: 14,
        },
        {
          num: 1,
          c: 45,
          k: 15,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 456,
      [ErrorCorrectionLevel.H]: 232,
    },
  },
  R11x139: {
    version_indicator: 0b01111,
    height: 11,
    width: 139,
    remainder_bits: 6,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 132,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 66,
          k: 42,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 3,
          c: 44,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 672,
      [ErrorCorrectionLevel.H]: 336,
    },
  },
  R13x27: {
    version_indicator: 0b10000,
    height: 13,
    width: 27,
    character_count_indicator_length: {
      [NumericEncoder]: 5,
      [AlphanumericEncoder]: 5,
      [ByteEncoder]: 4,
      [KanjiEncoder]: 3,
    },
    remainder_bits: 4,
    codewords_total: 21,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 21,
          k: 14,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 21,
          k: 7,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 96,
      [ErrorCorrectionLevel.H]: 56,
    },
  },
  R13x43: {
    version_indicator: 0b10001,
    height: 13,
    width: 43,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 6,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 5,
      [KanjiEncoder]: 5,
    },
    codewords_total: 41,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 41,
          k: 27,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 41,
          k: 13,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 216,
      [ErrorCorrectionLevel.H]: 104,
    },
  },
  R13x59: {
    version_indicator: 0b10010,
    height: 13,
    width: 59,
    remainder_bits: 6,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 60,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 60,
          k: 38,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 30,
          k: 10,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 304,
      [ErrorCorrectionLevel.H]: 160,
    },
  },
  R13x77: {
    version_indicator: 0b10011,
    height: 13,
    width: 77,
    remainder_bits: 4,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 6,
    },
    codewords_total: 85,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 42,
          k: 26,
        },
        {
          num: 1,
          c: 43,
          k: 27,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 42,
          k: 14,
        },
        {
          num: 1,
          c: 43,
          k: 15,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 424,
      [ErrorCorrectionLevel.H]: 232,
    },
  },
  R13x99: {
    version_indicator: 0b10100,
    height: 13,
    width: 99,
    remainder_bits: 3,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 113,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 56,
          k: 36,
        },
        {
          num: 1,
          c: 57,
          k: 37,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 37,
          k: 11,
        },
        {
          num: 2,
          c: 38,
          k: 12,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 584,
      [ErrorCorrectionLevel.H]: 280,
    },
  },
  R13x139: {
    version_indicator: 0b10101,
    height: 13,
    width: 139,
    remainder_bits: 0,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 8,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 7,
    },
    codewords_total: 166,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 55,
          k: 35,
        },
        {
          num: 1,
          c: 56,
          k: 36,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 41,
          k: 13,
        },
        {
          num: 2,
          c: 42,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 848,
      [ErrorCorrectionLevel.H]: 432,
    },
  },
  R15x43: {
    version_indicator: 0b10110,
    height: 15,
    width: 43,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 51,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 51,
          k: 33,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 25,
          k: 7,
        },
        {
          num: 1,
          c: 26,
          k: 8,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 264,
      [ErrorCorrectionLevel.H]: 120,
    },
  },
  R15x59: {
    version_indicator: 0b10111,
    height: 15,
    width: 59,
    remainder_bits: 4,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 74,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 74,
          k: 48,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 37,
          k: 13,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 384,
      [ErrorCorrectionLevel.H]: 208,
    },
  },
  R15x77: {
    version_indicator: 0b11000,
    height: 15,
    width: 77,
    remainder_bits: 6,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 103,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 51,
          k: 33,
        },
        {
          num: 1,
          c: 52,
          k: 34,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 34,
          k: 10,
        },
        {
          num: 1,
          c: 35,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 536,
      [ErrorCorrectionLevel.H]: 248,
    },
  },
  R15x99: {
    version_indicator: 0b11001,
    height: 15,
    width: 99,
    remainder_bits: 7,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 136,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 68,
          k: 44,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 4,
          c: 34,
          k: 12,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 704,
      [ErrorCorrectionLevel.H]: 384,
    },
  },
  R15x139: {
    version_indicator: 0b11010,
    height: 15,
    width: 139,
    remainder_bits: 2,
    character_count_indicator_length: {
      [NumericEncoder]: 9,
      [AlphanumericEncoder]: 8,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 7,
    },
    codewords_total: 199,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 66,
          k: 42,
        },
        {
          num: 1,
          c: 67,
          k: 43,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 39,
          k: 13,
        },
        {
          num: 4,
          c: 40,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 1016,
      [ErrorCorrectionLevel.H]: 552,
    },
  },
  R17x43: {
    version_indicator: 0b11011,
    height: 17,
    width: 43,
    remainder_bits: 1,
    character_count_indicator_length: {
      [NumericEncoder]: 7,
      [AlphanumericEncoder]: 6,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 5,
    },
    codewords_total: 61,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 1,
          c: 60,
          k: 39,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 30,
          k: 10,
        },
        {
          num: 1,
          c: 31,
          k: 11,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 312,
      [ErrorCorrectionLevel.H]: 168,
    },
  },
  R17x59: {
    version_indicator: 0b11100,
    height: 17,
    width: 59,
    remainder_bits: 2,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 6,
      [KanjiEncoder]: 6,
    },
    codewords_total: 88,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 44,
          k: 28,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 44,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 448,
      [ErrorCorrectionLevel.H]: 224,
    },
  },
  R17x77: {
    version_indicator: 0b11101,
    height: 17,
    width: 77,
    remainder_bits: 0,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 7,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 122,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 61,
          k: 39,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 1,
          c: 40,
          k: 12,
        },
        {
          num: 2,
          c: 41,
          k: 13,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 624,
      [ErrorCorrectionLevel.H]: 304,
    },
  },
  R17x99: {
    version_indicator: 0b11110,
    height: 17,
    width: 99,
    remainder_bits: 3,
    character_count_indicator_length: {
      [NumericEncoder]: 8,
      [AlphanumericEncoder]: 8,
      [ByteEncoder]: 7,
      [KanjiEncoder]: 6,
    },
    codewords_total: 160,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 2,
          c: 53,
          k: 33,
        },
        {
          num: 1,
          c: 54,
          k: 34,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 4,
          c: 40,
          k: 14,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 800,
      [ErrorCorrectionLevel.H]: 448,
    },
  },
  R17x139: {
    version_indicator: 0b11111,
    height: 17,
    width: 139,
    remainder_bits: 4,
    character_count_indicator_length: {
      [NumericEncoder]: 9,
      [AlphanumericEncoder]: 8,
      [ByteEncoder]: 8,
      [KanjiEncoder]: 7,
    },
    codewords_total: 232,
    blocks: {
      [ErrorCorrectionLevel.M]: [
        {
          num: 4,
          c: 58,
          k: 38,
        },
      ],
      [ErrorCorrectionLevel.H]: [
        {
          num: 2,
          c: 38,
          k: 12,
        },
        {
          num: 4,
          c: 39,
          k: 13,
        },
      ],
    },
    number_of_data_bits: {
      [ErrorCorrectionLevel.M]: 1216,
      [ErrorCorrectionLevel.H]: 608,
    },
  },
};

function computeLength(segments, versionName) {
  return segments.reduce((sum, s) => {
    return (
      sum +
      s.encoder_class.length(
        s.data,
        rMQRVersions[versionName].character_count_indicator_length[
        s.encoder_class
        ]
      )
    );
  }, 0);
}

class SegmentOptimizer {
  constructor() {
    this.MAX_CHARACTER = 360;
    this.INF = 100000;
    this.dp = Array(this.MAX_CHARACTER + 1)
      .fill()
      .map(() =>
        Array(4)
          .fill()
          .map(() => Array(3).fill(this.INF))
      );
    this.parents = Array(this.MAX_CHARACTER + 1)
      .fill()
      .map(() =>
        Array(4)
          .fill()
          .map(() => Array(3).fill(-1))
      );
  }

  compute(data, version, ecc) {
    if (data.length > this.MAX_CHARACTER) {
      throw new DataTooLongError();
    }

    this.qrVersion = rMQRVersions[version];
    this._computeCosts(data);
    const best = this._findBest(data);
    if (best.cost > this.qrVersion.numberOfDataBits[ecc]) {
      throw new DataTooLongError();
    }

    const path = this._reconstructPath(best.index);
    const segments = this._computeSegments(path, data);
    return segments;
  }

  _compute_costs(data) {
    for (let i = 0; i < encoders.length - 1; i++) {
      const encoder_class = encoders[i];
      var character_count_indicator_length =
        this.qr_version[encoder_class.versionName]
          .characterCountIndicatorLength;
      this.dp[0][mode][0] = encoder_class.length(
        "",
        character_count_indicator_length
      );
      this.parents[0][mode][0] = [0, 0, 0];
    }

    for (let n = 0; n < data.length - 1; n++) {
      for (let mode = 0; mode < 4; mode++) {
        // unfilled_length
        for (let unfilled_length = 1; unfilled_length < 3; unfilled_length++) {
          if (this.dp[n][mode][unfilled_length] == this.INF) {
            continue;
          }

          for (let new_mode = 0; new_mode < 4; new_mode++) {
            if (!encoders[new_mode].is_valid_characters(data[n])) {
              continue;
            }

            var cost, new_length;
            if (new_mode == mode) {
              [cost, new_length] =
                this._compute_new_state_without_mode_changing(
                  data[n],
                  new_mode,
                  unfilled_length
                );
            } else {
              [cost, new_length] = this._compute_new_state_with_mode_changing(
                data[n],
                new_mode,
                unfilled_length
              );
            }

            if (
              this.dp[n][mode][unfilled_length] + cost <
              this.dp[n + 1][new_mode][new_length]
            ) {
              this.dp[n + 1][new_mode][new_length] =
                this.dp[n][mode][unfilled_length] + cost;
              this.parents[n + 1][new_mode][new_length] =
                (n, mode, unfilled_length);
            }
          }
        }
      }
    }
  }

  _compute_new_state_without_mode_changing(
    character,
    new_mode,
    unfilled_length
  ) {
    var new_length, cost;
    let encoder_class = encoders[new_mode];
    if (encoder_class == NumericEncoder) {
      new_length = (unfilled_length + 1) % 3;
      cost = unfilled_length == 0 ? 4 : 3;
    } else if (encoder_class == AlphanumericEncoder) {
      new_length = (unfilled_length + 1) % 2;
      cost = unfilled_length == 0 ? 6 : 5;
    } else if (encoder_class == ByteEncoder) {
      new_length = 0;
      cost = 8 * character.length;
    } else if (encoder_class == KanjiEncoder) {
      new_length = 0;
      cost = 13;
    }
    return [cost, new_length];
  }

  _compute_new_state_with_mode_changing(character, new_mode, unfilled_length) {
    var new_length, cost;
    let encoder_class = encoders[new_mode];
    let character_count_indicator_length =
      this.qr_version["character_count_indicator_length"][encoder_class];
    if (
      encoder_class == NumericEncoder ||
      encoder_class == AlphanumericEncoder
    ) {
      new_length = 1;
    } else if (encoder_class == ByteEncoder || encoder_class == KanjiEncoder) {
      new_length = 0;
    }
    cost = encoder_class.length(character, character_count_indicator_length);
    return [cost, new_length];
  }

  _find_best(data) {
    var best = this.INF;
    var best_index = [-1, -1];
    for (let mode = 0; mode < data.length - 1; mode++) {
      for (let unfilled_length = 0; unfilled_length < 3; unfilled_length++) {
        if (this.dp[data.length - 1][mode][unfilled_length] < best) {
          best = this.dp[data.length - 1][mode][unfilled_length];
          best_index = [mode, unfilled_length];
        }
      }
    }
    return { cost: best, index: best_index };
  }

  _reconstruct_path(best_index) {
    var path = [];
    var index = best_index;
    while (index[0] != 0) {
      path.push(index);
      index = this.parents[index[0]][index[1]][index[2]];
    }
    return path.reverse();
  }

  _compute_segments(path, data) {
    var segments = [],
      current_segment_data = "",
      current_mode = -1;
    path.forEach((index) => {
      if (current_mode == -1) {
        current_mode = p[1];
        current_segment_data += data[p[0] - 1];
      } else if (p[1] == current_mode) {
        current_segment_data += data[p[0] - 1];
      } else {
        segments.push({
          data: current_segment_data,
          encoder_class: encoders[current_mode],
        });
        current_segment_data = data[p[0] - 1];
        current_mode = p[1];
      }
    });
    if (current_mode != -1) {
      segments.push({
        data: current_segment_data,
        encoder_class: encoders[current_mode],
      });
    }
    return segments;
  }
}
// ---

// ---

class HTMLQRImage {
  constructor(qr, module_size = 10) {
    this.module_size = module_size;
    this.qrList = qr; // Assuming qr is a 2D list similar to what was used in python
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.qrList[0].length * module_size;
    this.canvas.height = this.qrList.length * module_size;
    this.makeImage();
  }

  show() {
    const img = document.createElement("img");
    img.src = this.canvas.toDataURL("image/png");
    document.body.appendChild(img);
  }

  getBase64Image() {
    return this.canvas.toDataURL("image/png");
  }

  save(name) {
    const a = document.createElement("a");
    a.href = this.canvas.toDataURL("image/png");
    a.download = name;
    a.click();
  }

  makeImage() {
    const ctx = this.canvas.getContext("2d");
    for (let y = 0; y < this.qrList.length; y++) {
      for (let x = 0; x < this.qrList[0].length; x++) {
        const color = this.qrList[y][x] ? "black" : "white";
        ctx.fillStyle = color;
        ctx.fillRect(
          x * this.module_size,
          y * this.module_size,
          this.module_size,
          this.module_size
        );
      }
    }
  }
}

class NODEQRImage {
  constructor(qr, module_size = 10) {
    // Importing the required modules
    const { createCanvas, loadImage } = require("canvas");
    const numpy = require("numpy");

    class QRImage {
      constructor(qr, module_size = 10) {
        this.module_size = module_size;
        const qr_list = qr.toList();
        this.img = createCanvas(
          qr_list[0].length * module_size,
          qr_list.length * module_size
        );
        this.ctx = this.img.getContext("2d");
        this.makeImage(qr_list);
      }

      show() {
        const out = fs.createWriteStream(__dirname + "/test.png");
        const stream = this.img.createPNGStream();
        stream.pipe(out);
        out.on("finish", () => console.log("The PNG file was created."));
      }

      get_ndarray() {
        if (typeof numpy === "undefined" || numpy === null) {
          throw new Error("numpy is not installed");
        }
        return numpy.array(this.img);
      }

      save(name) {
        const out = fs.createWriteStream(__dirname + "/" + name + ".png");
        const stream = this.img.createPNGStream();
        out.on("finish", () =>
          console.log("The PNG file named " + name + " was created.")
        );
      }

      makeImage(qr_list) {
        this.ctx.fillStyle = "#FFFFFF";
        this.ctx.fillRect(0, 0, this.img.width, this.img.height);

        for (let y = 0; y < qr_list.length; y++) {
          for (let x = 0; x < qr_list[0].length; x++) {
            let [r, g, b] = qr_list[y][x] ? [0, 0, 0] : [255, 255, 255];
            this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            this.ctx.fillRect(
              x * this.module_size,
              y * this.module_size,
              (x + 1) * this.module_size,
              (y + 1) * this.module_size
            );
          }
        }
      }
    }

    return new QRImage(qr, module_size);
  }
}

class rMQR {
  static fit(
    data,
    ecc = ErrorCorrectionLevel.M,
    fit_strategy = FitStrategy.BALANCED
  ) {
    return rMQROptimizer.compute(data, ecc, fit_strategy);
  }

  _optimized_segments(data) {
    var optimizer = qr_segments.SegmentOptimizer();
    return optimizer.compute(
      data,
      this.version_name(),
      this._error_correction_level
    );
  }

  constructor(version, ecc, with_quiet_zone = false) {
    if (!rMQR.validate_version(version)) {
      throw new IllegalVersionError(version);
    }

    this._version_name = version;
    this._qr_version = rMQRVersions[version];
    this._height = this._qr_version["height"];
    this._width = this._qr_version["width"];
    this._error_correction_level = ecc;
    this._qr = new rMQRCore(this._width, this._height);
    this._segments = [];
  }

  add_segment(data, encoder_class = ByteEncoder) {
    this._segments.push({
      data: data,
      encoder_class: new encoder_class(data),
    });
  }

  add_segments(segments) {
    for (let i = 0; i < segments.length; i++) {
      this.add_segment(segments[i], segments[i].encoder_class);
    }
  }

  make() {
    if (this._segments.length < 1) {
      throw new NoSegmentError();
    }

    try {
      encoded_data = this._encode_data();
    } catch (e) {
      throw new DataTooLongError();
    }

    this._qr.put_finder_patterns();
    this._qr.put_corner_finder_pattern();
    this._qr.put_alignment_pattern();
    this._qr.put_timing_pattern();

    var format_information = this._compute_format_info();
    this._qr.put_format_information(format_information);

    var codewords_num = this._qr_version["codewords_total"];
    var codewords = this._make_codewords(encoded_data, codewords_num);
    var blocks = this._split_into_blocks(
      codewords,
      this._qr_version["blocks"][this._error_correction_level]
    );
    var final_codewords = this._make_final_codewords(blocks);
    this._qr.put_data(final_codewords, this._qr_version["remainder_bits"]);
  }

  _encode_data() {
    var data_bits_max =
      this._qr_version["number_of_data_bits"][this._error_correction_level];

    var res = "";
    this._segments.forEach((segment) => {
      var character_count_indicator_length =
        this._qr_version["character_count_indicator_length"][
        segment["encoder_class"]
        ];
      res += segment["encoder_class"].encode(
        segment["data"],
        character_count_indicator_length
      );
    });
    res = this._append_terminator_if_possible(res, data_bits_max);

    if (res.length > data_bits_max) {
      throw new DataTooLongError("The data is too long.");
    }

    return res;
  }

  _append_terminator_if_possible(data, data_bits_max) {
    if (data.length - 1 + 3 < data_bits_max) {
      data += "000";
    }
    return data;
  }

  version_name() {
    return `R${this._height}x${this._width}`;
  }

  size() {
    return [this.width(), this.height()];
  }

  width() {
    return this._width;
  }

  height() {
    return this._height;
  }

  value_at(x, y) {
    return this._qr[y][x];
  }

  to_list(with_quiet_zone = true) {
    var res = [];
    if (with_quiet_zone) {
      for (let y = 0; y < this._height; y++) {
        // Py: res.append([0] * (self.width() + QUIET_ZONE_MODULES * 2))
        res.push(Array(this._width + QUIET_ZONE_MODULES * 2).fill(0));
      }

      this._qr.to_binary_list().forEach((row, y) => {
        // Py: res.append([0] * (self.width() + QUIET_ZONE_MODULES * 2))
        res.push(Array(this._width + QUIET_ZONE_MODULES * 2).fill(0));
      });
    } else {
      res = this._qr.to_binary_list();
    }

    return res;
  }

  __str__(with_quiet_zone = true) {
    let res = `rMQR Version R${this._height}x${this._width}:\n`;
    res += self._qr.__str__(with_quiet_zone);
    return res;
  }

  _compute_format_info() {
    var format_information_data = self._qr_version["version_indicator"];
    if (this._error_correction_level == ErrorCorrectionLevel.H) {
      // Py:
      format_information_data |= 1 << 6;
    }
    var reminder_polynomial = compute_bch(format_information_data);
    var format_information_data =
      (format_information_data << 12) | reminder_polynomial;
    return format_information_data;
  }

  _make_codewords(encoded_data, codewords_num) {
    var codewords = split_into_8bits(encoded_data);
    while (true) {
      if (codewords.length >= codewords_num) {
        break;
      }
      codewords.push("11101100");
      if (codewords.length >= codewords_num) {
        break;
      }
      codewords.push("00010001");
    }
    return codewords;
  }
}

class rMQROptimizer {
  // A class to compute optimized rMQR code for input data.

  static compute(data, ecc, fit_strategy) {
    let ok_versions = [];
    let determined_width = new Set();
    let determined_height = new Set();

    for (let version_name in rMQRVersions) {
      let qr_version = rMQRVersions[version_name];
      let optimizer = new SegmentOptimizer();
      let optimized_segments;

      try {
        optimized_segments = optimizer.compute(data, version_name, ecc);
      } catch (err) {
        if (err.name == "DataTooLongError") {
          continue;
        } else {
          throw err;
        }
      }

      let width = qr_version["width"],
        height = qr_version["height"];
      if (!determined_width.has(width) && !determined_height.has(height)) {
        determined_width.add(width);
        determined_height.add(height);
        ok_versions.push({
          version: version_name,
          width: width,
          height: height,
          segments: optimized_segments,
        });
      }
    }

    if (ok_versions.length == 0) {
      throw new DataTooLongError("The data is too long.");
    }

    let sort_key;
    if (fit_strategy == FitStrategy.MINIMIZE_WIDTH) {
      sort_key = (x) => x["width"];
    } else if (fit_strategy == FitStrategy.MINIMIZE_HEIGHT) {
      sort_key = (x) => x["height"];
    } else if (fit_strategy == FitStrategy.BALANCED) {
      sort_key = (x) => x["height"] * 9 + x["width"];
    }

    let selected = ok_versions.sort((a, b) => sort_key(a) - sort_key(b))[0];
    let qr = new rMQR(selected["version"], ecc);
    qr.add_segments(selected["segments"]);
    qr.make();
    return qr;
  }
}

class rMQRCore {
  constructor(width, height) {
    this._width = width;
    this._height = height;
    this._qr = Array(this._height)
      .fill()
      .map(() => Array(this._width).fill(Color.UNDEFINED));
  }

  get_data(x, y) {
    if (0 > x || this._width < x) {
      throw Error("x index out of range");
    }
    if (0 > y || this._height < y) {
      throw Error("y index out of range");
    }
    return this._qr[y][x];
  }

  to_binary_list() {
    return this._qr.map((column) =>
      column.map((x) => (x === Color.BLACK ? 1 : 0))
    );
  }

  put_finder_patterns() {
    this._put_finder_pattern();
    this._put_finder_sub_pattern();
  }

  _put_finder_pattern() {
    // Outer square
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        this._qr[i][j] =
          i === 0 || i === 6 || j === 0 || j === 6 ? Color.BLACK : Color.WHITE;
      }
    }

    // Inner square
    for (let i = 2; i < 5; i++) {
      for (let j = 2; j < 5; j++) {
        this._qr[i][j] = Color.BLACK;
      }
    }

    // Separator
    for (let n = 0; n < 8; n++) {
      if (n < this._height) {
        this._qr[n][7] = Color.WHITE;
      }

      if (this._height >= 9) {
        this._qr[7][n] = Color.WHITE;
      }
    }
  }

  _put_finder_sub_pattern() {
    // Outer square
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        let color =
          i === 0 || i === 4 || j === 0 || j === 4 ? Color.BLACK : Color.WHITE;
        this._qr[this._height - i - 1][this._width - j - 1] = color;
      }
    }

    // Inner square
    this._qr[this._height - 1 - 2][this._width - 1 - 2] = Color.BLACK;
  }

  put_corner_finder_pattern() {
    // Corner finder pattern
    // Bottom left
    this._qr[this._height - 1][0] = Color.BLACK;
    this._qr[this._height - 1][1] = Color.BLACK;
    this._qr[this._height - 1][2] = Color.BLACK;

    if (this._height >= 11) {
      this._qr[this._height - 2][0] = Color.BLACK;
      this._qr[this._height - 2][1] = Color.WHITE;
    }

    // Top right
    this._qr[0][this._width - 1] = Color.BLACK;
    this._qr[0][this._width - 2] = Color.BLACK;
    this._qr[1][this._width - 1] = Color.BLACK;
    this._qr[1][this._width - 2] = Color.WHITE;
  }

  put_alignment_pattern() {
    var center_xs = AlignmentPatternCoordinates[this._width];
    for (var center_x of center_xs) {
      for (var i = 0; i < 3; i++) {
        for (var j = 0; j < 3; j++) {
          var color =
            i == 0 || i == 2 || j == 0 || j == 2 ? Color.BLACK : Color.WHITE;
          // Top side
          this._qr[i][center_x + j - 1] = color;
          // Bottom side
          this._qr[this._height - 1 - i][center_x + j - 1] = color;
        }
      }
    }
  }

  put_timing_pattern() {
    this._put_timing_pattern_horizontal();
    this._put_timing_pattern_vertical();
  }

  _put_timing_pattern_horizontal() {
    for (let j = 0; j < this.width; j++) {
      let color = (j + 1) % 2 ? Color.BLACK : Color.WHITE;
      for (let i of [0, this.height - 1]) {
        if (this.qr[i][j] === Color.UNDEFINED) {
          this.qr[i][j] = color;
        }
      }
    }
  }

  _put_timing_pattern_vertical() {
    const center_xs = [0, this._width - 1].concat(
      AlignmentPatternCoordinates[this._width]
    );
    for (let i = 0; i < this._height; i++) {
      const color = (i + 1) % 2 ? Color.BLACK : Color.WHITE;
      for (const j of center_xs) {
        if (this._qr[i][j] == Color.UNDEFINED) {
          this._qr[i][j] = color;
        }
      }
    }
  }

  putFormatInformation(formatInformation) {
    this._put_format_information_finder_pattern_side(formatInformation);
    this._put_format_information_finder_sub_pattern_side(formatInformation);
  }

  _put_format_information_finder_pattern_side(formatInformation) {
    let mask = 0b011111101010110010;
    formatInformation ^= mask;

    let si = 1,
      sj = 8;
    for (let n = 0; n < 18; n++) {
      let di = n % 5;
      let dj = Math.floor(n / 5);
      this._qr[si + di][sj + dj] =
        (formatInformation >> n) & 1 ? Color.BLACK : Color.WHITE;
    }
  }

  _put_format_information_finder_sub_pattern_side(formatInformation) {
    let mask = 0b100000101001111011;
    formatInformation ^= mask;

    let si = this._height - 1 - 5,
      sj = this._width - 1 - 7;
    for (let n = 0; n < 15; n++) {
      let di = n % 5;
      let dj = Math.floor(n / 5);
      this._qr[si + di][sj + dj] =
        (formatInformation >> n) & 1 ? Color.BLACK : Color.WHITE;
    }

    this._qr[this._height - 1 - 5][this._width - 1 - 4] =
      (formatInformation >> 15) & 1 ? Color.BLACK : Color.WHITE;
    this._qr[this._height - 1 - 5][this._width - 1 - 3] =
      (formatInformation >> 16) & 1 ? Color.BLACK : Color.WHITE;
    this._qr[this._height - 1 - 5][this._width - 1 - 2] =
      (formatInformation >> 17) & 1 ? Color.BLACK : Color.WHITE;
  }

  put_data(final_codewords, remainder_bits_num) {
    let mask_area = this._put_final_codewords(
      final_codewords,
      remainder_bits_num
    );
    this._apply_mask(mask_area);
  }

  _put_final_codewords(finalCodewords, reminderBitsNum) {
    let dy = -1; // Up
    let currentCodewordIdx = 0;
    let currentBitIdx = 0;
    let cx = this.width - 2;
    let cy = this.height - 6;
    let remainingRemainderBits = reminderBitsNum;
    let maskArea = Array.from({ length: this.height }, () =>
      Array(this.width).fill(false)
    );

    while (true) {
      for (let x of [cx, cx - 1]) {
        if (this.qr[cy][x] == Color.UNDEFINED) {
          // Process only empty cell
          if (currentCodewordIdx == finalCodewords.length) {
            // Remainder bits
            this.qr[cy][x] = Color.WHITE;
            maskArea[cy][x] = true;
            remainingRemainderBits -= 1;
          } else {
            // Codewords
            this.qr[cy][x] =
              finalCodewords[currentCodewordIdx][currentBitIdx] == "1"
                ? Color.BLACK
                : Color.WHITE;
            maskArea[cy][x] = true;
            currentBitIdx += 1;
            if (currentBitIdx == 8) {
              currentBitIdx = 0;
              currentCodewordIdx += 1;
            }
          }

          if (
            currentCodewordIdx == finalCodewords.length &&
            remainingRemainderBits == 0
          ) {
            break;
          }
        }
      }

      if (
        currentCodewordIdx == finalCodewords.length &&
        remainingRemainderBits == 0
      ) {
        break;
      }

      // Update current coordinates
      if (dy < 0 && cy == 1) {
        cx -= 2;
        dy = 1;
      } else if (dy > 0 && cy == this.height - 1 - 1) {
        cx -= 2;
        dy = -1;
      } else {
        cy += dy;
      }
    }

    return maskArea;
  }

  _apply_mask(mask_area) {
    for (let y = 0; y < this._height; y++) {
      for (let x = 0; x < this._width; x++) {
        if (!mask_area[y][x]) {
          continue;
        }
        if (mask(x, y)) {
          // mask is expected to be declared elsewhere in your code
          if (this._qr[y][x] == Color.BLACK) {
            // Color is expected to be an object declared elsewhere in your code with properties BLACK and WHITE
            this._qr[y][x] = Color.WHITE;
          } else if (this._qr[y][x] == Color.WHITE) {
            this._qr[y][x] = Color.BLACK;
          }
        }
      }
    }
  }

  toString(withQuietZone = true) {
    const show = {
      WHITE: "_",
      BLACK: "X",
      UNDEFINED: "?",
      true: "X",
      false: "_",
    };

    let res = "";
    if (withQuietZone) {
      res +=
        (show["false"].repeat(this._width + QUIET_ZONE_MODULES * 2) + "\n") *
        QUIET_ZONE_MODULES;
    }

    for (let y = 0; y < this._height; y++) {
      if (withQuietZone) {
        res += show["false"].repeat(QUIET_ZONE_MODULES);
      }

      for (let x = 0; x < this._width; x++) {
        if (show[this._qr[y][x]]) {
          res += show[this._qr[y][x]];
        } else {
          res += this._qr.get_data[y][x];
        }
      }

      if (withQuietZone) {
        res += show["false"].repeat(QUIET_ZONE_MODULES);
      }

      res += "\n";
    }

    if (withQuietZone) {
      res +=
        (show["false"].repeat(this._width + QUIET_ZONE_MODULES * 2) + "\n") *
        QUIET_ZONE_MODULES;
    }

    return res;
  }
}

class Block {
  // A class represents data block. This class represents data block.
  // A block consists data part and error correction code (ecc) part.

  constructor(data_codewords_num, ecc_codewords_num) {
    this._data_codewords_num = data_codewords_num;
    this._data_codewords = [];
    this._ecc_codewords_num = ecc_codewords_num;
    this._ecc_codewords = [];
  }

  set_data_and_compute_ecc(data_codewords) {
    // Set data and compute ecc.
    // Args:
    //   data_codewords (list): The list of codeword strings.
    // Returns:
    //   void
    this._data_codewords = data_codewords;
    this._compute_ecc_codewords();
  }

  get_data_at(index) {
    // Get data codeword at the index.
    // Args:
    //   index (int): The index.
    // Return:
    //   str: The data codeword.
    return this._data_codewords[index];
  }

  get_ecc_at(index) {
    // Get ecc codeword at the index.
    // Args:
    //   index (int): The index.
    // Return:
    //   str: The ecc codeword.
    return this._ecc_codewords[index];
  }

  data_length() {
    // Get the number of data codewords
    return this._data_codewords.length;
  }

  ecc_length() {
    // Get the number of ecc codewords
    return this._ecc_codewords.length;
  }

  _compute_ecc_codewords() {
    // Computes the ecc codewords with the data codewords.
    let g = GeneratorPolynomials[this._ecc_codewords_num];
    this._ecc_codewords = compute_reed_solomon(
      this._data_codewords,
      g,
      this._ecc_codewords_num
    );
  }
}

class HTMLrMQR {
  // A class represents HTML rMQR code.
  // This class uses the rMQR class.

  constructor(version, ecc, with_quiet_zone = false) {
    this._version = version;
    this._ecc = ecc;
    this._with_quiet_zone = with_quiet_zone;
    this._qr = new rMQR(version, ecc, with_quiet_zone);
  }

  drawOnCanvas(canvas, x, y, size) {
    // Draws the mQR code on the canvas.
    // Args:
    //   canvas (HTMLCanvasElement): The canvas.
    //   x (int): The x coordinate.
    //   y (int): The y coordinate.
    //   size (int): The size.
    // Returns:
    //   void

  }
}

// Example usage:
// let qr = new rmQR(8, 8, Color.BLACK);
// let HTMLQR = HTMLQRImage()