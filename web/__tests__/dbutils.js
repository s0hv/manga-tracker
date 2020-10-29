import { unsignCookie } from './utils';

import db from '../db';

export const sessionExists = async (sessionId, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId);
  }
  expect(sessionId).not.toBeFalse();

  const sql = 'SELECT 1 FROM sessions WHERE session_id=$1';
  const res = await db.query(sql, [sessionId]);
  return res.rowCount !== 0;
};

export const authTokenExists = async (tokenValue) => {
  tokenValue = decodeURIComponent(tokenValue);
  const [lookup, token, uuidBase64] = tokenValue.split(';', 3);
  const uuid = Buffer.from(uuidBase64, 'base64').toString('ascii');
  const sql = `SELECT 1
               FROM auth_tokens INNER JOIN users u ON auth_tokens.user_id = u.user_id 
               WHERE user_uuid=$1 AND lookup=$2 AND hashed_token=encode(digest($3, 'sha256'), 'hex')`;

  const res = await db.query(sql, [uuid, lookup, token]);
  return res.rowCount !== 0;
};

export const spyOnDb = () => jest.spyOn(db, 'query');

export const sessionAssociatedWithUser = async (sessionId, encrypted=true) => {
  if (encrypted) {
    sessionId = unsignCookie(sessionId);
  }
  expect(sessionId).not.toBeFalse();

  const sql = 'SELECT user_id FROM sessions WHERE session_id=$1';
  const res = await db.query(sql, [sessionId]);
  return res.rowCount !== 0 && res.rows[0].user_id !== null;
};

export const authTokenCount = async (uuid) => {
  const sql = `SELECT 1
               FROM auth_tokens INNER JOIN users u ON auth_tokens.user_id = u.user_id
               WHERE user_uuid=$1`;

  const res = await db.query(sql, [uuid]);
  return res.rowCount;
};

export const userSessionCount = async (uuid) => {
  const sql = `SELECT 1
               FROM sessions INNER JOIN users u ON sessions.user_id = u.user_id
               WHERE user_uuid=$1`;

  const res = await db.query(sql, [uuid]);
  return res.rowCount;
};
