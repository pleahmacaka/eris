const unsupported = () => false

module.exports =
  process.platform === "win32"
    ? require("./binding.js").isScreenSharing
    : unsupported
