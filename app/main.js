const axios = require('axios')
const https = require('https')
const parseDuration = require('parse-duration')

const config = JSON.parse(require('fs').readFileSync(process.argv[2] ?? 'config.json'))

const metricsUrl = new URL('history/timeseries/metrics', config.brewblox_url)

const streamUrls = (() => {
	let urls = config.stream_urls ? config.stream_urls.slice() : []

	if (config.brewfather_stream) {
		urls.push(`https://log.brewfather.net/stream?id=${config.brewfather_stream}`)
	}

	if (config.brewers_friend_stream) {
		urls.push(`https://log.brewersfriend.com/stream/${config.brewers_friend_stream}`)
	}

	return urls
})();

function pushStreams() {
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

				streamUrls.forEach(streamUrl => {
					const host = new URL(streamUrl).hostname
					const prefix = `${new Date().toISOString()} [${device.name}: ${host}]`

					axios
						.post(streamUrl, streamData)
						.then(res => {
							if (res.status == 200) {
								console.log(`${prefix} posted successfully (HTTP ${res.status})`)
							} else {
								console.error(`${prefix} error (HTTP ${res.status})`)
							}
						})
						.catch(error => {
							console.error(`${prefix} error`, error)
						})
				})
			})
		})
		.catch(error => {
			console.error(`${new Date().toISOString()} Error fetching from BrewBlox:`, error)
		})
}

setInterval(pushStreams, parseDuration(config.interval))
pushStreams()
