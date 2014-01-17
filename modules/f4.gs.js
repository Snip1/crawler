var Site = function() {

	var Mapper = require(__dirname + '/../app/mapper'),
		Util = require('util'),
		Config = require(__dirname + '/../config.json');


	var config = Config['sites']['f4.gs'],
		mapper = new Mapper.Mapper();

	var self = this,
		_auth = false;

// private function: auth user
	var auth = function(callback) {
		if(_auth) return callback();

		mapper.getHtml({
			url: config.url + '/login',
			body: Util.format('login=%s&password=%s', config.login, config.password),
			method: 'POST'
		}, function(html, res) {
			if(res.statusCode !== 302) throw new Error('Invalid credentials');
			_auth = true;
			return callback();
		});
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

// fetch userpages by criteria and apply callback to each url
	self.searchUsers = function(callback, start) {
		auth(function() { // auth user
			var page = start || 0;
			var count = 0;
			(function() { // recurese search users
				var recursive = arguments.callee;
				mapper.getHtml({
					url: config.url + '/user/search',
					body: Util.format('order=0&page=%s', ++page),
					method: 'POST'
				}, function(html, res) {
					if(res.statusCode !== 200) throw new Error('Wrong search responce');
					// console.log('Page done: '+page);
					var result = JSON.parse(html);
					if(!Object.keys(result.result).length) {
						console.log('Finished, last page is %d, fetched %s users', page, count);
						return; // exit: last page
					}
					result.result.forEach(function(user) {
						callback(Util.format('%s/id/%s', config.url, user.id)); //  callback with fetched url
						count++;
					});
					recursive();
				});
			}());
		});
	}

// parse html userpage and extract info
	self.getUserInfo = function(url, callback) {
		auth(function() {
			mapper.getHtml({
				url: url
			}, function(html, res) {
				if(res.statusCode !== 200) throw new Error('Wrong userpage responce');
				mapper.parseDom(html, function(window) {
					var $ = window.$;
					var el = $('#main');
					var tmp = el.find('td:contains("Зарегистрирован")').parent()
					var profile = {};


					// * обязательные поля профиля * //
					profile.url = url;
					profile.img = mapper.wrapUrl(
						$('.anketa-avatar > img').attr('src'),
						config.url
					);
					profile.nick = el.find('nobr:first').text();
					profile.sex = getSex(
						el.find('small:first').text()
					);
					var birth = parseInt(tmp.next().children().eq(1).text());
					if(birth) {
						profile.birth = new Date().getFullYear() - birth;
					}

					var city = el.find('td:contains("Город")').parent().children().eq(1).text().trim();
					if(!city.match('не указан')) {
						profile.city = city
					}

					var orient = el.find('td:contains("Ориентация")').parent().children().eq(1).text();
					if(!orient.match('не указан')) {
						profile.orient = getOrient(
							orient
						);
					}
					var search = getSex(
						el.find('td:contains("Кого ищ")').parent().children().eq(1).text()
					);
					if(search) {
						profile.search = search;
					}

					var about = el.find('.user-about > i').text().replace(/(\r\n|\n|\r)/g, ' ');
					if(about) {
						profile.about = about;
					}

					// * необязательные поля профиля * //
					profile.more = {};
					// profile.more['Дата регистрации'] = tmp.children().eq(1).text();
					profile.more['Имя'] = tmp.next().children().eq(0).text();
					var prefer = el.find('td:contains("Предпочтения")').parent().children().eq(1).text().trim();
					if(prefer) {
						profile.more['Предпочтения'] = prefer.replace(/(\t|\r)/g, '').replace(/\n/g, ', ');
					}
					$('#person, #prefer').find('td').each(function() {
						var key = $(this).find('b').text();
						var value = $(this).contents().filter(function() {
							return this.nodeType == 3; //Node.TEXT_NODE;
						}).text();
						if(key && value) profile.more[key] = value;
					});

					// * список друзей (отношений) * //
					var friends = [], friendAdded = {};
					var tmp = $('#friends').find('tr').each(function() {
						$(this).find('a').each(function() {
							var href = mapper.wrapUrl(
								$(this).attr('href'),
								config.url
							);
							if(!friendAdded[href]) {
								friendAdded[href] = true;
								friends.push({
									href : href,
									nick : $(this).text()
								});
							}
							// mapper.appendUrl(url); // no need to sync? think
						});
					});
					if(friends.length) {
						profile.friends = friends;
					};

					// * список фотоальбомов * //
					var albums = [];
					$('.albums-main').find('img').each(function() {
						var tmp2 = $(this).attr('data-original-title');
						albums.push({
							image	: mapper.wrapUrl(
								$(this).attr('src'),
								config.url
							),
							name 	: $(tmp2).text(),
							href	: mapper.wrapUrl(
								$(tmp2).attr('href'),
								config.url
							)
						});
					});
					if(albums.length) {
						profile.albums = albums;
					}

					return callback(profile); // profile here
				});
			});
		});
	}
}

exports.Site = Site;