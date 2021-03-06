var ArcJS = (function() {
  var ArcJS = this;

  ArcJS.version = '0.1.5';
#ifdef NO_EVAL
  ArcJS.version += ' (no-eval)';
#endif

  var todos_after_all_initialized = [];

#ifdef NO_EVAL
#include "../lib/classify.simple.js"
#else
#include "../lib/classify.js"
#endif
#include "stack.js"
#include "symbol.js"
#include "cons.js"
#include "char.js"
#include "table.js"
#include "closure.js"
#include "call.js"
#include "continuation.js"
#include "tagged.js"
#include "box.js"
#include "regexp.js"
#include "reader.js"
#include "namespace.js"
#include "primitives.js"
#include "preload.js"
#include "vm.js"
#include "context.js"

  for (var i = 0, l = todos_after_all_initialized.length; i<l; i++) {
    (todos_after_all_initialized[i])();
  }
  delete todos_after_all_initialized;

  return ArcJS;
}).call(typeof exports !== 'undefined' ? exports : {});
