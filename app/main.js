const axios = require('axios')
const https = require('https')
const parseDuration = require('parse-duration')

const config = JSON.parse(require('fs').readFileSync(process.argv[2] ?? 'config.json'))

const metricsUrl = new URL('history/timeseries/metrics', config.brewblox_url)
const streamUrl = `https://log.brewfather.net/stream?id=${config.brewfather_stream}`

function pushToBrewfather() {
	axios
		.post(metricsUrl.href, {
			fields: config.devices.flatMap(device => Object.values(device.fields)),
		}, {
			httpsAgent: new https.Agent({
				// disabling HTTPS validation when talking to BrewBlox
				rejectUnauthorized: false,
			})
		})
		.then(res => {
			const data = new Map(res.data.map(metric => [metric.metric, metric.value]))

			config.devices.forEach(device => {
				let streamData = {}

				Object.assign(
					streamData,
					{ name: device.name },
					device.constants,
					Object.fromEntries(
						Object
							.entries(device.fields)
							.map(([key, field]) => [key, data.get(field)])
					),
				)

				axios
					.post(streamUrl, streamData)
					.then(res => {
						if (res.status == 200) {
							console.log(`${new Date().toISOString()} [${device.name}] posted successfully (HTTP ${res.status})`)
						} else {
							console.error(`${new Date().toISOString()} [${device.name}] error (HTTP ${res.status})`)
						}
					})
					.catch(error => {
						console.error(`${new Date().toISOString()} [${device.name}] error`, error)
					})
			})
		})
		.catch(error => {
			console.error(`${new Date().toISOString()} Error fetching from BrewBlox:`, error)
		})
}

setInterval(pushToBrewfather, parseDuration(config.interval))
pushToBrewfather()
