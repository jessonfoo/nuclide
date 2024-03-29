'use babel';
/* flow */
/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var {CompositeDisposable} = require('atom');
var React = require('react-for-atom');
var {PropTypes} = React;

var DiffViewComponent = React.createClass({
  propTypes: {
    model: PropTypes.object.isRequired,
  },

  async componentDidMount(): Promise<void> {
    this._subscriptions = new CompositeDisposable();

    var DiffViewEditor = require('./DiffViewEditor');

    this._oldDiffEditor = new DiffViewEditor(this._getOldTextEditorElement());
    this._newDiffEditor = new DiffViewEditor(this._getNewTextEditorElement());

    // The first version of the diff view will have both editors readonly.
    // But later on, the right editor will be editable and savable.
    this._oldDiffEditor.setReadOnly();
    this._newDiffEditor.setReadOnly();

    var {oldText, newText, filePath} = await this.props.model.getDiffState();
    this._oldDiffEditor.setFileContents(filePath, oldText);
    this._newDiffEditor.setFileContents(filePath, newText);

    this._updateDiffMarkers();

    // TODO(most): Setup scroll syncing between the two editors.
  },

  _updateDiffMarkers() {
    var {addedLines, removedLines, oldLineOffsets, newLineOffsets} =
        this.props.model.computeDiff(this._oldDiffEditor.getText(), this._newDiffEditor.getText());

    // TODO(most): update the editors with the highlight markers at the added and removed lines.
    // TODO(most): update the editors with the empty line offsets required for diff comparability.
  },

  componentWillUnmount(): void {
    if (this._subscriptions) {
      this._subscriptions.dispose();
      this._subscriptions = null;
    }
  },

  render(): ReactElement {
    return (
      <div className='diff-view-component'>
        <div className='split-pane'>
          <p>Old File</p>
          <atom-text-editor ref='old' style={{height: '100%'}} />
        </div>
        <div className='split-pane'>
          <p>New File</p>
          <atom-text-editor ref='new' style={{height: '100%'}} />
        </div>
      </div>
    );
  },

  _getOldTextEditorElement(): TextEditorElement {
    return this.refs['old'].getDOMNode();
  },

  _getNewTextEditorElement(): TextEditorElement {
    return this.refs['new'].getDOMNode();
  },

});

module.exports = DiffViewComponent;
