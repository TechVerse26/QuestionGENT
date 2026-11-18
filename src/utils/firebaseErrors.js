// On the free Firebase (Spark) plan Firestore stops answering when the daily quota (reads / writes / deletes) is used up and
// reports `resource-exhausted` ("Quota exceeded."). Show people a clear message instead of a cryptic code.
// The daily quota resets around midnight Pacific time = about 1-2 PM in Bangladesh.
export const QUOTA_MESSAGE = 'The free daily database limit is used up. Loading and saving are paused until it resets (around 1–2 PM Bangladesh time). Changes made now may not be saved.';

const QUOTA_RE = /quota exceeded|resource[-_ ]exhausted/i;

export const isQuotaMessage = (text) => QUOTA_RE.test(String(text ?? ''));

export const isQuotaError = (e) => !!e && (e.code === 'resource-exhausted' || e.code === 'firestore/resource-exhausted' || isQuotaMessage(e.message));
