#!/usr/local/bin/node

/*
* Get url's with userpages from target site
*/

var Config = require(__dirname + '/../config.json');

var arg = process.argv[2];

if(!arg || !Config.sites[arg]) {
	console.log('Usage: node map.js <site_from_config.json> [page]');
	process.exit(1);
}

console.log('Start mapping: '+arg);
var Interface = require(__dirname + '/../app/interface'),
	Mapper = require(__dirname + '/../app/mapper').Mapper,
	Iconv = require('iconv').Iconv;

var mapper = new Mapper;
var Site = require(__dirname + '/../modules/'+arg).Site;
var site = new Site;

Interface.ensureImplements(mapper, Interface.mapInterface);
Interface.ensureImplements(site, Interface.siteInterface);

var match = {};
site.searchUsers(function(url) {
	if(!url) return;

	if(match[url]) {
		process.stdout.write('.');
		return;
	}
	match[url] = true;
	mapper.appendUrl(url, arg, function(appended) {
		process.stdout.write(appended?'+':'-');
	}, function(error) {
		throw new Error(error);
	});
}, (process.argv[3] || undefined)
);