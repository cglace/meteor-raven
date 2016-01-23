/**
 * Raven node.js and JavaScript logger for Meteor.
 */
'use strict';
var isRavenEnabled = false;
var trackUser = false;
var client;

/**
 * Start the logger.
 *
 * Options:
 *  * trackUser: set to true: include in each message the Meteor user's ID and
 *               username, if they're logged in.
 *               NOTE: Applies to the client only.
 *  * patchGlobal: set to true or a function: enables catching global uncaught
 *                 exceptions on the server. If this is set to a function, that
 *                 function is invoked after the exception is sent to Sentry.
 *                 The default callback calls `exit(1)`.
 *                 NOTE: Applies to the server only.
 *
 * @param settings object      Client & Server DSN strings. { client: 'dsn here', server: 'dsn here' }
 * @param options object
 */
function initialize(settings, options) {
  settings.client = settings.client || false;
  settings.server = settings.server || false;
  options = options || {};
  trackUser = typeof options.trackUser !== 'undefined' && options.trackUser === true;

  if (Meteor.isClient && settings.client !== false) {
    debug('Client initialize ' + settings.client);
    client = window.Raven;
    client.config(settings.client, {}).install();
    isRavenEnabled = true;
  }
  if (Meteor.isServer && settings.server !== false) {
    debug('Server initialize ' + settings.server);
    var Raven = Npm.require('raven');
    client = new Raven.Client(settings.server);
    addServerOptions(options);
    isRavenEnabled = true;
  }
}

/**
 * Log a message in Raven.
 *
 * @param message string|Error  Message to log
 * @param attrs object          Optionally add attributes such as 'extra', 'tags', 'fingerprint', and 'level'
 */
function log(message, attrs) {
  if (!isRavenEnabled) {
    debug('RavenLogger is not enabled');
    return;
  }

  if (trackUser && Meteor.isClient) {
    setUser(Meteor.user()); // temp work-around because user() is not set on load but reactive
  }

  if (message instanceof Error) {
    client.captureException(message, attrs);
  } else {
    client.captureMessage(message, attrs );
  }
}

/**
 * Add options to the server client.
 *
 * @param options object
 */
function addServerOptions(options) {
  if (options.patchGlobal) {
    var callback = function() {
      process.exit(1);
    };
    if (typeof options.patchGlobal === 'function') {
      callback = options.patchGlobal;
    }
    client.patchGlobal(callback);
    debug('Patched global error handler');
  }
}

/**
 * Set the currently logged in user; for correlating error reports to a user.
 *
 * @param user User|null
 */
function setUser(user) {
  if (Meteor.isServer) {
    return;
  }

  if (user === null || typeof user === 'undefined') { // no one is logged in
    window.Raven.setUser(); // remove data if present
    return;
  }

  window.Raven.setUser({
    id: user._id,
    username: user.username
  });
}

/**
 * Log debugger.
 */
function debug(message) {
  //console.log(message);
}

RavenLogger = {
  initialize: initialize,
  log: log
};
