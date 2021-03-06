### ArcJS

[![Build Status](https://travis-ci.org/smihica/arc-js.svg?branch=master)](https://travis-ci.org/smihica/arc-js)
[![Docs](https://readthedocs.org/projects/arcjs/badge/?version=latest)](http://arcjs.readthedocs.org/en/latest/)

__An Arc-langugage compiler and VM-interpreter written in JavaScript__

Arc-language can run both on nodejs and on a web-site.
You can get more information from the [website](http://smihica.github.io/arc-js/)
or [documentation](http://arcjs.readthedocs.org/en/latest/).

A lot of inspired from Paul Graham version of [Arc](http://arclanguage.org/) and [Anarki](https://github.com/arclanguage/anarki)

### Demo

#### client side

1. [REPL](http://smihica.github.io/arc-js/demo_repl.html)
2. [Maze generator](http://smihica.github.io/arc-js/demo_mg.html)
3. [Strange attractor generator](http://smihica.github.io/arc-js/demo_at.html)
4. [Automatic reversi player](http://smihica.github.io/arc-js/reversi.html)
5. [Tetris](http://smihica.github.io/arc-js/demo_tetris.html)

### How to make

#### install Node.js and npm (on mac)

    # from port
    $ sudo port install nodejs

    # or from brew
    $ brew install node.js

#### setup the compressor and unit-test framework.

    $ make setup

#### make ArcJS

    $ make

### How to run tests

    $ make test

### How to run repl

    $ ./bin/arcjs
    arc> (+ 1 2 3)
    6
    arc> (for n 1 100
           (prn (case (gcd n 15)
                  1 n
                  3 'Fizz
                  5 'Buzz
                  'FizzBuzz)))
    1
    2
    Fizz
    ...
    arc> (def average (x y) (/ (+ x y) 2))
    #<fn:average>
    arc> (average 2 4)
    3

Try Arc's [tutorial](http://ycombinator.com/arc/tut.txt)

### How to run scripts

    $ echo "(prn (gcd 33 77))" > test.arc
    $ ./bin/arcjs test.arc
    11

### How to run repl with preloading some scripts

    $ echo "(def average (x y) (/ (+ x y) 2))" > avg.arc
    $ ./bin/arcjs -l avg.arc
    arc> (average 10 20)
    15

### How to run compiler

    $ echo "(def average (x y) (/ (+ x y) 2))" > avg.arc
    $ ./bin/arcjsc -o avg.js.fasl avg.arc
    $ cat avg.js.fasl
    // This is an auto generated file.
    // Compiled from ['avg.arc'].
    // DON'T EDIT !!!
    preloads.push([
    [12,7,14,20,0,1,0,20,2,-1,0,10,9,1, ...
    ]);
    preload_vals.push(["2","+","/", ...
    $

### License

    # ArcJS

    Copyright (c) 2012 Shin Aoyama
    -----------------
    Perl Foundations's Artistic License 2.0

    # Arc language

    Copyright (c) Paul Graham
    Copyright (c) Robert Morris
    -----------------
    Perl Foundations's Artistic License 2.0

    # Anarki

    Copyright (c) Paul Graham
    Copyright (c) Robert Morris
    Copyright (c) A lot of contributors (see https://github.com/arclanguage/anarki/graphs/contributors)
    -----------------
    Perl Foundations's Artistic License 2.0
