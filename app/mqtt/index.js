const mqtt = require('async-mqtt');
const log = require('../log');

const {
    mqttUrl,
    mqttUser,
    mqttPassword,
    mqttBaseTopic,
    hassDiscovery,
} = require('../config');

const { publishConfigurationForHassDiscovery } = require('./hass');

/**
 * True when hass discovery configuration has been published.
 * @type {boolean}
 */
let discoveryConfigurationPublished = false;

/**
 * MQT Client.
 */
let client;

/**
 * Get frame topic.
 * @param nodeID
 * @returns {string}
 */
function getFrameTopic(nodeID) {
    return `${mqttBaseTopic}/${nodeID}`;
}

/**
 * Connect to MQTT broker.
 */
async function connect() {
    const options = {};
    if (mqttUser) {
        options.username = mqttUser;
    }
    if (mqttPassword) {
        options.password = mqttPassword;
    }
    log.info(`Connecting to MQTT broker [${mqttUrl}]`);
    try {
        client = await mqtt.connectAsync(mqttUrl, options);
        log.info(`Connected to MQTT broker [${mqttUrl}]`);
    } catch (e) {
        log.error(`MQTT connection error [${e.message}]`);
        throw e;
    }
    try {
        if (client) {
            client.on('connect', () => {
                // Workaround to avoid reconnect issue (see https://github.com/mqttjs/MQTT.js/issues/1213)
                // eslint-disable-next-line no-underscore-dangle
                client._client.options.properties = {};
            });
            client.on('reconnect', () => {
                log.info('Reconnecting to the MQTT broker...');
            });
            client.on('error', (err) => {
                log.warn(`Error when publishing to the mqtt broker (${err.message})`);
            });
        }
    } catch (e) {
        log.error(`MQTT connection error [${e.message}]`);
        throw e;
    }
}

/**
 * Disconnect from MQTT broker.
 */
async function disconnect() {
    log.info(`Disconnecting from MQTT broker [${mqttUrl}]`);
    try {
        await client.end();
        log.info(`Disconnected from MQTT broker [${mqttUrl}]`);
    } catch (e) {
        log.error(`Error on disconnecting from MQTT broker [${mqttUrl}]`);
        throw e;
    }
}

/**
 * Publish RPICT frame to MQTT broker.
 * @param {*} frame
 */
async function publishFrame(frame) {
    const nodeID = frame.NodeID;
    if (!nodeID) {
        log.warn('Cannot publish a frame without NodeID property');
        log.debug(frame);
    } else {
        if (hassDiscovery && !discoveryConfigurationPublished) {
            try {
                await publishConfigurationForHassDiscovery(client, nodeID, frame);
                discoveryConfigurationPublished = true;
            } catch (e) {
                log.warn(`Unable to publish discovery configuration (${e.message})`);
            }
        }
        const frameTopic = getFrameTopic(nodeID);
        log.debug(`Publish frame to topic [${frameTopic}]`);
        log.debug(frame);
        try {
            await client.publish(frameTopic, JSON.stringify(frame));
        } catch (e) {
            log.warn(`Unable to publish frame to ${frameTopic} (${e.message})`);
        }
    }
}

module.exports = {
    connect,
    disconnect,
    publishFrame,
};
