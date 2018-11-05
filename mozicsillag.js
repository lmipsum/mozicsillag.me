/**
 *  Mozicsillag.cc plugin for Movian Media Center
 *
 *  Copyright (C) 2017 Murdock
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program. If not, see <http://www.gnu.org/licenses/>.
 */
(function (plugin) {
    var http = require("showtime/http");
    var html = require("showtime/html");
    var BASE_URL = "https://mozicsillag.me";
    var logo = plugin.path + "logo.png";
    var blue = "6699CC";
    var orange = "FFA500";
    var service = plugin.createService("mozicsillag.me", plugin.getDescriptor().id + ":start", "video", true, logo);
    var tmdb_media_prefix = "https://image.tmdb.org/t/p/original";
    var api_key = "d3196359d679b29665024601d4aa7482";

    function coloredStr(str, color) {
        return "<font color=\"" + color + "\">" + str + "</font>";
    }

    function setPageHeader(page, title) {
        page.loading = false;
        if (page.metadata) {
            page.metadata.title = showtime.entityDecode(unescape(title));
            page.metadata.logo = logo;
        }
        page.type = "directory";
        page.contents = "items";
    }

    function getLang(lng) {
        var lang = "";
        switch (lng) {
            case "EN":
                lang = "Nincs felirat";
                break;
            case "HU":
                lang = "Magyar";
                break;
            default:
                lang = "Felirat";
        }
        return lang;
    }

    function checkLink(link) {
        if (!link) return '';
        if (link.match(/https/)) return link.substr(0, 5) == 'https' ? showtime.entityDecode(link).replace(/\"/g, '')
            : BASE_URL + showtime.entityDecode(link).replace(/\"/g, '');
        return link.substr(0, 4) == 'http' ? showtime.entityDecode(link).replace(/\"/g, '')
            : BASE_URL + showtime.entityDecode(link).replace(/\"/g, '');
    }

    function tmdb(needle, year, imdb, tvseries, tmdb_id) {
        var prefix = "https://api.themoviedb.org/3";
        var suffix = "api_key=" + api_key + "&language=hu-HU";
        var season;
        var url = prefix;

        if (!imdb && tvseries) {
            season = needle.match(/:\s(\d+)\./)[1];
            needle = needle.match(/(.*)\s:/)[1];
        }

        if (tmdb_id) {
            url += !tvseries ? "/movie/" + tmdb_id + "?include_image_language=en&append_to_response=images&"
                : "/tv/" + tmdb_id + "/season/" + season + "?";
            url += suffix;
            res = showtime.httpReq(url);
            return JSON.parse(res);
        }

        if (imdb) {
            url = prefix + "/find/" + needle + "?external_source=imdb_id&" + suffix;
        } else {
            url += "/search/";
            url += !tvseries ? "movie?query=" + needle + "&year=" + year + "&page=1&include_adult=true&"
                : "tv?query=" + needle + "&page=1&";
            url += suffix;
        }
        var res = showtime.httpReq(encodeURI(url));
        var json_main = JSON.parse(res);

        var match = json_main.results[0];
        if (match) return match;
        /*
        var imdb_search = showtime.httpReq(encodeURI("http://www.imdb.com/find?q=" + needle
            + "&s=tt&ttype=ft&ref_=fn_ft")).toString();
        var imdb_id = html.parse(imdb_search).root.getElementByClassName('findResult')[0].getElementByTagName('a')[0]
            .attributes.getNamedItem('href').value.match(/(tt[\d]+)/)[1];
        return tmdb(imdb_id, year, 1, tvseries);
        */
        return false;
    }

    // Index page
    plugin.addURI(plugin.getDescriptor().id + ":play:(.*):(.*):(.*):(.*):(.*):(.*)",
        function (page, hoster, url, title, season, episode, imdbid) {
            var canonicalUrl = plugin.getDescriptor().id + ":play:" + hoster + ':' + url + ':' + title;

            page.loading = true;
            var mimetype = null;
            var doc = embedurl = regexp = src = '';

            function videoRemoved() {
                page.loading = false;
                page.error("A Videó törölve lett. Sajnálom :(");
                return;
            }

            if (checkLink(unescape(url)).match(/(http:\/\/filmbirodalmak.*)/)) {
                if (showtime.probe(checkLink(unescape(url))).result != 0) {
                    videoRemoved();
                    return;
                }
                doc = showtime.httpReq(checkLink(unescape(url))).toString();
            } else {
                doc = checkLink(unescape(url)).match(
                    /(?:youtu\.be\/|youtube\.com\/(?:(?:watch)?\?(?:.*&)?v(?:i)?=|(?:embed|v|vi|user|video)\/))([^\?&\"'>]+)/
                )[1].toString();
            }

            switch (unescape(hoster)) {
                case 'YouTubeTrailer':
                    var videoinfo = showtime.httpReq('http://youtube.com/get_video_info?video_id=' + doc).toString();
                    var fmt_map = unescape(videoinfo.match(/url_encoded_fmt_stream_map=([^&]+)/)[1].toString());
                    var video_formats = fmt_map.split(",");
                    var allurl = video_formats[0].match(/url=([^&]+)/)[1].toString();
                    url = unescape(allurl);
                    break;
                case 'ALLVID.CH':
                    embedurl = doc.match(/<IFRAME SRC="([\S\s]*?)"/)[1].toString();
                    var urldata = showtime.httpReq(checkLink(embedurl)).toString().match(/<iframe src="([\S\s]*?)"/)[1]
                        .toString();
                    url = showtime.httpReq(checkLink(urldata)).toString();
                    var tmp = url.match(/file:"([\S\s]*?)"/);
                    if (tmp)
                        url = tmp[1]
                    else {
                        url = url.match(
                            /<script type='text\/javascript'>eval\(function([\S\s]*?)\}\(([\S\s]*?)<\/script>/
                        );
                        var decryptedUrl;
                        eval('try { function decryptParams' + url[1] + '}; decryptedUrl = (decryptParams(' + url[2]
                            + '} catch (err) {}');
                        url = decryptedUrl.match(/file:"([\S\s]*?)"/)[1];
                    }
                    break;
                case 'VIDZI':
                    embedurl = doc.match(/<iframe[\S\s]*?src="([\S\s]*?)"/)[1].toString();
                    url = showtime.httpReq(checkLink(embedurl)).toString();
                    var tmp = url.match(/file:"([\S\s]*?)"/);
                    if (tmp)
                        url = tmp[1]
                    else {
                        url = url.match(
                            /<script type='text\/javascript'>eval\(function([\S\s]*?)\}\(([\S\s]*?)<\/script>/
                        );
                        var decryptedUrl;
                        eval('try { function decryptParams' + url[1] + '}; decryptedUrl = (decryptParams('
                            + url[2] + '} catch (err) {}');
                        url = decryptedUrl.match(/file:"([\S\s]*?)"/)[1];
                    }
                    url = 'hls:' + url;
                    break;
                case 'STREAMIN':
                    embedurl = doc.match(/<iframe[\S\s]*?src="([\S\s]*?)"/)[1].toString();
                    url = showtime.httpReq(checkLink(embedurl)).toString();
                    var tmp = url.match(/file:"([\S\s]*?)"/);
                    if (tmp)
                        url = tmp[1]
                    else {
                        url = url.match(
                            /<script type='text\/javascript'>eval\(function([\S\s]*?)\}\(([\S\s]*?)<\/script>/
                        );
                        var decryptedUrl;
                        eval('try { function decryptParams' + url[1] + '}; decryptedUrl = (decryptParams(' + url[2]
                            + '} catch (err) {}');
                        url = decryptedUrl.match(/file:"([\S\s]*?)"/)[1];
                    }
                    break;
                case 'VIDTO':
                    embedurl = "http://" + doc.headers.Location.toString().match(/(vidto\.me)\/([0-9a-zA-Z]+)/)[1]
                        + "/embed-" + doc.headers.Location.toString().match(/(vidto\.me)\/([0-9a-zA-Z]+)/)[2] + ".html";
                    url = showtime.httpReq(embedurl).toString().match(/file\s*:\s*"(http.+?)"/)[1];
                    break;
                case 'EXASHARE':
                    embedurl = doc.match(/<iframe[\S\s]*?src="([\S\s]*?)"/)[1].toString();
                    var srcurl = showtime.httpReq(embedurl).toString().match(/src="(.*?)"/)[1];
                    url = showtime.httpReq(srcurl).toString().match(/file\s*:\s*"(http.+?)"/)[1];
                    break;
                case 'VIDLOX.TV':
                    regexp = new RegExp(/sources:\s*\["([^"]+)"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    url = regexp.exec(doc)[1];
                    url = 'hls:' + url;
                    break;
                case 'INDAVIDEO':
                    regexp = new RegExp(/emb_hash"[\S\s]*?value="([^"]+)"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    url = showtime.httpReq('http://amfphp.indavideo.hu/SYm0json.php/player.'
                        + 'playerHandler.getVideoData/' + regexp.exec(doc)[1]);
                    var tokenobject = showtime.JSONDecode(url).data.filesh;
                    var tokennumber = JSON.stringify(tokenobject).match(/\{\"[0-9]+\":\"([^\"]+)\"/);
                    url = showtime.JSONDecode(url).data.video_file + "&token=" + tokennumber[1];
                    break;
                case 'VIDCLOUD':
                    regexp = new RegExp(/fileID[\S\s]*?\'([^"]+)\',\spage/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    var fileid = regexp.exec(doc)[1];
                    src = showtime.httpReq('https://vidcloud.co/download', {postdata: {'file_id': fileid}});
                    var json = JSON.parse(src);
                    url = json.html.match(/href=\"([^"]+)\"/)[1];
                    break;
                case 'VIDOZA':
                    regexp = new RegExp(/sourcesCode[\s\S]*?:\s*"(http[\S\s]*?)"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    url = regexp.exec(doc)[1];
                    break;
                case 'THEVIDEO':
                case 'VIDUP':
                    regexp = new RegExp(/<input[\S\s]*?direct\slink[\S\s]*?io\/([^"]+)\"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    var domain = hoster != 'VIDUP' ? 'vev' : hoster;
                    var fileid = regexp.exec(doc)[1];
                    src = showtime.httpReq('https://' + domain.toLowerCase() +
                        '.io/api/serve/video/' + fileid, {
                        postdata: {}
                    });
                    url = 'http' + src.toString().match(/qualities[\S\s]*?http([^"]+)\"/)[1];
                    break;
                case 'GAMOVIDEO':
                    regexp = new RegExp(/iframe[\S\s]*?src=\"[\S\s]*?embed-([^"]+)\"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    src = showtime.httpReq('http://gamovideo.com/embed-' + regexp.exec(doc)[1]);
                    url = 'http://s' + src.toString().match(/\|\|s([^"]+)\|doPlay/)[1] + '.gamovideo.com:8777/'
                        + src.toString().match(/mp4\|([^"]+)\|com/)[1] + '/v.mp4';
                    break;
                case 'VIDEA':
                    regexp = new RegExp(/videa_player_iframe[\S\s]*?src=\"(.+?)\"/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    src = showtime.httpReq(regexp.exec(doc)[1].replace('/player?',
                        'https://videa.hu/videaplayer_get_xml.php?')).toString();
                    var allvideos = src.match(/<video_source[\S\s]*?\">(.+?)<\//g);
                    url = 'https:' + allvideos[allvideos.length - 1].match(/<video_source[\S\s]*?\">(.+?)<\//)[1]
                        .replace('&amp;', '&');
                    break;
                case 'GOUNLIMITED.TO':
                    regexp = new RegExp(/eval[\S\s]*?function\|(.*?)\|sources/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    var data = regexp.exec(doc)[1].split('|');
                    url = 'https://' + data[26] + '.gounlimited.to/' + data[data.length - 1] + '/v.mp4';
                    break;
                case 'OPENLOAD.CO':
                    regexp = new RegExp(/fileid=\"([\S\s]*?)\";/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    var id = regexp.exec(doc)[1];
                    src = showtime.httpReq('https://openload.co/embed/' + id).toString();

                    var data_col_1 = src.match(/0x30725e,\(parseInt\('(.+?)',8\)-(.+?)\+0x4-\d{1}\)\/\((.+?)-/);
                    var data_col_2 = src.match(/1x4bfb36=parseInt\(\'(.+?)',8\)\-(.+?);/);
                    var _0x531f91 = src.match(/:none;\">\n<p\sstyle=\"\"\sid=".+?">(.+?)<\/p>/)[1];

                    var _0x5d72cd = _0x531f91.charCodeAt(0);
                    _0x5d72cd = _0x531f91;

                    var _0x1bf6e5 = '';
                    var _0x41e0ff = 9 * 8;
                    var _0x439a49 = _0x5d72cd.substring(0x0, _0x41e0ff);
                    var _0x3d7b02 = [];
                    var _0x31f4aa = {
                        k: _0x439a49,
                        ke: []
                    };

                    for (i = 0; (i < _0x439a49.length); i += 8) {
                        _0x41e0ff = i * 8;
                        var _0x40b427 = _0x439a49.substring(i, i + 8);
                        var _0x577716 = parseInt(_0x40b427, 16);

                        _0x31f4aa.ke.push(_0x577716);
                    }

                    _0x3d7b02 = _0x31f4aa.ke;
                    _0x41e0ff = 9 * 8;

                    _0x5d72cd = _0x5d72cd.substring(_0x41e0ff);

                    var _0x439a49 = 0;
                    var _0x145894 = 0;
                    while (_0x439a49 < _0x5d72cd.length) {
                        var _0x5eb93a = 64;
                        var _0x37c346 = 127;
                        var _0x896767 = 0;
                        var _0x1a873b = 0;
                        var _0x3d9c8e = 0;
                        var _0x31f4aa = {
                            'mm': 128,
                            'xx': 63
                        };

                        do {
                            if ((_0x439a49 + 1) >= _0x5d72cd.length) {
                                _0x5eb93a = 143;
                            }
                            var _0x1fa71e = _0x5d72cd.substring(_0x439a49, (_0x439a49 + 2));
                            _0x439a49++;
                            _0x439a49++;
                            _0x3d9c8e = parseInt(_0x1fa71e, 16);

                            with (_0x31f4aa) {
                                if (_0x1a873b < 30) {
                                    var _0x332549 = _0x3d9c8e & xx;
                                    _0x896767 += _0x332549 << _0x1a873b;
                                } else {
                                    var _0x332549 = _0x3d9c8e & xx;
                                    _0x896767 += _0x332549 * Math.pow(2, _0x1a873b);
                                }
                            }
                            _0x1a873b += 0x6;
                        } while (_0x3d9c8e >= _0x5eb93a);

                        var _1x4bfb36 = parseInt(data_col_2[1], 8) - data_col_2[2];
                        var _0x30725e = (_0x896767 ^ _0x3d7b02[(_0x145894 % 0x9)]);
                        _0x30725e = (_0x30725e ^ (parseInt(data_col_1[1], 8) - parseInt(data_col_1[2]) + 0x4)
                            / (parseInt(data_col_1[3]) - 0x8)) ^ _1x4bfb36;

                        var _0x2de433 = (_0x5eb93a * 0x2) + _0x37c346;

                        for (i = 0; (i < 4); i++) {
                            var _0x1a9381 = _0x30725e & _0x2de433;
                            var _0x1a0e90 = (_0x41e0ff / 9) * i;
                            _0x1a9381 = _0x1a9381 >> _0x1a0e90;
                            var _0x3fa834 = String.fromCharCode(_0x1a9381 - 1);
                            if (_0x3fa834 != '$') _0x1bf6e5 += _0x3fa834;
                            _0x2de433 = _0x2de433 << (_0x41e0ff / 9);
                        }

                        _0x145894 += 0x1;
                    }
                    url = 'https://oload.stream/stream/' + _0x1bf6e5 + '?mime=true';
                    break;
                case 'STREAMANGO':
                    regexp = new RegExp(/iframe[\S\s]*?src=\&quot;([\S\s]*?)\&quot;/);
                    if (!regexp.exec(doc)) {
                        videoRemoved();
                        return;
                    }
                    src = showtime.httpReq(regexp.exec(doc)[1]).toString();
                    var encoded = src.match(/srces[\S\s]*?d\(\'([^']+)\',(\d+)\)/);

                    var _0x5ecd00 = encoded[1];
                    var _0x184b8d = encoded[2];

                    k = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
                    var _0x59b81a = '';
                    var _0x2e4782, _0x2c0540, _0x5a46ef;
                    var _0x4a2f3a, _0x29d5bf, _0x3b6833, _0x426d70;
                    var _0x1598e0 = 0;
                    k = k.split('').reverse().join('');

                    _0x5ecd00 = _0x5ecd00.replace(/[^A-Za-z0-9\+\/\=]/g, '');

                    while (_0x1598e0 < _0x5ecd00.length) {
                        _0x4a2f3a = k.indexOf(_0x5ecd00.charAt(_0x1598e0++));
                        _0x29d5bf = k.indexOf(_0x5ecd00.charAt(_0x1598e0++));
                        _0x3b6833 = k.indexOf(_0x5ecd00.charAt(_0x1598e0++));
                        _0x426d70 = k.indexOf(_0x5ecd00.charAt(_0x1598e0++));

                        _0x2e4782 = (_0x4a2f3a << 2) | (_0x29d5bf >> 4);
                        _0x2c0540 = ((_0x29d5bf & 15) << 4) | (_0x3b6833 >> 2);
                        _0x5a46ef = ((_0x3b6833 & 3) << 6) | _0x426d70;
                        _0x2e4782 = _0x2e4782 ^ _0x184b8d;

                        _0x59b81a = _0x59b81a + String.fromCharCode(_0x2e4782);

                        if (_0x3b6833 != 64) {
                            _0x59b81a = _0x59b81a + String.fromCharCode(_0x2c0540);
                        }

                        if (_0x426d70 != 64) {
                            _0x59b81a = _0x59b81a + String.fromCharCode(_0x5a46ef);
                        }
                    }

                    url = ('https:' + _0x59b81a);
                    break;
                // not supported    
                case 'FLASHX':
                case '1FICHIER':
                case 'UPVID.CO':
                case 'SPEEDVID':
                case 'STREAMCLOUD':
                case 'WAAW.':
                    break;
                default:
                    page.loading = false;
                    page.error("Nem lehet lejátszani a linket.'" + unescape(hoster) + "'. Sajnálom :(");
                    return;
            }
            page.loading = false;
            page.type = "video";
            page.source = "videoparams:" + showtime.JSONEncode({
                title: unescape(unescape(title)),
                imdbid: imdbid,
                season: season,
                episode: episode,
                no_fs_scan: true,
                canonicalUrl: canonicalUrl,
                sources: [{
                    url: url,
                    mimetype: mimetype
                }]
            });
        });

    // Index page
    var addURI = plugin.addURI(plugin.getDescriptor().id + ":index:(.*)", function (page, data) {
        page.loading = true;

        data = JSON.parse(data);
        var url = data.url;
        var doc = showtime.httpReq(checkLink(unescape(url))).toString();
        var dom = html.parse(doc);
        var content = dom.root.getElementById('content-elements');
        if (!content.getElementByClassName('small-centered')[0]) {
            page.loading = false;
            page.error("Jelenleg nincs stream ehhez a filmhez. Sajnálom :(");
            return;
        }

        var hostpageurl = content.getElementByClassName('small-centered')[0].getElementByTagName('a')[0]
            .attributes.getNamedItem('href').value;
        var season = data.tv_series ? +content.getElementByTagName('h1')[0].textContent.match(/:\s(\d+)\./)[1] : '';
        var movie_details = content.getElementByClassName('movie-details')[0].getElementByTagName('li');
        var genre = [].slice.call(movie_details[1].getElementByTagName('a')).map(function (item, i) {
            return item.textContent;
        }).join(', ');
        var imdbid = movie_details[7].getElementByTagName('a')[0].attributes.getNamedItem('href').value.split('/')[4];

        var tmdb_data = tmdb(data.title, data.year, 0, data.tv_series, data.id);

        setPageHeader(page, data.title);

        page.loading = true;
        // redirecting to hoster page
        doc = showtime.httpReq(checkLink(hostpageurl)).toString();
        dom = html.parse(doc);
        content = dom.root.getElementByClassName('content')[0];

        var trailer = content.getElementByTagName('iframe')[0].attributes.getNamedItem('src').value;
        if (trailer.match(/(http|https)/) != null) appendItem(plugin.getDescriptor().id + ':play:YouTubeTrailer:'
            + escape(trailer) + ':' + escape(page.metadata.title) + ':' + escape('no info') + ':' + ':', 'Előzetes');

        function appendItem(route, title, movie_data) {
            var metadata = {
                title: new showtime.RichText(title),
                icon: tmdb_data.poster_path ? tmdb_media_prefix + tmdb_data.poster_path : data.icon
            };
            if (data.backdrops) metadata.backdrops = data.backdrops;
            if (title === "Előzetes" || !data.tv_series) {
                metadata.genre = genre;
                metadata.tagline = data.title;
                metadata.description = new showtime.RichText((title !== "Előzetes" ? coloredStr("Feltöltve: ", orange)
                    + movie_data.date.trim() + "\n" : ""));
            }
            if (title !== "Előzetes") metadata.source = movie_data.hoster + (movie_data.views ? " ("
                + movie_data.views.trim() + ")" : "");
            if (title !== "Előzetes" && data.tv_series) {
                var index = movie_data.episode - 1;
                var overview, ep_title = "";
                if (tmdb_data.episodes[index]) {
                    ep_title = tmdb_data.episodes[index].name;
                    overview = tmdb_data.episodes[index].overview;
                }
                metadata.vtype = "tvseries";
                metadata.episode = {
                    title: data.title,
                    number: movie_data.episode
                };
                metadata.tagline = ep_title;
                metadata.season = {number: season};
                metadata.description = new showtime.RichText((movie_data.date ? coloredStr("Feltöltve: ", orange)
                    + movie_data.date.trim() + "\n" : "") + overview
                );

            }
            page.appendItem(route, 'video', metadata);

        }

        function collectLinks(items, moreinfo) {
            var supportedhoster = ["ALLVID.CH", "VIDZI", "VIDTO", "VIDLOX.TV", "EXASHARE", "STREAMIN", "INDAVIDEO",
                "VIDCLOUD", "VIDOZA", "VIDUP", "THEVIDEO", "GAMOVIDEO", "VIDEA", "OPENLOAD.CO", "STREAMANGO",
                "GOUNLIMITED.TO"
            ];
            for (var i = 0; i < items.length; i++) {
                page.loading = true;
                supported = false;
                var movie_data = {
                    hoster: items[i].getElementByTagName('a')[1].attributes.getNamedItem('title').value.split(' - ')[0]
                        .trim()
                };

                if (supportedhoster.indexOf(escape(movie_data.hoster.toUpperCase())) > -1) {
                    movie_data.url = !data.tv_series ? items[i].getElementByTagName('a')[5].attributes.getNamedItem('href')
                        .value : items[i].getElementByTagName('a')[4].attributes.getNamedItem('href').value;
                    // if (showtime.probe('http://filmbirodalmak.com/' + movie_data.url.toString()).result == 0)
                    // Check if URL works, it can slow down the parsing, but won't include dead links,
                    // magyarul gecire belassul a linkek betöltése, ha egy filmnél sok link van
                    supported = true;
                }
                if (supported) {
                    movie_data.quality = items[i].getElementByTagName('a')[1].attributes.getNamedItem('title').value
                        .split(' - ')[1].trim();
                    movie_data.lang = items[i].getElementByTagName('img')[1].attributes.getNamedItem('src').value
                        .split('/')[2].replace('.png', '');
                    movie_data.date = items[i].getElementByClassName('uploadedLink')[0]
                        ? items[i].getElementByClassName('uploadedLink')[0].textContent.toString()
                        : items[i].getElementByClassName('uploadedLink_movie')[0].textContent.toString();
                    movie_data.views = items[i].getElementByClassName('link_views')[0]
                        ? items[i].getElementByClassName('link_views')[0].textContent : '';
                    movie_data.episode = +moreinfo.match(/\d+/);

                    appendItem(plugin.getDescriptor().id + ':play:' + escape(movie_data.hoster.toUpperCase()) + ':'
                        + escape('http://filmbirodalmak.com/' + movie_data.url) + ':' + escape(page.metadata.title)
                        + ':' + season + ':' + movie_data.episode + ':' + imdbid, coloredStr(movie_data.quality,
                        orange) + ' ' + (movie_data.hoster.toUpperCase() + (moreinfo ? ' - ' + moreinfo.trim()
                        : '')).trim() + coloredStr(' (' + getLang(movie_data.lang) + ')', orange), movie_data);
                }
            }
            page.loading = false;
        }

        page.loading = false;
        var moreinfo = '';
        var links_holder = content.getElementByClassName('links_holder')[0];
        var items = links_holder.getElementByClassName('panel');
        if (!data.tv_series) {
            collectLinks(items, moreinfo);
        } else {
            var episodes = links_holder.getElementByClassName('accordion-episodes');
            for (var e = 0; e < episodes.length; e++) {
                moreinfo = episodes[e].getElementByClassName('textHolder')[0].textContent;
                items = episodes[e].getElementByClassName('panel');
                collectLinks(items, moreinfo);
            }
        }
    });

    var cats;

    // scraping the home page
    function scraper(page, url) {
        page.entries = 0;
        var first = true,
            tryToSearch = true;

        function loader() {
            if (!tryToSearch) return false;
            page.loading = true;
            var doc = showtime.httpReq(checkLink(url)).toString();
            var dom = html.parse(doc);
            page.loading = false;
            if (first) {
                cats = dom.root.getElementByClassName('top-bar-section')[0];
                var maxitem = 15;
                first = false;
            } else {
                var maxitem = 20;
            }

            var movies = dom.root.getElementByClassName(
                'small-block-grid-2 medium-block-grid-4 large-block-grid-5 enable-hover-link'
            )[0];

            if (movies) {
                var items = movies.getElementByTagName('li');
                for (var i = 0; (i < maxitem); i++) {
                    var item = items[i].getElementByTagName('a')[0];
                    var href = item.attributes.getNamedItem('href').value;
                    var tv_series = (href.match(/\/(film|sorozat)\//)[1] == 'sorozat') ? true : false;
                    var title = item.getElementByTagName('h3')[0] != null
                        ? item.getElementByTagName('h3')[0].textContent.trim()
                        : item.getElementByTagName('h2')[0].textContent.trim();
                    var year = item.getElementByClassName('small-5 columns text-left')[0].textContent.trim();
                    var tmdb_data = !tv_series ? tmdb(title, year, 0, tv_series) : tmdb(title, year, 0, tv_series, 0);
                    //showtime.print(JSON.stringify(tmdb_data));
                    if (tmdb_data.title) title = tmdb_data.title;

                    var icon = tmdb_data.poster_path ? tmdb_media_prefix + tmdb_data.poster_path
                        : BASE_URL + item.getElementByTagName('img')[0].attributes.getNamedItem('data-original').value;
                    var details = item.getElementByClassName('cover-surface')[0].textContent;
                    var duration = details.toString().match(/Hossz:\s*([\S\s]*?)IM/)[1].trim();
                    var rating = tmdb_data.vote_average ? tmdb_data.vote_average
                        : details.toString().match(/IMDB\s+Pont:\s*([\S\s]*?)F/)[1].trim();
                    var last_update = item.getElementByClassName('cover-surface')[0].getElementByTagName('p')[0]
                        .textContent.split(':');
                    var description = tmdb_data.overview ? tmdb_data.overview : "";
                    var metadata = {
                        title: title,
                        icon: icon,
                        year: +year,
                        duration: duration,
                        rating: +rating * 10,
                        description: new showtime.RichText(coloredStr(last_update[0].trim() + ': ', orange)
                            + last_update[1].trim() + "\n" + description)
                    };
                    var item_data = {
                        url: href,
                        tv_series: tv_series,
                        title: title,
                        icon: icon
                    };
                    if (tmdb_data.id) item_data.id = tmdb_data.id;
                    if (tmdb_data.episodes) item_data.episodes = tmdb_data.episodes;
                    if (tmdb_data.backdrop_path)
                        metadata.backdrops = item_data.backdrops = [{url: tmdb_media_prefix + tmdb_data.backdrop_path}];

                    page.appendItem(
                        plugin.getDescriptor().id + ':index:' + JSON.stringify(item_data), 'video', metadata
                    );
                    page.entries++;
                }

                var next = doc.match(/current[\S\s]*?>\d+<\/a><\/li><li><a\shref=\'([\S\s]*?)\'/);
                if (!next) return tryToSearch = false;
                url = next[1];
            }
            return true;
        }

        loader();
        page.paginator = loader;
    }

    // populate categories
    function addCats(page, type, filter) {
        var collection = cats.getElementByClassName('dropdown dropdown-wrapper')[type];
        var items = collection.getElementByTagName('li');
        for (var i = 1; i < items.length; i++) {
            var item = items[i].getElementByTagName('a')[0];
            var href = item.attributes.getNamedItem('href').value;
            if (href.indexOf(filter) > -1) {
                var title = item.getElementByTagName('strong')[0].textContent;
                page.appendItem(plugin.getDescriptor().id + ':category:' + escape(href) + ':' + escape(title),
                    'directory', {
                        title: showtime.entityDecode(title)
                    });
            }
        }
    }

    plugin.addURI(plugin.getDescriptor().id + ":mostviewedmovie", function (page) {
        setPageHeader(page, 'Legnézettebb Filmek');
        scraper(page, BASE_URL + '/filmek-online/legnezettebb');
    });

    plugin.addURI(plugin.getDescriptor().id + ":mostnewmovie", function (page) {
        setPageHeader(page, 'Legfrissebb Filmek');
        scraper(page, BASE_URL + '/filmek-online/legfrissebb');
    });

    plugin.addURI(plugin.getDescriptor().id + ":mostviewedserie", function (page) {
        setPageHeader(page, 'Legnézettebb Sorozatok');
        scraper(page, BASE_URL + '/sorozatok-online/legnezettebb');
    });

    plugin.addURI(plugin.getDescriptor().id + ":mostnewserie", function (page) {
        setPageHeader(page, 'Legfrissebb Sorozatok');
        scraper(page, BASE_URL + '/sorozatok-online/legfrissebb');
    });

    plugin.addURI(plugin.getDescriptor().id + ":moviecategories", function (page) {
        setPageHeader(page, 'Film Kategóriák');
        addCats(page, 0, 'filmek-online');
    });

    plugin.addURI(plugin.getDescriptor().id + ":seriecategories", function (page) {
        setPageHeader(page, 'Sorozat Kategóriák');
        addCats(page, 1, 'sorozatok-online');
    });

    plugin.addURI(plugin.getDescriptor().id + ":category:(.*):(.*)", function (page, url, title) {
        setPageHeader(page, unescape(title));
        scraper(page, checkLink(unescape(url)));
    });

    plugin.addURI(plugin.getDescriptor().id + ":start", function (page) {
        setPageHeader(page, plugin.getDescriptor().synopsis);
        page.appendItem(plugin.getDescriptor().id + ':mostviewedmovie', 'directory', {
            title: 'Legnézettebb Filmek'
        });

        page.appendItem(plugin.getDescriptor().id + ':mostnewmovie', 'directory', {
            title: 'Legfrissebb Filmek'
        });

        page.appendItem(plugin.getDescriptor().id + ':mostviewedserie', 'directory', {
            title: 'Legnézettebb Sorozatok'
        });

        page.appendItem(plugin.getDescriptor().id + ':mostnewserie', 'directory', {
            title: 'Legfrissebb Sorozatok'
        });

        page.appendItem(plugin.getDescriptor().id + ':moviecategories', 'directory', {
            title: 'Film Kategóriák'
        });

        page.appendItem(plugin.getDescriptor().id + ':seriecategories', 'directory', {
            title: 'Sorozat Kategóriák'
        });

        page.appendItem("", "separator", {
            title: 'Kiemelt filmek'
        });
        scraper(page, BASE_URL);
    });

    plugin.addSearcher(plugin.getDescriptor().id, logo, function (page, query) {
        var Base64 = {
            _keyStr: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=", encode: function (e) {
                var t = "";
                var n, r, i, s, o, u, a;
                var f = 0;
                e = Base64._utf8_encode(e);
                while (f < e.length) {
                    n = e.charCodeAt(f++);
                    r = e.charCodeAt(f++);
                    i = e.charCodeAt(f++);
                    s = n >> 2;
                    o = (n & 3) << 4 | r >> 4;
                    u = (r & 15) << 2 | i >> 6;
                    a = i & 63;
                    if (isNaN(r)) {
                        u = a = 64
                    } else if (isNaN(i)) {
                        a = 64
                    }
                    t = t + this._keyStr.charAt(s) + this._keyStr
                        .charAt(o) + this._keyStr
                        .charAt(u) + this._keyStr.charAt(a)
                }
                return t
            },
            decode: function (e) {
                var t = "";
                var n, r, i;
                var s, o, u, a;
                var f = 0;
                e = e.replace(/[^A-Za-z0-9\+\/\=]/g, "");
                while (f < e.length) {
                    s = this._keyStr.indexOf(e.charAt(f++));
                    o = this._keyStr.indexOf(e.charAt(f++));
                    u = this._keyStr.indexOf(e.charAt(f++));
                    a = this._keyStr.indexOf(e.charAt(f++));
                    n = s << 2 | o >> 4;
                    r = (o & 15) << 4 | u >> 2;
                    i = (u & 3) << 6 | a;
                    t = t + String.fromCharCode(n);
                    if (u != 64) {
                        t = t + String.fromCharCode(r)
                    }
                    if (a != 64) {
                        t = t + String.fromCharCode(i)
                    }
                }
                t = Base64._utf8_decode(t);
                return t
            },
            _utf8_encode: function (e) {
                e = e.replace(/\r\n/g, "\n");
                var t = "";
                for (var n = 0; n < e.length; n++) {
                    var r = e.charCodeAt(n);
                    if (r < 128) {
                        t += String.fromCharCode(r)
                    } else if (r > 127 && r < 2048) {
                        t += String.fromCharCode(r >> 6 |
                            192);
                        t += String.fromCharCode(r & 63 |
                            128)
                    } else {
                        t += String.fromCharCode(r >> 12 |
                            224);
                        t += String.fromCharCode(r >> 6 &
                            63 | 128);
                        t += String.fromCharCode(r & 63 |
                            128)
                    }
                }
                return t
            },
            _utf8_decode: function (e) {
                var t = "";
                var n = 0;
                var r = c1 = c2 = 0;
                while (n < e.length) {
                    r = e.charCodeAt(n);
                    if (r < 128) {
                        t += String.fromCharCode(r);
                        n++
                    } else if (r > 191 && r < 224) {
                        c2 = e.charCodeAt(n + 1);
                        t += String.fromCharCode((r & 31) <<
                            6 | c2 & 63);
                        n += 2
                    } else {
                        c2 = e.charCodeAt(n + 1);
                        c3 = e.charCodeAt(n + 2);
                        t += String.fromCharCode((r & 15) <<
                            12 | (c2 & 63) << 6 | c3 &
                            63);
                        n += 3
                    }
                }
                return t
            }
        };
        var searchurl = 'search_term=' + query.replace(/\s/g, '\+') +
            '&search_type=0&search_where=0&search_rating_start=1&search_rating_end=10&search_year_from=1900&search_year_to=2017';
        scraper(page, BASE_URL + '/kereses/' + Base64.encode(searchurl));
    });
})(this);