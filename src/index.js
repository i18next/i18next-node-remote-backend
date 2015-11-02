import * as utils from './utils';
import request from 'request';

// https://gist.github.com/Xeoncross/7663273
function ajax(url, callback, data) {
  if (data) {
    request.post({url: url, body: body, json: true}, function(err, res, body) {
      if (err) console.log(err);
      callback(body, res);
    });
  } else {
    request(url, function(err, res, body) {
      if (err) console.log(err);
      callback(body, res);
    });
  }
};

function getDefaults() {
  return {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
    addPath: 'locales/add/{{lng}}/{{ns}}',
    allowMultiLoading: false
  };
}

class Backend {
  constructor(services, options = {}) {
    this.init(services, options);

    this.type = 'backend';
  }

  init(services, options = {}) {
    this.services = services;
    this.options = utils.defaults(options, this.options || {}, getDefaults());
  }

  readMulti(languages, namespaces, callback) {
    let url = this.services.interpolator.interpolate(this.options.loadPath, { lng: languages.join('+'), ns: namespaces.join('+') });

    this.loadUrl(url, callback);
  }

  read(language, namespace, callback) {
    let url = this.services.interpolator.interpolate(this.options.loadPath, { lng: language, ns: namespace });

    this.loadUrl(url, callback);
  }

  loadUrl(url, callback) {
    ajax(url, (data, res) => {
      const statusCode = res.statusCode;
      if (statusCode.indexOf('5') === 0) return callback('failed loading ' + url, true /* retry */);
      if (statusCode.indexOf('4') === 0) return callback('failed loading ' + url, false /* no retry */);

      let ret, err;
      try {
        ret = JSON.parse(data);
      } catch (e) {
        err = 'failed parsing ' + url + ' to json';
      }
      if (err) return callback(err, false);
      callback(null, ret);
    });
  }

  create(languages, namespace, key, fallbackValue) {
    if (typeof languages === 'string') languages = [languages];

    let payload = {};
    payload[key] = fallbackValue || '';

    languages.forEach(lng => {
      let url = this.services.interpolator.interpolate(this.options.addPath, { lng: lng, ns: namespace });

      ajax(url, function(data, res) {
        //const statusCode = xhr.status.toString();
        // TODO: if statusCode === 4xx do log
      }, payload);
    });
  }
}

Backend.type = 'backend';


export default Backend;
