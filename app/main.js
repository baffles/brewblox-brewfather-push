const axios = require('axios')
const https = require('https')
const parseDuration = require('parse-duration')
const winston = require('winston')

const config = JSON.parse(require('fs').readFileSync(process.argv[2] ?? 'config.json'))

const logger = winston.createLogger({
	level: config.log_level ?? 'info',
	format: winston.format.combine(
		winston.format.colorize(),
		winston.format.timestamp(),
		winston.format.simple(),
	),
	transports: [
		new winston.transports.Console({
			handleExceptions: true,
			handleRejections: true,
		}),
	],
})

const metricsUrl = new URL('history/timeseries/metrics', config.brewblox_url)
logger.verbose(`using metrics URL ${metricsUrl}`)

const streamUrls = (() => {
	let urls = config.stream_urls ? config.stream_urls.slice().map(url => new URL(url)) : []

	if (config.brewfather_stream_id) {
		urls.push(new URL(`https://log.brewfather.net/stream?id=${config.brewfather_stream_id}`))
	}

	if (config.brewers_friend_api_key) {
		urls.push(new URL(`https://log.brewersfriend.com/stream/${config.brewers_friend_api_key}`))
	}

	return urls
})();

const metricsFields = config.devices.flatMap(device => Object.values(device.fields))
logger.verbose(`will request metrics: ${metricsFields}`)

function pushStreams() {
	const request = {
		fields: config.devices.flatMap(device => Object.values(device.fields)),
	}
	logger.debug(`requesting metrics from ${metricsUrl.hostname}...`, { payload: request })

	const metricsProfiler = logger.startTimer()

	axios
		.post(metricsUrl.href, request, {
			httpsAgent: new https.Agent({
				// disabling HTTPS validation when talking to BrewBlox
				rejectUnauthorized: false,
			})
		})
		.then(res => {
			metricsProfiler.done({ level: 'verbose', message: 'got metrics from BrewBlox', payload: res.data })

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

				logger.debug(`stream publish payload for ${device.name}:`, { payload: streamData })

				streamUrls.forEach(streamUrl => {
					const host = streamUrl.hostname
					const streamLog = logger.child({ device: device.name, host })
					const deviceStreamProfiler = streamLog.startTimer()

					streamLog.debug(`publishing to ${host}...`)

					axios
						.post(streamUrl.href, streamData)
						.then(res => {
							if (res.status == 200) {
								deviceStreamProfiler.done({ level: 'info', message: `posted successfully (HTTP ${res.status})` })
							} else {
								deviceStreamProfiler.done({ level: 'error', message: `unsuccessful metrics post (HTTP ${res.status})` })
							}

							streamLog.debug(`response from ${host}`, { response: res.data })
						})
						.catch(error => {
							if (error.response) {
								deviceStreamProfiler.done({ level: 'error', message: `error posting metrics (HTTP ${error.response.status})` })
								streamLog.debug(`response from ${host}`, { response: error.response.data })
							} else {
								deviceStreamProfiler.done({ level: 'error', message: `error posting metrics`, errorCode: error.code, error: error.message })
							}
						})
				})
			})
		})
		.catch(error => {
			if (error.response) {
				metricsProfiler.done({ level: 'error', message: `error fetching metrics from BrewBlox (HTTP ${error.response.status})` })
				logger.debug('response from BrewBlox', { response: error.response.data })
			} else {
				metricsProfiler.done({ level: 'error', message: 'error fetching metrics from BrewBlox', errorCode: error.code, error: error.message })
			}
		})
}

logger.info(`Starting publisher; publishing from ${metricsUrl.hostname} to ${streamUrls.map(url => url.hostname)}`)

setInterval(pushStreams, parseDuration(config.interval))
pushStreams()
