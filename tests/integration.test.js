const axios = require('axios');
const cheerio = require('cheerio');
const nock = require('nock');
const app = require('../app'); // use exported app
const { sampleHtmlWithYale } = require('./test-utils');

const TEST_PORT = 3099;
let server;

describe('Integration Tests', () => {
  beforeAll(async () => {
    // Block all outbound net connects EXCEPT to our local test server
    nock.disableNetConnect();
    nock.enableNetConnect(/(127\.0\.0\.1|localhost)/);

    // Start the app on a test port (no need to spawn/cp/sed)
    server = app.listen(TEST_PORT);
  }, 10000);

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    nock.cleanAll();
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test(
    'Should replace Yale with Fale in fetched content',
    async () => {
      // Mock external target
      nock('https://example.com').get('/').reply(200, sampleHtmlWithYale);

      // Call our proxy
      const response = await axios.post(`http://127.0.0.1:${TEST_PORT}/fetch`, {
        url: 'https://example.com/',
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);

      const $ = cheerio.load(response.data.content);
      expect($('title').text()).toBe('Fale University Test Page');
      expect($('h1').text()).toBe('Welcome to Fale University');
      expect($('p').first().text()).toContain('Fale University is a private');

      // URLs should remain unchanged
      const links = $('a');
      let hasYaleUrl = false;
      links.each((i, link) => {
        const href = $(link).attr('href');
        if (href && href.includes('yale.edu')) {
          hasYaleUrl = true;
        }
      });
      expect(hasYaleUrl).toBe(true);

      // Link text should be changed
      expect($('a').first().text()).toBe('About Fale');
    },
    10000
  );

  test('Should handle missing URL parameter', async () => {
    try {
      await axios.post(`http://127.0.0.1:${TEST_PORT}/fetch`, {});
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      expect(error.response.status).toBe(400);
      expect(error.response.data.error).toBe('URL is required');
    }
  });
});
