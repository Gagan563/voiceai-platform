const Store = require("electron-store");

const encryptionKey =
  process.env.VOICEAI_STORE_KEY ||
  "voiceai-platform-local-secure-store-v1-change-before-release";

const store = new Store({
  name: "voiceai-secure-settings",
  encryptionKey,
  clearInvalidConfig: true,
});

function get(key) {
  return store.get(key);
}

function set(key, value) {
  store.set(key, value);
}

module.exports = {
  get,
  set,
};
