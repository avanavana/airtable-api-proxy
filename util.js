/**
 * @file Common utility methods
 * @author Avana Vana <dear.avana@gmail.com>
 * @module util
 */

module.exports = {
  
  /*
   * Pads a string to a specified length with repeated specified string
   *
   * @method pad
   * @param {string} string - The original string to pad
   * @param {number} length - The desired final length of {@link string} with padding
   * @param {string} [padString='0'] - Another string used repeatedly to pad the first, defaults to '0'
   * @param {boolean} [prepend=true] - Whether or not the repeated {@link padString} is prepended or appended to the original {@link string}
   * @returns {string} Original {@link string} padded with {@link padString}, repeated until return string's length is {@link amount} number of characters
   *
   * @example <caption>Simple leading zeroes</caption>
   * // returns '004'
   * pad(2+2, 3)
   *
   * @example <caption>A fancy fore-flourish</caption>
   * // returns '~*~~*~text'
   * pad('text', 10, '~*~')
   *
   * @example <caption>With toLocaleString() and Array.map()</caption>
   * // returns [
   * //   '$         2.91',
   * //   '$ 3,304,394.00',
   * //   '$    50,504.24'
   * // ]
   * [2.906, 3304394, 50504.2422].map(price => '$' + pad(price.toLocaleString('en-US'), 13, ' '));
   *
   * @example <caption>Table of contents from an Array of Objects</caption>
   * // returns [
   * //   'Title................1',
   * //   'Contents.............4',
   * //   'Chapter 1...........12'
   * // ]
   * [{ name: 'Title', page: 1 }, { name: 'Contents', page: 2 }, { name: 'Chapter 1', page: 12 }].map(item => pad(item.name, 20, '.', false) + pad(item.page, 2, '.'));
   */
  
  pad: (string, length, padString = '0', prepend = true) => {
    const padding = padString
      .repeat(Math.ceil(length / padString.length))
      .substr(0, length - string.toString().length);
    return length > string.toString().length ? (
      prepend ?
        padding + string.toString()
        : string.toString() + padding
      )
      : string.toString();
  },
  
  /*
   * Formats ISO-8601 dates to YYYY-MM-DD hh:mm:ss (Zotero-friendly date format), in the user's local time
   *
   * @method formatDate
   * @param {string} rawDate - A raw date string, may or may not be in ISO-8601 format
   * @returns {string} Date in YYYY-MM-DD hh:mm:ss format, in user's local time, if {@link rawDate} is in ISO-8601 format, otherwise returns {@link rawDate}
   *
   * @example <caption>ISO-8601 date in GMT</caption>
   * // returns '2020-12-07 16:55:43' (in EST timezone)
   * formatDate('2020-12-07T21:55:43.000Z');
   * @example <caption>ISO-8601 date with timezone specified</caption>
   * // returns '2020-12-07 16:55:43' (in EST timezone)
   * formatDate('2020-12-07T215543-0500');
   */
  
  formatDate: rawDate => {
    const iso8601Format = /^([0-9]{4})-?([01][0-9])-?([0-3][0-9])T([0-2][0-9]):?([0-5][0-9]):?([0-6][0-9])\.?(0{1,6})?(?:Z|(([+-])([01][0-9]):?([0-5][0-9])?))$/;

    if (iso8601Format.test(rawDate)) {
      let [, year, month, day, hours, min, sec, fracSec, offset, offsetSign, offsetHours, offsetMin] = iso8601Format.exec(rawDate) || [];
      let d = new Date(year, month - 1, day, hours, min, sec);
      if (fracSec) fracSec *= Math.pow(10, -1 * fracSec.length);
      if (offset) {
        d.setHours(d.getHours() + offsetHours * (offsetSign === '+' ? 1 : -1));
        offsetMin && d.setMinutes(d.getMinutes() + offsetMin * (offsetSign === '+' ? 1 : -1));
      } else {
        d = new Date(d.getTime() - d.getTimezoneOffset() * 1000 * 60);
      }
      return `${d.getFullYear()}-${module.exports.pad(d.getMonth() + 1, 2)}-${module.exports.pad(d.getDate(), 2)} ${module.exports.pad(d.getHours(), 2)}:${module.exports.pad(d.getMinutes(), 2)}:${module.exports.pad(d.getSeconds(), 2)}`;
    } else {
      return rawDate;
    }
  },
  
  /*
   * Merges separate arrays for first and last names of authors into an array of full names of authors in a specified format
   *
   * @method formatAuthors
   * @param {string[]} first - An array of first name strings
   * @param {string[]} last - An array of last name strings
   * @param {boolean} [reverse=false] - Whether or not to reverse the order of names in the returned array
   * @returns {string[]} An array of full names of authors, merging {@link first} and {@link last} names
   * 
   * @example <caption>Default format (reverse = false)</caption>
   * // returns ['John C. Smith', 'F. Johnson', 'Marjorie García-Gamboa']
   * formatAuthors(['John C.', 'F.', 'Marjorie'], ['Smith', 'Johnson', 'García-Gamboa']);
   *
   * @example <caption>Reversed format (reverse = true)</caption>
   * // returns ['Smith, John C.', 'Johnson, F.', 'García-Gamboa, Marjorie']
   * formatAuthors(['John C.', 'F.', 'Marjorie'], ['Smith', 'Johnson', 'García-Gamboa'], true);
   */
  
  formatAuthors: (first, last, reverse = false) => reverse ? first.map((f, i) => last[i] + (f.length > 0 ? ', ' + f : '')) : first.map((f, i) => (f.length > 0 ? f + ' ' : '') + last[i]),
  
  /*
   * Merges separate arrays for first and last names of authors into a single array of author objects, with keys for first and last name
   *
   * @method packageAuthors
   * @param {string[]} first - An array of first name strings
   * @param {string[]} last - An array of last name strings
   * @returns {Object[]} An array of author objects, with keys for first and last name
   *
   * @example
   * // returns [{ firstName: 'John C.', lastName: 'Smith' }, { firstName: 'F.', lastName: 'Johnson' }, { firstName: 'Marjorie', lastName: 'Marjorie García-Gamboa' }]
   * formatAuthors(['John C.', 'F.', 'Marjorie'], ['Smith', 'Johnson', 'García-Gamboa']);
   */
  
  packageAuthors: (first, last) => first.map((f, i) => ({ firstName: f, lastName: last[i] })),
  
  /*
   * Formats an Airtable duration field's value (given in integer seconds), to h:mm:ss, m:ss, or s, as necessary
   *
   * @method formatDuration
   * @requires util.pad
   * @param {number} duration - Duration, in integer seconds
   * @returns {string} Duration string formatted as h:mm:ss, m:ss, depending on magnitude of {@link duration}
   *
   * @example <caption>Duration > 1 hour</caption>
   * // returns '2:34:04'
   * formatDuration(9244);
   *
   * @example <caption>Duration < 1 hour</caption>
   * // returns '45:22'
   * formatDuration(2722);
   *
   * @example <caption>Duration < 1 minute</caption>
   * // returns '0:27'
   * formatDuration(27);
   */
  
  formatDuration: (duration) => (duration < 60 ? '0:' : '') + [
    Math.floor(duration / 3600),
    duration > 3600
      ? module.exports.pad(Math.floor((duration % 3600) / 60), 2)
      : Math.floor((duration % 3600) / 60),
    module.exports.pad(Math.floor(duration % 60), 2),
    ]
      .filter((i) => +i !== 0)
      .join(':'),
  
  /*
   * Returns an array of IP addresses from a string of space separated IP patterns, expanding any wildcard characters (*)
   *
   * @method patternsToArray
   * @param {string} patterns - List of ip addresses, space-separated, with optional wildcard parts (*)
   * @returns {string[]} Flattened array of all combinatorically possible ip address strings using given {@link patterns}
   *
   * @example <caption>Without wildcards (*)</caption>
   * // returns ['67.118.0.1','255.255.1.1']
   * generateIps('67.118.0.1 255.255.1.1');
   *
   * @example <caption>With wildcards (*)</caption>
   * // returns ['67.118.0.1','255.255.1.0','255.255.1.1', ... , '255.255.1.255'] (256)
   * generateIps('67.118.0.1 255.255.1.*');
   */
  
  patternsToArray: (patterns) => patterns
    .split(' ')
    .map((pattern) => pattern
      .split('.')
      .map((part) => (part === '*' ? [...Array(256).keys()] : [part])))
    .flatMap((ip) => [...ip]
      .reduce((a, b) => a
        .flatMap((d) => b
          .map((e) => [d, e]
            .flat()))))
    .map((ip) => ip
      .join('.')),
  
  /*
   * Returns a regular expression from a string of space-separated IP patterns, with wildcard characters (*)
   *
   * @method patternsToRegEx
   * @param {string} patterns - List of ip addresses, space-separated, with optional wildcards (*)
   * @returns {RegExp} Regular expression equivalent to {@link patterns}
   *
   * @example <caption>Without wildcards (*)</caption>
   * // returns true
   * let whitelist = '67.118.0.1 255.255.1.1';
   * validateIps(whitelist).test('67.118.0.1');
   *
   * @example <caption>With wildcards (*)</caption>
   * // returns true
   * let whitelist = '67.118.0.1 255.255.*.*';
   * validateIps(whitelist).test('255.255.0.1');
   */
  
  patternsToRegEx: (patterns) => new RegExp(
    `(?:${patterns
      .split(' ')
      .map((pattern) => pattern
        .replace(/\./g, '\\.')
        .replace(/\*/g, '\\b(?:1\\d{2}|2[0-4]\\d|[1-9]?\\d|25[0-5])\\b'))
      .join('|')})`),
  
}