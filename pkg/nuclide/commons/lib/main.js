'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

module.exports = {

  asyncFind(items: array, test: mixed, thisArg: mixed): Promise {
    return require('./promises').asyncFind(items, test, thisArg);
  },

  getConfigValueAsync(key: string): () => Promise {
    return require('./config').getConfigValueAsync(key);
  },

  asyncExecute(command: string, args: array<string>, options: mixed): Promise {
    return require('./process').asyncExecute(command, args, options);
  },

  checkOutput(command: string, args: array<string>, options?: mixed): Promise {
    return require('./process').checkOutput(command, args, options);
  },

  readFile(filePath: string, options?: mixed): Promise {
    return require('./filesystem').readFile(filePath, options);
  },

  findNearestFile(fileName: string, pathToDirectory: string): Promise<?string> {
    return require('./filesystem').findNearestFile(fileName, pathToDirectory);
  },

  get array() {
    return require('./array');
  },

  get fsPromise() {
    return require('./filesystem');
  },

  get strings() {
    return require('./strings');
  },

  get PromiseQueue() {
    return require('./PromiseQueue');
  },

  get extend() {
    return require('./extend');
  },

  get debounce() {
    return require('./debounce');
  },

  get vcs() {
    return require('./vcs');
  },
};
