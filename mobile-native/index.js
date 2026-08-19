// Entry point. Uses require() (not import) so execution order is preserved:
// the localStorage polyfill must be installed BEFORE any module that reads
// localStorage at load time (theme.js, i18n.js) is required through ./App.

require("./src/polyfill"); // side-effect: installs global.localStorage

const { registerRootComponent } = require("expo");
const App = require("./App").default;

registerRootComponent(App);
