#!/usr/local/bin/node
//2do: find memory leack

/*
* Get userinfo by urls
*/

var Config = require(__dirname + '/../config.json');

var arg = process.argv[2];
if(!arg || !Config.sites[arg]) {
	console.log('Usage: node fetch.js <site_from_config.json>');
	process.exit(1);
}

console.log('Start fetching: '+arg);
var Interface = require(__dirname + '/../app/interface'),
	Mapper = require(__dirname + '/../app/mapper').Mapper;
	Iconv = require('iconv').Iconv;

var mapper = new Mapper;
Interface.ensureImplements(mapper, Interface.mapInterface);


function fetchNext() {
	
	mapper.fetchNextUrl(arg, function(url) {
		if(url === undefined) {
			console.log('Finished!!!');
			process.exit();
		}

		console.log(url);

		mapper.getUserInfo(url, function(user) {
			var ret = mapper.validateUser(user);
			if(ret.errors.length) {
				console.log('errors: '+ret.errors.length);
				for(var i in ret.errors) {
					console.log('[ERR] '+ret.errors[i]);
				}
				mapper.removeUrl(url, function() {
					console.log('>> removed');
					return fetchNext();
				});
			} else {
				if(ret.warnings.length) {
					console.log('warnings: '+ret.warnings.length);
					for(var i in ret.warnings) {
						console.log('[WARN] '+ret.warnings[i]);
					}
				}

				mapper.updateUrl(url, ret.user, function(success) {
					console.log( success ? '>> done' : '>> error');
					return fetchNext();
				});
			}


		}); 

	}, function(err) {
		console.log('Error while fetching url:' + err)
	});
};

fetchNext();