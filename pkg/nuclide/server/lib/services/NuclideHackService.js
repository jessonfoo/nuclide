'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

var logger = require('nuclide-logging').getLogger();
var {SearchResultType, SymbolType} = require('nuclide-hack-common/lib/constants');
var {asyncExecute, fsPromise} = require('nuclide-commons');
var extend = require('util')._extend;

const HH_NEWLINE = '<?hh\n';
const HH_STRICT_NEWLINE = '<?hh // strict\n'

/**
 * Executes the hh_client on the remote connected dev box using the ExecClient passed
 */
async function _callHHClient(
  args: Array<string>,
  errorStream: boolean,
  outputJson: boolean,
  processInput: string,
  cwd: string): Promise<any> {
  // append args on the end of our commands
  var pathToHH = 'hh_client';
  var defaults = ['--retries', '0', '--retry-if-init', 'false', '--from', 'nuclide'];
  if (outputJson) {
    defaults.unshift('--json');
  }

  var allArgs = defaults.concat(args);
  allArgs.push(cwd);

  var execResult;
  try {
    execResult = await asyncExecute(pathToHH, allArgs, {stdin: processInput});
  } catch (err) {
    // For some reason Hack outputs sometimes on stderr
    // and sometimes on stdout depending on the type of request.
    // Throw if the error isn't a result of the process exec command with stderr.
    if (err.exitCode === undefined) {
      throw err;
    }
    execResult = err;
  }

  var output = errorStream ? execResult.stderr : execResult.stdout;
  if (outputJson) {
    try {
      return JSON.parse(output);
    } catch (err) {
      logger.error('failed to parse hh_client output:', output);
      throw new Error('failed to parse hh_client output: ' + output);
    }
  } else {
    return output;
  }
}

/**
 * Gets the hh_client diagnistics for all files open
 */
function getDiagnostics(options = {}): Promise<Array<mixed>> {
  return _callHHClient(
    /*args*/ [],
    /*errorStream*/ true,
    /*outputJson*/ true,
    /*processInput*/ null,
    /*options*/ options.cwd
  );
}

/**
 * Gets the hh_client autocompletions for the passed query string (file contents with a marker).
 */
function getCompletions(query: string, options): Promise<Array<mixed>> {
  return _callHHClient(
    /*args*/ ['--auto-complete'],
    /*errorStream*/ false,
    /*outputJson*/ true,
    /*processInput*/ query,
    /*options*/ options.cwd
  );
}

/**
 * Gets the hh_client definition of the query with a given symbol type.
 */
async function getDefinition(query: string, symbolType: SymbolType, options = {}): Promise<Array<mixed>> {
  var searchTypes = symbolTypeToSearchTypes(symbolType);
  var searchResults = [];
  try {
    searchResults = await getSearchResults(query, searchTypes, undefined, options);
  } catch (e) {
    logger.warn('getSearchResults error:', e);
  }
  return searchResults.filter((result) => {
    // If the request had a :: in it, it's a full name, so we should compare to
    // the name of the result in that format.
    var fullName = result.name;
    if (query.indexOf('::') !== -1 && result.scope) {
      fullName = result.scope + '::' + fullName;
    }
    return fullName === query;
  });
}

/**
 * Fetches the dependencies needed by the hack worker to cache for faster hack features response times.
 * Returnes a map of file paths to file contents.
 */
async function getDependencies(
      dependenciesInfo: Array<{name: string; type: string}>,
      options = {}
    ): Promise<mixed> {
  var dependencies = {};

  // hh_server currently is single threaded and processes one request at a time.
  // Hence, we fetch the dependencies one-by-one, without Promise.all for the hack search to unblock
  // user-requested hack language features and failry treat other usages of hh_client.
  for (var i = 0; i < dependenciesInfo.length; i++) {
    var {name: dependencyName, type: dependencyType} = dependenciesInfo[i];
    if (dependencyName.startsWith('\\')) {
       dependencyName = dependencyName.substring(1);
    }
    var filter;
    if (dependencyType === 'class') {
      filter = [
        SearchResultType.CLASS,
        SearchResultType.ABSTRACT_CLASS,
        SearchResultType.TRAIT,
        SearchResultType.TYPEDEF,
        SearchResultType.INTERFACE,
      ];
    } else {
      filter = [SearchResultType.FUNCTION];
    }

    var searchResults = await getSearchResults(dependencyName, filter, undefined, options);

    await Promise.all(searchResults.map(async (location) => {
      var {name, path} = location;
      if (name !== dependencyName) {
        return;
      }
      var contents = await fsPromise.readFile(path, 'utf8');
      if (!contents.startsWith('<?hh')) {
        return;
      }
      // This turns anything we're adding into decl mode, so that it uses less memory.
      // Ideally, hh_server should do this, and strip the method/function bodies.
      if (contents.startsWith(HH_NEWLINE)) {
        contents = '<?hh // decl\n' + contents.substring(HH_NEWLINE.length);
      } else if (contents.startsWith(HH_STRICT_NEWLINE)) {
        contents = '<?hh // decl\n' + contents.substring(HH_STRICT_NEWLINE.length);
      }
      dependencies[path] = contents;
    }));
  }

  return dependencies;
}

async function getSearchResults(
    search: string,
    filterTypes: ?Array<SearchResultType>,
    searchPostfix: ?string,
    options = {}
  ): Promise<Array<mixed>> {

  if (!search) {
    return [];
  }
  var response = await _callHHClient(
      /*args*/ ['--search' + (searchPostfix || ''), search],
      /*errorStream*/ false,
      /*outputJson*/ true,
      /*processInput*/ null,
      /*options*/ options.cwd
  );
  var results = response.map((result) => {
    return {
      line: result.line - 1,
      column: result.char_start - 1,
      name: result.name,
      path: result.filename,
      length: result.char_end - result.char_start + 1,
      scope: result.scope,
      additionalInfo: result.desc,
      action: 'OPEN_PATH',
    };
  });
  if (filterTypes) {
    results = filterSearchResults(results, filterTypes);
  }
  return results;
}

// Eventually this will happen on the hack side, but for now, this will do.
function filterSearchResults(
  results: Array<mixed>,
  filter: Array<SearchResultType>)
  : Array<mixed> {

  return results.filter((result) => {
    var info = result.additionalInfo;
    var searchType = getSearchType(info);
    return filter.indexOf(searchType) !== -1;
  });
}

function getSearchType(info: string): SearchResultType {
  switch (info) {
    case 'typedef':
      return SearchResultType.TYPEDEF;
    case 'function':
      return SearchResultType.FUNCTION;
    case 'constant':
      return SearchResultType.CONSTANT;
    case 'trait':
      return SearchResultType.TRAIT;
    case 'interface':
      return SearchResultType.INTERFACE;
    case 'abstract class':
      return SearchResultType.ABSTRACT_CLASS;
    default: {
      if (info.startsWith('method') || info.startsWith('static method')) {
        return SearchResultType.METHOD;
      }
      if (info.startsWith('class var') || info.startsWith('static class var')) {
        return SearchResultType.CLASS_VAR;
      }
      return SearchResultType.CLASS;
    }
  }
}

function symbolTypeToSearchTypes(symbolType: SymbolType): ?Array<SearchResultType> {
  switch (symbolType) {
    case SymbolType.CLASS:
      return [
        SearchResultType.CLASS,
        SearchResultType.ABSTRACT_CLASS,
        SearchResultType.TRAIT,
        SearchResultType.TYPEDEF,
        SearchResultType.INTERFACE,
      ];
     case SymbolType.METHOD:
       return [ SearchResultType.METHOD ];
     case SymbolType.FUNCTION:
       return [ SearchResultType.FUNCTION ];
     default:
       return null;
  }
}

module.exports = {
  services: {
    '/hack/getDiagnostics': {handler: getDiagnostics, method: 'post'},
    '/hack/getCompletions': {handler: getCompletions, method: 'post'},
    '/hack/getDefinition': {handler: getDefinition, method: 'post'},
    '/hack/getDependencies': {handler: getDependencies, method: 'post'},
    '/hack/getSearchResults': {handler: getSearchResults, method: 'post'},
  }
};
