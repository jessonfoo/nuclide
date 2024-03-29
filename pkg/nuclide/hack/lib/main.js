'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Point} from 'atom';

var {CompositeDisposable} = require('atom');
var {PHP_GRAMMAR} = require('nuclide-hack-common/lib/constants');

// One of text or snippet is required.
type Suggestion = {
  text: ?string;
  snippet: ?string;
  replacementPrefix: ?string;
  rightLabel: ?string;
  rightLabelHTML: ?string;
  className: ?string;
}

var subscriptions: ?CompositeDisposable = null;

module.exports = {

  activate() {
    var hack = require('./hack');
    subscriptions = new CompositeDisposable();
    subscriptions.add(atom.workspace.observeTextEditors((editor) => {
      if (PHP_GRAMMAR === editor.getGrammar().scopeName) {
        hack.onDidSave(editor); // Trigger an initial diagnostics check.
        subscriptions.add(editor.onDidSave(() => hack.onDidSave(editor)));
      }
    }));
  },

  /** Provider for autocomplete service. */
  createAutocompleteProvider() {
    var AutocompleteProvider = require('./AutocompleteProvider');
    var autocompleteProvider = new AutocompleteProvider();

    return {
      selector: '.' + PHP_GRAMMAR,
      inclusionPriority: 1,
      excludeLowerPriority: true,

      getSuggestions(
          request: {editor: TextEditor; bufferPosition: Point; scopeDescriptor: any; prefix: string}
          ): Promise<Array<Suggestion>> {
        return autocompleteProvider.getAutocompleteSuggestions(request);
      },
    };
  },

  createClickToSymbolDelegate() {
    var ClickToSymbolDelegate = require('./ClickToSymbolDelegate');
    return new ClickToSymbolDelegate();
  },

  /** Provider for code format service. */
  createCodeFormatProvider(): mixed {
    var CodeFormatProvider = require('./CodeFormatProvider');
    var codeFormatProvider = new CodeFormatProvider();

    return {
      selector: PHP_GRAMMAR,
      inclusionPriority: 1,

      formatCode(editor: TextEditor, range: Range): Promise<string> {
        return codeFormatProvider.formatCode(editor, range);
      },
    };
  },

  createTypeHintProvider(): mixed {
    var TypeHintProvider = require('./TypeHintProvider');
    var typeHintProvider = new TypeHintProvider();

    return {
      selector: PHP_GRAMMAR,
      inclusionPriority: 1,

      typeHint(editor: TextEditor, position: Point): Promise<string> {
        return typeHintProvider.typeHint(editor, position);
      },
    };
  },

  deactivate(): void {
    if (subscriptions) {
      subscriptions.dispose();
      subscriptions = null;
    }
  }
};
