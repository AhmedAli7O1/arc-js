var Cons = function(car, cdr) {
  this.car = car; this.cdr = cdr;
}
var nil = (function() {
  var x = new Cons(null, null);
  x.car = x; x.cdr = x;
  return x;
})();

var t = true;

var s_int    = Symbol.get('int');
var s_num    = Symbol.get('num');
var s_string = Symbol.get('string');
var s_sym    = Symbol.get('sym');
var s_cons   = Symbol.get('cons');
var s_fn     = Symbol.get('fn');

var list_to_javascript_arr = function(lis) {
  if (lis !== nil && type(lis).name !== 'cons') return [lis];
  var rt = [];
  while (lis !== nil) {
    rt.push(car(lis));
    lis = cdr(lis);
  }
  return rt;
}

var javascript_arr_to_list = function(arr) {
  var l = arr.length;
  if (l === 0) return nil;
  var rt = cons(arr[0], nil);
  var tmp = rt;
  for (var i=1; i<l; i++) {
    tmp.cdr = cons(arr[i], nil);
    tmp = tmp.cdr;
  }
  return rt;
}

var stringify = function(x) {
  var type_name = type(x).name;
  switch (type_name) {
  case 'int':
  case 'num':
  case 'string':
    return JSON.stringify(x);
  case 'sym':
    if (x === nil) return 'nil';
    if (x === t) return 't';
    return x.name;
  case 'cons':
    return "(" + stringify_list(x) + ")";
  case 'fn':
    return "#<" + (typeof x === 'function' ?
                   'prim' + (x.prim_name ? (":"+x.prim_name) : "") :
                   'fn' + (x.name ? (":"+x.name) : "")) + ">";
  }
  return x+'';
}

var stringify_list = function(cons) {
  var a = car(cons), d = cdr(cons);
  return stringify(a) +
    ((d === nil) ? '' :
     (d instanceof Cons) ?
     ' ' + stringify_list(d) :
     ' . ' + stringify(d));
};

var uniq_counter = 0;

var primitives = ({
  'cons': function(car, cdr) {
    return new Cons(car, cdr);
  },
  'car':  function(x) {
    if (x instanceof Cons) return x.car;
    else throw new Error(x + ' is not cons type.');
  },
  'cdr': function(x) {
    if (x instanceof Cons) return x.cdr;
    else throw new Error(x + ' is not cons type.');
  },
  'caar': function(x) { return car(car(x)); },
  'cadr': function(x) { return car(cdr(x)); },
  'cddr': function(x) { return cdr(cdr(x)); },
  'list': function($$) {
    for (var i=arguments.length-1, rt=nil; -1<i; i--) {
      rt = cons(arguments[i], rt);
    }
    return rt;
  },
  'len': function(lis) {
    var i = 0;
    while (lis !== nil) {
      i++; lis = cdr(lis);
    }
    return i;
  },
  'rev': function(lis) {
    var rt = nil;
    while (lis !== nil) {
      rt = cons(car(lis), rt);
      lis = cdr(lis);
    }
    return rt;
  },
  'nrev': function(lis, $$) {
    var r = $$ || nil;
    var tmp;
    while (lis !== nil && 'cdr' in lis) {
      tmp = lis.cdr;
      lis.cdr = r;
      r = lis;
      lis = tmp;
    }
    return r;
  },
  'uniq': function() {
    var rt = Symbol.get('%g'+uniq_counter);
    uniq_counter++;
    return rt;
  },
  'type': function(x) {
    if (x === nil || x === t) return s_sym;
    var type = typeof x;
    switch (type) {
    case 'string':
      return s_string;
    case 'number':
      return (!!(x % 1)) ? s_num : s_int;
    case 'function':
      return s_fn;
    case 'object':
      if (x instanceof Symbol)  return s_sym;
      if (x instanceof Cons)    return s_cons;
      if (x instanceof Closure) return s_fn;
    default:
      return Symbol.get('javascript-' + type);
    }
  },
  'err': function($$) {
    throw new Error(
      ('error: ' +
       Array.prototype.map.call(
         arguments,
         function(x) { return type(x) === s_string ? x : stringify(x); }
       ).join(' ') + '.'));
  },
  '+':   function($$) {
    var l = arguments.length;
    if (0 < l && (arguments[0] === nil || type(arguments[0]) === s_cons))
      return primitives['%list-append'].apply(this, arguments);
    for (var i=0, rt = 0; i<l; i++)
      rt += arguments[i];
    return rt;
  },
  '%list-append': function($$) {
    var dotted = nil;
    for (var i=0, l=arguments.length, rt = nil; i<l; i++) {
      if (dotted !== nil) throw new Error(
        ('error: +(list): contract violation (' +
         Array.prototype.map.call(arguments, stringify).join(' ') + ')'));
      var lis = arguments[i];
      while (lis !== nil) {
        rt = cons(car(lis), rt);
        lis = cdr(lis);
        if (!(lis instanceof Cons)) { dotted = lis; break; }
      }
    }
    return nreverse(rt, dotted);
  },
  '-': function(x, $$) {
    for (var i=1, l=arguments.length, rt = arguments[0]; i<l; i++)
      rt -= arguments[i];
    return rt;
  },
  '*': function($$) {
    for (var i=0, l=arguments.length, rt = 1; i<l; i++)
      rt *= arguments[i];
    return rt;
  },
  '/': function(x, $$) {
    for (var i=1, l=arguments.length, rt = arguments[0]; i<l; i++)
      rt /= arguments[i];
    return rt;
  },
  '<': function($$) {
    for (var i=1, l=arguments.length; i<l; i++) {
      if (!(arguments[i-1] < arguments[i])) return nil;
    }
    return t;
  },
  '>': function($$) {
    for (var i=1, l=arguments.length; i<l; i++) {
      if (!(arguments[i-1] > arguments[i])) return nil;
    }
    return t;
  },
  '<=': function($$) {
    for (var i=1, l=arguments.length; i<l; i++) {
      if (!(arguments[i-1] <= arguments[i])) return nil;
    }
    return t;
  },
  '>=': function($$) {
    for (var i=1, l=arguments.length; i<l; i++) {
      if (!(arguments[i-1] >= arguments[i])) return nil;
    }
    return t;
  },
  'no': function(x) {
    return (x === nil) ? t : nil;
  },
  'is': function(a, b) {
    return (a === b) ? t : nil;
  },
  'mem': function(test, lis) {
    if (lis === nil) return nil;
    if (type(test).name === 'fn') {
      return new Call('%mem-fn', [test, lis]);
    } else {
      while (lis !== nil) {
        if (car(lis) === test) return lis;
        lis = cdr(lis);
      }
      return nil;
    }
  },
  'pos': function(test, lis) {
    if (lis === nil) return nil;
    if (type(test).name === 'fn') {
      return new Call('%pos-fn', [test, lis]);
    } else {
      var i = 0;
      while (lis !== nil) {
        if (car(lis) === test) return i;
        lis = cdr(lis);
        i++;
      }
      return nil;
    }
  },
  'atom': function(x) {
    return (type(x).name === 'cons') ? nil : t;
  },
  'apply': function(fn, $$) {
    for (var i=1, l=arguments.length, args=[]; i<l; i++)
      args = args.concat(list_to_javascript_arr(arguments[i]));
    return new Call(fn, args);
  },
  'pair': function(lis) {
    var rt = nil, toggle = true;
    while (lis !== nil) {
      if (toggle) {
        rt = cons(cons(car(lis), nil), rt);
      } else {
        car(rt).cdr = cons(car(lis), nil);
      }
      lis = cdr(lis);
      toggle = !toggle;
    }
    return nreverse(rt);
  },
  'union': function(test, lis1, lis2) {
    if (test === primitives['is']) {
      var arr = list_to_javascript_arr(lis1);
      while (lis2 !== nil) {
        var ca = car(lis2);
        if (arr.indexOf(ca) < 0) arr.push(ca);
        lis2 = cdr(lis2);
      }
      return javascript_arr_to_list(arr);
    } else {
      return new Call('%union-fn', [test, lis1, lis2]);
    }
  },
  'dedup': function(lis) {
    var arr = list_to_javascript_arr(lis);
    var narr = [];
    for (var i=0, l=arr.length; i<l; i++) {
      if (narr.indexOf(arr[i]) < 0) narr.push(arr[i]);
    }
    return javascript_arr_to_list(narr);
  }
});

for (var n in primitives) {
  var f = primitives[n];
  if ((typeof f) === 'function') {
    f.toString().match(/^function.*?\((.*?)\)/);
    var args = RegExp.$1;
    if (args === '') {
      f.dotpos = -1;
      f.arglen = 0;
      f.prim_name = n;
    } else {
      var vs = args.split(/\s*,\s*/g);
      f.dotpos = vs.indexOf('$$');
      f.arglen = vs.length;
      f.prim_name = n;
    }
  }
}

var cons  = primitives.cons;
var list  = primitives.list;
var car   = primitives.car;
var cdr   = primitives.cdr;
var type  = primitives.type;
var nreverse = primitives.nrev;
