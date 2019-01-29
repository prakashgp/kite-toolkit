console.log('script.js')
var bg = chrome.extension.getBackgroundPage()
var session = bg.session
var settings = bg.settings
var kiteApi = bg.kiteApi
var allInstruments = []

getData('instruments', data => {
  // debugger
  allInstruments = data.instruments || []
})
ELEMENT.locale(ELEMENT.lang.en)

new Vue({
  el: '#app',
	data: () => ({
		page: 'alerts',
    createType: '',
    bulk: {
      symbols: '',
      priceOffset: 0.05,
      risk: 100,
      exchange: 'NSE',
      product: 'MIS',
      intervalOffset: 1,
      interval: 'day',
      tags: [],
      excludeBroke: true,
      working: false
    },
    settings: {
  		orderUpdateAlerts: true,
  		enableAlerts: true,
      candleCloseAlerts: {
        '5min': false,
        '15min': false,
        '1hr': false,
      },
      emailAlerts: {
        enabled: false,
        gmailAddress: '',
        password: '',
        toEmail: '',
        subject: 'Kite toolkit - Price alert'
      }
    },
		createAlert: false,
    createOrder: false,
    orders: [],
    instruments: [],
		alert: {
      e: '',
      i: '',
      price: '',
      method: 'speech',
      time: '',
      expiryPrice: '',
      r: false,
    },
    order: {
      instrument: {
        token: '',
        symbol: '',
        exchange: ''
      }, 
      status: '',
      transaction_type: 'BUY',
      product: 'MIS',
      order_type: 'LIMIT',
      quantity: '',
      price: '',
      variety: 'regular',
      tags: []
    },
    orders: bg.orders,
		alerts: bg.alerts,
    tags: [],
    ordersSelection: [],
    statusColors: {
      REJECTED: 'danger',
      OPEN: 'warning',
      COMPLETE: 'success',
    },
    search: '',
    searchAlerts: '',
    amo: false,
    localStorage
	}),
  filters: {
    formatCurrency (value) {
      var formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'INR',
        minimumFractionDigits: 0
      });
      
      return value && formatter.format(value); 
    }
  },
	methods: {
    moment,
    track (event) {
      mixpanel.track(event)
    },
    createCustom (command) {
      this.createOrder = true
      this.createType = command
    },
    acceptTos () {
      localStorage.tos = 1;
      location.reload()
    },
    contact() {
      mixpanel.track("contact");
      prompt('Hi, I\'m Prakash. You can contact me at: ', 'prakash.gpzz@gmail.com')
    },
    donate () {
      mixpanel.track("donate");
      location.href = 'https://www.instamojo.com/@prakashgp'
    },
    createOrderClick (type) {
      this.createOrder = true
      this.createType = type
    },
		exportOrders () {
      mixpanel.track("exportOrders");
			var csv = Papa.unparse(this.orders)
			saveToFile('kite_orders.csv', csv)
		},
		importOrders () {
      mixpanel.track("importOrders");
			readUserFile().then(csv => {
				Papa.parse(csv, {
					header: true,
					complete: result => {
						if (!result.meta.fields.includes('transaction_type')) return this.$message({
  						message: 'Invalid csv file!',
  						type: 'error'
  					})
            result.data.forEach(order => {
              order.tags = order.tags.split(',')
              var index = this.orders.findIndex(item => item.id == order.id)
              if (index > -1) this.orders.splice(index, 1, order)
              else this.orders.push(order)
            })
            this.saveOrders()
   					this.$message('Orders imported successfully')
					}
				})
			})
		},
    submitOrders (filter) {
      mixpanel.track("submitOrders");
      var filteredOrders = this.filteredOrders.filter(order => {
        if (filter) {
          var tagMatch = filter.match(/tag\:(.*)/)
          if (filter == 'selected' && this.ordersSelection.find(item => item.id == order.id)) return true
          if (tagMatch && tagMatch[1]  && order.tags.includes(tagMatch[1])) return true
        } else return true
      })
      var postedOrdersCount = filteredOrders.filter(order => order.status == 'POSTED').length
      if (postedOrdersCount > 0 && !confirm('There are ' + postedOrdersCount + ' orders in list with status = POSTED. Posting those may result in duplicate orders.')) return
      this.placeBulkOrders(filteredOrders).then(() => {
        mixpanel.people.increment("submitOrders", filteredOrders);
        this.$message('Orders submitted successfully')
      }).catch(error => {
        this.$message({
          message: 'There was an error while submitting orders: ' + error.message,
          type: 'error'
        })
      })
    },
		placeBulkOrders (orders) {
      var $this = this
			return new Promise((resolve, reject) => {
				promiseLoop(orders, order => {
					return kiteApi.placeOrder($this.amo ? 'amo' : 'regular', order).then(response => {
            this.updateOrder(order.id, {order_id: response.order_id, status: 'POSTED'})
  				})
				}, 500).then(resolve).catch(reject)
			})
		},
    findInstrument (condition) {
      return allInstruments.find(item => {
        for (let i in condition) if (condition[i] != item[i]) return false
        return true
      })
    },
    searchInstruments (query) {
      if (query && query.length > 1) {
        var exchanges = ['NSE', 'BSE', 'MCX', 'CDS', 'NFO']
        this.instruments = []
        exchanges.forEach(exchange => {
          var instruments = allInstruments.filter(item => {
            return item.exchange == exchange && item.symbol && item.symbol.toLowerCase().indexOf(query.toLowerCase()) > -1
          }).slice(0, 10)
          this.instruments = this.instruments.concat(instruments)
        })
      } else {
        this.instruments = [];
      }
      return this.instruments
    },
    addAlert () {
      mixpanel.track("addAlert");
      if (!this.alert.id) {
        this.alerts.push(Object.assign({id: Date.now()}, this.alert))
      } else {
        bg.alerts = this.alerts = this.alerts.map(alert => {
          if (alert.id == this.alert.id) return Object.assign(this.alert, {time: 0, initialDiff: 0})
          else return alert
        })
      }
      this.alert = this.$options.data().alert
      this.createAlert = false
      this.saveAlerts()
    },
    saveAlerts () {
      localStorage.alerts = JSON.stringify(this.alerts)
    },
    editAlert (alert) {
      this.alert = JSON.parse(JSON.stringify(alert))
      this.createAlert = true
      this.instruments = [this.alert.i]
    },
    deleteAlert(id) {
      var index = this.alerts.findIndex(item => item.id == id)
      if (~index) this.alerts.splice(index, 1)
      this.saveAlerts()
    },
    createBulkOrders () {
      mixpanel.track("createBulkOrders");
      var symbols = this.bulk.symbols.split(/\r?\n/)
      if (!Array.isArray(symbols) && typeof symbols == 'string') symbols = [symbols]
      this.bulk.working = true
      promiseLoop(symbols, (symbol) => {
        var instrument = this.findInstrument({symbol: symbol, exchange: this.bulk.exchange})
        if (!instrument) return
        if (!this.createOrder) return false
        return this.createOrderFromCriteria(instrument)
      }, 500).then(() => {
        this.bulk.working = false
        this.createOrder = false
        mixpanel.people.increment("createBulkOrders", symbols.length);
        this.$message('Orders generated successfully')
      })
    },
    createOrderFromCriteria (instrument, criteria = 'breakout') {
      return getHistoricalData(instrument.token, moment().subtract(this.bulk.intervalOffset, this.bulk.interval).startOf(this.bulk.interval).format('YYYY-MM-DD'), moment().format('YYYY-MM-DD'), this.bulk.interval).then(data => {
        if (!data[0]) return
        var excludeBuy = false, excludeSell = false
        if (this.exlcudeBroke) {
          for (let i = 1; i < data.length; i++) {
            if (data[i].high > data[0].high) excludeBuy = true
            if (data[i].low < data[0].low) excludeSell = true
          }
        }
        var quantity = Math.floor(this.bulk.risk / Math.abs(data[0].high - data[0].low))
        if (quantity <= 0 || quantity == Infinity) return
        var order = {
          quantity,
          status: 'NEW',
          id: Date.now(),
          transaction_type: 'BUY',
          product: this.bulk.product,
          order_type: 'SL',
          tags: this.bulk.tags,
          price: data[0].high + this.bulk.priceOffset + 0.1,
          variety: 'regular',
          trigger_price: data[0].high + this.bulk.priceOffset,
          instrument_token: instrument.token,
          exchange: this.bulk.exchange,
          tradingsymbol: instrument.symbol
        }
        if (!excludeBuy) this.orders.push(order)
        order = bg.clone(order)
        if (!excludeSell) this.orders.push(Object.assign(order, {
          transaction_type: 'SELL',
          trigger_price: data[0].low - this.bulk.priceOffset,
          price: data[0].low - this.bulk.priceOffset - 0.1
        }))
        this.saveOrders()
      })
    },
    addOrder () {
      mixpanel.track("addOrder");
      if (this.createType == 'breakout') {
        return this.createBulkOrders()
      }
      var order = normalizeOrder(this.order)
      if (!order.id) {
        this.orders.push(Object.assign(order, {id: Date.now(), status: 'NEW'}))
      } else {
        bg.orders = this.orders = this.orders.map(item => {
          if (item.id == order.id) return order
          else return item
        })
      }
      this.order = this.$options.data().order
      this.createOrder = false
      this.saveOrders()
    },
    saveOrders () {
      localStorage.orders = JSON.stringify(this.orders)
      this.updateTags()
    },
    editOrder (order) {
      this.order = denormalizeOrder(order)
      this.createOrder = true
      this.instruments = [this.order.instrument]
    },
    deleteOrder(id) {
      var index = this.orders.findIndex(item => item.id == id)
      if (~index) this.orders.splice(index, 1)
      this.saveOrders()
    },
    updateTags () {
      this.orders.forEach(order => {
        order.tags.forEach(tag => {
          if (this.tags.indexOf(tag) < 0) {
            mixpanel.people.increment("addTag");
            this.tags.push(tag)
          }
        })
      })
    },
    updateOrder (id, data) {
      this.orders.forEach((order, idx) => {
        if (order.id == id) {
          this.orders[idx] = Object.assign(this.orders[idx], data)
        }
      })
    },
    handleSelection (selection) {
      this.ordersSelection = selection
    },
    exportAlerts () {
      mixpanel.track("exportAlerts");
      saveToFile('kitekit_alerts.json', JSON.stringify(this.alerts))
    },
    importAlerts () {
      mixpanel.track("importAlerts");
      readUserFile().then(json => {
        var alerts = JSON.parse(json)
        alerts.forEach(alert => {
          if (!this.alerts.find(item => item.id == alert.id)) this.alerts.push(alert)
        })
        this.saveAlerts()
      })
    }
	},
	mounted () {
      mixpanel.track("Opened the app");

			if (!session.user_id || !session.public_token) return this.$message({
				message: 'Unable to find active login',
				type: 'error'
			})
      this.settings = Object.assign(this.settings, settings)
      this.updateTags()
      document.getElementById('app').style.display = 'block'
	},
  watch: {
    settings: {
      deep: true,
      handler () {
        Object.assign(settings, this.settings)
        localStorage.settings = JSON.stringify(this.settings)
      }
    }
  },
  computed: {
    filteredOrders () {
      return this.orders.filter(order => {
        return this.search ? !!JSON.stringify(order).toLowerCase().match(this.search.toLowerCase()) : true
      })
    },
    filteredAlerts () {
      return this.alerts.filter(alert => {
        return this.searchAlerts ? !!JSON.stringify(alert).toLowerCase().match(this.searchAlerts.toLowerCase()) : true
      })
    }
  }
})


function normalizeOrder (item) {
  var order = bg.clone(item)
  order.instrument_token = order.instrument.token
  order.exchange = order.instrument.exchange
  order.tradingsymbol = order.instrument.symbol
  delete order.instrument
  return order
}

function denormalizeOrder (item) {
  var order = bg.clone(item)
  order.instrument = {
    token: order.instrument_token,
    exchange: order.exchange,
    symbol: order.tradingsymbol
  }
  delete order.instrument_token
  delete order.exchange
  delete order.tradingsymbol
  return order
}

function promiseLoop (array, func, delay = 0) {
  return new Promise((resolve, reject) => {
    var index = -1
    iterator(index)
    function iterator () {
      index++
      if (index >= array.length) return resolve()
      var retval = func(array[index])
      if (typeof retval == 'object' && typeof retval.then == 'function') retval.then(() => wait(delay)).then(iterator).catch(reject)
      else {
        if (retval === false) return resolve()
        wait(delay).then(iterator)
      }
    }
  })
}
function wait (delay)  {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, delay)
  })
}
function getHistoricalData (instrument_token, from, to, interval) {
  return new Promise((resolve, reject) => {
    $.ajax({
      url: 'https://kitecharts.zerodha.com/api/chart/' + instrument_token + '/' + interval,
      data: {
        public_token: session.public_token,
        user_id: session.user_id,
        api_key: 'kitefront',
        access_token: randomString(),
        from,
        to, 
        ciqrandom: Date.now()
      },
      dataType: 'json'
    }).done(data => {
      resolve(data.data.candles.map(candle => {
        return {
          time: candle[0],
          open: candle[1],
          high: candle[2],
          low: candle[3],
          close: candle[4],
          volume: candle[5]
        }
      }))
    }).fail(reject)
  })
}

function randomString() {
    for (var e = "", t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789", a = 0; a < 32; a++)
        e += t.charAt(Math.floor(Math.random() * t.length));
    return e
}