const axios = require('axios')
const https = require('https')
const parseDuration = require('parse-duration')

const config = JSON.parse(require('fs').readFileSync(process.argv[2] ?? 'config.json'))

const metricsUrl = new URL('history/timeseries/metrics', config.brewblox_url)

const streamUrls = (() => {
	let urls = config.stream_urls ? config.stream_urls.slice() : []

	if (config.brewfather_stream_id) {
		urls.push(`https://log.brewfather.net/stream?id=${config.brewfather_stream_id}`)
	}

	if (config.brewers_friend_api_key) {
		urls.push(`https://log.brewersfriend.com/stream/${config.brewers_friend_api_key}`)
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
			console.debug(`Got ${res.data} from BrewBlox`)

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

				console.debug(`Will publish ${JSON.stringify(streamData)}`)

				streamUrls.forEach(streamUrl => {
					const host = new URL(streamUrl).hostname
					const prefix = `${new Date().toISOString()} [${device.name}: ${host}]`

					axios
						.post(streamUrl, streamData)
						.then(res => {
							if (res.status == 200) {
								console.log(`${prefix} posted successfully (HTTP ${res.status})`)
								console.debug(`${prefix} got ${res.data}`)
							} else {
								console.error(`${prefix} error (HTTP ${res.status})`)
							}
						})
						.catch(error => {
							if (error.response) {
								console.error(`${prefix} error (HTTP ${error.response.status})`, error.response.data)
							} else {
								console.error(`${prefix} error`, error)
							}
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
