/**
 * @file ESOVDB Airtable API methods
 * @author Avana Vana <dear.avana@gmail.com>
 * @module esovdb
 * @see {@link https://airtable.com/shrFBKQwGjstk7TVn|The Earth Science Online Video Database}
 */

const dotenv = require('dotenv').config();
const Airtable = require('airtable');
const Bottleneck = require('bottleneck');
const cache = require('./cache');
const { formatDuration, formatDate, packageAuthors } = require('./util');

const base = new Airtable({
  apiKey: process.env.AIRTABLE_API_KEY,
}).base(process.env.AIRTABLE_BASE_ID);

/** @constant {number} [airtableRateLimit=201] - Minimum time in ms to wait between requests using {@link Bottleneck} (default: 201ms ⋍ just under 5 req/s) */
const airtableRateLimit = 1005 / 5;

const rateLimiter = new Bottleneck({ minTime: airtableRateLimit });

module.exports = {
  
  /*
   *  Retrieves a list of videos by first checking the cache for a matching, fresh request, and otherwise performs an Airtable select() API query, page by page {@link req.query.pageSize} videos at a time (default=100), until all or {@link req.query.maxRecords}, if specified, using Botleneck for rate-limiting.  
   *
   *  @method listVideos
   *  @requires Airtable
   *  @requires Bottleneck
   *  @requires cache
   *  @requires util
   *  @param {Object} req - Express.js request object, an enhanced version of Node's http.IncomingMessage class
   *  @param {number} [req.params.pg] - An Express.js route param optionally passed after videos/list, which specifies which page of a given {@link pageSize} number records should be sent in the [server response]{@link res}
   *  @param {number} [req.query.pageSize=100] - An [http request]{@link req} URL query param that specifies how many Airtable records to return in each API call
   *  @param {number} [req.query.pageSize] - An [http request]{@link req} URL query param that specifies the maximum number of Airtable records that should be sent in the [server response]{@link res}
   *  @param {string} [req.query.createdAfter] - An [http request]{@link req} URL query param, in the format of a date string, parseable by Date.parse(), used to create a filterByFormula in an Airtable API call that returns only records created after the date in the given string
   *  @param {string} [req.query.modifiedAfter] - An [http request]{@link req} URL query param, in the format of a date string, parseable by Date.parse(), used to create a filterByFormula in an Airtable API call that returns only records modified after the date in the given string
   *  @param {Object} res - Express.js request object, an enhanced version of Node's http.ServerResponse class
   */
  
  listVideos: (req, res) => {
    req.params.pg =
      !req.params.pg || !Number(req.params.pg) || +req.params.pg < 0 
        ? null 
        : +req.params.pg - 1;
    
    if (
      !req.query.pageSize ||
      !Number(req.query.pageSize || req.query.pageSize > 100)
    ) {
      req.query.pageSize = 100;
    }
    
    if (!Number(req.query.maxRecords || req.query.maxRecords == 0)) {
      req.query.maxRecords = null;
    }
    
    if (req.query.maxRecords && +req.query.maxRecords < +req.query.pageSize) {
      req.query.pageSize = req.query.maxRecords;
    }
    
    let modifiedAfter,
        modifiedAfterDate,
        createdAfter,
        createdAfterDate;
    
    if (
      req.query.modifiedAfter &&
      typeof Date.parse(decodeURIComponent(req.query.modifiedAfter)) === 'number' &&
      Date.parse(decodeURIComponent(req.query.modifiedAfter)) > 0
    ) {
      modifiedAfter = Date.parse(decodeURIComponent(req.query.modifiedAfter));
      modifiedAfterDate = new Date(modifiedAfter);
    }

    if (
      req.query.createdAfter &&
      typeof Date.parse(decodeURIComponent(req.query.createdAfter)) === 'number' &&
      Date.parse(decodeURIComponent(req.query.createdAfter)) > 0
    ) {
      createdAfter = Date.parse(decodeURIComponent(req.query.createdAfter));
      createdAfterDate = new Date(createdAfter);
    }
    
    let queryText =
      req.params.pg !== null
        ? 'for page ' +
          (req.params.pg + 1) +
          ' (' +
          req.query.pageSize +
          ' results per page)'
        : '(' +
          req.query.pageSize +
          ' results per page, ' +
          (req.query.maxRecords ? 'up to ' + req.query.maxRecords : 'for all') +
          ' results)';
    
    queryText += modifiedAfterDate ? ', modified after ' + modifiedAfterDate.toLocaleString() : '';
    queryText += createdAfterDate ? ', created after ' + createdAfterDate.toLocaleString() : '';
    
    console.log(`Performing videos/list API request ${queryText}...`);

    const cachePath = `.cache${req.url}.json`;
    const cachedResult = cache.readCacheWithPath(cachePath);

    if (cachedResult != null) {
      console.log('Cache hit. Returning cached result for ' + req.url);
      res.status(200).send(JSON.stringify(cachedResult));
    } else {
      console.log('Cache miss. Loading from Airtable for ' + req.url);

      let pg = 0;
      const ps = +req.query.pageSize;
      let options = {
        pageSize: ps,
        view: 'All Online Videos',
        sort: [{ field: 'Modified', direction: 'desc' }],
        fields: [
          'Zotero Key',
          'Zotero Version',
          'Title',
          'URL',
          'Year',
          'Description',
          'Running Time',
          'Format',
          'Topic',
          'Learn More',
          'Series Text',
          'Series Count Text',
          'Vol.',
          'No.',
          'Publisher Text',
          'Presenter First Name',
          'Presenter Last Name',
          'Language Code',
          'Location',
          'Plus Code',
          'Video Provider',
          'ESOVDBID',
          'Record ID',
          'ISO Added',
          'Created',
          'Modified'
        ],
      };

      if (req.query.maxRecords) options.maxRecords = +req.query.maxRecords;
      if (modifiedAfter) options.filterByFormula = `IS_AFTER({Modified}, DATETIME_PARSE(${modifiedAfter}))`;
      if (createdAfter) options.filterByFormula = `IS_AFTER(CREATED_TIME(), DATETIME_PARSE(${createdAfter}))`;
      
      let data = [];

      rateLimiter.wrap(
        base('Videos')
          .select(options)
          .eachPage(
            function page(records, fetchNextPage) {
              if (!req.params.pg || pg == req.params.pg) {
                console.log(
                  `Retrieving records ${pg * ps + 1}-${(pg + 1) * ps}...`
                );
                
                records.forEach((record) => {
                  let row = {
                    zoteroKey: record.get('Zotero Key') || '',
                    zoteroVersion: record.get('Zotero Version') || '',
                    title: record.get('Title') || '',
                    url: record.get('URL') || '',
                    year: record.get('Year') || '',
                    desc: record.get('Description') || '',
                    runningTime: formatDuration(record.get('Running Time')) || '',
                    format: record.get('Format') || '',
                    topic: record.get('Topic'),
                    learnMore: record.get('Learn More'),
                    series: record.get('Series Text') || '',
                    seriesCount: record.get('Series Count Text') || '',
                    vol: record.get('Vol.') || '',
                    no: record.get('No.') || '',
                    publisher: record.get('Publisher Text') || '',
                    presenters: packageAuthors(
                      record.get('Presenter First Name'),
                      record.get('Presenter Last Name')
                    ),
                    language: record.get('Language Code') || '',
                    location: record.get('Location') || '',
                    plusCode: record.get('Plus Code') || '',
                    provider: record.get('Video Provider') || '',
                    esovdbId: record.get('ESOVDBID') || '',
                    recordId: record.get('Record ID') || '',
                    accessDate: formatDate(record.get('ISO Added')) || '',
                    created: record.get('Created'),
                    modified: record.get('Modified')
                  };

                  data.push(row);
                });

                console.log(
                  `Successfully retrieved ${records.length} records.`
                );

                if (pg == req.params.pg) {
                  res.status(200).send(JSON.stringify(data));
                }

                pg++;
                fetchNextPage();
              } else {
                pg++;
                fetchNextPage();
              }
            },
            function done(err) {
              if (err) {
                console.error(err);
                res.status(400).end(JSON.stringify(err));
              } else {
                console.log(
                  `[DONE] Retrieved ${data.length} records.`
                );
                cache.writeCacheWithPath(cachePath, data);
                res.status(200).send(JSON.stringify(data));
              }
            }
          )
      );
    }
  },
  
  /*
   *  Updates one or more Airtable records using the non-destructive Airtable update() method, at most 50 at a time, until all provided records have been updated, using Bottleneck for rate-limiting.
   *
   *  @method processUpdates
   *  @requires Airtable
   *  @requires Bottleneck
   *  @param {Object[]} videos - An array of objects formatted as updates for Airtable (i.e. [ { id: 'recordId', fields: { 'Airtable Field': 'value', ... } }, ... ])
   *  @returns {Object[]} The original array of video update objects, {@link videos}, passed to {@link processUpdates}
   */
  
  processUpdates: (videos) => {
    let i = 0, updates = [...videos], queue = videos.length;

    while (updates.length) {
      console.log(
        `Updating record${updates.length > 1 ? 's' : ''} ${
          i * 50 + 1
        }${updates.length > 1 ? '-' : ''}${
          updates.length > 1
            ? i * 50 +
              (updates.length < 50
                ? updates.length
                : 50)
            : ''
        } of ${queue} total...`
      );

      i++, rateLimiter.wrap(base('Videos').update(updates.splice(0, 50)));
    }
    
    return videos;
  },
  
  /*
   *  Passes the body of an HTTP POST request to this server on to {@link processUpdates} for updating records on Airtable and sends a 200 server response with the array of objects originally passed to it in the [request body]{@link req.body}.
   *
   *  @async
   *  @method updateVideos
   *  @param {Object} req - Express.js request object, an enhanced version of Node's http.IncomingMessage class
   *  @param {Object[]} req.body - An array of objects formatted as updates for Airtable (i.e. [ { id: 'recordId', fields: { 'Airtable Field': 'value', ... } }, ... ]) passed as the body of the [server request]{@link req}
   *  @param {Object} res - Express.js request object, an enhanced version of Node's http.ServerResponse class
   */
  
  updateVideos: async (req, res) => {
    if (req.body.length > 0) {
      console.log(`Performing videos/update API request for ${req.body.length} records...`);
      
      const data = await module.exports.processUpdates(req.body);
      
      res.status(200).send(JSON.stringify(data));
    }
  }
};
