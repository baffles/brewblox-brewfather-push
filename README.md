# Brewblox Stream Publisher

_Brewblox Stream Publisher_ is a simple service to publish fermentation data from Brewblox to Brewfather and Brewer's Friend device streams.
The streaming format of both streams are compatible with each other, and this service is able to push to arbitrary stream URLs for other services, provided they use a compatible data format.

For brewers with multiple fermentations going at the same time, this service supports publishing stream data for multiple devices.

## Deploying

This service can easily be deployed and run as a Docker service. An example `docker-compose.yml` file is provided for ease of setup.
To get going, just grab `docker-compose.yml` and `config.json.sample` from the root of the repository and put them into a folder. Rename `config.json.sample` to `config.json`, modify it as appropriate (see _Configuration_ section below), and then do a `docker-compose up -d` to kick things off.
After this, the service will automatically run and restart if it goes down.

### Updating

The default `docker-compose.yml` file references the `latest` tag. To update, you can just run `docker-compose pull` followed by `docker-compose up -d` to update to the latest version. You may also modify `docker-compose.yml` to specify different tags to get other versions.

## Configuration

`config.json.sample` contains examples of typical configuration options.

### `log_level` **(optional)**

This setting controls the log level. By default, the log level is `'info'`.
For possible values, see the [Winston docs](https://www.npmjs.com/package/winston#logging-levels).

### `brewblox_url` **(required)**

This setting sets the URL for the Brewblox web server. HTTP or HTTPS can be used.
_HTTPS certificates are not validated for Brewblox URLs_. Since most deployments will likely be using a self-signed certificate, and since no sensitive data is sent, skipping HTTPS certificate validation poses a minimal security risk.

### `brewfather_stream_id` **(optional)**

This setting sets the Brewfather stream ID to publish to.
On the [Brewfather settings page](https://web.brewfather.app/tabs/settings), enable _Custom Stream_ in the _Power-ups_ section.
After enabling, a URL will appear in the format of `http://log.brewfather.net/stream?id=<some ID>`. Copy the ID value to this setting to enable publishing data to Brewfather.

### `brewers_friend_api_key` **(optional)**

This setting sets the Brewer's Friend stream ID to publish to.
You can find your API key on the [Brewer's Friend integrations page](https://www.brewersfriend.com/homebrew/profile/integrations). Copy the API key to this setting to enable publishign data to Brewer's Friend.

### `stream_urls` **(optional)**

This setting can be used to provide raw stream endpoint URLs if you're pushing to a compatible service. **Delete this setting** if you're just using `brewfather_stream_id` or `brewers_friend_api_key` and don't have a custom stream to publish to.

Technically, you can specify the Brewfather or Brewer's Friend stream URLs here as well and forego setting the specific configuration settings for them. There is no need to do both though, that will cause rate limiting issues as this service will publish twice per interval.

### `interval` **(required)**

This controls the interval at which to publish data. Both Brewfather and Brewer's Friend suggest a 15 minute interval, so the sample value should be sufficient for most users.

### `devices` **(required)**

An array of devices to publish data for. Each set of beer sensors should be published as its own device; this will allow you to attach data to multiple beers simultaneously.

Each element in the array is an object with the following values:

#### `name` **(required)**

This is the name for the device. This is what the device will be identified as on the target service.

#### `constants` **(required)**

The values in this object will be copied verbatim to the stream data.
This is useful for constant values such as the units. See the _Data_ section below for more information on these fields.

#### `fields` **(required)**

The keys in this object should match the keys to be used in the stream data.
The value for the key specifies what value to pull from Brewblox to populate the field with. These values match up with what you would query for when using Grafana. More information on that can be found in the [Brewblox documentation](https://www.brewblox.com/user/grafana.html#queries).

## Data

The data published to the stream, at the time of this writing, seems to be pretty consistent between Brewfather and Brewer's Friend.

The fields that will likely be of most interest will be:

* `name` -- this is provided by the device name value above and need not be specified in `constants` or `fields`.
* `temp` -- the temperature of the beer, you'll want to map this to a Brewblox field
* `aux_temp` -- the temperature of the fridge/fermentation chamber, you'll want to map this to a Brewblox field
* `temp_unit` -- the temperature unit used (likely `C` or `F`) for the temperature fields, you'll probably set this to the correct value in `constants`
* `gravity` -- the gravity of the beer; if you have an integration that provides this (such as Tilt), then you'll want to map this to the relevant Brewblox field
* `gravity_unit` -- the gravity unit used (likely `G` or `P`) for the gravity field 

There are extra fields available that may make sense. Feel free to add or omit any fields you want. Links to the Brewfather and Brewer's Friend documentation are provided below.

### Brewfather

Please see the [Brewfather documentation](https://docs.brewfather.app/integrations/custom-stream) for details on the data fields supported.

### Brewer's Friend

Please see the [Brewer's Friend documentation](https://docs.brewersfriend.com/api/stream) for details on the data fields supported.

## Development

This service can easily be built locally and deployed during development. An example docker-compose.yml file is provided in the `app` folder for ease of setup.
To get going, do the following:

* Clone the repository
* Copy `config.json.sample` to `app/config.json` and modify
* Run `docker-compose build`
* Run `docker-compose up` or `docker-compose up -d`

After making changes/modifications, just do a `docker-compose build` followed by another `docker-compose up` to run the modified version.
