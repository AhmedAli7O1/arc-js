var vm = new VM();
var reader = new Reader();

var expect = chai.expect;

function evaluate(code) {
  var asm = [
    ['frame', 8],
    ['constant', vm.reader.read(code)],
    ['argument'],
    ['constant', 1],
    ['argument'],
    ['refer-global', 'do-compile'],
    ['indirect'],
    ['apply'],
    ['halt']
  ];
  vm.cleanup();
  vm.set_asm(asm);
  var compiled = vm.run();
  vm.cleanup();
  vm.load(compiled);
  return vm.run();
}

function compile_srv(code, after) {
  $.ajax({
    url: '/arc-compiler',
    type: 'POST',
    data: { code: code }
  }).done(after).error(function(r) {
    throw new Error(r.responseText);
  });
};

describe('Reader', function(){
  function rex(str) {
    return expect(reader.read(str));
  }
  describe('atom', function(){
    it('number', function() {
      rex("0").equal(0);
      rex("42").equal(42);
      rex("0002").equal(2);
      rex("10.5").equal(10.5);
      rex("22.2903").equal(22.2903);
      rex("-inf.0").equal(-Infinity);
      rex("+inf.0").equal(+Infinity);
      rex("#x10").equal(16);
      rex("#d10").equal(10);
      rex("#o10").equal(8);
      rex("#b10").equal(2);
      rex("1e3").equal(1e3);
      //TODO
      // rex("2/7")      // flaction
      // rex("2.0-3.0i") // imagine
      // rex("1/2+3/4i") // expression
    });
    it('symbol', function() {
      rex('a').equal(Symbol.get('a'));
      rex('abcd').equal(Symbol.get('abcd'));
      rex('u-n.k_o#abc$$%%moemoe').equal(Symbol.get('u-n.k_o#abc$$%%moemoe'));
      rex('nil').equal(nil);
      rex('t').equal(t);
    });
    // it('character', function() {});
    it('string', function() {
      rex('"abc"').equal("abc");
      rex('"ab\\"cd"').equal('ab"cd');
      rex('"ab\\ncd"').equal('ab\ncd');
      rex('"ab\\rcd"').equal('ab\rcd');
      rex('"ab\\scd"').equal('ab\scd');
      rex('"ab\\tcd"').equal('ab\tcd');
      // TODO more escape patterns.
    });
    it('cons', function() {
      function s(x) { return Symbol.get(x); }
      rex("(a b c)").to.deep.equal(
        cons(s('a'), cons(s('b'), cons(s('c'), nil))));
      rex("(a (b c))").to.deep.equal(
        cons(s('a'), cons(cons(s('b'), cons(s('c'), nil)), nil)));
      rex("(a . b)").to.deep.equal(cons(s('a'), s('b')));
      rex("(a b (d (e . f)) g)").to.deep.equal(
        cons(s('a'),
             cons(s('b'),
                  cons(cons(s('d'), cons(cons(s('e'), s('f')), nil)),
                       cons(s('g'), nil)))));
    });
    it('quote/quasiquote', function() {
      function s(x) { return Symbol.get(x); }
      rex("'a").to.deep.equal({ car: s('quote'),
                                cdr: { car: s('a'),
                                       cdr: nil}});
      rex("`a").to.deep.equal({ car: s('quasiquote'),
                                cdr: { car: s('a'),
                                       cdr: nil}});
      rex(",a").to.deep.equal({ car: s('unquote'),
                                cdr: { car: s('a'),
                                       cdr: nil}});
      rex(",@a").to.deep.equal({ car: s('unquote-splicing'),
                                 cdr: { car: s('a'),
                                        cdr: nil}});
      expect(stringify(reader.read("`(1 2 ,x ,(+ 1 y))"))).to.equal('(quasiquote (1 2 (unquote x) (unquote (+ 1 y))))');
    });
    it('shortfn', function() {
      expect(stringify(reader.read("[car _]"))).to.equal('(%shortfn (car _))');
    });
  });
});

describe('VM eval', function(){

  function eval_eql(code, res) {
    var args = arguments;
    for (var i=0, l=args.length; i<l; i+=2) (function(i){
      var code = args[i];
      var res  = args[i+1];
      it(code, function() {
        expect(evaluate(code)).eql(res);
        /*
        compile_srv(code, function(asm) {
          expect(vm.run(asm)).eql(res);
          done();
        });
        */
      });
    })(i);
  }

  function eval_print_eql(code, res) {
    var args = arguments;
    for (var i=0, l=args.length; i<l; i+=2) (function(i){
      var code = args[i];
      var res  = args[i+1];
      it(code, function() {
        expect(stringify(evaluate(code))).eql(res);
        /*
        compile_srv(code, function(asm) {
          expect(stringify(vm.run(asm))).eql(res);
          done();
        });
        */
      });
    })(i);
  }

  describe('values', function(){
    eval_eql(
      't',                                       t,
      'nil',                                     nil,
      '1',                                       1,
      '20',                                      20,
      '"abc"',                                   "abc",
      '"def\\nxyz"',                             "def\nxyz",
      "'(1 2 3)",                                cons(1,cons(2,cons(3,nil))),
      "'(1 . 2)",                                cons(1,2),
      "'a",                                      Symbol.get('a')
    );
  });

  describe('exprs', function(){
    eval_eql(
      '(+ 1 2)',                                 3,
      '(+ (/ 1 2) 3)',                           3.5,
      '(- 1 2 3)',                               -4,
      '(+ 1 (+ 2 3))',                           6,
      '(+ (- 3 4) (+ 1 (- 1 (* 3 2))))',         -5,
      '((fn (a b) (+ a b)) 10 20)',              30,
      "(if 'a 1 2)",                             1,
      '(if nil 1 2)',                            2,

      '((fn (c d)' +
        '  (* c' +
        '   ((fn (a b) (+ (- d c) a b d))' +
        '    d (+ d d))))' +
        ' 10 3)',                                  50,

      '((fn (a b)' +
        '   (+ a b)' +
        '   (- a b)' +
        '   (/ a b))' +
        ' 20 10)',                                 2,

      '((fn (a b)' +
        '  (do (+ 1 2)' +
        '    (+ a b)))' +
        ' 10 20)',                                 30,


      '((fn (a b)' +
        '   (assign a 10)' +
        '   (* a b))' +
        ' 1 3)', 30,

      '((fn (a b)' +
        '   (assign b 30)' +
        '   (* a b))' +
        ' 1 3)', 30,

      '((fn (a b)' +
        '   (assign a 10)' +
        '   (assign b 30)' +
        '   (* a b))' +
        ' 1 3)', 300,

      '((fn (a b)' +
        '   ((fn ()' +
        '      (assign a 10)))' +
        '   (* a b))' +
        ' 1 3)', 30,

      '((fn (a)' +
        '   ((fn (b)' +
        '      ((fn (c d)' +
        '         (assign a 100)' +
        '         ((fn (e)' +
        '            (assign e (+ a e))' +
        '            (assign c 20)' +
        '            (+ a b c d e))' +
        '          5))' +
        '       3 4))' +
        '    2))' +
        ' 1)', 231,

      '(> 10 20)', nil,

      '(< 10 10)', nil,
      '(< 10 11)', t,
      '(<= 10 10)', t,
      '(<= 10 9)',  nil,
      '(no nil)', t,
      '(no 10)', nil,
      '(is (no t) nil)', t
    );
  });

  describe('with / let', function(){

    evaluate('(def nth2 (n lis)' +
             '  (with (x (car lis) next (cdr lis))' +
             '    (if (< n 1) x (nth2 (- n 1) next))))');

    eval_eql(
      '(with (a 10) a)',   10,
      '(let a 10 a)',      10,

      '((fn (a b)' +
      ' (with (x (+ a b) y (- a b))' +
      '   (with (z (/ x y))' +
      '     (- a b x y z))))' +
      ' 3 5)',             -4,

      '(nth2 3 \'(1 2 3 4 5))', 4
    );
  });

  describe('def', function() {
    evaluate('(def fib (n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2)))))');
    eval_eql(
      '(fib 10)', 55
    );
  });

  describe('fn dotted argument', function() {
    evaluate('(def a (x y) (+ x y))');
    evaluate('(def b (x . y) y)');
    evaluate('(def c x x)');
    eval_eql(
      '(a 1 2)', 3,
      '(b 1 2)', cons(2, nil),
      '(b 1)', nil,
      '(b 1 2 3 4)', cons(2, cons(3, cons(4, nil))),
      '(c)', nil,
      '(c 1)', cons(1, nil),
      '(c 1 2)', cons(1, cons(2, nil))
    );
  });

  describe('ccc', function () {
    eval_print_eql(
      // inner -> outer (non-tail-call)
      '(+ 1 (ccc (fn (c) (+ 3 5) (c (* 8 3)))))', "25",

      // inner -> outer (non-tail-call and through-native)
      '(+ 1 (ccc (fn (c) (+ 3 5) (apply (fn () (c (* 8 3)))))))', "25",

      // hungup case (TODO fix this. hint: evaluating order of arguments)
      /*
      ('((fn (x)' +
       '  ((fn (cc)' +
       '      (assign x (+ x (ccc (fn (c) (assign cc c) (c 1)))))' +
       '      (if (< x 4) (cc 2) x))' +
       '    nil))' +
       ' 0)'), "5",
      */

      // outer -> inner (non-tail-call)
      ('((fn (x)' +
       '  ((fn (cc)' +
       '      (assign x (+ (ccc (fn (c) (assign cc c) (c 1))) x))' +
       '      (if (< x 4) (cc 2) x))' +
       '    nil))' +
       ' 0)'), "5",

      // outer -> inner (non-tail-call and through-native)
      ('((fn (x)' +
       '  ((fn (cc)' +
       '      (assign x (apply (fn () (+ (ccc (fn (c) (assign cc c) (c 1))) x))))' +
       '      (if (< x 4) (cc 2) x))' +
       '    nil))' +
       ' 0)'), "5",

      // inner -> outer (tail-call)
      "((fn () (ccc (fn (c) (+ 1 2 (c 3))))))", "3",

      // outer -> inner (tail-call)
      "((fn () (ccc (fn (c) (assign cc c)))))", "#<fn:cc>",
      "(cc 10)", "10",

      // inner -> outer (tail-call and through-native)
      "((fn () (ccc (fn (cc) (apply (fn (a b c) (cc (+ a b c))) (list 1 2 3))))))", "6",

      // outer -> inner (tail-call and through-native)
      "(apply (fn () (ccc (fn (c) (assign cc c)))))", "#<fn:cc>",
      "(cc 10)", "10"

    );
  });

  describe('list manipuration', function() {
    eval_print_eql(
      "(car '(1 2 3))", "1",
      "(cdr '(1 2 3))", "(2 3)",
      "(caar '((1 2) 3 4))", "1",
      "(cadr '((1 2) 3 4))", "3",
      "(cddr '((1 2) 3 4))", "(4)",

      //"(conswhen (fn (_) (< (len _) 3)) '(1 2) '(3 4 5))", "((1 2) 3 4 5)",
      //"(conswhen (fn (_) (< (len _) 3)) '(1 2 3 4) '(3 4 5))", "(3 4 5)",

      "(consif 1 '(2 3))", "(1 2 3)",
      "(consif nil '(2 3))", "(2 3)",

      "(firstn 3 '(1 2))", "(1 2)",
      "(firstn 3 '(a b c d e))", "(a b c)",

      "(nthcdr 0 '(1 2 3))", "(1 2 3)",
      "(nthcdr 2 '(1 2 3))", "(3)",
      "(nthcdr 10 '(1 2 3))", "nil"

    );
  });

  describe('afn', function() {
    eval_print_eql(
      "((afn (x y) (if (< x 0) (+ x y) (self (- x 1) (- y 1)))) 1 2)", "-1"
    );
  });

  describe('compiler', function() {
    describe('micro utils', function() {
      eval_print_eql(
        // append
        "(+ '(1 2 3) '(4 5 6))", "(1 2 3 4 5 6)",
        "(+ '(1 2 3) '(4 5 . 6))", "(1 2 3 4 5 . 6)",
        // should error
        // "(+ '(1 2 . 3) '(4 5 6))", "",
        "(mem 3 '(1 2 3 4 5))", "(3 4 5)",
        "(mem (fn (x) (is x 3)) '(1 2 3 4 5))", "(3 4 5)",
        "(pos 3 '(1 2 3 4 5))", "2",
        "(pos (fn (x) (is x 3)) '(1 2 3 4 5))", "2",
        "(atom 1)", "t",
        "(atom nil)", "t",
        "(atom \"abc\")", "t",
        "(atom '(1 2))", "nil",
        "(atom '())", "t",
        "(rev '(1 2 3 4))", "(4 3 2 1)",
        "(nrev '(1 2 3 4))", "(4 3 2 1)",
        "(map (fn (x) (+ 1 x)) '(1 2 3))", "(2 3 4)",
        "(mappend (fn (x) (list (+ 1 x))) '(1 2 3))", "(2 3 4)",
        "(len '(1 2 3))", "3",
        "(uniq)", "%g0",
        "(pair '())", "nil",
        "(pair '(a))", "((a))",
        "(pair '(a b))", "((a b))",
        "(pair '(a b c))", "((a b) (c))",
        "(pair '(a b c d))", "((a b) (c d))",
        "(union is '(a b c) '(b c d))", "(a b c d)",
        "(union is '(a a a b c) '(b c d))", "(a a a b c d)", // true ??

        "(flat '(a b c))", "(a b c)",
        "(flat nil)", "nil",
        "(flat '(a b (c)))", "(a b c)",
        "(flat '(a b (c (d (e) () (f (g) h) i))))", "(a b c d e f g h i)",
        "(dedup nil)", "nil",
        "(dedup '(a b c))", "(a b c)",
        "(dedup '(a c a b a b b c))", "(a c b)",
        "(keep (fn (x) (is x 2)) '(1 2 3))", "(2)",
        "(keep (fn (x) (is x 1)) nil)", "nil",
        "(keep (fn (x) (is x 3)) '(3 2 3 2 3 1))", "(3 3 3)",
        "(keep (fn (x) (is x 4)) '(3 2 3 2 3 1))", "nil"
      );
    });
    describe('utils', function() {
      eval_print_eql(
        "(set-minus '(1 2 3) '(1 3))", "(2)",
        "(set-intersect '(1 2 3 4) '(2 4))", "(2 4)",
        "(dotted-to-proper '(a b))", "(a b)",
        "(dotted-to-proper '(a b . c))", "(a b c)",
        "(dotted-to-proper 'a)", "(a)"
      );
    });
    describe('qq', function() {
      eval_print_eql(
        "(expand-qq (cadr '`(x x x x)))", "(quote (x x x x))", // (x x x x)
        "(expand-qq (cadr '`(a b c ,@(list x x) x y z)))", "(cons (quote a) (cons (quote b) (cons (quote c) (+ (list x x) (quote (x y z))))))", // (a b c 2 2 x y z)
        "(expand-qq (cadr '`(x x '(x ,x) x x)))", "(cons (quote x) (cons (quote x) (cons (cons (quote quote) (cons (cons (quote x) (cons x (quote nil))) (quote nil))) (quote (x x)))))" // (x x (quote (x 2)) x x)
      );
    });
    describe('expand-macro', function() {
      eval_print_eql(
        "(expand-macro '(quote (1 2 3)))", "(quote (1 2 3))",

        "(expand-macro '(caselet xx yy a 1 b 2 c 3 4))",
        "(with (xx yy) (%if (is xx (quote a)) 1 (%if (is xx (quote b)) 2 (%if (is xx (quote c)) 3 4))))",

        "(expand-macro '(case (car x) a 1 b 2 c 3 4))",
        "(with (%g1 (car x)) (%if (is %g1 (quote a)) 1 (%if (is %g1 (quote b)) 2 (%if (is %g1 (quote c)) 3 4))))",

        "(expand-macro '(reccase (car x) (a (x) (+ x x)) (b (y) (- y y)) (c x)))",
        "(with (%g2 (car (car x))) (%if (is %g2 (quote a)) (apply (fn (x) (+ x x)) (cdr (car x))) (%if (is %g2 (quote b)) (apply (fn (y) (- y y)) (cdr (car x))) (c x))))",

        "(expand-macro '(each a (cdr list) (prn a) (+ 1 p)))",
        "((with (%g3 nil) (assign %g3 (fn (%g4) (%if %g4 (do (with (a (car %g4)) (do (prn a) (+ 1 p))) (%g3 (cdr %g4))) nil)))) (cdr list))",

        "(expand-macro '(%shortfn (+ (car _) 10)))",
        "(fn (_) (+ (car _) 10))",

        "(expand-macro '(fn (a b . c) a b (list (+ a b) c)))",
        "(fn (a b . c) (do a b (list (+ a b) c)))",

        "(expand-macro '(rfn y (a b c) (if (< 0 a) (+ a b c) (y (inc a) (inc b) (inc c)))))",
        "(with (y nil) (assign y (fn (a b c) (%if (< 0 a) (+ a b c) (y (inc a) (inc b) (inc c))))))",

        "(expand-macro '((afn (x) (if (< 0 x) (self (dec x)) x)) 10))",
        "((with (self nil) (assign self (fn (x) (%if (< 0 x) (self (dec x)) x)))) 10)",

        "(expand-macro '`(a b ,c ,@d e f))",
        "(cons (quote a) (cons (quote b) (cons c (+ d (quote (e f))))))",

        "(expand-macro '(if a b))",
        "(%if a b nil)",
        "(expand-macro '(aif a b))",
        "(with (it a) (%if it b nil))",

        "(expand-macro '(if a b c))",
        "(%if a b c)",
        "(expand-macro '(aif a b c))",
        "(with (it a) (%if it b c))",

        "(expand-macro '(if a b c d))",
        "(%if a b (%if c d nil))",
        "(expand-macro '(aif a b c d))",
        "(with (it a) (%if it b (with (it c) (%if it d nil))))",

        "(expand-macro '(if a b c d e))",
        "(%if a b (%if c d e))",
        "(expand-macro '(aif a b c d e))",
        "(with (it a) (%if it b (with (it c) (%if it d e))))",

        "(expand-macro '(and a b c))",
        "(%if a (%if b c nil) nil)",

        "(expand-macro '(or a b c))",
        "(with (%g5 a) (%if %g5 %g5 (with (%g6 b) (%if %g6 %g6 (with (%g7 c) (%if %g7 %g7 nil))))))",

        "(expand-macro '(with (x a y b) x y (+ x y)))",
        "(with (x a y b) (do x y (+ x y)))",

        "(expand-macro '(let x y (+ x y) (- x y)))",
        "(with (x y) (do (+ x y) (- x y)))",

        "(expand-macro '(def f (a . b) (+ a (car b))))",
        "(assign f (fn (a . b) (+ a (car b))))"

      );
    });

    describe('compile-refer', function() {
      eval_print_eql(
        "(compile-refer 'a '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-let 0 0 (halt))",

        "(compile-refer 'd '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-let 1 1 (halt))",

        "(compile-refer 'f '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-let 2 0 (halt))",

        "(compile-refer 'i '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-local 2 (halt))",

        "(compile-refer 'k '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-free 1 (halt))",

        "(compile-refer 'x '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-global x (indirect (halt)))"
      );
    });

    describe('find-free', function() {
      eval_print_eql(
        "(find-free '(fn (a b c) ((fn (x y) (+ a b c d (- x y))) y z)) '())",
        "(+ d - y z)",

        "(find-free '(fn (a b c) (with (x (- y z) y 2) (+ a b c d x y z))) '())",
        "(- y z + d)",

        "(find-free '(fn (a b c) (do (+ a b c d) (with (x y) (+ x z)) (- a c))) '())",
        "(+ d y z -)",

        "(find-free '(fn (a b . c) (+ a b c d)) '())",
        "(+ d)"
      );
    });

    describe('find-sets', function() {
      eval_print_eql(
        "(find-sets '(fn (a b c) (assign d x)) '(a b c d e f g))",
        "(d)",

        "(find-sets '(fn (a b c) (with (g (assign e x)) (assign g y))) '(a b c d e f g))",
        "(e)",

        "(find-sets '(fn x (assign x e)) '(x e))",
        "nil"
      );
    });

    describe('make-boxes', function() {
      eval_print_eql(
        "(make-boxes '(a b) '(a b c) '(halt))", "(box 0 (box 1 (halt)))"
      );
    });

    describe('tailp', function() {
      eval_print_eql(
        "(tailp '(return 3 (halt)))", "3",
        "(tailp '(halt))", "nil",
        "(tailp '(exit-let 3 (return 3 (halt))))", "6"
      );
    });

    describe('collect-free', function() {
      eval_print_eql(
        "(collect-free '(a d f i k x) '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-global x (indirect (argument (refer-free 1 (argument (refer-local 2 (argument (refer-let 2 0 (argument (refer-let 1 1 (argument (refer-let 0 0 (argument (halt))))))))))))))"
      );
    });

    describe('remove-globs', function() {
      eval_print_eql(
        "(collect-free '(a d f i k x) '(((a b) (c d e) (f)) (g h i) j k l) '(halt))",
        "(refer-global x (indirect (argument (refer-free 1 (argument (refer-local 2 (argument (refer-let 2 0 (argument (refer-let 1 1 (argument (refer-let 0 0 (argument (halt))))))))))))))"
      );
    });

    describe('do-compile', function() {
      eval_print_eql(
        "(do-compile '(+ 1 2))",
        "((frame 10) (constant 1) (argument) (constant 2) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (halt))",

        "(do-compile '(+ (- 3 4) (+ 1 (- 1 (* 3 2)))))",
        "((frame 46) (frame 10) (constant 3) (argument) (constant 4) (argument) (constant 2) (argument) (refer-global -) (indirect) (apply) (argument) (frame 28) (constant 1) (argument) (frame 19) (constant 1) (argument) (frame 10) (constant 3) (argument) (constant 2) (argument) (constant 2) (argument) (refer-global *) (indirect) (apply) (argument) (constant 2) (argument) (refer-global -) (indirect) (apply) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (halt))",

        "(do-compile '((fn (a b) (+ a b)) 10 20))",
        "((frame 19) (constant 10) (argument) (constant 20) (argument) (constant 2) (argument) (close 0 11 2 -1) (refer-local 1) (argument) (refer-local 0) (argument) (constant 2) (argument) (refer-global +) (indirect) (shift 3 3) (apply) (apply) (halt))",

        "(do-compile '(if 'a 1 2))",
        "((constant a) (test 3) (constant 1) (halt) (constant 2) (halt))",

        "(do-compile '((fn (c d) (* c ((fn (a b) (+ (- d c) a b d)) d (+ d d)))) 10 3))",
        "((frame 63) (constant 10) (argument) (constant 3) (argument) (constant 2) (argument) (close 0 55 2 -1) (refer-local 1) (argument) (frame 45) (refer-local 0) (argument) (frame 10) (refer-local 0) (argument) (refer-local 0) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (argument) (constant 2) (argument) (refer-local 1) (argument) (refer-local 0) (argument) (close 2 24 2 -1) (frame 10) (refer-free 0) (argument) (refer-free 1) (argument) (constant 2) (argument) (refer-global -) (indirect) (apply) (argument) (refer-local 1) (argument) (refer-local 0) (argument) (refer-free 0) (argument) (constant 4) (argument) (refer-global +) (indirect) (shift 5 3) (apply) (apply) (argument) (constant 2) (argument) (refer-global *) (indirect) (shift 3 3) (apply) (apply) (halt))",

        "(do-compile '((fn (a b) (assign a 10) (assign b 30) (* a b)) 1 3))",
        "((frame 27) (constant 1) (argument) (constant 3) (argument) (constant 2) (argument) (close 0 19 2 -1) (box 0) (box 1) (constant 10) (assign-local 1) (constant 30) (assign-local 0) (refer-local 1) (indirect) (argument) (refer-local 0) (indirect) (argument) (constant 2) (argument) (refer-global *) (indirect) (shift 3 3) (apply) (apply) (halt))",

        "(do-compile '((fn (a) ((fn (b) ((fn (c d) (assign a 100) ((fn (e) (assign e (+ a e)) (assign c 20) (+ a b c d e)) 5)) 3 4)) 2)) 1))",
        "((frame 83) (constant 1) (argument) (constant 1) (argument) (close 0 77 1 -1) (box 0) (constant 2) (argument) (constant 1) (argument) (refer-local 0) (argument) (close 1 67 1 -1) (constant 3) (argument) (constant 4) (argument) (constant 2) (argument) (refer-local 0) (argument) (refer-free 0) (argument) (close 2 54 2 -1) (box 1) (constant 100) (assign-free 0) (constant 5) (argument) (constant 1) (argument) (refer-local 0) (argument) (refer-free 1) (argument) (refer-local 1) (argument) (refer-free 0) (argument) (close 4 36 1 -1) (box 0) (frame 12) (refer-free 0) (indirect) (argument) (refer-local 0) (indirect) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (assign-local 0) (constant 20) (assign-free 1) (refer-free 0) (indirect) (argument) (refer-free 2) (argument) (refer-free 1) (indirect) (argument) (refer-free 3) (argument) (refer-local 0) (indirect) (argument) (constant 5) (argument) (refer-global +) (indirect) (shift 6 2) (apply) (shift 2 3) (apply) (shift 3 2) (apply) (shift 2 2) (apply) (apply) (halt))",

        "(do-compile '(let a 10 a))",
        "((constant 10) (argument) (enter-let) (refer-let 0 0) (exit-let 2) (halt))",

        "(do-compile '(def fib (n) (if (< n 2) n (+ (fib (- n 1)) (fib (- n 2))))))",
        "((close 0 56 1 -1) (frame 10) (refer-local 0) (argument) (constant 2) (argument) (constant 2) (argument) (refer-global <) (indirect) (apply) (test 3) (refer-local 0) (return 2) (frame 17) (frame 10) (refer-local 0) (argument) (constant 1) (argument) (constant 2) (argument) (refer-global -) (indirect) (apply) (argument) (constant 1) (argument) (refer-global fib) (indirect) (apply) (argument) (frame 17) (frame 10) (refer-local 0) (argument) (constant 2) (argument) (constant 2) (argument) (refer-global -) (indirect) (apply) (argument) (constant 1) (argument) (refer-global fib) (indirect) (apply) (argument) (constant 2) (argument) (refer-global +) (indirect) (shift 3 2) (apply) (assign-global fib) (halt))",

        "(do-compile '(+ 1 (ccc (fn (c) (+ 3 5) (apply (fn () (c (* 8 3))))))))",
        "((frame 52) (constant 1) (argument) (frame 43) (conti 0) (argument) (constant 1) (argument) (close 0 37 1 -1) (frame 10) (constant 3) (argument) (constant 5) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (refer-local 0) (argument) (close 1 17 0 -1) (frame 10) (constant 8) (argument) (constant 3) (argument) (constant 2) (argument) (refer-global *) (indirect) (apply) (argument) (constant 1) (argument) (refer-free 0) (shift 2 1) (apply) (argument) (constant 1) (argument) (refer-global apply) (indirect) (shift 2 2) (apply) (apply) (argument) (constant 2) (argument) (refer-global +) (indirect) (apply) (halt))"
      );
    });

  });
});