var KiteConnect = require("kiteconnect").KiteConnect
var KiteTicker = require("kiteconnect").KiteTicker
var session = {}
var settings = JSON.parse(localStorage.settings || '{}')
var alerts = JSON.parse(localStorage.alerts || '[]')
var orders = JSON.parse(localStorage.orders || '[]')

if (!localStorage.settings) localStorage.settings = JSON.stringify({
	enableAlerts: true,
	orderUpdateAlerts: true
})

chrome.browserAction.onClicked.addListener(() => {
	chrome.tabs.create({
		url: '/ui/main.html'
	})
})

chrome.cookies.onChanged.addListener(function _cookies_onchanged(data) {
	var cookie = data.cookie
	if (cookie.domain.indexOf("kite.zerodha.com") > -1 && cookie.name == "public_token") updateSession()
})

$('body').append($('<div/>').attr('id', 'audio'))
$('body').append($('<audio/>').attr('id', 'music'))
updateSession()

function updateSession () {
	getSession(session => {
		window.session = session
		if (session.public_token) init()
	})
}

function init() {
	window.kiteApi = new KiteConnect({
		api_key: "kitefront",
		csrfToken: session.public_token
	})
	window.ticker = new KiteTicker({
		api_key: "kitefront",
		user_id: session.user_id,
		access_token: session.public_token
	})
	if (!localStorage.instruments_last_updated || moment().diff(Number(localStorage.instruments_last_updated), 'day') >= 1) {
		(new KiteConnect({
			api_key: "kitefront",
			csrfToken: session.public_token,
			root: 'https://api.kite.trade/'
		})).getInstruments().then(instruments => {
			instruments = instruments.map(item => {
				return {
					symbol: item.tradingsymbol,
					exchange: item.exchange,
					token: item.instrument_token
				}
			})
			updateData({instruments: instruments})
			localStorage.instruments_last_updated = Date.now()
		})
	}
	ticker.connect()
	ticker.on("ticks", onTicks)
	ticker.on("connect", subscribe)
	ticker.on('order_update', onOrderUpdate)
}
setInterval(() => {
	var time = new Date()
	if (settings && settings.candleCloseAlerts && time.getSeconds() % 60 == 0) {
		if (settings.candleCloseAlerts['5min'] && time.getMinutes() % 5 == 0) musicAlert('woody')
		if (settings.candleCloseAlerts['15min'] && time.getMinutes() % 15 == 0) musicAlert('woody')
		if (settings.candleCloseAlerts['1hr'] && time.getMinutes() == 59) speechAlert('trading alert: watch for houurlee candle close')
	}
}, 1000)

function onTicks(ticks) {
	if (!settings.enableAlerts) return
	ticks.forEach(instrument => {
		alerts.forEach((alert, idx) => {
			if (alert.i.token == instrument.instrument_token && alert.time == 0) {
				if (!alert.initialDiff) alert.initialDiff = alert.price - instrument.last_price
				if (
					(alert.initialDiff >= 0 // alert price was greater than current price
					&& alert.price <= instrument.last_price) // current price is now reached alert price
					|| 
					(alert.initialDiff < 0 // alert price was lesser than current price
					&& alert.price >= instrument.last_price)
				) {
					// alert triggered
					alerts[idx].time = Date.now()
					saveAlerts()
					if (alert.method == 'sound') musicAlert()
					if (alert.method == 'speech') speechAlert(`Trading Alert: Price of ${alert.i.symbol} is now ${instrument.last_price}`)
					notifier('Price Alert', `Price of ${alert.i.symbol} is now ${instrument.last_price}`, `https://kite.zerodha.com/chart/${alert.i.exchange}/${alert.i.symbol}/${alert.i.token}`);
					if (settings.emailAlerts.enabled ) Email.send({
					    Host : "smtp.gmail.com",
					    Username : settings.emailAlerts.gmailAddress,
					    Password : settings.emailAlerts.password,
					    To : settings.emailAlerts.toEmail,
					    From : settings.emailAlerts.gmailAddress,
					    Subject : settings.emailAlerts.subject || 'Kite toolkit: Price Alert',
					    Body : `Price of ${alert.i.symbol} is now ${instrument.last_price}`
					}).then(console.log);
				} else if (
					alert.expiryPrice && 
					(
						(alert.initialDiff >= 0 // alert price was greater than current price
						&& alert.expiryPrice >= instrument.last_price) // current price is now reached alert price
						|| 
						(alert.initialDiff < 0 // alert price was lesser than current price
						&& alert.expiryPrice <= instrument.last_price)
					)
				) {
					alerts[idx].time = -1
					saveAlerts()
				}
			}
		})
	})
}

function onOrderUpdate (order) {
	if (!settings.orderUpdateAlerts) return
	$.ajax({
		url: 'https://kite.zerodha.com/api/alerts?type=order',
		headers: {
			'x-csrftoken': session.public_token
		}
	}).done(response => {
		var firstAlert = response.data[0]
		if (!localStorage.lastAlertId) localStorage.lastAlertId = firstAlert.timestamp - 1
		response.data.forEach(item => {
			var order = item.data
			orders.forEach((localOrder, idx) => {
				if (localOrder.order_id == order.order_id) {
					orders[idx].status = order.status
				}
			})
			if (item.timestamp <= localStorage.lastAlertId) return 0;
			if (order.status != 'COMPLETE') return 0;
			console.log(moment().diff(item.timestamp, 'second'))
			if (moment().diff(item.timestamp, 'second') < 10) {
				musicAlert()
				notifier('Order Executed', `${order.transaction_type} ${order.quantity} ${order.exchange}:${order.tradingsymbol} @ ${order.average_price}`, `https://kite.zerodha.com/chart/${order.exchange}/${order.tradingsymbol}/${order.instrument_token}`)
			}
		})
		saveOrders()
		if (firstAlert.timestamp > localStorage.lastAlertId) localStorage.lastAlertId = firstAlert.timestamp
	})
// {
//     "order_id": "16032300017157",
//     "exchange_order_id": "511220371736111",
//     "placed_by": "AB0012",
//     "status": "COMPLETE",
//     "status_message": "",

//     "tradingsymbol": "TATAMOTORS",
//     "exchange": "NSE",
//     "order_type": "MARKET",
//     "transaction_type": "SELL",
//     "validity": "DAY",
//     "product": "CNC",

//     "average_price": 376.35,
//     "price": 376.35,
//     "quantity": 1,
//     "filled_quantity": 1,
//     "unfilled_quantity": 0,
//     "trigger_price": 0,
//     "status_message": "",
//     "user_id": "AB0012",
//     "order_timestamp": "2015-12-20 15:01:43",
//     "exchange_timestamp": "2015-12-20 15:01:43",
//     "checksum": "5aa3f8e3c8cc41cff362de9f73212e28"
// }
}

function subscribe() {
	var items = alerts.map(alert => {
		return Number(alert.i.token)
	})
	ticker.subscribe(items);
	ticker.setMode(ticker.modeLTP, items);
}

function saveOrders () {
	localStorage.orders = JSON.stringify(orders)
}
function saveAlerts () {
	localStorage.alerts = JSON.stringify(alerts)
}

function clone (object) {
	return JSON.parse(JSON.stringify(object))
}