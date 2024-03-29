'use babel';

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {Range} = require('atom');

// TODO(7154684): Re-enable this test once the Atom linter package is redesigned so it does not
// run the risk of a race condition with respect to package loading during testing.
xdescribe('FlowLinter::processDiagnostics', () => {

  var FlowLinter = require('../lib/FlowLinter');

  it('should propertly transform a simple diagnostic', () => {
    var diags = [
      {
        message: [
          {
            path: 'myPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          }
        ]
      }
    ];

    var expectedOutput = {
      message: 'message',
      linter: 'flow',
      level: 'error',
      line: 1,
      col: 3,
      range: new Range([0, 2], [1, 4]),
    };

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toEqual(expectedOutput);
  });

  it('should filter diagnostics not in the target file', () => {
    var diags = [
      {
        message: [
          {
            path: 'notMyPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0,
          }
        ]
      }
    ];

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toBeUndefined();
  });

  it('should merge diagnostic messages spanning files', () => {
    var diags = [
      {
        message: [
          {
            path: 'myPath',
            descr: 'message',
            line: 1,
            endline: 2,
            start: 3,
            end: 4,
            code: 0
          },
          {
            path: 'notMyPath',
            descr: 'more message',
            line: 5,
            endline: 6,
            start: 7,
            end: 8,
            code: 0,
          }
        ]
      }
    ];

    var expectedOutput = {
      message: 'message more message',
      linter: 'flow',
      level: 'error',
      line: 1,
      col: 3,
      range: new Range([0, 2], [1, 4]),
    };

    var message = FlowLinter.processDiagnostics(diags, 'myPath')[0];
    expect(message).toEqual(expectedOutput);
  });

});
