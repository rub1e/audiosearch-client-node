var Promise = require('promise');
var EventEmitter = require('events').EventEmitter;
var request = require('request');
var version = '1.0.2';

var Audiosearch = function (oauthKey, oauthSecret, oauthHost) {
  var self = this;
  if (!oauthKey || !oauthSecret) {
    throw new Error('Audiosear.ch API requires key and secret to initialize.');
  }

  self._creds = {
    key: oauthKey,
    secret: oauthSecret,
    host: oauthHost || 'https://www.audiosear.ch',
  }

  self._ee = new EventEmitter();

  self._authorize().then(function (token) {
    self._token = token;
    self._ee.emit('authComplete');
  });
}

Audiosearch.prototype._authorize = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    var params = {'grant_type':'client_credentials'};
    var unencoded_sig = self._creds.key + ':' + self._creds.secret;
    var signature = new Buffer(unencoded_sig).toString('base64');
    var options = {
      url: self._creds.host + '/oauth/token',
      qs: params,
      headers: {
        'Authorization': 'Basic ' + signature,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    request.post(options, function (err, res, body) {
      if (res.statusCode !== 200) {
        console.warn(res);
        reject();
      }
      var token = JSON.parse(body).access_token;
      resolve(token);
    });
  });
};

Audiosearch.prototype.get = function (url, params) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var options = {
      url: self._creds.host + '/api' + url,
      qs: params,
      headers: {
        'Authorization': 'Bearer ' + self._token,
        'User-Agent': 'request'
      }
    };
    if (!self._token) {
      self._ee.once('authComplete', function () {
        return self.get(url, params).then(resolve);
      });
    } else {

      request(options, function (err, res, body) {
        if (err || res.statusCode !== 200) {
          return reject(err);
        }
        resolve(JSON.parse(body));
      });
    }
  });
};

Audiosearch.prototype.searchEpisodes = function (queryString, params) {
  return this.get('/search/episodes/'+encodeURI(queryString), params);
};

Audiosearch.prototype.searchPeople = function (queryString, params) {
  return this.get('/search/people/'+encodeURI(queryString), params);
};

Audiosearch.prototype.getShow = function (showId) {
  return this.get('/shows/' + showId);
};

Audiosearch.prototype.getEpisode = function (episodeId) {
  return this.get('/episodes/' + episodeId);
};

Audiosearch.prototype.getTrending = function () {
  return this.get('/trending/');
};

Audiosearch.prototype.getRelated = function (id, _type) {
  var type = _type || 'episodes';
  return this.get('/'+type+'/'+id+'/related/');
};

Audiosearch.prototype.getTastemakers = function (_numResults) {
  var numResults = _numResults === undefined ? 5 : _numResults;
  return this.get('/tastemakers/episodes/' + numResults);
};

// Note params can be optional but best to set them even if not needed to avoid confusion
// start - The start date of the charts data in the format YYYY-MM-DD. Maximum (and default) date is the most recent chart date minus one week; earliest is 2013-06-01)
// limit - The highest ranks for which to get data. Default is 10, maximum is 100.
// country - The country for which to get charts data. US: 'us', Great Britain: 'gb', Ireland: 'ie', New Zealand: 'nz', South Africa: 'za'
Audiosearch.prototype.getCharts = function (start, limit, country) {
  if (!start) {
    var now = new Date();
    //last week
    now.setDate(now.getDate() - 7);
    start = now.getFullYear() + '-' + (now.getMonth() + 1) + '-' + now.getDate();
  }
  limit = limit || 10;
  country = country || 'us';
  return this.get('/chart_daily?limit=' + limit + '&country=' + country + '&start_date=' + start);
};

module.exports = Audiosearch;
