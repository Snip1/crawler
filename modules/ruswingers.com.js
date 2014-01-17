var Site = function() {

	var Mapper = require(__dirname + '/../app/mapper'),
		Util = require('util'),
		Config = require(__dirname + '/../config.json'),
		Iconv = require('iconv').Iconv;

	var conv = new Iconv('windows-1251', 'utf8');

	var config = Config['sites']['ruswingers.com'],
		mapper = new Mapper.Mapper();

	var self = this,
		_auth = false;

// private function: auth user
	var auth = function(callback) {
		if(_auth) return callback();

		mapper.getHtml({
			url: config.url + '/users/do/login/',
			body: Util.format('lgn=%s&pswd=%s', config.login, config.password),
			method: 'POST'
		}, function(html, res) {
			if(res.statusCode !== 302) throw new Error('Invalid credentials');
			_auth = true;
			return callback();
		});
	}

	var toUtf = function(text) {
		var text = new Buffer(text, 'binary');
		return conv.convert(text).toString();
	}

	var getSex = function(str) {
		if(str.match('ужчи')) return 'мужчина';
		if(str.match('енщин')) return 'женщина';
		if(str.match('ар')) return 'пара';
	}

	var getOrient = function(str) {
		if(str.match('и')) return 'би';
		if(str.match('етеро')) return 'гетеро';
	}

	var isAlbumExists = function(uid, callback) {
		if(!uid) return callback();

		auth(function() {
			var album = config.url + '/album/do/view/id/'+uid;
			mapper.getHtml({
				url: album
			}, function(html, res) {
				html = toUtf(html);
				if(res.statusCode === 200 && html.match('highslide-gallery')) return callback(album);
				return callback();
			});
		});
	}

	var getGalleryList = function(uid, callback) {
		if(!uid) return callback([]);
		
		auth(function() {
			var album = config.url + '/gallery/do/list/id/'+uid;
			mapper.getHtml({
				url: album,
				encoding: 'binary'
			}, function(html, res) {
				html = toUtf(html);
				if(res.statusCode !== 200) return callback([]);
				mapper.parseDom(html, function(window) {
					var $ = window.$;
					var ret = [];

					$('.border.shadow-noborder').each(function() {
						var a = $(this).children('div:first').children('a:first');

						var href = a.attr('href');
						var image = a.children('img').attr('src');
						var name = $(this).children('i:first').children('a:first').text();

						if(href && image && name) {
							ret.push({
								href: mapper.wrapUrl(
									href,
									config.url
								),
								image: mapper.wrapUrl(
									image,
									config.url
								),
								name: name
							});
						}
					});
					callback(ret);
				});
			});
		});
	}

// fetch userpages by criteria and apply callback to each url
	self.searchUsers = function(callback, start) {
		auth(function() { // auth user
			mapper.getHtml({ // get first page (init session storage)
				url: config.url + '/users/do/search/result/',
				body: 'usrch_login=&usrch_city=&usrch_country=&usrch_sex=&usrch_age=&usrch_prefer=&usrch_orient=&usrch_reason=&usrch_pair_prefer=&usrch_pair_orient=&usrch_type=&usrch_type1=1',
				method: 'POST'
			}, function(html, res) {
				var page = start || 0;
				var count = 0;
				var regexp = /\/users\/id\/\d+/igm;

				(function() { // recurese search users
					var recursive = arguments.callee;
					mapper.getHtml({
						url: Util.format('%s/users/do/search/result/1/page/%s', config.url, ++page)
					}, function(html, res) {
						console.log('Page  #'+page);
						if(res.statusCode === 302) {
							console.log('Finished, last page is %d, fetched %s users', page, count);
							return; // last page
						}
						if(res.statusCode !== 200) throw new Error('Wrong search responce');
						var matches = html.match(regexp);
						for(var i=0; i < matches.length; i++) {
							count++;
							callback(config.url + matches[i]);
						}
						recursive();
					});
				}());
			});
		});
	}

// parse html userpage and extract info
	self.getUserInfo = function(url, callback) {
		auth(function() {

			mapper.getHtml({
				url: url,
				encoding: 'binary'
			}, function(html, res) {
				if(res.statusCode !== 200) throw new Error('Wrong userpage responce');
				// convert html from cp1251 to utf8
				html = toUtf(html);
				mapper.parseDom(html, function(window) {
					var $ = window.$;
					var profile = {};

					var el = $('.h10').next(); // profle
					profile.url = url;
					profile.img = mapper.wrapUrl(
						el.find('img').attr('src'),
						config.url
					);
					var ul = el.find('h1:contains("данные")').next();
					var fields = {};
					ul.find('li').each(function() {
						var key = $(this).find('b').text();
						var value = $(this).contents().filter(function() {
							return this.nodeType == 3; //Node.TEXT_NODE;
						}).text().trim();
						fields[key] = value;
					});

					if(fields['Ник:']) {
						profile.nick = fields['Ник:'];
						delete fields['Ник:'];
					}
					if(fields['Пол:']) {
						profile.sex = getSex(fields['Пол:']);
						delete fields['Пол:'];
					}
					if(fields['Возраст:']) {
						profile.birth = new Date().getFullYear() - parseInt(
							fields['Возраст:']
						);
						delete fields['Возраст:'];
					}
					if(fields['Город:']) {
						profile.city = fields['Город:'];
						delete fields['Город:'];
					}

					if(fields['Ориентация:']) {
						profile.orient = getOrient(fields['Ориентация:']);
						delete fields['Ориентация:'];
					}
					
					// profile.search - нет такого поля на сайте

					profile.about = el.find('h1:contains("о себе:")').next().text().replace(/(\r\n|\n|\r)/g, ' ');

					profile.more = {};
					for(var i in fields)
						if(fields[i])
							profile.more[i] = fields[i];

					var uid = url.match(/id\/(\d+)/)[1];

					var albumFound = html.match('>Фотоальбом<')?true:false;
					var galleryFound = html.match('>Список галерей<')?true:false;

					// get albums
					getGalleryList(
						galleryFound ? uid : null,
						function(albums) {
							isAlbumExists(albumFound ? uid : null,
							function(album) {
								if(album) {
									albums.push({
										image: profile.img,
										name: 'Фотоальбом',
										href: album
									});
								};
								if(albums.length) {
									profile.albums = albums;
								}

								// profile.friends - на сайте нет открытого списка друзей

								return callback(profile); // profile here
							});
					});


				});
			});
		});
	}


}

exports.Site = Site;