import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock slack client before importing
vi.mock('../src/slack/app.js', () => ({
  slackClient: {
    chat: {
      postMessage: vi.fn().mockResolvedValue({ ts: '1234567890.123456' }),
    },
  },
}));

// Mock config
vi.mock('../src/config.js', () => ({
  config: {
    slack: { botToken: 'test', signingSecret: 'test', channelId: 'C123' },
    log: { level: 'silent' },
  },
}));

import { sendToSlack } from '../src/slack/messages.js';
import { slackClient } from '../src/slack/app.js';

describe('sendToSlack', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send a message when no articles', async () => {
    await sendToSlack([]);
    expect(slackClient.chat.postMessage).toHaveBeenCalledTimes(1);
    expect(slackClient.chat.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: 'C123',
        text: expect.stringContaining('없습니다'),
      }),
    );
  });

  it('should send header + thread reply for each article', async () => {
    await sendToSlack([
      {
        title: 'Test Brain Study',
        url: 'https://example.com/test',
        snippet: 'A test snippet',
        content: 'Full article content about brain health.',
      },
    ]);

    // Header message + 1 thread reply
    expect(slackClient.chat.postMessage).toHaveBeenCalledTimes(2);
  });

  it('should include article count in header', async () => {
    await sendToSlack([
      { title: 'Article 1', url: 'https://example.com/1', snippet: 's', content: 'content 1' },
      { title: 'Article 2', url: 'https://example.com/2', snippet: 's', content: 'content 2' },
    ]);

    const headerCall = vi.mocked(slackClient.chat.postMessage).mock.calls[0][0];
    expect(headerCall.text).toContain('2건');
  });

  it('should truncate long content', async () => {
    const longContent = 'x'.repeat(1000);
    await sendToSlack([
      { title: 'Long Article', url: 'https://example.com', snippet: 's', content: longContent },
    ]);

    const threadCall = vi.mocked(slackClient.chat.postMessage).mock.calls[1][0];
    const blocks = threadCall.blocks as any[];
    const contentBlock = blocks.find((b: any) => b.type === 'section' && b.text?.text && !b.text.text.startsWith('*<'));
    expect(contentBlock.text.text.length).toBeLessThan(1000);
    expect(contentBlock.text.text).toContain('...');
  });
});
