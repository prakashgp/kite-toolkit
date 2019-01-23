
function speechAlert(text) {
	speak(text, {
		speed: 180,
		wordgap: 2
	})
}

function musicAlert() {
	$('#music').attr('src', '/music/to-the-point.mp3')[0].play()
}

function notifier(title, message, url) {
	var id = Math.floor(Math.random() * 9007199254740992) + 1;
	chrome.notifications.create(id + "", {
		iconUrl: "images/icon.png",
		type: "basic",
		title: title,
		message: message || ""
	}, function () {
	});
	if (url) {
		chrome.notifications.onClicked.addListener(function (nid) {
			if (nid == id) {
				window.open(url);
			}
		});
	}
}


function getSession(callback) {
	chrome.cookies.get({
		url: "https://kite.zerodha.com/",
		name: "public_token"
	}, public_token => {
		chrome.cookies.get({
			url: "https://kite.zerodha.com/",
			name: "user_id"
		}, user_id => {
			if (public_token && user_id)
				callback({
					public_token: public_token.value,
					user_id: user_id.value
				});
			else callback({})
		})
	});
}

function updateData(data, callback) {
	chrome.storage.local.set.apply(this, arguments);
}

function getData(key, callback) {
	chrome.storage.local.get(key, function (data) {
		callback(data);
	});
}
function _delete(object, fields, mutate) {
	var newObject = {}
	for (var field in object) {
		if (!fields.includes(field)) {
			newObject[field] = object[field]
		} else if (mutate) {
			delete object[field]
		}
	}
	return newObject
}

function saveToFile(filename, content) {
	var a = window.document.createElement("a");
	a.href = window.URL.createObjectURL(new Blob([content], {
		type: "text/text"
	}));
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}

function getUserFile() {
	return new Promise((resolve, reject) => {
		var fileInput = $('<input type="file">')[0];
		fileInput.onchange = () => resolve(fileInput.files)
		fileInput.click();
	})
}

function readUserFile() {
	return new Promise((resolve, reject) => {
		getUserFile().then(files => {
			var readFile = new FileReader()
			readFile.onloadend = () => resolve(readFile.result)
			readFile.onerror = () => reject(readFile.error)
			readFile.readAsText(files[0])
		})
	})
}
