var Site = function() {

	var Mapper = require(__dirname + '/../app/mapper'),
		Util = require('util'),
		Config = require(__dirname + '/../config.json');


	var config = Config['sites']['swinglife.ru'],
		mapper = new Mapper.Mapper();

	var self = this,
		_auth = false;

// private function: auth user
	var auth = function(callback) {
		if(_auth) return callback();

		mapper.getHtml({
			url: config.url
		}, function(html, res) {
			if(res.statusCode !== 200) throw new Error('Site unawailable');
			var regexp = /name="form_build_id".*?value="(.+?)"/i;
			var build_id = html.match(regexp)[1];
			mapper.getHtml({
				url: config.url + '/home?destination=home',
				body: Util.format('name=%s&pass=%s&form_build_id=%s&form_id=user_login_block', config.login, config.password, build_id),
				method: 'POST'
			}, function(html, res) {
				if(html.indexOf('edit-remember-me-wrapper') >= 0) throw new Error('Invalid credentials');
				_auth = true;
				return callback();
			});
		});
	}

// fetch userpages by criteria and apply callback to each url
	self.searchUsers = function(callback, start) {
		auth(function() { // auth user
			var page = start || 0;
			var count = 0;
			var regexp = /\/user\/\d+/igm;

			(function() { // recurese search users
				var recursive = arguments.callee;
				mapper.getHtml({
					url: Util.format('%s/users?page=%s&sort=new&sid=1364726853', config.url, page++)
				}, function(html, res) {
					console.log('Page #'+page);
					if(res.statusCode !== 200) throw new Error('Wrong search responce');
					if(html.indexOf('pager-last') < 0) {
						console.log('Finished, last page is %d, fetched %d users', page, count);
						return callback(); // last page
					}

					var matches = html.match(regexp);
					for(var i=0; i < matches.length; i++) {
						count++;
						callback(config.url + matches[i]);
					}
					recursive();
				});
			}());
		});
	}

// parse html userpage and extract info
	self.getUserInfo = function(url, callback) {
		// auth(function() {
		// 	mapper.getHtml({
		// 		url: url
		// 	}, function(html, res) {
		// 		if(res.statusCode !== 200) throw new Error('Wrong userpage responce');
		// 		mapper.parseDom(html, function(window) {
		// 			var $ = window.$;
		// 			var el = $('#main');
		// 			var tmp = el.find('td:contains("Зарегистрирован")').parent()
		// 			var profile = {};

		// 			// * обязательные поля профиля * //
		// 			profile.url = url;
		// 			profile.img = $('.anketa-avatar > img').attr('src');
		// 			profile.nick = el.find('nobr:first').text();
		// 			profile.sex = getSex(
		// 				el.find('small:first').text()
		// 			);
		// 			profile.birth = new Date().getFullYear() - parseInt(
		// 				tmp.next().children().eq(1).text()
		// 			);
		// 			profile.city = el.find('td:contains("Город")').parent().children().eq(1).text();
		// 			profile.orient = getOrient(
		// 				el.find('td:contains("Ориентация")').parent().children().eq(1).text()
		// 			);
		// 			profile.search = getSex(
		// 				el.find('td:contains("Кого ищ")').parent().children().eq(1).text()
		// 			);

		// 			// * необязательные поля профиля * //
		// 			profile.more = {};
		// 			profile.more['Дата регистрации'] = tmp.children().eq(1).text();
		// 			profile.more['Имя'] = tmp.next().children().eq(0).text();
		// 			profile.more['Предпочтения'] = el.find('td:contains("Предпочтения")').parent().children().eq(1).text().replace(/(\r\n|\n|\r)/g, ', ');
		// 			profile.about = el.find('.user-about > i').text().replace(/(\r\n|\n|\r)/g, ' ');
		// 			$('#person, #prefer').find('td').each(function() {
		// 				var key = $(this).find('b').text();
		// 				var value = $(this).contents().filter(function() {
		// 					return this.nodeType == 3; //Node.TEXT_NODE;
		// 				}).text();
		// 				if(key && value) profile.more[key] = value;
		// 			});

		// 			// * список друзей (отношений) * //
		// 			var friends = [];
		// 			var tmp = $('#friends').find('tr').each(function() {
		// 				$(this).find('a').each(function() {
		// 					friends.push({
		// 						href : $(this).attr('href'),
		// 						nick : $(this).text()
		// 					});
		// 				});
		// 			});
		// 			if(friends.length) {
		// 				profile.friends = friends;
		// 			};

		// 			// * список фотоальбомов * //
		// 			var albums = [];
		// 			$('.albums-main').find('img').each(function() {
		// 				var tmp2 = $(this).attr('data-original-title');
		// 				albums.push({
		// 					image	: $(this).attr('src'),
		// 					name 	: $(tmp2).text(),
		// 					href	: $(tmp2).attr('href')
		// 				});
		// 			});
		// 			if(albums.length) {
		// 				profile.albums = albums;
		// 			}

		// 			return callback(profile); // profile here
		// 		});
		// 	});
		// });
	}
}

exports.Site = Site;