import { describe, expect, test } from 'bun:test';
import { readFunctionError, shouldRetryFunctionError } from './functionError';

function httpError(body: string, status: number) {
  return Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(body, { status }),
  });
}

describe('readFunctionError', () => {
  test('reads code, message and status from the JSON body', async () => {
    const error = httpError(
      JSON.stringify({ code: 'rate_limited', message: "You've hit today's recipe limit — back tomorrow." }),
      429,
    );
    expect(await readFunctionError(error)).toEqual({
      status: 429,
      code: 'rate_limited',
      message: "You've hit today's recipe limit — back tomorrow.",
    });
    // The body stays readable for later callers.
    expect((await readFunctionError(error)).code).toBe('rate_limited');
  });

  test('tolerates plain-text bodies, blank messages and missing context', async () => {
    expect(await readFunctionError(httpError('Unauthorized', 401))).toEqual({
      status: 401,
      code: undefined,
      message: undefined,
    });
    expect((await readFunctionError(httpError(JSON.stringify({ code: 'x', message: '  ' }), 500))).message)
      .toBeUndefined();
    expect(await readFunctionError(new Error('Failed to send a request to the Edge Function'))).toEqual({});
    expect(await readFunctionError(undefined)).toEqual({});
  });
});

describe('shouldRetryFunctionError', () => {
  test('skips the re-ask for auth and rate-limit rejections only', () => {
    for (const status of [401, 403, 429]) expect(shouldRetryFunctionError({ status })).toBe(false);
    for (const status of [422, 500, 503, undefined]) expect(shouldRetryFunctionError({ status })).toBe(true);
  });
});
