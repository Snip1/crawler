function Mapper() { // implements MapInterface
    var self = this;

    var Config = require(__dirname + '/../config.json'),
        Interface = require(__dirname + '/interface'),
        Http = require('http'),
        Https = require('https'),
        Url = require('url'),
        Util = require('util'),
        Jsdom = require('jsdom'),
        // Tidy = require('htmltidy').tidy,
        Fs = require('fs');

    var check = require('validator').check,
    sanitize = require('validator').sanitize;

    var jquery = Fs.readFileSync(__dirname + '/jquery.js').toString();

    self.cookies = {};
    self.headers = {
        'Accept': 'text/html',
        'Accept-Charset': 'windows-1251,utf-8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'http://www.yandex.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 6.1; WOW64)',
    }

    // simple couchdb wrapper
    var db = function(obj) {
        var data = obj.data ? JSON.stringify(obj.data) : '';
        var url = Url.parse(Config.database);
        var path = url.path + (obj.url ? obj.url : '');

        var options = {
            hostname: url.hostname,
            port: url.port,
            path: path,
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data, 'utf8')
            }
        };

        for(var i in obj) {
            if(options[i])
                options[i] = obj[i];
        };

        var req = Http.request(options, function(res) {

            var json = '';
            res.on('data', function(data) {
                json += data;
            });
            res.on('end', function() {
                obj.success(JSON.parse(json ? json : '{}'), res);
            })
            res.on('error', function(e) {
                if(typeof(obj.error) == 'function') {
                    console.warn('error: '+e.message);
                    obj.error(e.message);
                } else {
                    throw new Error(e.message);
                }
            });
        });

        req.on('error', function(e) {

            if(typeof(obj.error) == 'function') {
                console.warn('error: '+e.message);
                obj.error(e.message);
            } else {
                    throw new Error(e.message);
            }

        });

        if(data) req.write(data);
        req.end();
    }




// request url and return html-code in callback
    self.getHtml = function(param, success) {
        var url = Url.parse(param.url);
        self.headers['Referer'] = url.href;
        self.headers['Content-Length'] = param.body ? param.body.length : 0;
        delete self.headers['Cookie'];
        if(Object.keys(self.cookies).length !== 0) {
            var arr = [];
            for(var name in self.cookies)
                arr.push(Util.format('%s=%s', name, self.cookies[name][name]));
            self.headers['Cookie'] = arr.join(';');
        }
        var options = {
            hostname: url.host,
            path: url.path,
            method: param.method?param.method:'GET',
            headers: self.headers
        };

        var mod = (url.protocol == 'https:')?Https:Http;
        var req = mod.request(options, function(res) {
            if(param.encoding)
                res.setEncoding(param.encoding);
            // cookie support
            if(res.headers['set-cookie']) {
                res.headers['set-cookie'].forEach(function(cookie) {
                    var bisquit = {};
                    var name = null;
                    cookie.split(';').forEach(function(str) {
                        var tmp = str.split('=');
                        var key = tmp[0].replace(/^\s+|\s+$/g, '');
                        var val = tmp[1]?tmp[1].replace(/^\s+|\s+$/g, ''):'';
                        bisquit[key] = val;
                        if(!name) name = key;
                    });
                    self.cookies[name] = bisquit;
                });
            }

            var body = '';
            res.on('data', function(data) {
                body += data;
            });
            res.on('end', function() {
                success(body, res)
            })
            res.on('error', function(e) {
                throw new Error(e.message);
            });
        });
        if(param.body) req.write(param.body);
        req.end();
    }

// get absolute url, test against errors and return user info
    self.getUserInfo = function(url, callback) {
        for(var siteId in Config.sites) {
            if(Config.sites[siteId].url == url.substr(0, Config.sites[siteId].url.length)) {
                found = true;
                break;
            }
            siteId = undefined;
        }
        if(!siteId) return error('Site id not found');
        if(!self._sites) {
            self._sites = {};
        }
        if(!self._sites[siteId]) {
            var Site = require(__dirname + '/../modules/'+siteId).Site;
            self._sites[siteId] = new Site;
            Interface.ensureImplements(self._sites[siteId], Interface.siteInterface);
        }
        site = self._sites[siteId];
        site.getUserInfo(url, callback);
    }

// parse html-code and return dom (window onject) with jquery injected
    self.parseDom = function(html, callback) {
        // Tidy(html, function(err, html) {
            Jsdom.env({
                html: html,
                src: [jquery],
                done: function (errors, window) {
                    callback(window);
                }
            });
        // });
    }

// validate json-object with userinfo
    self.validateUser = function(user) {

        // xss protect
        var xss = function(obj) {
            for(var i in obj) {
                if('object' === typeof(obj[i])) {
                    xss(obj[i]);
                } else {
                    obj[i] = sanitize(obj[i]).xss();
                }
            }
        };
        xss(user);

        // return value
        var ret = {
            'errors': [],
            'warnings': [],
            'user': user
        };


        // step #1 - check for required fields
        // var required = ['url', 'img', 'nick', 'sex', 'birth', 'city', 'orient', 'search', 'about'];
        var required = ['url', 'img', 'nick', 'sex'];

        for(var i = 0, l = required.length; i < l; i++) {
            if(!user[required[i]]) {
                ret.errors.push('Field "' +required[i]+'" is required but not found.');
            }
        }

        if(ret.errors.length) return ret;


        try {
            check(user.url).isUrl();
        } catch (e) {
            ret.errors.push('url: ' + e.message + '[' +user.url+ ']');
        }

        try {
            check(user.img).isUrl();
        } catch (e) {
            ret.errors.push('img: ' + e.message + '[' +user.img+ ']');
        }

        try {
            check(user.nick).notEmpty();
        } catch (e) {
            ret.errors.push('nick: ' + e.message + '[' +user.nick+ ']');
        }

        try {
            check(user.sex).notEmpty();
        } catch (e) {
            ret.errors.push('sex: ' + e.message + '[' +user.sex+ ']');
        }

        try {
            check(user.birth).min(1900).max(2100);
        } catch (e) {
            ret.warnings.push('birth: ' + e.message + '[' +user.birth+ ']');
        }

        try {
            check(user.city).notEmpty();
        } catch (e) {
            ret.warnings.push('city: ' + e.message + '[' +user.city+ ']');
        }

        try {
            check(user.orient).notEmpty();
        } catch (e) {
            ret.warnings.push('orient: ' + e.message + '[' +user.orient+ ']');
        }

        try {
            check(user.search).notEmpty();
        } catch (e) {
            ret.warnings.push('search: ' + e.message + '[' +user.search+ ']');
        }

        try {
            check(user.about).notEmpty();
        } catch (e) {
            ret.warnings.push('about: ' + e.message + '[' +user.about+ ']');
        }

        return ret;
    }

    // convert relative into absolute url
    self.wrapUrl = function(url, global) {
        if('undefined' == typeof url) return undefined;
        return (
            (global == url.substr(0, global.length)) ?
                url :
                global + url
        );
    }

// database functions ::
// CAUTION: debug only, use 'startkey' + 'limit'

    // check if url exists, append new one
    self.appendUrl = function(url, site, callback, error) {
        db({
            url: '/_design/profile_by_url/_view/profile_by_url?key="'+url+'"&limit=1',
            success: function(data, res) {
                if(data.error) {
                    return error(data.error+': '+data.reason);
                }
                if(data.rows.length) {
                    return callback(false, data); // url exists
                }

                db({
                    method: 'POST',
                    data: {
                        url: url,
                        site: site,
                        created: Math.round(+new Date()/1000)
                    },
                    success: function(data, res) {
                        return callback(true, data); // url appended
                    }
                });
            }
        });
    }


    // get document from database
    self.getUserinfo = function(docId, callback, error) {
        db({
            url: '/'+docId,
            success: function(data) {
                if(data.error) {
                    return error(data.error+' - '+data.reason);
                }
                return callback(data);
            },
            error: function(msg) {
                return error(msg);
            }
        });
    }

    // fetch "empty" utl from database
    self.fetchNextUrl = function(site, callback, error) {
        db({
            url: '/_design/unfetched/_view/unfetched/?key="'+site+'"&limit=1',
            success: function(data, res) {
                if(data.error) {
                    return error(data.error+': '+data.reason);
                }

                return callback(
                    data.rows.length ?
                    data.rows[0].value.url :
                    undefined
                );
            }
        });
    }

    self.updateUrl = function(url, user, callback) {
        // get url current id and revision
        db({
            url: '/_design/profile_by_url/_view/profile_by_url?key="'+url+'"&limit=1',
            success: function(data, res) {
                if(data.error || !data.rows.length) {
                    return callback(false);
                }

                var current = data.rows[0].value;
                user._id = current._id;
                user._rev = current._rev;
                user.site = current.site;
                user.created = current.created;
                user.updated = Math.round(+new Date()/1000);

                // update url
                db({
                    method: 'PUT',
                    url: '/'+current._id,
                    data: user,
                    success: function(data, res) {
                        if(!data.ok) {
                            return callback(false);
                        }
                        return callback(true);
                    }
                });
            }
        });
    }

    self.removeUrl = function(url, callback) {
        db({
            url: '/_design/profile_by_url/_view/profile_by_url?key="'+url+'"&limit=1',
            success: function(data, res) {
                if(data.error || !data.rows.length) {
                    return callback();
                }

                var current = data.rows[0].value;
                // remove url
                db({
                    method: 'DELETE',
                    url: '/'+current._id+'?rev='+current._rev,
                    // url: '/'+current._id,
                    success: function(data, res) {
                        if(data.error) {
                            throw new Error(data.error + ': ' + data.reason);
                        }
                        callback();
                    }
                });
            }
        });
    }

}

exports.Mapper = Mapper;