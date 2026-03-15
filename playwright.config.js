const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
    testDir: './tests',
    testMatch: '*.pw.test.js',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:8080',
        headless: true,
    },
    webServer: {
        command: 'npx serve -l 8080 --no-clipboard',
        port: 8080,
        reuseExistingServer: true,
    },
});
