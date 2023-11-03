// -=- AUTHORHEADER -=-
// -- authorheader.js --
// @SpcFORK
// @SpectCOW
// -=-

/**
 * A getter for author info.
 *
 * ---
 * @async
 * @function
 * @name AuthorHeader
 * @param {Object} prefs - The preferences for the author header.
 * @param {Function} cb - A callback function.
 * @description
 * Generates the author header for the script.
 * @example
 * AuthorHeader({
 *   location: "./script.js",
 * }, () => {...})
 */
async function AuthorHeader(prefs, cb) {
  prefs ? prefs : (prefs = {});
  cb ? cb : (cb = function () {});

  // FDAO = "Fucking D-Awesome Object" -Ghostwriter
  prefs.location = prefs.location || "./script.js";

  // Snippeteer Funct #9
  var checkEnvironment = () => {
    // So nasty I'd rather write it as if it were a Py function.

    let isImportSupported = false;

    try {
      eval("import.meta");
      isImportSupported = true;
    } catch {}

    if (isImportSupported) {
      // ES Module environment
      return "ES Module";
    } else if (
      typeof module !== "undefined" &&
      module?.exports &&
      typeof window === "undefined"
    ) {
      // Node.js environment
      return "Node";
    } else if (
      typeof window !== "undefined" &&
      typeof window?.document !== "undefined"
    ) {
      // Browser environment
      return "Browser";
    } else if (
      typeof WorkerGlobalScope !== "undefined" &&
      self instanceof WorkerGlobalScope
    ) {
      // Web Worker environment
      return "Web Worker";
    } else {
      // Unknown environment
      return "Unknown";
    }
  };

  let _env_ = checkEnvironment();

  async function node_getFile() {
    let _fs = globalThis?.fs
      ? globalThis.fs
      : globalThis?.require?.resolve?.("fs");

    if (_fs) {
      return _fs.readFileSync(prefs.location, "utf8");
    }
  }

  async function node_getFile_async() {
    let _fs = globalThis?.fs
      ? globalThis.fs
      : globalThis?.require?.resolve?.("fs");

    if (_fs) {
      return await _fs.promises.readFile(prefs.location, "utf8");
    }
  }

  async function browser_getFile() {
    if (prefs.location.startsWith("./")) {
      prefs.location = prefs.location.slice(2);
      prefs.location = window.location.toString() + prefs.location;
    }

    // Fetch the file from the URL
    let _url = new URL(prefs.location);
    let _response = await fetch(_url);
    let _text = await _response.text();
    return _text;
  }

  function esm_getFile() {
    // ES Module environment
    let _esm = globalThis?.import?.meta?.url;
    if (_esm) {
      return _esm;
    }
  }

  async function fetchSRC() {
    switch (_env_) {
      case "ES Module":
        return await esm_getFile();
        break;
      case "Node":
        return await node_getFile();
        break;
      case "Browser":
        return await browser_getFile();
        break;
      case "Web Worker":
        return await node_getFile_async();
        break;
      case "Unknown":
        return await node_getFile();
        break;

      default:
        return await browser_getFile();
        break;
    }
  }

  async function getFile() {
    let _src = await fetchSRC();
    if (_src) {
      return _src;
    } else {
      return "";
    }
  }

  async function formatExpectation() {
    var fulldata = {};

    // Types of AuthorHeader styles
    // =-= AUTHORHEADER =-=
    // ...
    // =-= =-=

    // -=- AUTHORHEADER -=-
    // ...
    // -=- -=-

    // *** AUTHORHEADER ***
    // ...
    // *** ***

    // ### AUTHORHEADER ###
    // ...
    // ### ###

    // Rule: line 1: 3 symbols, +AUTHORHEADER, then same as match 1
    // Rule: line 2: 3 symbols + space + same as match 1

    let src = await getFile();
    // console.log(src);
    prefs.src = src;

    if (!prefs) {
      return fulldata;
    }

    let regex =
      /^\/[*/] *([^\s]*?[\W]){3} *authorheader *\1{3} *(?:\*\/)*([^]+)\/[*/] *\1{3} *\1{3} *(?:\*\/)*/gim;

    let matchees = regex.exec(prefs.src)?.[2];

    // console.log(matchees);

    if (!matchees) {
      return fulldata;
    }

    // COMMENT DESTRCT
    // Format:
    // -- {{ location }} --
    // @{{ Author }}
    // ${{ METADATA }}
    // ${{ METADATA }}: {{ METADATA }}

    function commentParser(comments) {
      let regex = /^\/\/ *([^\n]*?) *(?:\n|$)/gim;

      let matchees = comments.match(regex);
      // console.log(matchees, 'cmprt');
      let formatted = [];

      matchees.forEach((match) => {
        // console.log(match);
        let formattedMatch = match.replace(/\n/g, "");
        // console.log(formattedMatch);

        if (formattedMatch.startsWith("/")) {
          if (formattedMatch.startsWith("//")) {
            formattedMatch = formattedMatch.replace(/\//g, "");
          } else if (formattedMatch.startsWith("/*")) {
            formattedMatch = formattedMatch.replace(/\*/g, "");
          }
        }

        formatted.push(formattedMatch);
      });
      return formatted;
    }

    let comments = commentParser(matchees.trim());

    function atDataParser(atData) {
      atData = atData.slice(1);
      fulldata?.atData
        ? fulldata.atData.push(atData)
        : (fulldata.atData = [atData]);
      return;
    }

    function metaParser(meta) {
      meta = meta.slice(1);

      if (meta.includes(":")) {
        let metaData = meta.split(":");
        metaData[0] = metaData[0].trim();
        metaData[1] = metaData[1].trim();

        metaData = {
          [metaData[0]]: metaData[1],
        };

        fulldata?.metaData
          ? fulldata.metaData.push(metaData)
          : (fulldata.metaData = [metaData]);
      } else {
        fulldata?.meta ? fulldata.meta.push(meta) : (fulldata.meta = [meta]);
      }
      return;
    }
    function pathParser(path) {
      path = path.slice(2);
      path = path.slice(0, -2).trim();
      fulldata?.path ? fulldata.path.push(path) : (fulldata.path = [path]);
      return;
    }

    // console.log(comments);

    comments.forEach((comment) => {
      if (typeof comment === "string") {
        let trimmed = comment.trim();

        if (trimmed.startsWith("@")) atDataParser(trimmed);
        else if (trimmed.startsWith("$")) metaParser(trimmed);
        else if (trimmed.startsWith("--") && trimmed.endsWith("--"))
          pathParser(trimmed);
      } else {
        return fulldata;
      }
    });

    // console.log(fulldata);
    return fulldata;
  }

  async function compile() {
    let formatted = await formatExpectation();
    if (!formatted) {
      return;
    }
    return formatted;
  }

  let _returns_ = {
    compile,
    getFile,
    formatExpectation,
    prefs,
  };

  cb(_returns_);

  return _returns_;
}

// (async () => {
//   let ah = await AuthorHeader({
//     location: './script.js'
//   });
//   console.log(ah);
//   console.log(await ah.compile());

// })();
