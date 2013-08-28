// This file deals with storing a login token and user id in the
// browser's localStorage facility. It polls local storage every few
// seconds to synchronize login state between multiple tabs in the same
// browser.

var lastLoginTokenWhenPolled;

// Login with a Meteor access token. This is the only public function
// here.
Meteor.loginWithToken = function (token, callback) {
  Accounts.callLoginMethod({
    methodArguments: [{resume: token}],
    userCallback: callback});
};

// Semi-internal API. Call this function to re-enable auto login after
// if it was disabled at startup.
Accounts._enableAutoLogin = function () {
  autoLoginEnabled = true;
  pollStoredLoginToken();
};


///
/// STORING
///

// Key names to use in localStorage
var loginTokenKey = "Meteor.loginToken";
var userIdKey = "Meteor.userId";

// Call this from the top level of the test file for any test that does
// logging in and out, to protect multiple tabs running the same tests
// simultaneously from interfering with each others' localStorage.
Accounts._isolateLoginTokenForTest = function () {
  loginTokenKey = loginTokenKey + Random.id();
  userIdKey = userIdKey + Random.id();
};

storeLoginToken = function(userId, token) {
  Meteor._localStorage.setItem(userIdKey, userId);
  Meteor._localStorage.setItem(loginTokenKey, token);

  // to ensure that the localstorage poller doesn't end up trying to
  // connect a second time
  lastLoginTokenWhenPolled = token;
};

unstoreLoginToken = function() {
  Meteor._localStorage.removeItem(userIdKey);
  Meteor._localStorage.removeItem(loginTokenKey);

  // to ensure that the localstorage poller doesn't end up trying to
  // connect a second time
  lastLoginTokenWhenPolled = null;
};

// This is private, but it is exported for now because it is used by a
// test in accounts-password.
//
var storedLoginToken = Accounts._storedLoginToken = function() {
  return Meteor._localStorage.getItem(loginTokenKey);
};

var storedUserId = function() {
  return Meteor._localStorage.getItem(userIdKey);
};


///
/// AUTO-LOGIN
///

if (autoLoginEnabled) {
  // Immediately try to log in via local storage, so that any DDP
  // messages are sent after we have established our user account
  var token = storedLoginToken();
  if (token) {
    // On startup, optimistically present us as logged in while the
    // request is in flight. This reduces page flicker on startup.
    var userId = storedUserId();
    userId && Meteor.connection.setUserId(userId);
    Meteor.loginWithToken(token, function (err) {
      if (err) {
        Meteor._debug("Error logging in with token: " + err);
        makeClientLoggedOut();
      }
    });
  }
}

// Poll local storage every 3 seconds to login if someone logged in in
// another tab
lastLoginTokenWhenPolled = token;
var pollStoredLoginToken = function() {
  if (! autoLoginEnabled)
    return;

  var currentLoginToken = storedLoginToken();

  // != instead of !== just to make sure undefined and null are treated the same
  if (lastLoginTokenWhenPolled != currentLoginToken) {
    if (currentLoginToken)
      Meteor.loginWithToken(currentLoginToken); // XXX should we pass a callback here?
    else
      Meteor.logout();
  }
  lastLoginTokenWhenPolled = currentLoginToken;
};

setInterval(pollStoredLoginToken, 3000);