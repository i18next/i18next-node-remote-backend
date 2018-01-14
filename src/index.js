import request from 'request';

// https://gist.github.com/Xeoncross/7663273
function ajax(url, callback, data) {
  if (data) {
    request.post({url: url, body: data, json: true}, function(err, res, body) {
      if (err) console.log(err);
      callback(err, body, res);
    });
  } else {
    request(url, function(err, res, body) {
      if (err) console.log(err);
      callback(err, body, res);
    });
  }
};

function getDefaults() {
  return {
    loadPath: '/locales/{{lng}}/{{ns}}.json',
    addPath: 'locales/add/{{lng}}/{{ns}}',
    allowMultiLoading: false,
    reloadInterval: false
  };
}

class Backend {
  constructor(services, options = {}, allOptions = {}) {
    this.options = options;
    this.init(services, options, allOptions);

    this.type = 'backend';
  }

  init(services, options = {}, allOptions = {}) {
    this.services = services;
    this.options = {...getDefaults(), ...this.options, ...options};
    this.allOptions = allOptions;

    if (this.options.reloadInterval) {
      setInterval(() => {
        this.reload();
      }, this.options.reloadInterval);
    }
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
    ajax(url, (err, data, res) => {
      if (err) return callback(err, true); // retry

      const statusCode = res.statusCode && res.statusCode.toString();
      if (statusCode && statusCode.indexOf('5') === 0) return callback('failed loading ' + url, true /* retry */);
      if (statusCode && statusCode.indexOf('4') === 0) return callback('failed loading ' + url, false /* no retry */);

      let ret;
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

      ajax(url, function(err, data, res) {
        //const statusCode = xhr.status.toString();
        // TODO: if statusCode === 4xx do log
      }, payload);
    });
  }

  reload() {
    const { backendConnector, languageUtils, logger } = this.services;
    const currentLanguage = backendConnector.language;
    if (currentLanguage && currentLanguage.toLowerCase() === 'cimode') return; // avoid loading resources for cimode

    let toLoad = [];

    let append = lng => {
      let lngs = languageUtils.toResolveHierarchy(lng);
      lngs.forEach(l => {
        if (toLoad.indexOf(l) < 0) toLoad.push(l);
      });
    };

    append(currentLanguage);

    if (this.allOptions.preload) {
      this.allOptions.preload.forEach(l => {
        append(l);
      });
    }

    toLoad.forEach(lng => {
      this.allOptions.ns.forEach(ns => {
        backendConnector.read(lng, ns, 'read', null, null, (err, data) => {
          if (err) logger.warn(`loading namespace ${ns} for language ${lng} failed`, err);
          if (!err && data) logger.log(`loaded namespace ${ns} for language ${lng}`, data);

          const langLoaded = (!err && data) ? data[lng][ns] : data;
          backendConnector.loaded(`${lng}|${ns}`, err, langLoaded);
        });
      });
    });
  }
}

Backend.type = 'backend';


export default Backend;
